// scripts/ui/cards/handlers.js
import { AttackCardRenderer } from './card-renderer.js';

export class CardHandlers {
  static init() {
    console.log("SW5E Helper: CardHandlers.init() called");
    Hooks.on("renderChatMessage", (message, html) => {
      console.log("SW5E Helper: renderChatMessage hook triggered", { message, html });
      const root = html[0]?.querySelector('.sw5e-helper-card');
      console.log("SW5E Helper: Found root element:", root);
      if (!root) return;

      // Toggle one row
      root.querySelectorAll('[data-action="toggle-row"]').forEach(el => {
        el.addEventListener('click', (ev) => {
          ev.preventDefault();
          const details = el.closest('summary')?.parentElement;
          if (details?.tagName === "DETAILS") details.open = !details.open;
        });
      });

      // Expand / Collapse all
      root.querySelector('[data-action="toggle-all"]')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        const rows = root.querySelectorAll('.target-row');
        const open = [...rows].some(r => !r.open);
        rows.forEach(r => r.open = open);
      });

      // Handle all card actions
      root.addEventListener('click', async (ev) => {
        const actionElement = ev.target.closest('[data-action]');
        if (!actionElement) return;
        
        const action = actionElement.dataset.action;
        const messageId = root.dataset.messageId;
        const targetRef = actionElement.dataset.targetRef;
        
        console.log("SW5E Helper: Action triggered:", action, { messageId, targetRef });
        
        ev.preventDefault();
        
        try {
          // Get the stored state from the message
          const message = game.messages?.get(messageId);
          if (!message) {
            console.error("SW5E Helper: Could not find message:", messageId);
            return;
          }
          
                     const state = message.getFlag('sw5e-helper-new', 'state');
           if (!state) {
             console.error("SW5E Helper: No state found on message:", messageId);
             return;
           }
           
           console.log("SW5E Helper: Retrieved state:", state);
           console.log("SW5E Helper: State structure:", {
             actorId: state.actorId,
             itemId: state.itemId,
             weaponId: state.weaponId,
             targets: state.targets?.length || 0
           });
          
                     // Handle different action types
           switch (action) {
             case 'card-quick-damage':
               await this.handleQuickDamage(state, targetRef);
               break;
               
             case 'card-mod-damage':
               await this.handleModDamage(state, targetRef);
               break;
               
             case 'gm-roll-all-saves':
               await this.handleRollAllSaves(state);
               break;
               
             case 'gm-apply-all-full':
               await this.handleApplyAllFull(state);
               break;
               
             case 'apply-full':
             case 'apply-half':
             case 'apply-none':
               await this.handleApplyDamage(state, targetRef, action);
               break;
               
             case 'row-mod-damage':
               await this.handleRowModDamage(state, targetRef);
               break;
               
             case 'show-attack-formula':
               await this.handleShowAttackFormula(state);
               break;
               
             case 'toggle-row':
               // This is handled by the existing toggle logic above
               console.log("SW5E Helper: toggle-row handled by existing logic");
               break;
               
             default:
               console.log("SW5E Helper: Unhandled action:", action);
           }
          
        } catch (error) {
          console.error("SW5E Helper: Error handling action:", action, error);
          ui.notifications?.error?.(`Error: ${error.message}`);
        }
      });
    });
  }
  
  // Handle quick damage application
  static async handleQuickDamage(state, targetRef) {
    console.log("SW5E Helper: Handling quick damage for target:", targetRef);
    
    try {
      // Import the damage action
      const { DamageAction } = await import('../../workflow/actions/damage.js');
      
      // Get the actor and item from state
      const actor = game.actors?.get(state.actorId);
      const item = actor?.items?.get(state.itemId);
      
      console.log("SW5E Helper: Looking up actor:", state.actorId, "found:", actor);
      console.log("SW5E Helper: Looking up item:", state.itemId, "found:", item);
      
      if (!actor || !item) {
        ui.notifications?.warn?.("Could not find actor or item for quick damage");
        return;
      }
      
      // If targetRef is provided, use just that target, otherwise use all targets
      const targets = targetRef ? [this.resolveTargetRef(targetRef)] : state.targets;
      
      if (!targets || targets.length === 0) {
        ui.notifications?.warn?.("No targets found for quick damage");
        return;
      }
      
      // Execute quick damage
      const result = await DamageAction.execute({
        actor,
        item,
        config: state.options || {},
        targets,
        state
      });
      
      if (result.ok) {
        ui.notifications?.info?.("Quick damage applied successfully");
      } else {
        ui.notifications?.warn?.(`Quick damage failed: ${result.errors.join(', ')}`);
      }
      
    } catch (error) {
      console.error("SW5E Helper: Error executing quick damage:", error);
      ui.notifications?.error?.(`Quick damage failed: ${error.message}`);
    }
  }
  
  // Handle damage modification dialog
  static async handleModDamage(state, targetRef) {
    console.log("SW5E Helper: Handling mod damage for target:", targetRef);
    
    try {
      // Import the damage dialog
      const { DamageDialog } = await import('../dialogs/DamageDialog.js');
      
      const actor = game.actors?.get(state.actorId);
      const item = actor?.items?.get(state.itemId);
      
      console.log("SW5E Helper: Looking up actor for mod damage:", state.actorId, "found:", actor);
      console.log("SW5E Helper: Looking up item for mod damage:", state.itemId, "found:", item);
      
      if (!actor || !item) {
        ui.notifications?.warn?.("Could not find actor or item for damage dialog");
        return;
      }
      
      // Create and show the damage dialog
      const dialog = new DamageDialog({
        actor,
        item,
        config: state.options || {},
        targets: targetRef ? [this.resolveTargetRef(targetRef)] : state.targets,
        state: state
      });
      
      await dialog.render(true);
      
    } catch (error) {
      console.error("SW5E Helper: Error opening damage dialog:", error);
      ui.notifications?.error?.(`Failed to open damage dialog: ${error.message}`);
    }
  }
  
  // Handle rolling all saves
  static async handleRollAllSaves(state) {
    console.log("SW5E Helper: Handling roll all saves");
    
    try {
      // Import the save action
      const { SaveAction } = await import('../../workflow/actions/save.js');
      
      // Get the actor and item from state
      const actor = game.actors?.get(state.actorId);
      const item = actor?.items?.get(state.itemId);
      
      if (!actor || !item) {
        ui.notifications?.warn?.("Could not find actor or item for save rolls");
        return;
      }
      
      // Execute save rolls for all targets
      const result = await SaveAction.execute({
        actor,
        item,
        config: state.options || {},
        targets: state.targets,
        state
      });
      
      if (result.ok) {
        ui.notifications?.info?.("All saves rolled successfully");
      } else {
        ui.notifications?.warn?.(`Save rolls failed: ${result.errors.join(', ')}`);
      }
      
    } catch (error) {
      console.error("SW5E Helper: Error rolling all saves:", error);
      ui.notifications?.error?.(`Save rolls failed: ${error.message}`);
    }
  }
  
  // Handle applying full damage to all targets
  static async handleApplyAllFull(state) {
    console.log("SW5E Helper: Handling apply all full damage");
    
    try {
      // Import the damage action
      const { DamageAction } = await import('../../workflow/actions/damage.js');
      
      // Get the actor and item from state
      const actor = game.actors?.get(state.actorId);
      const item = actor?.items?.get(state.itemId);
      
      if (!actor || !item) {
        ui.notifications?.warn?.("Could not find actor or item for damage application");
        return;
      }
      
      // Execute full damage application to all targets
      const result = await DamageAction.execute({
        actor,
        item,
        config: { ...state.options, applyMode: 'full' },
        targets: state.targets,
        state
      });
      
      if (result.ok) {
        ui.notifications?.info?.("Full damage applied to all targets successfully");
      } else {
        ui.notifications?.warn?.(`Damage application failed: ${result.errors.join(', ')}`);
      }
      
    } catch (error) {
      console.error("SW5E Helper: Error applying full damage to all targets:", error);
      ui.notifications?.error?.(`Damage application failed: ${error.message}`);
    }
  }
  
  // Handle applying damage to a specific target
  static async handleApplyDamage(state, targetRef, mode) {
    console.log("SW5E Helper: Handling apply damage:", mode, "for target:", targetRef);
    
    try {
      // Import the damage action
      const { DamageAction } = await import('../../workflow/actions/damage.js');
      
      // Get the actor and item from state
      const actor = game.actors?.get(state.actorId);
      const item = actor?.items?.get(state.itemId);
      
      if (!actor || !item) {
        ui.notifications?.warn?.("Could not find actor or item for damage application");
        return;
      }
      
      // Resolve the specific target
      const target = this.resolveTargetRef(targetRef);
      if (!target) {
        ui.notifications?.warn?.("Could not resolve target reference");
        return;
      }
      
      // Execute damage application with the specified mode
      const result = await DamageAction.execute({
        actor,
        item,
        config: { ...state.options, applyMode: mode },
        targets: [target],
        state
      });
      
      if (result.ok) {
        ui.notifications?.info?.(`${mode} damage applied successfully`);
      } else {
        ui.notifications?.warn?.(`Damage application failed: ${result.errors.join(', ')}`);
      }
      
    } catch (error) {
      console.error("SW5E Helper: Error applying damage:", error);
      ui.notifications?.error?.(`Damage application failed: ${error.message}`);
    }
  }
  
  // Handle row damage modification
  static async handleRowModDamage(state, targetRef) {
    console.log("SW5E Helper: Handling row damage modification for target:", targetRef);
    
    try {
      // Import the damage dialog
      const { DamageDialog } = await import('../dialogs/DamageDialog.js');
      
      // Resolve the specific target
      const target = this.resolveTargetRef(targetRef);
      if (!target) {
        ui.notifications?.warn?.("Could not resolve target reference");
        return;
      }
      
      // Create and show the damage dialog for this specific target
      const actor = game.actors?.get(state.actorId);
      const item = actor?.items?.get(state.itemId);
      
      const dialog = new DamageDialog({
        actor,
        item,
        config: state.options || {},
        targets: [target],
        state: state
      });
      
      await dialog.render(true);
      
    } catch (error) {
      console.error("SW5E Helper: Error opening row damage dialog:", error);
      ui.notifications?.error?.(`Failed to open damage dialog: ${error.message}`);
    }
  }
  
  // Handle showing attack formula
  static async handleShowAttackFormula(state) {
    console.log("SW5E Helper: Handling show attack formula");
    
    try {
      // Show the attack formula in a notification
      const formula = state.attack?.formula || state.attack?.info || "No formula available";
      ui.notifications?.info?.(`Attack Formula: ${formula}`);
      
    } catch (error) {
      console.error("SW5E Helper: Error showing attack formula:", error);
      ui.notifications?.error?.(`Failed to show attack formula: ${error.message}`);
    }
  }
  
  // Resolve a target reference (sceneId:tokenId) to a target object
  static resolveTargetRef(targetRef) {
    if (!targetRef || typeof targetRef !== 'string') return null;
    
    const [sceneId, tokenId] = targetRef.split(':');
    console.log("SW5E Helper: Parsed targetRef:", { targetRef, sceneId, tokenId });
    
    if (!sceneId || !tokenId) return null;
    
    try {
      const scene = game.scenes?.get(sceneId);
      console.log("SW5E Helper: Found scene:", scene);
      if (!scene) return null;
      
      const token = scene.tokens?.get(tokenId);
      console.log("SW5E Helper: Found token:", token);
      if (!token) return null;
      
      const result = {
        sceneId,
        tokenId,
        name: token.name,
        img: token.document?.texture?.src,
        actorId: token.actor?.id,
        ac: token.actor?.system?.attributes?.ac?.value
      };
      console.log("SW5E Helper: Resolved target:", result);
      return result;
      
    } catch (error) {
      console.error("SW5E Helper: Error resolving target ref:", targetRef, error);
      return null;
    }
  }
}

export default CardHandlers;
