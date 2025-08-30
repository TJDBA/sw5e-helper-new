/**
 * Attack Action Handler
 * Workflow action for attack roll execution with validation and permissions
 */

import { DiceRoller } from '../../core/dice/roller.js';
import { CheckEvaluator } from '../../core/dice/evaluator.js';
import { StateManager } from '../../core/state/manager.js';
import { AttackCardRenderer } from '../../ui/cards/card-renderer.js';
import { isDebug } from '../../config.js';

// Utility functions
const log = (...args) => isDebug() && console.log("SW5E Helper | AttackAction:", ...args);
const warn = (...args) => console.warn("SW5E Helper | AttackAction:", ...args);
const error = (...args) => console.error("SW5E Helper | AttackAction:", ...args);

const signed = (n) => `${n >= 0 ? "+" : ""}${Number(n)}`;
const toBool = (v) => v === true || v === "true";

/**
 * Infer default attack ability from item (ranged/finesse → DEX else STR)
 */
function deriveDefaultAbility(item) {
  const sys = item?.system ?? {};
  if (sys.ability) return sys.ability;
  const type = sys.actionType || sys.activation?.type;
  const ranged = type?.startsWith?.("r");
  const finesse = sys.properties?.fin || sys.properties?.finesse;
  return (ranged || finesse) ? "dex" : "str";
}

/**
 * Build advantage/disadvantage d20 term
 */
function advD20(adv) {
  if (adv === "advantage" || adv === "adv") return "2d20kh1";
  if (adv === "disadvantage" || adv === "dis") return "2d20kl1";
  return "1d20";
}

/**
 * Normalize user attack modifiers into a +(... ) chunk if needed
 */
function normalizeAtkExpr(expr) {
  const s = String(expr ?? "").trim();
  if (!s) return "";
  if (/^[+\-]/.test(s)) return s;
  return `+ (${s})`;
}

/**
 * Standardized result envelope
 */
function createResult() {
  return {
    ok: false,
    type: "attack",
    errors: [],
    warnings: [],
    meta: {},
    rolls: [],
    targets: [],
    info: ""
  };
}

export class AttackAction {
  static name = "attack";

  static validate(context = {}) {
    const result = { ok: true, errors: [], warnings: [] };
    const { actor, item, config } = context;

    if (!actor) { result.ok = false; result.errors.push("No actor provided"); }
    if (!item)  { result.ok = false; result.errors.push("No weapon item provided"); }
    if (!config){ result.ok = false; result.errors.push("No attack configuration provided"); }

    const selected = canvas?.tokens?.controlled?.[0];
    if (!selected) result.warnings.push("No token selected for attack");
    return result;
  }

  static checkPermission(context = {}) {
    try {
      const { actor } = context;
      if (!actor) return { ok: false, reason: "No actor found for permission check" };
      if (game.user?.isGM) return { ok: true };
      const ownership = actor.ownership?.[game.user.id] ?? (actor.isOwner ? 3 : 0);
      const required = CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
      return { ok: ownership >= required, reason: ownership < required ? "Insufficient permissions to control this actor" : undefined };
    } catch (err) {
      return { ok: false, reason: err?.message || "Permission check failed" };
    }
  }

  static async execute(context = {}) {
    const result = createResult();
    try {
      const validation = this.validate(context);
      if (!validation.ok) {
        result.errors.push(...validation.errors);
        result.warnings.push(...validation.warnings);
        return result;
      }

      const permission = this.checkPermission(context);
      if (!permission.ok) {
        result.errors.push(permission.reason || "Permission denied");
        return result;
      }

      const { actor, item, config, targets } = context;
      log("execute()", { actor: actor.name, item: item.name, config, targetCount: targets.length });

      const formula = this.buildEnhancedAttackFormula(actor, item, config);
      const attackResult = await this.executeAttackRolls({ actor, item, config, targets, formula });

      const state = StateManager.createAttackState({
        actor,
        item,
        config,
        targets: targets.map(t => ({
          sceneId: t.scene?.id ?? canvas.scene?.id,
          tokenId: t.id,
          name: t.name,
          img: t.document?.texture?.src,
          actorId: t.actor?.id,
          ac: t.actor?.system?.attributes?.ac?.value
        }))
      });

      if (!config.saveOnly && attackResult) {
        // Map per-target evaluations into state
        StateManager.updateAttackResults(state, attackResult.targets || []);
      } else if (config.saveOnly) {
        for (const target of state.targets) target.summary.status = "saveonly";
      }

      if (config.saveOnHit || config.saveOnly) {
        await this.processSaves(state, config, item);
      }

      const { message } = await this.createAttackMessage({ actor, state, rolls: attackResult?.rolls || [] });

      Hooks.callAll("sw5eHelper.attackComplete", { actor, item, config, targets, state, message, attackResult });

      result.ok = true;
      result.meta = {
        actorId: actor.id,
        itemId: item.id,
        itemName: item.name,
        formula: attackResult?.formula || formula,
        advState: config.adv || "normal",
        separate: !!config.separate
      };
      result.targets = attackResult?.targets || [];
      result.rolls = attackResult?.rolls || [];
      result.info = attackResult?.info || "";
      result.state = state;
      result.message = message;
      return result;

    } catch (err) {
      error("Execute failed:", err);
      result.errors.push(err?.message || "Attack execution failed");
      return result;
    }
  }

