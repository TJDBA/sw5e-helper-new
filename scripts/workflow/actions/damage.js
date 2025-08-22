/**
 * Damage Action Handler
 * Handles damage roll execution and processing
 */

import { DiceRoller } from '../../core/dice/roller.js';
import { FormulaUtils } from '../../core/dice/formula.js';
import { StateManager } from '../../core/state/manager.js';
import { DamageDialog } from '../../ui/dialogs/DamageDialog.js';
import { CardRenderer } from '../../ui/cards/renderer.js';

export class DamageAction {
  /** @type {string} Action name identifier */
  static name = "damage";

  /**
   * Validate damage context
   * @param {object} context - Damage context
   * @returns {void}
   */
  static validate(context = {}) {
    if (!context.actorId) {
      throw new Error("No actor provided for damage action");
    }
    
    if (!context.itemId) {
      throw new Error("No item provided for damage action");
    }
    
    if (!context.config) {
      throw new Error("No damage configuration provided");
    }
  }

  /**
   * Check permissions for damage action
   * @param {object} context - Damage context  
   * @returns {void}
   */
  static checkPermission(context = {}) {
    const actor = game.actors?.get(context.actorId);
    if (!actor) {
      throw new Error("Actor not found for permission check");
    }
    
    if (game.user?.isGM) {
      return;
    }
    
    const ownership = actor.ownership?.[game.user.id] ?? (actor.isOwner ? 3 : 0);
    const required = CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
    
    if (ownership < required) {
      throw new Error("Insufficient permissions to control this actor");
    }
  }
  /**
   * Roll quick damage without dialog
   * @param {object} state - Card state
   * @param {Array} targets - Eligible targets
   * @param {ChatMessage} message - Chat message
   */
  static async rollQuickDamage(state, targets, message) {
    const actor = game.actors?.get(state.actorId);
    const item = actor?.items?.get(state.itemId);
    
    if (!actor || !item) return;

    const result = await this.executeRoll({
      actor,
      item,
      targets,
      config: state.options || {},
      separate: !!state.options?.separate
    });

    this.applyResultsToTargets(targets, result);
    
    if (result.rolls?.length) {
      await this.appendRolls(message, result.rolls);
    }

    await this.updateCard(message, state);
  }

  /**
   * Execute damage action (coordinator interface)
   * @param {object} context - Execution context
   * @returns {Promise<object>} Damage result
   */
  static async execute(context = {}) {
    const { actorId, itemId, config = {}, targetIds = [] } = context;
    
    const actor = game.actors?.get(actorId);
    const item = actor?.items?.get(itemId);
    
    if (!actor || !item) {
      return {
        ok: false,
        type: 'damage',
        errors: ['Actor or item not found'],
        warnings: [],
        meta: {}
      };
    }

    // Convert targetIds to target refs for existing methods
    const targetRefs = targetIds.map(id => {
      if (id.includes(':')) return id; // Already in scene:token format
      return `${canvas.scene?.id}:${id}`; // Convert token ID to scene:token format
    });

    // Use the existing executeManual method
    return this.executeManual({
      actor,
      item,
      config,
      targetRefs
    });
  }

  /**
   * Open damage dialog for targets
   * @param {object} state - Card state
   * @param {Array} targets - Target list
   * @param {ChatMessage} message - Chat message
   * @param {object} options - Dialog options
   */
  static async openDamageDialog(state, targets, message, options = {}) {
    const actor = game.actors?.get(state.actorId);
    const item = actor?.items?.get(state.itemId);
    
    if (!actor || !item) return;

    // Determine crit status for dialog prefill
    const hasCrit = options.targetRef
      ? targets.some(t => this.getTargetRef(t) === options.targetRef && this.isCritical(t))
      : targets.some(t => this.isCritical(t));

    // Build seed configuration
    const seed = {
      weaponId: state.itemId,
      ability: state.options?.smart ? "manual" : "",
      offhand: !!state.options?.offhand,
      smart: !!state.options?.smart,
      smartAbility: state.options?.smartAbility || 0,
      separate: !!options.separate,
      isCrit: hasCrit && !options.separate
    };

    try {
      const dialog = new DamageDialog({
        actor,
        item,
        seed,
        scope: options.targetRef 
          ? { type: "row", ref: options.targetRef }
          : { type: "card" }
      });

      dialog.render(true);
      const result = await dialog.wait();

      if (result) {
        await this.processDialogResult(result, targets, state, message, options);
      }
    } catch (error) {
      console.error("SW5E Helper: Damage dialog error", error);
    }
  }

