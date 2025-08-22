/**
 * Chat card event handlers
 * Handles user interactions with attack cards
 */

import { StateManager } from '../../core/state/manager.js';
import { TargetFreezer } from '../../core/state/freezer.js';
import { ActorResolver } from '../../core/actors/resolver.js';
import { PermissionChecker } from '../../core/actors/permissions.js';
import { Helpers } from '../../core/utils/helpers.js';
import { CardRenderer } from './renderer.js';

export class CardHandlers {
  /**
   * Initialize card event handlers
   */
  static init() {
    // Register chat message render hook
    Hooks.on("renderChatMessage", this.onRenderChatMessage.bind(this));
  }

  /**
   * Handle chat message render - attach event listeners
   * @param {ChatMessage} message - The chat message
   * @param {jQuery} html - Message HTML
   */
  static onRenderChatMessage(message, html) {
    const cardRoot = html[0]?.querySelector?.(".sw5e-helper-card");
    if (!cardRoot) return;

    // Attach single delegated event listener
    cardRoot.addEventListener("click", (ev) => this.onCardClick(ev, message));
  }

  /**
   * Handle clicks on card elements
   * @param {Event} event - Click event
   * @param {ChatMessage} message - Chat message
   */
  static async onCardClick(event, message) {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();

    const action = target.dataset.action;
    const targetRef = target.dataset.targetRef || 
                     target.closest(".target-row")?.dataset?.targetRef || 
                     null;

    const state = StateManager.getStateFromMessage(message);
    if (!state) return;

    try {
      await this.handleAction(action, targetRef, state, message);
    } catch (error) {
      console.error("SW5E Helper: Card action error", error);
      Helpers.notify("An error occurred processing the action", "error");
    }
  }

  /**
   * Route action to appropriate handler
   * @param {string} action - Action name
   * @param {string} targetRef - Target reference (optional)
   * @param {object} state - Card state
   * @param {ChatMessage} message - Chat message
   */
  static async handleAction(action, targetRef, state, message) {
    // UI actions
    if (action === "toggle-all") {
      return this.handleToggleAll(state, message);
    }

    // Token actions
    if (action === "ping-token") {
      return this.handlePingToken(targetRef);
    }
    if (action === "select-token") {
      return this.handleSelectToken(targetRef);
    }

    // Info actions
    if (action === "show-attack-formula") {
      return this.handleShowAttackFormula(state);
    }
    if (action === "show-damage-formula") {
      return this.handleShowDamageFormula(state, targetRef);
    }

    // Save actions
    if (action === "roll-save") {
      return this.handleRollSave(state, targetRef, message);
    }
    if (action === "gm-roll-all-saves") {
      return this.handleGMRollAllSaves(state, message);
    }

    // Damage actions
    if (action === "card-quick-damage") {
      return this.handleCardQuickDamage(state, message);
    }
    if (action === "card-mod-damage") {
      return this.handleCardModDamage(state, message);
    }
    if (action === "row-mod-damage") {
      return this.handleRowModDamage(state, targetRef, message);
    }

    // Apply actions
    if (action === "apply-full" || action === "apply-half" || action === "apply-none") {
      return this.handleApplyDamage(action, state, targetRef, message);
    }
    if (action === "gm-apply-all-full") {
      return this.handleGMApplyAllFull(state, message);
    }

    console.warn("SW5E Helper: Unhandled action", action);
  }

  /**
   * Handle expand/collapse all
   */
  static async handleToggleAll(state, message) {
    state.ui = state.ui || {};
    state.ui.expandedAll = !state.ui.expandedAll;
    await this.updateCard(message, state);
  }

  /**
   * Handle token ping
   */
  static handlePingToken(targetRef) {
    const { scene, token } = TargetFreezer.resolveSceneAndToken(targetRef);
    if (token?.object && canvas?.ping) {
      canvas.ping(token.object.center, { scene });
    }
  }

  /**
   * Handle token selection
   */
  static handleSelectToken(targetRef) {
    const { token } = TargetFreezer.resolveSceneAndToken(targetRef);
    if (token?.object) {
      token.object.control({ releaseOthers: true });
    }
  }

  /**
   * Handle show attack formula
   */
  static handleShowAttackFormula(state) {
    if (state.attack?.info) {
      ui.notifications.info(state.attack.info);
    }
  }

  /**
   * Handle show damage formula
   */
  static handleShowDamageFormula(state, targetRef) {
    const target = TargetFreezer.findTargetByRef(state.targets, targetRef);
    if (target?.damage?.info) {
      ui.notifications.info(target.damage.info);
    }
  }

  /**
   * Handle individual save roll
   */
  static async handleRollSave(state, targetRef, message) {
    const target = TargetFreezer.findTargetByRef(state.targets, targetRef);
    if (!target?.save || target.missing) return;

    // Check permissions
    if (!PermissionChecker.canRollForTarget(target)) {
      Helpers.notify("You don't have permission to roll for this target", "warn");
      return;
    }

    const saveResult = await this.rollSaveForTarget(target);
    StateManager.updateSaveResult(target, saveResult);
    
    if (saveResult.rollObj) {
      await this.appendRolls(message, [saveResult.rollObj]);
    }

    await this.updateCard(message, state);
  }

