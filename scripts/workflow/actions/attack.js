/**
 * Attack Action Handler
 * Workflow action for attack roll execution with validation and permissions
 */

import { DiceRoller } from '../../core/dice/roller.js';
import { CheckEvaluator } from '../../core/dice/evaluator.js';
import { StateManager } from '../../core/state/manager.js';
import { CardRenderer } from '../../ui/cards/renderer.js';
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
  /**
   * Validate attack context
   * @param {object} context - Attack context
   * @returns {object} Validation result
   */
  static validate(context = {}) {
    const result = { ok: true, errors: [], warnings: [] };
    const { actor, item, config, targets } = context;

    if (!actor) {
      result.ok = false;
      result.errors.push("No actor provided");
    }
    
    if (!item) {
      result.ok = false;
      result.errors.push("No weapon item provided");
    }
    
    if (!config) {
      result.ok = false;
      result.errors.push("No attack configuration provided");
    }

    // Check if token is selected for attack
    const selected = canvas?.tokens?.controlled?.[0];
    if (!selected) {
      result.warnings.push("No token selected for attack");
    }

    return result;
  }

  /**
   * Check permissions for attack
   * @param {object} context - Attack context
   * @returns {object} Permission result
   */
  static checkPermission(context = {}) {
    try {
      const { actor } = context;
      if (!actor) {
        return { ok: false, reason: "No actor found for permission check" };
      }
      
      if (game.user?.isGM) {
        return { ok: true };
      }
      
      const ownership = actor.ownership?.[game.user.id] ?? (actor.isOwner ? 3 : 0);
      const required = CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
      
      return { 
        ok: ownership >= required,
        reason: ownership < required ? "Insufficient permissions to control this actor" : undefined
      };
    } catch (err) {
      return { ok: false, reason: err?.message || "Permission check failed" };
    }
  }
  /**
   * Execute attack workflow with validation and permissions
   * @param {object} context - Execution context
   * @returns {Promise<object>} Attack result
   */
  static async execute(context = {}) {
    const result = createResult();
    
    try {
      // 1) Validate context
      const validation = this.validate(context);
      if (!validation.ok) {
        result.errors.push(...validation.errors);
        result.warnings.push(...validation.warnings);
        return result;
      }

      // 2) Check permissions
      const permission = this.checkPermission(context);
      if (!permission.ok) {
        result.errors.push(permission.reason || "Permission denied");
        return result;
      }

      const { actor, item, config, targets } = context;
      log("execute()", { actor: actor.name, item: item.name, config, targetCount: targets.length });

      // 3) Build attack formula with enhanced logic
      const formula = this.buildEnhancedAttackFormula(actor, item, config);
      
      // 4) Execute attack rolls
      const attackResult = await this.executeAttackRolls({ actor, item, config, targets, formula });
      
      // 5) Build initial state
      const state = StateManager.createAttackState({
        actor,
        item,
        targets,
        attackOptions: config,
        hasSave: !!(config.saveOnHit || config.saveOnly)
      });

      // 6) Update state with attack results or set save-only
      if (!config.saveOnly && attackResult) {
        StateManager.updateAttackResults(state, attackResult);
      } else if (config.saveOnly) {
        for (const target of state.targets) {
          target.summary.status = "saveonly";
        }
      }

      // 7) Process saves if configured
      if (config.saveOnHit || config.saveOnly) {
        await this.processSaves(state, config, item);
      }

      // 8) Create chat message
      const message = await this.createAttackMessage({ actor, state, rolls: attackResult?.rolls || [] });

      // 9) Fire completion hook
      Hooks.callAll("sw5eHelper.attackComplete", {
        actor, item, config, targets, state, message, attackResult
      });

      // 10) Finalize result
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

  /**
   * Legacy execute method for backwards compatibility
   * @param {object} options - Legacy options format
   * @returns {Promise<object>} Legacy result format
   */
  static async executeLegacy(options = {}) {
    const context = {
      actor: options.actor,
      item: options.item,
      config: options.config,
      targets: options.targets
    };
    
    const result = await this.execute(context);
    
    // Convert to legacy format
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

  /**
   * Execute attack rolls with enhanced logic
   * @param {object} options - Roll options
   * @returns {Promise<object>} Attack results
   */
  static async executeAttackRolls(options = {}) {
    const { actor, item, config, targets, formula } = options;
    
    const results = {
      formula,
      info: this.buildAttackInfo(actor, item, config),
      targets: [],
      rolls: []
    };

    if (config.saveOnly) {
      return results;
    }

    const rollData = actor.getRollData?.() ?? {};
    const separate = toBool(config.separate);
    
    log("executeAttackRolls", { formula, separate, targetCount: targets.length });

    // Execute rolls based on separate vs shared strategy
    if (separate && targets.length > 1) {
      // Separate roll for each target
      for (const target of targets) {
        const roll = await DiceRoller.roll(formula, rollData, { showDice: true });
        results.rolls.push(roll);
        
        const evaluation = this.evaluateAttackVsTarget(roll, target);
        results.targets.push(evaluation);
      }
    } else {
      // Single shared roll for all targets
      const roll = await DiceRoller.roll(formula, rollData, { showDice: true });
      results.rolls.push(roll);
      
      for (const target of targets) {
        const evaluation = this.evaluateAttackVsTarget(roll, target);
        results.targets.push(evaluation);
      }
    }

    return results;
  }

  /**
   * Legacy roll attack method for compatibility
   */
  static async rollAttack(options = {}) {
    const { actor, item, config, targets } = options;
    const formula = this.buildAttackFormula(actor, item, config);
    return this.executeAttackRolls({ ...options, formula });
  }

  /**
   * Build attack info string for tooltip
   */
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

  /**
   * Evaluate attack roll against target
   */
  static evaluateAttackVsTarget(roll, target) {
    const ac = this.getTargetAC(target);
    const evaluation = CheckEvaluator.evaluateAttack(roll, ac);
    
    return {
      tokenId: target.tokenId,
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

  /**
   * Build enhanced attack formula with better logic
   * @param {Actor} actor - Attacking actor
   * @param {Item} item - Weapon item
   * @param {object} config - Attack configuration
   * @returns {string} Attack formula
   */
  static buildEnhancedAttackFormula(actor, item, config) {
    const usingSmart = toBool(config.smart);
    const abilityKey = config.ability || deriveDefaultAbility(item);
    
    // Get modifiers with smart attack support
    const abilityMod = usingSmart ? 
      Number(config.smartAbility ?? 0) : 
      (actor.system?.abilities?.[abilityKey]?.mod ?? 0);
      
    const profBonus = usingSmart ? 
      Number(config.smartProf ?? 0) : 
      this.getProficiencyBonus(actor, item, config);
      
    const itemBonus = this.getItemAttackBonus(item);
    
    // Build formula parts
    const d20Term = advD20(config.adv);
    const parts = [d20Term];
    
    if (abilityMod) parts.push(signed(abilityMod));
    if (profBonus) parts.push(signed(profBonus));
    if (itemBonus) parts.push(signed(itemBonus));
    
    // Add user modifiers
    const extraMods = normalizeAtkExpr(config.atkMods);
    if (extraMods) parts.push(extraMods);
    
    return parts.join(" ");
  }

  /**
   * Legacy formula builder for compatibility
   */
  static buildAttackFormula(actor, item, config) {
    return this.buildEnhancedAttackFormula(actor, item, config);
  }

  /**
   * Get ability modifier for attack
   */
  static getAbilityModifier(actor, item, config) {
    if (config.smart) {
      return Number(config.smartAbility || 0);
    }

    const abilityKey = config.ability || item.system?.ability || "str";
    let mod = actor.system?.abilities?.[abilityKey]?.mod ?? 0;

    // Offhand weapons don't add ability modifier to damage (but do to attack)
    // This is handled in damage calculation

    return mod;
  }

  /**
   * Get proficiency bonus
   */
  static getProficiencyBonus(actor, item, config) {
    if (config.smart) {
      return Number(config.smartProf || 0);
    }

    // Check if proficient with weapon
    const isProficient = this.isProficientWith(actor, item);
    return isProficient ? (actor.system?.attributes?.prof ?? 0) : 0;
  }

  /**
   * Check weapon proficiency
   */
  static isProficientWith(actor, item) {
    // This would need to be implemented based on SW5E system
    // For now, assume proficient
    return true;
  }

  /**
   * Get item attack bonus
   */
  static getItemAttackBonus(item) {
    return Number(item.system?.attackBonus ?? 0);
  }

  /**
   * Apply advantage/disadvantage to formula (deprecated - use advD20 in formula building)
   */
  static applyAdvantage(formula, advState) {
    warn("applyAdvantage is deprecated, use advD20 in formula building instead");
    if (advState === "advantage") {
      return formula.replace("1d20", "2d20kh1");
    } else if (advState === "disadvantage") {
      return formula.replace("1d20", "2d20kl1");
    }
    return formula;
  }

  /**
   * Get target AC
   */
  static getTargetAC(target) {
    // Try to get AC from target actor
    const actor = target._actor || game.actors?.get?.(target.actorId);
    return actor?.system?.attributes?.ac?.value ?? 10;
  }

  /**
   * Process save configuration for targets
   */
  static async processSaves(state, config, item) {
    const saveAbility = config.saveAbility || config.save?.ability || "cha";
    let saveDC = config.save?.dc || config.save?.dcFormula || config.saveDcFormula;

    // Evaluate DC formula if needed
    if (typeof saveDC === "string" && saveDC.trim()) {
      try {
        const actor = game.actors?.get(state.actorId);
        const rollData = actor?.getRollData?.() ?? {};
        const roll = new Roll(saveDC, rollData);
        await roll.evaluate({ async: true });
        saveDC = roll.total;
      } catch (e) {
        saveDC = Number(saveDC) || this.calculateDefaultDC(state.actorId, saveAbility);
      }
    } else {
      saveDC = Number(saveDC) || this.calculateDefaultDC(state.actorId, saveAbility);
    }

    // Apply save data to all targets
    for (const target of state.targets) {
      if (config.saveOnHit || config.saveOnly) {
        target.save = {
          ability: saveAbility,
          dc: saveDC,
          formula: config.saveDcFormula || ""
        };
      }
    }
  }

  /**
   * Calculate default save DC
   */
  static calculateDefaultDC(actorId, abilityKey) {
    const actor = game.actors?.get(actorId);
    if (!actor) return 15;

    const abilityMod = actor.system?.abilities?.[abilityKey]?.mod ?? 0;
    const profBonus = actor.system?.attributes?.prof ?? 0;
    
    return 8 + profBonus + abilityMod;
  }

  /**
   * Create attack chat message
   */
  static async createAttackMessage(options) {
    const { actor, state, rolls = [] } = options;

    const content = CardRenderer.render(state);
    
    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      rolls,
      flags: { "sw5e-helper": { state } }
    });

    // Update state with message ID
    state.messageId = message.id;
    await message.update({
      flags: { "sw5e-helper": { state } }
    });

    return message;
  }

  /**
   * Initialize attack action
   */
  static init() {
    // Register any attack-specific hooks
    Hooks.on("sw5eHelper.preAttackRoll", this.onPreAttackRoll.bind(this));
    Hooks.on("sw5eHelper.postAttackRoll", this.onPostAttackRoll.bind(this));
  }

  /**
   * Pre-attack roll hook
   */
  static onPreAttackRoll(data) {
    // Allow modules to modify attack before rolling
    console.log("SW5E Helper: Pre-attack roll", data);
  }

  /**
   * Post-attack roll hook  
   */
  static onPostAttackRoll(data) {
    // Allow modules to react to attack results
    console.log("SW5E Helper: Post-attack roll", data);
  }
}

export default AttackAction;