  /**
   * Process dialog result and apply damage
   */
  static async processDialogResult(result, targets, state, message, options) {
    const actor = game.actors?.get(state.actorId);
    const item = actor?.items?.get(state.itemId);

    // Build crit map from target status
    const critMap = {};
    for (const target of targets) {
      const ref = this.getTargetRef(target);
      
      if (options.targetRef) {
        // Individual target: use actual status
        critMap[ref] = this.isCritical(target);
      } else {
        // Group roll: use target status or dialog setting
        critMap[ref] = this.isCritical(target) || !!result.isCrit;
      }
    }

    // Execute damage roll
    const rollResult = await this.executeRoll({
      actor,
      item,
      targets,
      config: result,
      critMap,
      separate: !!result.separate
    });

    this.applyResultsToTargets(targets, rollResult);

    if (rollResult.rolls?.length) {
      await this.appendRolls(message, rollResult.rolls);
    }

    await this.updateCard(message, state);
  }

  /**
   * Execute manual damage (standalone)
   * @param {object} options - Execution options
   * @returns {Promise<object>} Damage result
   */
  static async executeManual(options) {
    const { actor, item, config, targetRefs } = options;

    // Build crit map - manual crit applies to all
    const critMap = Object.fromEntries(
      targetRefs.map(ref => [ref, !!config.isCrit])
    );

    const result = await this.executeRoll({
      actor,
      item,
      targets: targetRefs.map(ref => ({ ref })),
      config,
      critMap,
      separate: !!config.separate
    });

    // Create simple chat message
    await this.createManualMessage(actor, item, targetRefs, result);

    return result;
  }

