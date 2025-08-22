/**
 * Custom Hooks for SW5E Helper
 * Defines workflow-specific hooks and events
 */

export class WorkflowHooks {
  /**
   * Initialize all workflow hooks
   */
  static init() {
    this.registerCustomHooks();
    this.registerFoundryHooks();
  }

  /**
   * Register custom SW5E Helper hooks
   */
  static registerCustomHooks() {
    // Attack workflow hooks
    this.registerHook("sw5eHelper.preAttackRoll");
    this.registerHook("sw5eHelper.postAttackRoll");
    this.registerHook("sw5eHelper.attackComplete");

    // Damage workflow hooks  
    this.registerHook("sw5eHelper.preDamageRoll");
    this.registerHook("sw5eHelper.postDamageRoll");
    this.registerHook("sw5eHelper.damageComplete");

    // Save workflow hooks
    this.registerHook("sw5eHelper.preSaveRoll");
    this.registerHook("sw5eHelper.postSaveRoll");
    this.registerHook("sw5eHelper.saveComplete");

    // Application hooks
    this.registerHook("sw5eHelper.preApplyDamage");
    this.registerHook("sw5eHelper.postApplyDamage");

    // General workflow hooks
    this.registerHook("sw5eHelper.workflowStart");
    this.registerHook("sw5eHelper.workflowComplete");
    this.registerHook("sw5eHelper.workflowError");
  }

  /**
   * Register Foundry system hooks we respond to
   */
  static registerFoundryHooks() {
    // Chat message hooks
    Hooks.on("renderChatMessage", this.onRenderChatMessage.bind(this));
    Hooks.on("deleteChatMessage", this.onDeleteChatMessage.bind(this));

    // Token/Actor hooks
    Hooks.on("targetToken", this.onTargetToken.bind(this));
    Hooks.on("updateActor", this.onUpdateActor.bind(this));

    // Combat hooks
    Hooks.on("combatStart", this.onCombatStart.bind(this));
    Hooks.on("combatRound", this.onCombatRound.bind(this));
    Hooks.on("combatTurn", this.onCombatTurn.bind(this));
  }

  /**
   * Register a custom hook
   */
  static registerHook(hookName) {
    console.log(`SW5E Helper: Registered hook ${hookName}`);
  }

  /**
   * Foundry hook handlers
   */
  static onRenderChatMessage(message, html, data) {
    // Let card handlers manage this
  }

  static onDeleteChatMessage(message, options, userId) {
    // Clean up any message-specific data
    if (message.flags?.["sw5e-helper"]) {
      console.log("SW5E Helper: Chat message deleted", message.id);
    }
  }

  static onTargetToken(user, token, targeted) {
    // Could trigger target change events
    console.log("SW5E Helper: Target changed", { token: token.id, targeted });
  }

  static onUpdateActor(actor, change, options, userId) {
    // React to actor changes (HP, stats, etc.)
    if (change.system?.attributes?.hp) {
      console.log("SW5E Helper: Actor HP changed", { 
        actor: actor.id, 
        hp: change.system.attributes.hp 
      });
    }
  }

  static onCombatStart(combat, updateData) {
    console.log("SW5E Helper: Combat started");
  }

  static onCombatRound(combat, updateData, options) {
    console.log("SW5E Helper: Combat round", combat.round);
  }

  static onCombatTurn(combat, updateData, options) {
    console.log("SW5E Helper: Combat turn", combat.current);
  }

  /**
   * Utility methods for firing hooks
   */
  static fireHook(hookName, ...args) {
    Hooks.callAll(hookName, ...args);
  }

  static async fireHookAsync(hookName, ...args) {
    return Hooks.call(hookName, ...args);
  }
}

export default WorkflowHooks;