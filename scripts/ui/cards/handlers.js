// scripts/ui/cards/handlers.js
import { CardRenderer } from './renderer.js';

export class CardHandlers {
  static init() {
    Hooks.on("renderChatMessage", (message, html) => {
      const root = html[0]?.querySelector('.sw5e-helper-card');
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

      // Domain actions
      root.addEventListener('click', async (ev) => {
        const a = ev.target.closest('[data-action]');
        if (!a) return;
        const action = a.dataset.action;
        if (!['apply-full','apply-half','apply-none','row-mod-damage'].includes(action)) return;
        ev.preventDefault();
        const ref = a.dataset.targetRef || a.closest('.target-row')?.dataset.targetRef || null;
        if (!ref) return ui.notifications?.warn?.('No target ref on row.');
        // Hook into your pipeline here if desired. Open row as visible feedback.
        a.closest('.target-row')?.setAttribute('open','');
      });
    });
  }
}
export default CardHandlers;