  /**
   * Handle GM roll all saves
   */
  static async handleGMRollAllSaves(state, message) {
    if (!PermissionChecker.isGM()) return;

    const targets = (state.targets || []).filter(t => 
      t.save && !t.save.roll && !t.missing
    );

    if (!targets.length) return;

    const allRolls = [];
    for (const target of targets) {
      const saveResult = await this.rollSaveForTarget(target);
      StateManager.updateSaveResult(target, saveResult);
      if (saveResult.rollObj) {
        allRolls.push(saveResult.rollObj);
      }
    }

    if (allRolls.length) {
      await this.appendRolls(message, allRolls);
    }

    await this.updateCard(message, state);
  }

  /**
   * Handle card quick damage
   */
  static async handleCardQuickDamage(state, message) {
    const eligible = this.getEligibleDamageTargets(state);
    if (!eligible.length) return;

    // Import damage workflow
    const { DamageAction } = await import('../../workflow/actions/damage.js');
    await DamageAction.rollQuickDamage(state, eligible, message);
  }

  /**
   * Handle card mod damage
   */
  static async handleCardModDamage(state, message) {
    const eligible = this.getEligibleDamageTargets(state);
    if (!eligible.length) return;

    // Import damage workflow
    const { DamageAction } = await import('../../workflow/actions/damage.js');
    await DamageAction.openDamageDialog(state, eligible, message, { separate: !!state?.options?.separate });
  }

  /**
   * Handle row mod damage
   */
  static async handleRowModDamage(state, targetRef, message) {
    const target = TargetFreezer.findTargetByRef(state.targets, targetRef);
    if (!target || target.missing) return;

    // Import damage workflow
    const { DamageAction } = await import('../../workflow/actions/damage.js');
    await DamageAction.openDamageDialog(state, [target], message, { 
      separate: true, 
      targetRef 
    });
  }

  /**
   * Handle apply damage
   */
  static async handleApplyDamage(action, state, targetRef, message) {
    const target = TargetFreezer.findTargetByRef(state.targets, targetRef);
    if (!target?.damage || target.missing) return;

    const mode = action.replace("apply-", "");
    StateManager.applyDamage(target, mode);

    // TODO: Call hooks for actual damage application
    // Hooks.callAll("sw5eHelper.applyDamage", { target, mode, amount: target.damage.appliedAmount });

    await this.updateCard(message, state);
  }

  /**
   * Handle GM apply all full
   */
  static async handleGMApplyAllFull(state, message) {
    if (!PermissionChecker.isGM()) return;

    const targets = (state.targets || []).filter(t => 
      t.damage && t.damage.total != null && !t.damage.applied && !t.missing
    );

    for (const target of targets) {
      StateManager.applyDamage(target, "full");
    }

    await this.updateCard(message, state);
  }

  /**
   * Get targets eligible for damage rolling
   */
  static getEligibleDamageTargets(state) {
    const saveOnly = !!state?.options?.saveOnly;
    const targets = state.targets || [];

    return targets.filter(t => {
      if (t.missing) return false;
      
      // Skip if damage already rolled
      if (t.damage && t.damage.total != null) return false;
      
      // In save-only mode, all targets are eligible
      if (saveOnly) return true;
      
      // Otherwise need hit or crit
      const status = String(t?.summary?.status || "");
      return status === "hit" || status === "crit";
    });
  }

  /**
   * Roll a saving throw for a target
   */
  static async rollSaveForTarget(target) {
    const abilityKey = target.save?.ability?.toLowerCase() || "wis";
    const actor = target._actor || game.actors?.get(target.actorId);
    const abilityMod = actor?.system?.abilities?.[abilityKey]?.mod ?? 0;

    const formula = `1d20+${abilityMod}`;
    const roll = new Roll(formula);
    await roll.evaluate({ async: true });

    // Show DSN animation
    try {
      await game.dice3d?.showForRoll?.(roll, game.user, true);
    } catch (e) {
      console.warn("SW5E Helper: DSN animation failed", e);
    }

    const total = Number(roll.total ?? 0);
    const dc = Number(target.save?.dc ?? Infinity);
    let outcome = total >= dc ? "success" : "fail";

    // Check for natural 20/1
    const d20Result = this.getFirstD20Result(roll);
    if (d20Result === 20) outcome = "critical";
    if (d20Result === 1) outcome = "fumble";

    return {
      total,
      formula: roll.formula,
      outcome,
      rollObj: roll
    };
  }

  /**
   * Get first d20 result from roll
   */
  static getFirstD20Result(roll) {
    try {
      const term = roll.terms?.find?.(t => t.faces === 20 && Array.isArray(t.results));
      return term?.results?.[0]?.result ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Update card display
   */
  static async updateCard(message, state, rolls = []) {
    const content = CardRenderer.render(state);
    const payload = {
      content,
      flags: { "sw5e-helper": { state } }
    };

    if (rolls.length) {
      payload.rolls = [...(message.rolls || []), ...rolls];
    }

    return message.update(payload);
  }

  /**
   * Append rolls to message
   */
  static async appendRolls(message, rolls) {
    if (!rolls?.length) return;
    return message.update({ 
      rolls: [...(message.rolls || []), ...rolls] 
    });
  }
}

export default CardHandlers;