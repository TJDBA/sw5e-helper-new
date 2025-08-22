/**
 * Main Workflow Orchestrator
 * Coordinates all module workflows and actions
 */

import { StateManager } from '../core/state/manager.js';
import { TargetFreezer } from '../core/state/freezer.js';
import { ActorResolver, TokenResolver } from '../core/actors/resolver.js';
import { AttackDialog } from '../ui/dialogs/AttackDialog.js';
import { DamageDialog } from '../ui/dialogs/DamageDialog.js';

export class WorkflowOrchestrator {
  constructor() {
    this.actions = new Map();
    this.registerDefaultActions();
  }
  
  /**
   * Register default action handlers
   */
  registerDefaultActions() {
    // Action handlers will be registered here as they are created
  }
  
  /**
   * Register a new action handler
   * @param {string} type - Action type
   * @param {object} handler - Action handler with validate, checkPermission, and execute methods
   */
  registerAction(type, handler) {
    this.actions.set(type, handler);
  }
  
  /**
   * Execute a single action with validation and permissions
   * @param {string} actionType - Type of action to execute
   * @param {object} context - Action context
   * @returns {Promise<object>} Action result
   */
  async execute(actionType, context = {}) {
    const handler = this.actions.get(actionType);
    if (!handler) {
      throw new Error(`Unknown action type: ${actionType}`);
    }
    
    // Validate context
    const validation = await handler.validate?.(context);
    if (validation === false) {
      throw new Error(`Invalid context for action: ${actionType}`);
    }
    
    // Check permissions
    const permission = await handler.checkPermission?.(context);
    if (permission === false) {
      throw new Error(`Permission denied for action: ${actionType}`);
    }
    
    // Execute action
    try {
      const result = await handler.execute(context);
      
      // Post-execution hook
      await Hooks.callAll(`sw5eHelper.post${actionType.charAt(0).toUpperCase() + actionType.slice(1)}`, {
        context,
        result
      });
      
      return result;
    } catch (error) {
      console.error(`SW5E Helper | Action failed: ${actionType}`, error);
      throw error;
    }
  }
  
  /**
   * Execute a chain of actions with context passing
   * @param {Array} actions - Array of action objects with type and context
   * @returns {Promise<Array>} Array of action results
   */
  async executeChain(actions) {
    const results = [];
    let context = {};
    
    for (const action of actions) {
      const result = await this.execute(action.type, {
        ...context,
        ...action.context
      });
      
      results.push(result);
      
      // Pass result to next action
      context = { ...context, previous: result };
    }
    
    return results;
  }
  /**
   * Execute attack workflow
   * @param {object} seed - Initial configuration
   * @returns {Promise<object>} Workflow result
   */
  static async executeAttack(seed = {}) {
    try {
      // Resolve actor
      const actor = ActorResolver.getActor({ 
        actorId: seed.actorId,
        fallbackToSelected: true,
        fallbackToUser: true 
      });
      
      if (!actor) {
        ui.notifications.warn("No actor available for attack");
        return null;
      }

      // Get equipped weapons
      const weapons = ActorResolver.getEquippedWeapons(actor);
      if (!weapons.length) {
        ui.notifications.warn("No equipped weapons found");
        return null;
      }

      // Open attack dialog
      const attackConfig = await AttackDialog.prompt({ actor, weapons });
      if (!attackConfig) return null;

      // Freeze current targets
      const frozenTargets = TargetFreezer.freezeCurrentTargets();

      // Import and execute attack action
      const { AttackAction } = await import('./actions/attack.js');
      const result = await AttackAction.execute({
        actor,
        item: ActorResolver.getItem(actor, attackConfig.weaponId),
        config: attackConfig,
        targets: frozenTargets
      });

      return result;
      
    } catch (error) {
      console.error("SW5E Helper: Attack workflow error", error);
      ui.notifications.error("Attack workflow failed - see console for details");
      return null;
    }
  }

