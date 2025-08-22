/**
 * Save-Only Workflow Graph
 * For spells and abilities that require saves without attacks
 */

/**
 * Save-only workflow for spells and abilities
 */
export const saveOnlyWorkflow = {
  name: "saveOnlyWorkflow",
  description: "Saving throw workflow for spells and abilities",
  version: "1.0.0",
  
  nodes: {
    // Start with saving throws
    start: {
      type: "action",
      action: "save",
      next: "checkDamage",
      onError: "end"
    },

    // Check if there's damage to apply based on save results
    checkDamage: {
      type: "conditional",
      condition: "hasDamageToApply",
      onTrue: "applyDamage",
      onFalse: "applyEffects"
    },

    // Apply damage based on save results
    applyDamage: {
      type: "action",
      action: "apply", 
      next: "applyEffects",
      onError: "applyEffects",
      config: {
        mode: "calculated", // Use save results
        halfOnSuccess: true
      }
    },

    // Apply additional effects (conditions, etc.)
    applyEffects: {
      type: "action",
      action: "apply",
      next: "end", 
      onError: "end",
      config: {
        mode: "effects",
        conditions: true
      }
    },

    // Workflow complete
    end: {
      type: "end"
    }
  },

  start: "start",

  config: {
    timeout: 300000, // 5 minutes
    allowUserCancel: true,
    logLevel: "info"
  }
};

/**
 * Multi-save workflow for complex effects
 */
export const multiSaveWorkflow = {
  name: "multiSaveWorkflow",
  description: "Multiple saving throws with different DCs",
  version: "1.0.0",
  
  nodes: {
    // Primary save
    start: {
      type: "action",
      action: "save",
      next: "checkPrimaryResult",
      onError: "end",
      config: {
        saveType: "primary"
      }
    },

    // Check primary save results
    checkPrimaryResult: {
      type: "conditional",
      condition: "primarySaveFailed",
      onTrue: "secondarySave",
      onFalse: "applyMinorEffects"
    },

    // Secondary save (if primary failed)
    secondarySave: {
      type: "action",
      action: "save",
      next: "checkSecondaryResult", 
      onError: "applyMajorEffects",
      config: {
        saveType: "secondary"
      }
    },

    // Check secondary save results
    checkSecondaryResult: {
      type: "conditional",
      condition: "secondarySaveFailed", 
      onTrue: "applyMajorEffects",
      onFalse: "applyModerateEffects"
    },

    // Apply minor effects (primary save succeeded)
    applyMinorEffects: {
      type: "action",
      action: "apply",
      next: "end",
      onError: "end",
      config: {
        effectLevel: "minor"
      }
    },

    // Apply moderate effects (primary failed, secondary succeeded)
    applyModerateEffects: {
      type: "action",
      action: "apply", 
      next: "end",
      onError: "end",
      config: {
        effectLevel: "moderate"
      }
    },

    // Apply major effects (both saves failed)
    applyMajorEffects: {
      type: "action",
      action: "apply",
      next: "end",
      onError: "end", 
      config: {
        effectLevel: "major"
      }
    },

    // Workflow complete
    end: {
      type: "end"
    }
  },

  start: "start",

  config: {
    timeout: 600000, // 10 minutes
    allowUserCancel: true,
    logLevel: "info"
  }
};

/**
 * Condition functions for save workflows
 */
export const saveConditions = {
  /**
   * Check if there's damage to apply after saves
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if damage should be applied
   */
  hasDamageToApply: (ctx) => {
    const saveResult = ctx.results?.save;
    if (!saveResult?.ok) return false;
    
    // Check if any targets failed their saves
    if (saveResult.data?.summary?.failed > 0) return true;
    
    // Check if spell/ability does damage even on successful save
    const actor = game.actors?.get(ctx.actorId);
    const item = actor?.items?.get(ctx.itemId);
    return !!(item?.system?.damage?.parts?.length > 0);
  },

  /**
   * Check if primary save failed
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if primary save failed
   */
  primarySaveFailed: (ctx) => {
    const saveResult = ctx.results?.save;
    return saveResult?.data?.summary?.failed > 0;
  },

  /**
   * Check if secondary save failed
   * @param {object} ctx - Workflow context 
   * @returns {boolean} True if secondary save failed
   */
  secondarySaveFailed: (ctx) => {
    const saveResult = ctx.results?.secondarySave;
    return saveResult?.data?.summary?.failed > 0;
  }
};

export default {
  saveOnlyWorkflow,
  multiSaveWorkflow,
  saveConditions
};