  /**
   * Execute damage roll
   * @param {object} options - Roll options
   * @returns {Promise<object>} Roll result
   */
  static async executeRoll(options) {
    const { actor, item, targets, config, critMap = {}, separate = false } = options;

    const rolls = [];
    const perTargetTotals = new Map();
    const perTargetTypes = new Map();

    // Get base weapon formula and properties
    const baseFormula = this.getWeaponFormula(item);
    const abilityMod = this.getAbilityModifier(actor, item, config);
    const brutalDice = this.getBrutalDice(item);
    const extraRows = config.extraRows || [];

    // Build complete formula for each crit state
    const buildFormula = (isCrit) => {
      let formula = isCrit ? FormulaUtils.doubleDice(baseFormula) : baseFormula;
      
      // Add brutal dice on crit
      if (isCrit && brutalDice) {
        formula += ` + ${brutalDice}`;
      }

      // Add ability modifier if weapon doesn't use @mod
      if (!FormulaUtils.usesAtMod(baseFormula) && abilityMod !== 0) {
        formula += abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
      }

      // Add extra damage
      for (const extra of extraRows) {
        if (!extra.formula?.trim()) continue;
        
        const extraFormula = (isCrit && extra.inCrit) 
          ? FormulaUtils.doubleDice(extra.formula)
          : extra.formula;
        
        formula += ` + (${extraFormula})`;
      }

      return formula;
    };

    if (separate) {
      // Separate rolls per target
      for (const target of targets) {
        const ref = this.getTargetRef(target);
        const isCrit = !!critMap[ref];
        
        const formula = buildFormula(isCrit);
        const rollData = FormulaUtils.usesAtMod(baseFormula) 
          ? { mod: abilityMod } 
          : {};

        const roll = await DiceRoller.roll(formula, rollData);
        rolls.push(roll);
        
        perTargetTotals.set(ref, roll.total ?? 0);
        perTargetTypes.set(ref, this.getDamageTypes(item, roll.total));
      }
    } else {
      // Shared rolls by crit status
      const critTargets = [];
      const normalTargets = [];

      for (const target of targets) {
        const ref = this.getTargetRef(target);
        if (critMap[ref]) {
          critTargets.push({ target, ref });
        } else {
          normalTargets.push({ target, ref });
        }
      }

      // Roll for crits
      if (critTargets.length) {
        const formula = buildFormula(true);
        const rollData = FormulaUtils.usesAtMod(baseFormula) 
          ? { mod: abilityMod } 
          : {};

        const roll = await DiceRoller.roll(formula, rollData);
        rolls.push(roll);

        const total = roll.total ?? 0;
        const types = this.getDamageTypes(item, total);

        for (const { ref } of critTargets) {
          perTargetTotals.set(ref, total);
          perTargetTypes.set(ref, types);
        }
      }

      // Roll for normal hits
      if (normalTargets.length) {
        const formula = buildFormula(false);
        const rollData = FormulaUtils.usesAtMod(baseFormula) 
          ? { mod: abilityMod } 
          : {};

        const roll = await DiceRoller.roll(formula, rollData);
        rolls.push(roll);

        const total = roll.total ?? 0;
        const types = this.getDamageTypes(item, total);

        for (const { ref } of normalTargets) {
          perTargetTotals.set(ref, total);
          perTargetTypes.set(ref, types);
        }
      }
    }

    return {
      rolls,
      perTargetTotals,
      perTargetTypes,
      info: `Damage rolls: ${rolls.length}`,
      singleTotal: rolls[0]?.total ?? 0
    };
  }

  /**
   * Get weapon damage formula
   */
  static getWeaponFormula(item) {
    const parts = item?.system?.damage?.parts ?? [];
    const formulas = parts.map(part => 
      Array.isArray(part) ? part[0] : (part?.formula ?? part)
    ).filter(Boolean);
    
    return formulas.length ? formulas.join(" + ") : "0";
  }

  /**
   * Get ability modifier for damage
   */
  static getAbilityModifier(actor, item, config) {
    if (config.smart) {
      return Number(config.smartAbility || 0);
    }

    const abilityKey = config.ability || item.system?.ability || "str";
    let mod = actor.system?.abilities?.[abilityKey]?.mod ?? 0;

    // Offhand weapons don't add ability modifier to damage
    if (config.offhand && mod > 0) {
      mod = 0;
    }

    return mod;
  }

  /**
   * Get brutal dice for weapon
   */
  static getBrutalDice(item) {
    const brutalVal = Number(item?.system?.properties?.brutal ?? 0);
    if (brutalVal <= 0) return null;

    const baseFormula = this.getWeaponFormula(item);
    const baseFaces = FormulaUtils.getFirstDieFaces(baseFormula);
    
    return baseFaces ? `${brutalVal}d${baseFaces}` : null;
  }

  /**
   * Get damage types from item
   */
  static getDamageTypes(item, total) {
    // Simplified - would need proper type parsing
    const parts = item?.system?.damage?.parts ?? [];
    if (parts.length > 0 && parts[0][1]) {
      return { [parts[0][1]]: total };
    }
    return { kinetic: total };
  }

  /**
   * Utility methods
   */
  static getTargetRef(target) {
    return target.ref || `${target.sceneId}:${target.tokenId}`;
  }

  static isCritical(target) {
    return String(target?.summary?.status) === "crit";
  }

