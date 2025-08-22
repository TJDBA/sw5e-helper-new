/**
 * State management for SW5E Helper
 * Handles card state creation and updates with validation and rerendering
 */

import { getConfig } from '../../config.js';

export class StateManager {
  /**
   * Create initial attack state
   * @param {object} options - State creation options
   * @returns {object} Initial state object
   */
  static createAttackState(options = {}) {
    const {
      actor,
      item,
      targets = [],
      messageId = null,
      attackOptions = {},
      hasSave = false
    } = options;

    return {
      kind: "attack",
      messageId,
      authorId: game.user.id,
      actorId: actor?.id,
      itemId: item?.id,
      weaponId: item?.id,
      itemName: item?.name,
      weaponImg: item?.img ?? item?.system?.img,
      hasSave,
      options: {
        separate: false,
        adv: "normal",
        saveOnly: false,
        smart: false,
        smartAbility: 0,
        smartProf: 0,
        offhand: false,
        itemAttackBonus: 0,
        ...attackOptions
      },
      targets: targets.map(t => this.createTargetState(t)),
      ui: {
        expandedAll: false
      }
    };
  }

  /**
   * Create target state object
   * @param {object} targetData - Target data
   * @returns {object} Target state
   */
  static createTargetState(targetData) {
    const {
      sceneId,
      tokenId,
      name,
      img,
      actorId,
      missing = false
    } = targetData;

    return {
      sceneId,
      tokenId,
      actorId,
      name,
      img,
      missing,
      summary: {
        status: "pending",
        keptDie: null,
        attackTotal: null
      },
      attack: null,
      damage: null,
      save: null
    };
  }

  /**
   * Update attack results on targets
   * @param {object} state - Card state
   * @param {Array} attackResults - Attack roll results
   */
  static updateAttackResults(state, attackResults) {
    if (!attackResults?.targets) return;

    for (const target of state.targets) {
      const result = attackResults.targets.find(r => r.tokenId === target.tokenId);
      
      if (result) {
        target.attack = {
          kept: result.kept,
          total: result.total,
          status: result.status
        };
        
        target.summary = {
          keptDie: result.kept,
          attackTotal: result.total,
          status: result.status
        };
      }
    }
  }

  /**
   * Update damage results on targets
   * @param {object} state - Card state
   * @param {Map} perTargetTotals - Damage totals per target
   * @param {Map} perTargetTypes - Damage types per target
   * @param {string} info - Damage info
   */
  static updateDamageResults(state, perTargetTotals, perTargetTypes, info = "") {
    for (const target of state.targets) {
      const ref = `${target.sceneId}:${target.tokenId}`;
      const total = perTargetTotals.get(ref);
      
      if (total != null) {
        target.damage = target.damage || {};
        target.damage.total = total;
        target.damage.types = perTargetTypes.get(ref) || { kinetic: total };
        target.damage.info = info || target.damage.info || "";
      }
    }
  }

  /**
   * Update save results on a target
   * @param {object} target - Target object
   * @param {object} saveResult - Save roll result
   */
  static updateSaveResult(target, saveResult) {
    if (!target.save) return;

    target.save.roll = {
      total: saveResult.total,
      formula: saveResult.formula,
      outcome: saveResult.outcome
    };
  }

  /**
   * Apply damage to a target
   * @param {object} target - Target object
   * @param {string} mode - Application mode ("full", "half", "none")
   */
  static applyDamage(target, mode) {
    if (!target.damage || target.damage.total == null) return;

    const amount = Number(target.damage.total ?? 0);
    let appliedAmount = amount;

    switch (mode) {
      case "none":
        appliedAmount = 0;
        break;
      case "half":
        appliedAmount = Math.floor(amount / 2);
        break;
      case "full":
      default:
        appliedAmount = amount;
        break;
    }

    target.damage.applied = mode;
    target.damage.appliedAmount = appliedAmount;
  }

  /**
   * Get state from a chat message
   * @param {ChatMessage} message - The chat message
   * @returns {object|null} The state object
   */
  static getStateFromMessage(message) {
    return message?.flags?.["sw5e-helper"]?.state ?? null;
  }

  /**
   * Update message with new state
   * @param {ChatMessage} message - The chat message
   * @param {object} state - The updated state
   * @param {Array} rolls - Optional additional rolls
   */
  static async updateMessage(message, state, rolls = []) {
    const payload = {
      flags: { "sw5e-helper": { state } }
    };

    if (rolls.length) {
      payload.rolls = [...(message.rolls || []), ...rolls];
    }

    return message.update(payload);
  }

  /**
   * Get state from message flag
   * @param {ChatMessage} message - The chat message
   * @returns {object|null} The state object
   */
  static getState(message) {
    const moduleId = getConfig("MODULE_ID", "sw5e-helper");
    return message?.getFlag(moduleId, "state") || null;
  }
  
  /**
   * Set state on message flag
   * @param {ChatMessage} message - The chat message
   * @param {object} state - The state to set
   * @returns {Promise} Update promise
   */
  static async setState(message, state) {
    const moduleId = getConfig("MODULE_ID", "sw5e-helper");
    return await message.setFlag(moduleId, "state", state);
  }
  
  /**
   * Update state with validation and rerendering
   * @param {ChatMessage} message - The chat message
   * @param {object} updates - State updates to apply
   * @param {object} options - Update options
   * @returns {Promise<object>} Updated state
   */
  static async updateState(message, updates, options = {}) {
    const currentState = this.getState(message);
    const newState = foundry.utils.mergeObject(currentState, updates);
    
    if (options.validate) {
      const validation = this.validateState(newState);
      if (!validation.valid) {
        throw new Error(`Invalid state: ${validation.errors.join(", ")}`);
      }
    }
    
    await this.setState(message, newState);
    
    if (options.rerender) {
      await this.rerenderMessage(message, newState);
    }
    
    return newState;
  }
  
  /**
   * Rerender message content with current state
   * @param {ChatMessage} message - The chat message
   * @param {object} state - Current state
   * @returns {Promise} Update promise
   */
  static async rerenderMessage(message, state) {
    const content = await renderTemplate(
      "modules/sw5e-helper/templates/cards/attack-card.hbs",
      { state, isGM: game.user.isGM }
    );
    
    await message.update({ content });
  }
  
  /**
   * Append rolls to message
   * @param {ChatMessage} message - The chat message
   * @param {Array} rolls - Rolls to append
   * @returns {Promise} Update promise
   */
  static async appendRolls(message, rolls) {
    const existingRolls = message.rolls || [];
    await message.update({ 
      rolls: [...existingRolls, ...rolls] 
    });
  }

  /**
   * Validate state object
   * @param {object} state - State to validate
   * @returns {object} Validation result
   */
  static validateState(state) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!state) {
      result.valid = false;
      result.errors.push("State cannot be null or undefined");
      return result;
    }

    // Validate required fields
    if (!state.kind) {
      result.errors.push("State must have a 'kind' property");
    }

    if (!state.authorId) {
      result.errors.push("State must have an 'authorId' property");
    }

    // Validate targets array
    if (state.targets && !Array.isArray(state.targets)) {
      result.errors.push("State 'targets' must be an array");
    }

    // Validate each target
    if (state.targets) {
      for (const [index, target] of state.targets.entries()) {
        if (!target.tokenId) {
          result.errors.push(`Target ${index} missing tokenId`);
        }
        if (!target.sceneId) {
          result.errors.push(`Target ${index} missing sceneId`);
        }
      }
    }

    result.valid = result.errors.length === 0;
    return result;
  }
}

export default StateManager;