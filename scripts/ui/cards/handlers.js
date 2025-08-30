/**
 * Updated scripts/ui/cards/handlers.js 
 * Enhanced card event handling with better visual feedback
 */

import { StateManager } from '../../core/state/manager.js';
import { TargetFreezer } from '../../core/state/freezer.js';
import { ActorResolver } from '../../core/actors/resolver.js';
import { PermissionChecker } from '../../core/actors/permissions.js';
import { Helpers } from '../../core/utils/helpers.js';
import { AttackCardRenderer } from './card-renderer.js';

export class CardHandlers {
  static init() {
    Hooks.on("renderChatMessage", this.onRenderChatMessage.bind(this));
  }

  static onRenderChatMessage(message, html) {
    const cardRoot = html[0]?.querySelector?.(".sw5e-helper-card");
    if (!cardRoot) return;

    // Enhanced visual feedback
    this.enhanceCardAppearance(cardRoot);

    // Attach single delegated event listener
    cardRoot.addEventListener("click", (ev) => this.onCardClick(ev, message));
  }

  static enhanceCardAppearance(cardRoot) {
    // Add loading states for buttons
    const buttons = cardRoot.querySelectorAll('.quick-btn, .gm-btn, .action-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', function() {
        this.style.opacity = '0.7';
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
          this.style.opacity = '';
          this.style.transform = '';
        }, 150);
      });
    });

    // Add hover effects for target rows
    const targetRows = cardRoot.querySelectorAll('.target-row');
    targetRows.forEach(row => {
      row.addEventListener('mouseenter', function() {
        this.style.backgroundColor = 'rgba(0, 255, 136, 0.05)';
      });
      
      row.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '';
      });
    });

    // Enhance expand/collapse arrows
    const arrows = cardRoot.querySelectorAll('.expand-arrow');
    arrows.forEach(arrow => {
      arrow.style.transition = 'transform 0.2s ease';
    });
  }

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

    // Add visual feedback
    this.addActionFeedback(target);

    try {
      await this.handleAction(action, targetRef, state, message);
    } catch (error) {
      console.error("SW5E Helper: Card action error", error);
      Helpers.notify("An error occurred processing the action", "error");
    }
  }

  static addActionFeedback(element) {
    // Enhanced visual feedback for actions
    element.style.transform = 'scale(0.95)';
    element.style.opacity = '0.8';
    
    if (element.classList.contains('quick-btn')) {
      element.style.backgroundColor = '#00cc55';
    }
    
    setTimeout(() => {
      element.style.transform = '';
      element.style.opacity = '';
      element.style.backgroundColor = '';
    }, 200);
  }

  static async handleAction(action, targetRef, state, message) {
    // Enhanced action routing with better organization
    const actionMap = {
      // UI actions
      "toggle-all": () => this.handleToggleAll(state, message),
      
      // Token actions
      "ping-token": () => this.handlePingToken(targetRef),
      "select-token": () => this.handleSelectToken(targetRef),
      
      // Info actions
      "show-attack-formula": () => this.handleShowAttackFormula(state),
      "show-damage-formula": () => this.handleShowDamageFormula(state, targetRef),
      
      // Save actions
      "roll-save": () => this.handleRollSave(state, targetRef, message),
      "gm-roll-all-saves": () => this.handleGMRollAllSaves(state, message),
      
      // Damage actions
      "card-quick-damage": () => this.handleCardQuickDamage(state, message),
      "card-mod-damage": () => this.handleCardModDamage(state, message),
      "row-mod-damage": () => this.handleRowModDamage(state, targetRef, message),
      
      // Apply actions
      "apply-full": () => this.handleApplyDamage("apply-full", state, targetRef, message),
      "apply-half": () => this.handleApplyDamage("apply-half", state, targetRef, message),
      "apply-none": () => this.handleApplyDamage("apply-none", state, targetRef, message),
      "gm-apply-all-full": () => this.handleGMApplyAllFull(state, message)
    };

    const handler = actionMap[action];
    if (handler) {
      await handler();
    } else {
      console.warn("SW5E Helper: Unhandled action", action);
    }
  }

  // Keep all your existing handler methods, just update the card rendering
  static async handleToggleAll(state, message) {
    state.ui = state.ui || {};
    state.ui.expandedAll = !state.ui.expandedAll;
    await this.updateCard(message, state);
  }

  static handlePingToken(targetRef) {
    const { scene, token } = TargetFreezer.resolveSceneAndToken(targetRef);
    if (token?.object && canvas?.ping) {
      canvas.ping(token.object.center, { scene });
    }
  }

  static handleSelectToken(targetRef) {
    const { token } = TargetFreezer.resolveSceneAndToken(targetRef);
    if (token?.object) {
      token.object.control({ releaseOthers: true });
    }
  }

  static handleShowAttackFormula(state) {
    if (state.attack?.info) {
      ui.notifications.info(state.attack.info);
    }
  }

  static handleShowDamageFormula(state, targetRef) {
    const target = TargetFreezer.findTargetByRef(state.targets, targetRef);
    if (target?.damage?.info) {
      ui.notifications.info(target.damage.info);
    }
  }

  static async handleRollSave(state, targetRef, message) {
    const target = TargetFreezer.findTargetByRef(state.targets, targetRef);
    if (!target?.save || target.missing) return;

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

  static async handleCardQuickDamage(state, message) {
    const eligible = this.getEligibleDamageTargets(state);
    if (!eligible.length) return;

    const { DamageAction } = await import('../../workflow/actions/damage.js');
    await DamageAction.rollQuickDamage(state, eligible, message);
  }

  static async handleCardModDamage(state, message) {
    const eligible = this.getEligibleDamageTargets(state);
    if (!eligible.length) return;

    const { DamageAction } = await import('../../workflow/actions/damage.js');
    await DamageAction.openDamageDialog(state, eligible, message, { separate: !!state?.options?.separate });
  }

  static async handleRowModDamage(state, targetRef, message) {
    const target = TargetFreezer.findTargetByRef(state.targets, targetRef);
    if (!target || target.missing) return;

    const { DamageAction } = await import('../../workflow/actions/damage.js');
    await DamageAction.openDamageDialog(state, [target], message, { 
      separate: true, 
      targetRef 
    });
  }

  static async handleApplyDamage(action, state, targetRef, message) {
    const target = TargetFreezer.findTargetByRef(state.targets, targetRef);
    if (!target?.damage || target.missing) return;

    const mode = action.replace("apply-", "");
    StateManager.applyDamage(target, mode);

    await this.updateCard(message, state);
  }

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

  static getEligibleDamageTargets(state) {
    const saveOnly = !!state?.options?.saveOnly;
    const targets = state.targets || [];

    return targets.filter(t => {
      if (t.missing) return false;
      if (t.damage && t.damage.total != null) return false;
      
      if (saveOnly) return true;
      
      const status = String(t?.summary?.status || "");
      return status === "hit" || status === "crit";
    });
  }

  static async rollSaveForTarget(target) {
    const abilityKey = target.save?.ability?.toLowerCase() || "wis";
    const actor = target._actor || game.actors?.get(target.actorId);
    const abilityMod = actor?.system?.abilities?.[abilityKey]?.mod ?? 0;

    const formula = `1d20+${abilityMod}`;
    const roll = new Roll(formula);
    await roll.evaluate({ async: true });

    try {
      await game.dice3d?.showForRoll?.(roll, game.user, true);
    } catch (e) {
      console.warn("SW5E Helper: DSN animation failed", e);
    }

    const total = Number(roll.total ?? 0);
    const dc = Number(target.save?.dc ?? Infinity);
    let outcome = total >= dc ? "success" : "fail";

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

  static getFirstD20Result(roll) {
    try {
      const term = roll.terms?.find?.(t => t.faces === 20 && Array.isArray(t.results));
      return term?.results?.[0]?.result ?? null;
    } catch {
      return null;
    }
  }

  static async updateCard(message, state, rolls = []) {
    // Use the enhanced card renderer
    const renderer = new AttackCardRenderer(state);
    const content = renderer.render();
    
    const payload = {
      content,
      flags: { "sw5e-helper": { state } }
    };

    if (rolls.length) {
      payload.rolls = [...(message.rolls || []), ...rolls];
    }

    // Add smooth transition effect
    const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
    if (messageElement) {
      messageElement.style.opacity = '0.7';
      setTimeout(() => {
        messageElement.style.opacity = '';
      }, 300);
    }

    return message.update(payload);
  }

  static async appendRolls(message, rolls) {
    if (!rolls?.length) return;
    return message.update({ 
      rolls: [...(message.rolls || []), ...rolls] 
    });
  }
}

export default CardHandlers;