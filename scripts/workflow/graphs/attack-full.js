/**
 * Complete Attack Workflow Graph
 * Full attack sequence: attack → damage → saves → application
 */

/**
 * Condition evaluation functions for workflow
 */
export const conditions = {
  /**
   * Check if any targets were hit by the attack
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if any hits occurred
   */
  hasHits: (ctx) => {
    const attackResult = ctx.results?.attack;
    if (!attackResult?.ok) return false;
    
    return attackResult.targets?.some(target => 
      target.status === "hit" || target.status === "crit"
    ) || false;
  },

  /**
   * Check if any targets critically hit
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if any crits occurred
   */
  hasCrits: (ctx) => {
    const attackResult = ctx.results?.attack;
    if (!attackResult?.ok) return false;
    
    return attackResult.targets?.some(target => 
      target.status === "crit"
    ) || false;
  },

  /**
   * Check if any targets require saving throws
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if saves are required
   */
  requiresSave: (ctx) => {
    // Check if the item has save DC specified
    const actor = game.actors?.get(ctx.actorId);
    const item = actor?.items?.get(ctx.itemId);
    
    return !!(item?.system?.save?.dc || ctx.config?.saveDC);
  },

  /**
   * Check if damage should be applied automatically
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if auto-apply is enabled
   */
  shouldAutoApply: (ctx) => {
    return game.settings?.get?.("sw5e-helper-new", "autoApplyDamage") === true;
  }
};

/**
 * Complete attack workflow with conditional branching
 */
export const fullAttackWorkflow = {
  name: "fullAttackWorkflow",
  description: "Complete attack sequence with conditional damage and saves",
  version: "1.0.0",
  
  nodes: {
    // Start with attack roll
    start: {
      type: "action",
      action: "attack",
      next: "checkHits",
      onError: "end"
    },

    // Check if any targets were hit
    checkHits: {
      type: "conditional",
      condition: "hasHits",
      onTrue: "rollDamage",
      onFalse: "checkSaves"
    },

    // Roll damage for hit targets
    rollDamage: {
      type: "action", 
      action: "damage",
      next: "checkSaves",
      onError: "checkSaves",
      config: {
        // Pass hit targets and crit status to damage
        targetFilter: "hitTargets",
        includeCrits: true
      }
    },

    // Check if saves are required
    checkSaves: {
      type: "conditional",
      condition: "requiresSave",
      onTrue: "rollSaves",
      onFalse: "checkAutoApply"
    },

    // Execute saving throws
    rollSaves: {
      type: "action",
      action: "save",
      next: "checkAutoApply",
      onError: "checkAutoApply",
      config: {
        // Get save DC from item or context
        dcSource: "item",
        targetFilter: "allTargets"
      }
    },

    // Check if damage should be auto-applied
    checkAutoApply: {
      type: "conditional",
      condition: "shouldAutoApply",
      onTrue: "applyDamage",
      onFalse: "pause"
    },

    // Auto-apply damage
    applyDamage: {
      type: "action",
      action: "apply",
      next: "end",
      onError: "end",
      config: {
        mode: "calculated", // Use save results to calculate damage
        respectImmunities: true
      }
    },

    // Pause for manual damage application
    pause: {
      type: "pause",
      message: "Attack complete. Apply damage manually or resume workflow.",
      resumeOptions: ["applyDamage", "end"],
      next: "end"
    },

    // Workflow complete
    end: {
      type: "end"
    }
  },

  start: "start",

  // Default configuration
  config: {
    timeout: 300000, // 5 minutes
    allowUserCancel: true,
    logLevel: "info"
  },

  // Target filtering functions
  targetFilters: {
    hitTargets: (ctx) => {
      const attackResult = ctx.results?.attack;
      if (!attackResult?.targets) return ctx.targetIds || [];
      
      return attackResult.targets
        .filter(target => target.status === "hit" || target.status === "crit")
        .map(target => target.id);
    },

    critTargets: (ctx) => {
      const attackResult = ctx.results?.attack;
      if (!attackResult?.targets) return [];
      
      return attackResult.targets
        .filter(target => target.status === "crit")
        .map(target => target.id);
    },

    allTargets: (ctx) => {
      return ctx.targetIds || [];
    }
  }
};

export default fullAttackWorkflow;