  static async compensate(context, result) {
    log("Attack compensation called (non-reversible action)", {
      actorId: context.actorId,
      itemId: context.itemId
    });
  }

  static idempotencyKey(context) {
    const parts = [
      'attack',
      context.actorId,
      context.itemId,
      context.targetIds?.join(',') || '',
      JSON.stringify(context.config || {})
    ];
    return btoa(parts.join('|')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  static async executeLegacy(options = {}) {
    const context = {
      actor: options.actor,
      item: options.item,
      config: options.config,
      targets: options.targets
    };
    const result = await this.execute(context);
    return {
      state: result.state,
      message: result.message,
      attackResult: {
        formula: result.meta?.formula,
        info: result.info,
        targets: result.targets,
        rolls: result.rolls
      }
    };
  }

  static async executeAttackRolls(options = {}) {
    const { actor, item, config, targets, formula } = options;

    const results = {
      formula,
      info: this.buildAttackInfo(actor, item, config),
      targets: [],
      rolls: []
    };

    if (config.saveOnly) return results;

    const rollData = actor.getRollData?.() ?? {};
    const separate = toBool(config.separate);
    log("executeAttackRolls", { formula, separate, targetCount: targets.length });

    if (separate && targets.length > 1) {
      for (const target of targets) {
        const roll = await DiceRoller.roll(formula, rollData, { showDice: true });
        results.rolls.push(roll);
        const evaluation = this.evaluateAttackVsTarget(roll, target);
        results.targets.push(evaluation);
      }
    } else {
      const roll = await DiceRoller.roll(formula, rollData, { showDice: true });
      results.rolls.push(roll);
      for (const target of targets) {
        const evaluation = this.evaluateAttackVsTarget(roll, target);
        results.targets.push(evaluation);
      }
    }
    return results;
  }

  static async rollAttack(options = {}) {
    const { actor, item, config, targets } = options;
    const formula = this.buildAttackFormula(actor, item, config);
    return this.executeAttackRolls({ ...options, formula });
  }

  static buildAttackInfo(actor, item, config) {
    const usingSmart = toBool(config.smart);
    const abilityKey = config.ability || deriveDefaultAbility(item);

    const abilityMod = usingSmart ?
      Number(config.smartAbility ?? 0) :
      (actor.system?.abilities?.[abilityKey]?.mod ?? 0);

    const profBonus = usingSmart ?
      Number(config.smartProf ?? 0) :
      this.getProficiencyBonus(actor, item, config);

    const itemBonus = this.getItemAttackBonus(item);

    return `${abilityKey.toUpperCase()} ${signed(abilityMod)} + PROF ${signed(profBonus)} + ITEM ${signed(itemBonus)}`;
  }

  static evaluateAttackVsTarget(roll, target) {
    const ac = this.getTargetAC(target);
    const evaluation = CheckEvaluator.evaluateAttack(roll, ac);
    return {
      sceneId: (target.scene?.id ?? canvas.scene?.id) ?? null, // added for state mapping
      tokenId: target.id,
      name: target.name || "Unknown Target",
      ac,
      total: evaluation.total,
      natural: evaluation.natural,
      status: evaluation.status,
      kept: CheckEvaluator.getKeptDie(roll),
      detail: evaluation.details,
      roll
    };
  }

  static buildEnhancedAttackFormula(actor, item, config) {
    const usingSmart = toBool(config.smart);
    const abilityKey = config.ability || deriveDefaultAbility(item);

    const abilityMod = usingSmart ?
      Number(config.smartAbility ?? 0) :
      (actor.system?.abilities?.[abilityKey]?.mod ?? 0);

    const profBonus = usingSmart ?
      Number(config.smartProf ?? 0) :
      this.getProficiencyBonus(actor, item, config);

    const itemBonus = this.getItemAttackBonus(item);

    const d20Term = advD20(config.adv);
    const parts = [d20Term];

    if (abilityMod) parts.push(signed(abilityMod));
    if (profBonus) parts.push(signed(profBonus));
    if (itemBonus) parts.push(signed(itemBonus));

    const extraMods = normalizeAtkExpr(config.atkMods);
    if (extraMods) parts.push(extraMods);

    return parts.join(" ");
  }

  static buildAttackFormula(actor, item, config) {
    return this.buildEnhancedAttackFormula(actor, item, config);
  }

  static getAbilityModifier(actor, item, config) {
    if (config.smart) return Number(config.smartAbility || 0);
    const abilityKey = config.ability || item.system?.ability || "str";
    return actor.system?.abilities?.[abilityKey]?.mod ?? 0;
  }

  static getProficiencyBonus(actor, item, config) {
    if (config.smart) return Number(config.smartProf || 0);
    const isProficient = this.isProficientWith(actor, item);
    return isProficient ? (actor.system?.attributes?.prof ?? 0) : 0;
  }

  static isProficientWith(actor, item) {
    return true;
  }

  static getItemAttackBonus(item) {
    return Number(item.system?.attackBonus ?? 0);
  }

  static applyAdvantage(formula, advState) {
    warn("applyAdvantage is deprecated, use advD20 in formula building instead");
    if (advState === "advantage") return formula.replace("1d20", "2d20kh1");
    if (advState === "disadvantage") return formula.replace("1d20", "2d20kl1");
    return formula;
  }

  static getTargetAC(target) {
    const actor = target._actor || game.actors?.get?.(target.actorId);
    return actor?.system?.attributes?.ac?.value ?? 10;
  }

  static async processSaves(state, config, item) {
    const saveAbility = config.saveAbility || config.save?.ability || "cha";
    let saveDC = config.save?.dc || config.save?.dcFormula || config.saveDcFormula;

    if (typeof saveDC === "string" && saveDC.trim()) {
      try {
        const actor = game.actors?.get(state.actorId);
        const rollData = actor?.getRollData?.() ?? {};
        const roll = new Roll(saveDC, rollData);
        await roll.evaluate({ async: true });
        saveDC = roll.total;
      } catch {
        saveDC = Number(saveDC) || this.calculateDefaultDC(state.actorId, saveAbility);
      }
    } else {
      saveDC = Number(saveDC) || this.calculateDefaultDC(state.actorId, saveAbility);
    }

    for (const target of state.targets) {
      if (config.saveOnHit || config.saveOnly) {
        target.save = { ability: saveAbility, dc: saveDC, formula: config.saveDcFormula || "" };
      }
    }
  }

  static calculateDefaultDC(actorId, abilityKey) {
    const actor = game.actors?.get(actorId);
    if (!actor) return 15;
    const abilityMod = actor.system?.abilities?.[abilityKey]?.mod ?? 0;
    const profBonus = actor.system?.attributes?.prof ?? 0;
    return 8 + profBonus + abilityMod;
  }

  static async createAttackMessage(options) {
    const { actor, state } = options;

    const html = await new AttackCardRenderer(state).render();
    const msg = await ChatMessage.create({
      content: html,
      speaker: ChatMessage.getSpeaker({ actor }), // use the provided actor
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });
    // Use your active module id as the flag scope
    await msg.setFlag('sw5e-helper-new', 'state', state);
    return { message: msg, html };
  }

  static init() {
    Hooks.on("sw5eHelper.preAttackRoll", this.onPreAttackRoll.bind(this));
    Hooks.on("sw5eHelper.postAttackRoll", this.onPostAttackRoll.bind(this));
  }

  static onPreAttackRoll(data) {
    console.log("SW5E Helper: Pre-attack roll", data);
  }

  static onPostAttackRoll(data) {
    console.log("SW5E Helper: Post-attack roll", data);
  }
}

export default AttackAction;
