// scripts/core/engine/attack.js
// SW5E Helper — Attack workflow action

import { getWeaponById } from "../adapter/sw5e.js";
import { DiceRoller } from "roller.js";          // new utility
import { CheckEvaluator } from "evaluator.js";   // new utility

const DEBUG = true;
const log = (...a) => DEBUG && console.log("SW5E Helper | AttackAction:", ...a);
const warn = (...a) => console.warn("SW5E Helper | AttackAction:", ...a);
const err  = (...a) => console.error("SW5E Helper | AttackAction:", ...a);

const signed = (n) => `${n >= 0 ? "+" : ""}${Number(n)}`;
const toBool = (v) => v === true || v === "true";

/** Infer default attack ability from item (ranged/finesse → DEX else STR). */
function deriveDefaultAbility(item) {
  const sys = item?.system ?? {};
  if (sys.ability) return sys.ability;
  const type = sys.actionType || sys.activation?.type;
  const ranged = type?.startsWith?.("r");
  const finesse = sys.properties?.fin || sys.properties?.finesse;
  return (ranged || finesse) ? "dex" : "str";
}

/** Build advantage/disadvantage d20 term. */
function advD20(adv) {
  if (adv === "adv") return "2d20kh1";
  if (adv === "dis") return "2d20kl1";
  return "1d20";
}

/** Normalize user attack modifiers into a +(... ) chunk if needed. */
function normalizeAtkExpr(expr) {
  const s = String(expr ?? "").trim();
  if (!s) return "";
  if (/^[+\-]/.test(s)) return s;      // already signed
  return `+ (${s})`;
}

/** Standardized result envelope */
function baseResult() {
  return {
    ok: false,
    type: "attack",
    errors: [],
    warnings: [],
    meta: {},
    rolls: [],
    targets: []
  };
}

/**
 * AttackAction
 * Static workflow with validate → permission → execute
 */
export class AttackAction {
  /**
   * Validate inputs.
   * @param {object} context { actor, weaponId, state }
   * @returns {{ok:boolean, errors:string[], warnings:string[]}}
   */
  static validate(context = {}) {
    const out = { ok: true, errors: [], warnings: [] };
    const { actor, weaponId, state } = context;

    if (!actor || !actor.actor) {
      out.ok = false; out.errors.push("No actor provided or actor wrapper missing.");
    }
    if (!weaponId) {
      out.ok = false; out.errors.push("No weaponId provided.");
    }
    if (!state) {
      out.ok = false; out.errors.push("No attack state provided.");
    }

    // Selected token requirement
    const selected = canvas?.tokens?.controlled?.[0];
    if (!selected) {
      out.ok = false; out.errors.push("A token must be selected to start an attack.");
    }

    return out;
  }

  /**
   * Permission check: GM or owner of the selected actor.
   * @param {object} context
   * @returns {{ok:boolean, reason?:string}}
   */
  static checkPermission(context = {}) {
    try {
      const a = context.actor?.actor ?? null;
      if (!a) return { ok: false, reason: "No actor found for permission check." };
      if (game.user?.isGM) return { ok: true };
      const lvl = a?.ownership?.[game.userId] ?? (a.isOwner ? 3 : 0);
      return { ok: lvl >= (CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3) };
    } catch (e) {
      return { ok: false, reason: e?.message || "Permission check failed." };
    }
  }

  /**
   * Execute the attack workflow.
   * @param {object} context { actor, weaponId, state }
   * @returns {Promise<object>} standardized result
   */
  static async execute(context = {}) {
    const result = baseResult();
    try {
      // 1) Validate
      const v = this.validate(context);
      if (!v.ok) { result.errors.push(...v.errors); return result; }

      // 2) Permission
      const p = this.checkPermission(context);
      if (!p.ok) { result.errors.push(p.reason || "Permission denied."); return result; }

      const { actor, weaponId, state } = context;
      const item = getWeaponById(actor.actor, weaponId);
      if (!item) {
        result.errors.push("Weapon not found on actor.");
        return result;
      }

      // 3) Resolve attack ability + bonuses (preserve current engine behavior) :contentReference[oaicite:3]{index=3}
      const usingSmart = toBool(state.smart);
      const abilityKey = state.ability || deriveDefaultAbility(item);
      const abilityMod = usingSmart ? Number(state.smartAbility ?? 0) : (actor.abilities?.[abilityKey]?.mod ?? 0);
      const profBonus  = usingSmart ? Number(state.smartProf ?? 0) : (item.system?.proficient ? (actor.prof ?? 0) : 0);
      const itemAtk    = Number(item.system?.attackBonus || 0);

      // 4) Build attack roll formula
      const d20Term  = advD20(state.adv);
      const parts = [d20Term];
      if (abilityMod) parts.push(signed(abilityMod));
      if (profBonus)  parts.push(signed(profBonus));
      if (itemAtk)    parts.push(signed(itemAtk));
      const extra = normalizeAtkExpr(state.atkMods);
      if (extra) parts.push(extra);
      const formula = parts.join(" ");

      // 5) Data and targets
      const data = actor.actor.getRollData?.() ?? {};
      const targets = Array.from(game.user?.targets ?? []);
      const separate = toBool(state.separate);
      log("execute()", { abilityKey, abilityMod, profBonus, itemAtk, formula, separate, tgtCount: targets.length });

      // 6) Roll strategy using DiceRoller (DSN integrated) :contentReference[oaicite:4]{index=4}
      const rolls = [];
      const rows = [];

      const rollOnce = async () => {
        const r = await DiceRoller.roll(formula, data, { showDice: true });
        rolls.push(r);
        return r;
      };

      const evalVsToken = (roll, token) => {
        const ac = token?.actor?.system?.attributes?.ac?.value ?? token?.actor?.system?.attributes?.ac ?? null;
        const evalRes = CheckEvaluator.evaluateAttack(roll, Number.isFinite(ac) ? ac : null); // outcome + kept die + details :contentReference[oaicite:5]{index=5}
        const status = evalRes.status; // "crit"|"hit"|"miss"|"fumble" via convertAttackStatus mapping
        const natural = evalRes.d20Result ?? CheckEvaluator.getKeptDie(roll);
        return {
          tokenId: token.id,
          name: token.name,
          total: evalRes.total,
          natural,
          ac,
          status,
          detail: evalRes.details
        };
      };

      if (separate && targets.length > 1) {
        for (const t of targets) {
          const r = await rollOnce();
          rows.push(evalVsToken(r, t));
        }
      } else {
        const shared = await rollOnce();
        if (targets.length) {
          for (const t of targets) rows.push(evalVsToken(shared, t));
        }
      }

      // 7) Assemble tooltip info string (for header ⓘ)
      const info = `${abilityKey.toUpperCase()} ${signed(abilityMod)} + PROF ${signed(profBonus)} + ITEM ${signed(itemAtk)}`;

      // 8) Finalize result envelope
      result.ok = true;
      result.meta = {
        actorId: actor.id,
        itemId: item.id,
        itemName: item.name,
        advState: state.adv || "NONE",
        separate,
        formula
      };
      result.targets = rows;
      result.rolls = rolls;
      result.info = info;

      return result;
    } catch (e) {
      err(e);
      result.errors.push(e?.message || "AttackAction.execute failed.");
      return result;
    }
  }
}

export default AttackAction;
