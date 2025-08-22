/**
 * Save Action Handler
 * Handles saving throw execution and processing with full workflow integration
 */

import { DiceRoller } from '../../core/dice/roller.js';
import { CheckEvaluator } from '../../core/dice/evaluator.js';

export class SaveAction {
  /** @type {string} Action name identifier */
  static name = "save";

  /**
   * Validate save context
   * @param {object} context - Save context
   * @returns {void}
   */
  static validate(context = {}) {
    if (!context.targetIds || context.targetIds.length === 0) {
      throw new Error("No targets provided for save action");
    }
    
    if (!context.config?.ability) {
      throw new Error("No save ability specified");
    }
    
    if (!context.config?.dc) {
      throw new Error("No save DC specified");
    }
  }

  /**
   * Check permissions for save action
   * @param {object} context - Save context
   * @returns {void}
   */
  static checkPermission(context = {}) {
    // GM can always make saves
    if (game.user?.isGM) {
      return;
    }
    
    // Check if user owns all target actors
    for (const targetId of context.targetIds) {
      const actor = this.getActorFromTargetId(targetId);
      if (!actor) continue;
      
      const ownership = actor.ownership?.[game.user.id] ?? (actor.isOwner ? 3 : 0);
      const required = CONST.DOCUMENT_PERMISSION_LEVELS?.OBSERVER ?? 2;
      
      if (ownership < required) {
        throw new Error(`Insufficient permissions for target: ${actor.name}`);
      }
    }
  }

  /**
   * Execute saving throws for all targets
   * @param {object} context - Execution context
   * @returns {Promise<object>} Save results
   */
  static async execute(context = {}) {
    const { targetIds, config } = context;
    const { ability, dc, allowHalfDamage = true } = config;

    const result = {
      ok: true,
      type: 'save',
      data: {
        ability,
        dc,
        results: new Map(),
        summary: { passed: 0, failed: 0 }
      },
      errors: [],
      warnings: [],
      meta: { targetCount: targetIds.length },
      rolls: []
    };

    console.log(`SW5E Helper: Executing ${ability.toUpperCase()} save (DC ${dc}) for ${targetIds.length} targets`);

    // Execute save for each target
    for (const targetId of targetIds) {
      try {
        const saveResult = await this.executeSingleSave(targetId, ability, dc);
        
        result.data.results.set(targetId, saveResult);
        result.rolls.push(saveResult.roll);
        
        if (saveResult.passed) {
          result.data.summary.passed++;
        } else {
          result.data.summary.failed++;
        }
        
        console.log(`SW5E Helper: ${saveResult.actorName} ${ability.toUpperCase()} save: ${saveResult.total} vs DC ${dc} (${saveResult.passed ? 'SUCCESS' : 'FAILURE'})`);
        
      } catch (error) {
        result.errors.push(`Save failed for target ${targetId}: ${error.message}`);
        console.error(`SW5E Helper: Save error for target ${targetId}:`, error);
      }
    }

    // Emit hooks
    Hooks.callAll('sw5e-helper.action.postExecute', {
      action: 'save',
      context,
      result
    });

    return result;
  }

  /**
   * Execute save for single target
   * @param {string} targetId - Target identifier
   * @param {string} ability - Save ability
   * @param {number} dc - Save DC
   * @returns {Promise<object>} Single save result
   */
  static async executeSingleSave(targetId, ability, dc) {
    const actor = this.getActorFromTargetId(targetId);
    if (!actor) {
      throw new Error(`Actor not found for target: ${targetId}`);
    }

    // Build save formula
    const abilityMod = actor.system?.abilities?.[ability]?.mod ?? 0;
    const profBonus = this.getSaveProficiency(actor, ability);
    const formula = `1d20 + ${abilityMod + profBonus}`;

    // Roll the save
    const rollData = actor.getRollData?.() ?? {};
    const roll = await DiceRoller.roll(formula, rollData, { showDice: true });
    
    // Evaluate result
    const total = roll.total;
    const passed = total >= dc;
    
    return {
      targetId,
      actorId: actor.id,
      actorName: actor.name,
      ability,
      dc,
      total,
      passed,
      roll,
      formula,
      modifiers: {
        ability: abilityMod,
        proficiency: profBonus
      }
    };
  }

  /**
   * Get save proficiency bonus
   * @param {Actor} actor - Target actor
   * @param {string} ability - Save ability
   * @returns {number} Proficiency bonus
   */
  static getSaveProficiency(actor, ability) {
    const saves = actor.system?.attributes?.saves;
    if (!saves?.[ability]) return 0;
    
    const saveData = saves[ability];
    const isProficient = saveData.proficient || saveData.prof > 0;
    
    return isProficient ? (actor.system?.attributes?.prof ?? 0) : 0;
  }

  /**
   * Get actor from target ID (supports multiple formats)
   * @param {string} targetId - Target identifier
   * @returns {Actor|null} Actor instance
   */
  static getActorFromTargetId(targetId) {
    // Direct actor ID
    let actor = game.actors?.get(targetId);
    if (actor) return actor;
    
    // Scene:Token format
    if (targetId.includes(':')) {
      const [sceneId, tokenId] = targetId.split(':');
      const scene = game.scenes?.get(sceneId);
      const token = scene?.tokens?.get(tokenId);
      return token?.actor || null;
    }
    
    // Token ID in current scene
    const token = canvas.scene?.tokens?.get(targetId);
    return token?.actor || null;
  }

  /**
   * Compensate save action - saves are not reversible, log only
   * @param {object} context - Original context
   * @param {object} result - Execution result
   */
  static async compensate(context, result) {
    console.log("SW5E Helper: Save compensation called (non-reversible action)", {
      ability: context.config?.ability,
      dc: context.config?.dc,
      targetCount: context.targetIds?.length
    });
  }

  /**
   * Generate idempotency key for save action
   * @param {object} context - Execution context
   * @returns {string} Idempotency key
   */
  static idempotencyKey(context) {
    const parts = [
      'save',
      context.targetIds?.join(',') || '',
      context.config?.ability || '',
      String(context.config?.dc || 0)
    ];
    
    return btoa(parts.join('|')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Initialize save action hooks
   */
  static init() {
    console.log("SW5E Helper: Save action initialized");
  }
}

export default SaveAction;