  static applyResultsToTargets(targets, result) {
    for (const target of targets) {
      const ref = this.getTargetRef(target);
      const total = result.perTargetTotals.get(ref);
      
      if (total != null) {
        target.damage = target.damage || {};
        target.damage.total = total;
        target.damage.types = result.perTargetTypes.get(ref) || { kinetic: total };
        target.damage.info = result.info || "";
      }
    }
  }

  static async appendRolls(message, rolls) {
    if (!rolls?.length) return;
    return message.update({ 
      rolls: [...(message.rolls || []), ...rolls] 
    });
  }

  static async updateCard(message, state) {
    const content = CardRenderer.render(state);
    return message.update({ 
      content,
      flags: { "sw5e-helper": { state } }
    });
  }

  static async createManualMessage(actor, item, targetRefs, result) {
    const lines = targetRefs.length
      ? Array.from(game.user.targets || []).map(token => {
          const ref = `${token.document?.parent?.id ?? canvas.scene?.id}:${token.id}`;
          const total = result.perTargetTotals.get(ref) ?? 0;
          return `<div>${token.name}: <strong>${total}</strong></div>`;
        })
      : [`<div>${item.name}: <strong>${result.singleTotal}</strong></div>`];

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="sw5e-helper-manual-damage">
        <div><em>${item.name}</em> — Damage</div>
        ${lines.join("")}
      </div>`,
      rolls: result.rolls
    });
  }

  /**
   * Initialize damage action
   */
  static init() {
    Hooks.on("sw5eHelper.preDamageRoll", this.onPreDamageRoll.bind(this));
    Hooks.on("sw5eHelper.postDamageRoll", this.onPostDamageRoll.bind(this));
  }

  static onPreDamageRoll(data) {
    console.log("SW5E Helper: Pre-damage roll", data);
  }

  static onPostDamageRoll(data) {
    console.log("SW5E Helper: Post-damage roll", data);
  }

  /**
   * Compensate damage action by applying healing
   * @param {object} context - Original context
   * @param {object} result - Execution result
   */
  static async compensate(context, result) {
    console.log("SW5E Helper: Compensating damage action", { context, result });
    
    // Apply healing equal to damage dealt
    if (result.data?.damageApplied) {
      for (const [targetRef, amount] of result.data.damageApplied.entries()) {
        try {
          const actor = this.getActorFromTargetRef(targetRef);
          if (actor && amount > 0) {
            await this.applyHealing(actor, amount);
            console.log(`SW5E Helper: Applied ${amount} healing to ${actor.name}`);
          }
        } catch (error) {
          console.warn(`SW5E Helper: Failed to compensate damage for ${targetRef}:`, error);
        }
      }
    }
  }

  /**
   * Generate idempotency key for damage action
   * @param {object} context - Execution context
   * @returns {string} Idempotency key
   */
  static idempotencyKey(context) {
    const parts = [
      'damage',
      context.actorId,
      context.itemId,
      context.targetIds?.join(',') || '',
      JSON.stringify(context.config || {})
    ];
    
    return btoa(parts.join('|')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Get actor from target reference
   * @param {string} targetRef - Target reference (sceneId:tokenId)
   * @returns {Actor|null} Actor instance
   */
  static getActorFromTargetRef(targetRef) {
    const [sceneId, tokenId] = targetRef.split(':');
    const scene = game.scenes?.get(sceneId);
    const token = scene?.tokens?.get(tokenId);
    return token?.actor || null;
  }

  /**
   * Apply healing to actor
   * @param {Actor} actor - Target actor
   * @param {number} amount - Healing amount
   */
  static async applyHealing(actor, amount) {
    const currentHp = actor.system?.attributes?.hp?.value || 0;
    const maxHp = actor.system?.attributes?.hp?.max || 0;
    const newHp = Math.min(currentHp + amount, maxHp);
    
    await actor.update({
      "system.attributes.hp.value": newHp
    });
  }
}

export default DamageAction;