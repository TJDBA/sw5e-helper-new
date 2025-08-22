/**
 * State validation utilities
 * Ensures state objects are valid and complete
 */

export class StateValidator {
  /**
   * Validate attack state object
   * @param {object} state - State to validate
   * @returns {object} Validation result
   */
  static validateAttackState(state) {
    const errors = [];
    const warnings = [];
    
    // Required fields
    if (!state.actorId) {
      errors.push("Missing actorId");
    }
    
    if (!state.itemId && !state.weaponId) {
      errors.push("Missing item/weapon ID");
    }
    
    if (!Array.isArray(state.targets)) {
      errors.push("Targets must be an array");
    } else if (state.targets.length === 0) {
      warnings.push("No targets specified");
    }
    
    // Validate options
    if (state.options) {
      if (state.options.adv && !["normal", "advantage", "disadvantage"].includes(state.options.adv)) {
        warnings.push("Invalid advantage state");
      }
      
      if (state.options.smart && (
          !Number.isFinite(state.options.smartAbility) ||
          !Number.isFinite(state.options.smartProf)
      )) {
        errors.push("Smart weapon requires numeric ability and proficiency values");
      }
    }
    
    // Validate save configuration
    if (state.hasSave && state.targets.some(t => t.save)) {
      for (const target of state.targets) {
        if (target.save) {
          if (!target.save.ability) {
            warnings.push(`Target ${target.name} missing save ability`);
          }
          
          if (target.save.dc == null) {
            warnings.push(`Target ${target.name} missing save DC`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate target state object
   * @param {object} target - Target to validate
   * @returns {object} Validation result
   */
  static validateTargetState(target) {
    const errors = [];
    const warnings = [];
    
    // Required fields
    if (!target.sceneId) {
      errors.push("Missing sceneId");
    }
    
    if (!target.tokenId) {
      errors.push("Missing tokenId");
    }
    
    if (!target.name) {
      warnings.push("Missing target name");
    }
    
    // Validate summary
    if (target.summary) {
      const validStatuses = ["pending", "hit", "miss", "crit", "fumble", "saveonly"];
      if (target.summary.status && !validStatuses.includes(target.summary.status)) {
        warnings.push("Invalid summary status");
      }
    }
    
    // Validate damage
    if (target.damage) {
      if (target.damage.total != null && !Number.isFinite(target.damage.total)) {
        errors.push("Damage total must be a number");
      }
      
      if (target.damage.applied && !["full", "half", "none"].includes(target.damage.applied)) {
        warnings.push("Invalid damage application mode");
      }
    }
    
    // Validate save
    if (target.save) {
      if (target.save.dc != null && !Number.isFinite(Number(target.save.dc))) {
        errors.push("Save DC must be a number");
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitize state object by removing invalid properties
   * @param {object} state - State to sanitize
   * @returns {object} Sanitized state
   */
  static sanitizeState(state) {
    const sanitized = { ...state };
    
    // Ensure required structure
    if (!sanitized.targets) {
      sanitized.targets = [];
    }
    
    if (!sanitized.options) {
      sanitized.options = {};
    }
    
    if (!sanitized.ui) {
      sanitized.ui = {};
    }
    
    // Sanitize options
    const validAdvStates = ["normal", "advantage", "disadvantage"];
    if (!validAdvStates.includes(sanitized.options.adv)) {
      sanitized.options.adv = "normal";
    }
    
    // Sanitize numeric values
    const numericFields = ["smartAbility", "smartProf", "itemAttackBonus"];
    for (const field of numericFields) {
      if (sanitized.options[field] != null && !Number.isFinite(sanitized.options[field])) {
        sanitized.options[field] = 0;
      }
    }
    
    // Sanitize boolean values
    const booleanFields = ["separate", "saveOnly", "smart", "offhand"];
    for (const field of booleanFields) {
      if (sanitized.options[field] != null) {
        sanitized.options[field] = !!sanitized.options[field];
      }
    }
    
    return sanitized;
  }

  /**
   * Check if state has required data for specific operations
   * @param {object} state - State to check
   * @param {string} operation - Operation type
   * @returns {boolean} True if state supports the operation
   */
  static supportsOperation(state, operation) {
    switch (operation) {
      case "attack":
        return !!(state.actorId && state.itemId && state.targets?.length);
      
      case "damage":
        return !!(state.actorId && state.itemId && state.targets?.some(t => 
          ["hit", "crit", "saveonly"].includes(t.summary?.status)
        ));
      
      case "save":
        return !!(state.hasSave && state.targets?.some(t => t.save));
      
      case "apply":
        return !!(state.targets?.some(t => t.damage?.total != null));
      
      default:
        return false;
    }
  }
}

export default StateValidator;