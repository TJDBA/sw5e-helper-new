// scripts/ui/cards/handlers.js
import { StateManager } from '../../core/state/manager.js';
import { AttackCardRenderer } from './card-renderer.js';

export class CardHandlers {
  static init() {
    Hooks.on("renderChatMessage", (message, html) => {
      const root = html[0]?.querySelector(`.sw5e-helper-card[data-message-id="${message.id}"]`);
      if (!root) return;

      // Click actions
      root.addEventListener('click', (ev) => this.onCardClick(ev, message));

      // Arrow toggles: rotate caret + toggle <details>
      root.querySelectorAll('.expand-arrow').forEach(arrow => {
        arrow.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const details = arrow.closest('summary')?.parentElement;
          if (details && details.tagName === 'DETAILS') {
            details.open = !details.open;
          }
        });
      });

      // Expand/Collapse All
      root.querySelector('[data-action="toggle-all"]')?.addEventListener('click', (ev) => {
        ev.preventDefault();
        const open = !(root.dataset.expandedAll === 'true');
        root.dataset.expandedAll = String(open);
        root.querySelectorAll('.target-row').forEach(d => d.open = open);
      });
    });
  }

  static async onCardClick(event, message) {
    const el = event.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;
    if (!action) return;

    // Resolve row reference if present
    const ref =
      el.dataset.targetRef ||
      el.closest('.target-row')?.dataset?.targetRef ||
      null;

    const state = StateManager.getStateFromMessage(message);
    if (!state) return;

    // Handle local UI actions
    if (action === 'toggle-row') {
      const details = el.closest('summary')?.parentElement;
      if (details && details.tagName === 'DETAILS') details.open = !details.open;
      return;
    }
    if (action === 'toggle-all') return; // handled above

    // Domain actions (apply damage, reroll, etc.)
    const { rolls, newState } = await StateManager.dispatchAction(state, { action, ref });
    if (newState) {
      const html = new AttackCardRenderer(newState).render();
      await message.update({ content: html });
    }
    if (rolls?.length) {
      await message.update({ rolls: [...(message.rolls || []), ...rolls] });
    }
  }
}

export default CardHandlers;
