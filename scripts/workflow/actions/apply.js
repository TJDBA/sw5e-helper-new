/**
 * Apply Action Handler  
 * Handles damage application to actors with full workflow integration
 */

export class ApplyAction {
  /** @type {string} Action name identifier */
  static name = "apply";

  /**
   * Validate apply context
   * @param {object} context - Apply context
   * @returns {void}
   */
  static validate(context = {}) {
    if (!context.targetIds || context.targetIds.length === 0) {
      throw new Error("No targets provided for apply action");
    }
    
    if (!context.config?.damage) {
      throw new Error("No damage data provided for apply action");
    }
  }

  /**
   * Check permissions for apply action
   * @param {object} context - Apply context
   * @returns {void}
   */
  static checkPermission(context = {}) {
    // GM can always apply damage
    if (game.user?.isGM) {
      return;
    }
    
    // Check if user has permission to modify target actors
    for (const targetId of context.targetIds) {
      const actor = this.getActorFromTargetId(targetId);
      if (!actor) continue;
      
      const ownership = actor.ownership?.[game.user.id] ?? (actor.isOwner ? 3 : 0);
      const required = CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
      
      if (ownership < required) {
        throw new Error(`Insufficient permissions to apply damage to: ${actor.name}`);
      }
    }
  }

  /**
   * Execute damage application to all targets
   * @param {object} context - Execution context
   * @returns {Promise<object>} Apply result
   */
  static async execute(context = {}) {
    const { targetIds, config } = context;
    const { damage, mode = "full", types = {} } = config;

    const result = {
      ok: true,
      type: 'apply',
      data: {
        applied: new Map(),
        summary: { totalDamage: 0, targetsAffected: 0 }
      },
      errors: [],
      warnings: [],
      meta: { targetCount: targetIds.length },
      effects: []
    };

    console.log(`SW5E Helper: Applying damage (${mode}) to ${targetIds.length} targets`);

    // Apply damage to each target
    for (const targetId of targetIds) {
      try {
        const applyResult = await this.applySingleTarget(targetId, damage, mode, types);
        
        result.data.applied.set(targetId, applyResult);
        result.data.summary.totalDamage += applyResult.applied;
        result.data.summary.targetsAffected++;
        
        result.effects.push(`Applied ${applyResult.applied} damage to ${applyResult.actorName}`);
        
        console.log(`SW5E Helper: Applied ${applyResult.applied} damage to ${applyResult.actorName} (${applyResult.newHp}/${applyResult.maxHp} HP)`);
        
      } catch (error) {
        result.errors.push(`Apply failed for target ${targetId}: ${error.message}`);
        console.error(`SW5E Helper: Apply error for target ${targetId}:`, error);
      }
    }

    // Emit hooks
    Hooks.callAll('sw5e-helper.action.postExecute', {
      action: 'apply',
      context,
      result
    });

    return result;
  }

  /**
   * Apply damage to single target
   * @param {string} targetId - Target identifier
   * @param {number} damage - Base damage amount
   * @param {string} mode - Application mode ("full", "half", "none")
   * @param {object} types - Damage types
   * @returns {Promise<object>} Single apply result
   */
  static async applySingleTarget(targetId, damage, mode, types) {
    const actor = this.getActorFromTargetId(targetId);
    if (!actor) {
      throw new Error(`Actor not found for target: ${targetId}`);
    }

    // Calculate applied damage based on mode
    let appliedDamage = damage;
    switch (mode) {
      case "none":
        appliedDamage = 0;
        break;
      case "half":
        appliedDamage = Math.floor(damage / 2);
        break;
      case "full":
      default:
        appliedDamage = damage;
        break;
    }

    // Get current HP
    const currentHp = actor.system?.attributes?.hp?.value ?? 0;
    const maxHp = actor.system?.attributes?.hp?.max ?? 1;
    const newHp = Math.max(0, currentHp - appliedDamage);

    // Apply the damage
    if (appliedDamage > 0) {
      await actor.update({
        "system.attributes.hp.value": newHp
      });
    }

    // Check for unconscious/death
    let status = "injured";
    if (newHp === 0) {
      status = "unconscious";
    } else if (newHp < 0) {
      status = "dying";
    }

    return {
      targetId,
      actorId: actor.id,
      actorName: actor.name,
      damage: damage,
      applied: appliedDamage,
      mode,
      previousHp: currentHp,
      newHp,
      maxHp,
      status,
      types: types || { kinetic: appliedDamage }
    };
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
   * Compensate apply action by restoring HP
   * @param {object} context - Original context
   * @param {object} result - Execution result
   */
  static async compensate(context, result) {
    console.log("SW5E Helper: Compensating apply action", { context, result });
    
    // Restore HP to all targets
    if (result.data?.applied) {
      for (const [targetId, applyData] of result.data.applied.entries()) {
        try {
          const actor = this.getActorFromTargetId(targetId);
          if (actor && applyData.applied > 0) {
            // Restore HP to previous value
            await actor.update({
              "system.attributes.hp.value": applyData.previousHp
            });
            console.log(`SW5E Helper: Restored ${actor.name} HP from ${applyData.newHp} to ${applyData.previousHp}`);
          }
        } catch (error) {
          console.warn(`SW5E Helper: Failed to compensate apply for ${targetId}:`, error);
        }
      }
    }
  }

  /**
   * Generate idempotency key for apply action
   * @param {object} context - Execution context
   * @returns {string} Idempotency key
   */
  static idempotencyKey(context) {
    const parts = [
      'apply',
      context.targetIds?.join(',') || '',
      String(context.config?.damage || 0),
      context.config?.mode || 'full'
    ];
    
    return btoa(parts.join('|')).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Initialize apply action
   */
  static init() {
    console.log("SW5E Helper: Apply action initialized");
  }
}

export default ApplyAction;