  /**
   * Execute manual damage workflow
   * @param {object} seed - Initial configuration
   * @returns {Promise<object>} Workflow result
   */
  static async executeDamage(seed = {}) {
    try {
      // Resolve actor
      const actor = ActorResolver.getActor({
        actorId: seed.actorId,
        fallbackToSelected: true,
        fallbackToUser: true
      });

      if (!actor) {
        ui.notifications.warn("No actor available for damage roll");
        return null;
      }

      // Get equipped weapons
      const weapons = ActorResolver.getEquippedWeapons(actor);
      if (!weapons.length) {
        ui.notifications.warn("No equipped weapons found");
        return null;
      }

      // Open damage dialog
      const damageConfig = await DamageDialog.prompt({
        actor,
        weapons,
        seed,
        scope: { type: "manual" }
      });

      if (!damageConfig) return null;

      // Get current targets
      const targetRefs = Array.from(game.user.targets ?? []).map(
        t => `${t.document?.parent?.id ?? canvas.scene?.id}:${t.id}`
      );

      // Import and execute damage action
      const { DamageAction } = await import('./actions/damage.js');
      const result = await DamageAction.executeManual({
        actor,
        item: ActorResolver.getItem(actor, damageConfig.weaponId),
        config: damageConfig,
        targetRefs
      });

      return result;

    } catch (error) {
      console.error("SW5E Helper: Damage workflow error", error);
      ui.notifications.error("Damage workflow failed - see console for details");
      return null;
    }
  }

  /**
   * Initialize workflow orchestrator
   */
  static init() {
    // Register workflow hooks
    this.registerHooks();
    
    // Initialize sub-systems
    this.initializeActions();
  }

  /**
   * Register workflow-related hooks
   */
  static registerHooks() {
    // Hook for workflow completion
    Hooks.on("sw5eHelper.workflowComplete", this.onWorkflowComplete.bind(this));
    
    // Hook for workflow error
    Hooks.on("sw5eHelper.workflowError", this.onWorkflowError.bind(this));
  }

  /**
   * Handle workflow completion
   * @param {object} data - Workflow completion data
   */
  static onWorkflowComplete(data) {
    console.log("SW5E Helper: Workflow completed", data);
  }

  /**
   * Handle workflow error
   * @param {object} error - Workflow error data
   */
  static onWorkflowError(error) {
    console.error("SW5E Helper: Workflow error", error);
  }

  /**
   * Initialize action modules
   */
  static async initializeActions() {
    try {
      // Dynamically import and initialize all actions
      const actions = [
        'attack',
        'damage', 
        'save',
        'apply'
      ];

      for (const actionName of actions) {
        const module = await import(`./actions/${actionName}.js`);
        const ActionClass = module[`${actionName.charAt(0).toUpperCase()}${actionName.slice(1)}Action`];
        
        if (ActionClass?.init) {
          ActionClass.init();
        }
      }
    } catch (error) {
      console.error("SW5E Helper: Failed to initialize actions", error);
    }
  }

  /**
   * Get workflow statistics
   * @returns {object} Workflow stats
   */
  static getStats() {
    return {
      executedWorkflows: this._executedWorkflows || 0,
      failedWorkflows: this._failedWorkflows || 0,
      averageExecutionTime: this._averageExecutionTime || 0
    };
  }

  /**
   * Reset workflow statistics
   */
  static resetStats() {
    this._executedWorkflows = 0;
    this._failedWorkflows = 0;
    this._averageExecutionTime = 0;
  }
}

// Static wrapper for backwards compatibility
export const LegacyWorkflowOrchestrator = {
  ...WorkflowOrchestrator,
  
  // Static method wrappers
  init() {
    const instance = new WorkflowOrchestrator();
    game.sw5eHelper = game.sw5eHelper || {};
    game.sw5eHelper.workflow = instance;
    
    this.registerHooks();
    this.initializeActions();
  }
};

export default WorkflowOrchestrator;