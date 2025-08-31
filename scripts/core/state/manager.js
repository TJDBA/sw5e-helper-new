/**
 * State management for SW5E Helper
 * Handles card state creation and updates with validation and rerendering
 */

import { getConfig } from '../../config.js';

export class StateManager {
  
  static _ref(sceneId, tokenId) { return `${sceneId || canvas.scene?.id || ""}:${tokenId || ""}`; }
  
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
      missing = false,
      ac
    } = targetData;

    const ref = this._ref(sceneId, tokenId);
    return {
      sceneId,
      tokenId,
      actorId,
      ref,
      name: name ?? game.scenes.get(sceneId)?.tokens.get(tokenId)?.name ?? "Target",
      img: img ?? game.scenes.get(sceneId)?.tokens.get(tokenId)?.document?.texture?.src ?? "",
      ac: ac ?? game.scenes.get(sceneId)?.tokens.get(tokenId)?.actor?.system?.attributes?.ac?.value ?? null,
      ui: { expanded: false },
      summary: { status: "pending" },     // Reference-style summary stub
      attack: null,                       // { total, roll, parts? }
      damage: null,                       // { total, parts: [{type, value}], note? }
      save: null,                          // { ability, dc, result, success }
      missing
    };
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
    return message?.flags?.["sw5e-helper-new"]?.state ?? null;
  }

  /**
   * Update message with new state
   * @param {ChatMessage} message - The chat message
   * @param {object} state - The updated state
   * @param {Array} rolls - Optional additional rolls
   */
  static async updateMessage(message, state, rolls = []) {
    const payload = {
      flags: { "sw5e-helper-new": { state } }
    };

    if (rolls.length) {
      payload.rolls = [...(message.rolls || []), ...rolls];
    }

    return message.update(payload);
  }

  /**
   * Store resume token for workflow
   * @param {string} token - Resume token
   * @param {object} data - Token data
   * @returns {Promise<void>}
   */
  static async storeResumeToken(token, data) {
    // Store in game settings for persistence across sessions
    const tokens = game.settings?.get?.("sw5e-helper-new", "resumeTokens") || {};
    tokens[token] = {
      ...data,
      stored: Date.now()
    };
    
    // Keep only last 50 tokens to prevent storage bloat
    const tokenEntries = Object.entries(tokens);
    if (tokenEntries.length > 50) {
      const sortedTokens = tokenEntries
        .sort((a, b) => b[1].stored - a[1].stored)
        .slice(0, 50);
      const cleanTokens = Object.fromEntries(sortedTokens);
      await game.settings?.set?.("sw5e-helper-new", "resumeTokens", cleanTokens);
      return;
    }
    
    await game.settings?.set?.("sw5e-helper-new", "resumeTokens", tokens);
  }

  /**
   * Retrieve resume token data
   * @param {string} token - Resume token
   * @returns {Promise<object|null>} Token data
   */
  static async retrieveResumeToken(token) {
    const tokens = game.settings?.get?.("sw5e-helper-new", "resumeTokens") || {};
    return tokens[token] || null;
  }

  /**
   * Clean up expired resume tokens
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {Promise<void>}
   */
  static async cleanupExpiredTokens(maxAge = 24 * 60 * 60 * 1000) {
    const tokens = game.settings?.get?.("sw5e-helper-new", "resumeTokens") || {};
    const now = Date.now();
    
    const validTokens = {};
    for (const [token, data] of Object.entries(tokens)) {
      if (data.expires > now && (now - data.stored) < maxAge) {
        validTokens[token] = data;
      }
    }
    
    await game.settings?.set?.("sw5e-helper-new", "resumeTokens", validTokens);
  }

  /**
   * Create workflow state tracking
   * @param {string} workflowName - Workflow name
   * @param {object} context - Execution context
   * @returns {object} Workflow state
   */
  static createWorkflowState(workflowName, context) {
    return {
      kind: "workflow",
      name: workflowName,
      workflowId: context.workflowId,
      actorId: context.actorId,
      itemId: context.itemId,
      targetIds: context.targetIds || [],
      status: "running",
      started: Date.now(),
      currentStep: null,
      results: {},
      context: { ...context }
    };
  }

  /**
   * Update workflow state
   * @param {string} workflowId - Workflow ID
   * @param {string} stepId - Current step ID
   * @param {object} result - Step result
   */
  static updateWorkflowState(workflowId, stepId, result) {
    // This could be enhanced to persist workflow state
    console.log(`SW5E Helper: Workflow ${workflowId} step ${stepId} completed`, result);
  }

  /**
   * Get workflow state
   * @param {string} workflowId - Workflow ID
   * @returns {object|null} Workflow state
   */
  static getWorkflowState(workflowId) {
    // Placeholder - could retrieve from persistent storage
    return null;
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

  /**
   * Attach attack results per target in Reference format
   * attackResults: Array of { sceneId, tokenId, total, roll } OR { targets: [...] }
   */
  static updateAttackResults(state, attackResults = []) {
    // Handle both array format and { targets: [...] } format
    const results = Array.isArray(attackResults) ? attackResults : (attackResults.targets || []);
    
    console.log("SW5E Helper: updateAttackResults called with:", { attackResults, results });
    console.log("SW5E Helper: State targets:", state.targets);
    
    const byRef = new Map(results.map(r => {
      const ref = this._ref(r.sceneId, r.tokenId);
      console.log("SW5E Helper: Creating ref:", { sceneId: r.sceneId, tokenId: r.tokenId, ref });
      return [ref, r];
    }));
    
    console.log("SW5E Helper: byRef Map:", byRef);
    
    for (const t of state.targets) {
      console.log("SW5E Helper: Processing target:", t);
      const r = byRef.get(t.ref);
      if (!r) {
        console.log("SW5E Helper: No result found for target ref:", t.ref);
        continue;
      }
      console.log("SW5E Helper: Found result for target:", r);
      t.attack = { total: r.total ?? null, roll: r.roll ?? null };
      t.summary = { 
        ...(t.summary||{}), 
        status: r.total != null ? "rolled" : "pending",
        attackTotal: r.total ?? null,
        keptDie: r.kept ?? null
      };
    }
  }
  
  /**
   * Attach damage totals per target in Reference format
   * damageResults: Array of { sceneId, tokenId, total, parts:[{type,value}] }
   */
  static updateDamageResults(state, damageResults = []) {
    const byRef = new Map(damageResults.map(r => [this._ref(r.sceneId, r.tokenId), r]));
    for (const t of state.targets) {
      const r = byRef.get(t.ref);
      if (!r) continue;
      t.damage = { total: r.total ?? null, parts: Array.isArray(r.parts) ? r.parts : [] };
    }
  }

  /**
   * Optional: attach save data in Reference format
   * saves: Array of { sceneId, tokenId, ability, dc, result, success }
   */
  static updateSaveResults(state, saves = []) {
    const byRef = new Map(saves.map(r => [this._ref(r.sceneId, r.tokenId), r]));
    for (const t of state.targets) {
      const r = byRef.get(t.ref);
      if (!r) continue;
      t.save = { ability: r.ability, dc: r.dc, result: r.result, success: !!r.success };
    }
  }
}

export default StateManager;