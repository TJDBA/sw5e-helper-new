/**
 * @file Renders the HTML for a condensed, single-message attack card.
 * @module scripts/core/chat/card-renderer
 */

// Assumed utility imports for cleaner, more modular code.
import { l } from './utils/localization.js';
import { getTargetRef, canUserControl } from './utils/actor-utils.js';
import { DEBUG } from '../constants.js';

/**
 * @typedef {object} TargetSave
 * @property {string} [ability] - The ability score for the save (e.g., 'dex').
 * @property {string} [type] - The type of save.
 * @property {number} [dc] - The difficulty class of the save.
 * @property {string} [formula] - The formula for the save DC.
 * @property {object} [roll] - Information about the save roll.
 * @property {number} roll.total - The total of the save roll.
 * @property {string} roll.outcome - 'success', 'fail', 'crit', 'fumble'.
 */

/**
 * @typedef {object} TargetDamage
 * @property {number} [total] - The total damage amount.
 * @property {string} [applied] - The status of applied damage ('full', 'half', 'none').
 * @property {string} [info] - The damage formula or other info.
 */

/**
 * @typedef {object} TargetSummary
 * @property {string} [status] - 'hit', 'miss', 'crit', 'fumble', 'pending', 'saveonly'.
 * @property {number} [attackTotal] - The total attack roll.
 * @property {number} [keptDie] - The result of the kept die in advantage/disadvantage.
 */

/**
 * @typedef {object} CardTarget
 * @property {string} name - The target's name.
 * @property {string} img - The URL for the target's portrait.
 * @property {string} sceneId - The ID of the scene the target is in.
 * @property {string} tokenId - The ID of the target's token.
 * @property {boolean} [missing] - If the token is missing from the canvas.
 * @property {object} [_actor] - The actor object associated with the target.
 * @property {TargetSummary} [summary] - The attack roll summary.
 * @property {TargetDamage} [damage] - The damage information.
 * @property {TargetSave} [save] - The saving throw information.
 */

/**
 * @typedef {object} CardState
 * @property {string} [messageId] - The ID of the chat message.
 * @property {string} [itemName] - The name of the item being used.
 * @property {string} [weaponImg] - The URL for the item's image.
 * @property {object} [attack]
 * @property {string} [attack.advState] - 'ADV', 'DIS', or 'NONE'.
 * @property {string} [attack.info] - The attack roll formula.
 * @property {CardTarget[]} [targets] - An array of target objects.
 * @property {boolean} [hasSave] - Whether the attack forces a save.
 * @property {object} [options]
 * @property {boolean} [options.saveOnly] - If the card is for a save-only effect.
 * @property {object} [ui]
 * @property {boolean} [ui.expandedAll] - UI state for expanding/collapsing all rows.
 */

/**
 * Renders an attack card based on a given state object.
 * This class builds the complete HTML string for the card, which is
 * highly performant as it avoids incremental DOM manipulation.
 */
export class AttackCardRenderer {
  /**
   * @param {CardState} state The state object for the card.
   */
  constructor(state) {
    /** @private */
    this.state = state;
    /** @private */
    this.isGM = game.user?.isGM === true;
    /** @private */
    this.saveOnly = !!this.state.options?.saveOnly;
  }

  /**
   * Renders the complete HTML for the chat card.
   * @returns {string} The full HTML content of the card.
   */
  render() {
    if (DEBUG) console.log("SW5E DEBUG: AttackCardRenderer.render() called", { state: this.state });
    
    return `
      <div class="sw5e-helper-card" data-message-id="${this.state.messageId ?? ""}">
        ${this._renderHeader()}
        <hr class="target-separator" />
        <div class="target-rows">
          ${this._renderTargets()}
        </div>
      </div>
    `;
  }

  /**
   * Renders the card's header section.
   * @private
   * @returns {string}
   */
  _renderHeader() {
    const attackInfoIcon = this.state.attack?.info
      ? `<span class="info-icon" data-action="show-attack-formula" title="${l("SW5EHELPER.AttackFormulaTooltip")}">ⓘ</span>`
      : "";
      
    const headerTitle = this.state.itemName || "Unknown Weapon";

    return `
      <header class="card-header">
        <div class="weapon-banner">
          <img src="${this.state.weaponImg ?? ""}" alt="${headerTitle}" class="weapon-icon" />
          <div class="weapon-title">
            <span class="name">${headerTitle}</span>
            ${attackInfoIcon}
          </div>
        </div>
        ${this._renderHeaderActions()}
      </header>
    `;
  }

  /**
   * Renders the header action buttons and GM toolbar.
   * @private
   * @returns {string}
   */
  _renderHeaderActions() {
    const targets = this.state.targets || [];
    
    // Determine visibility of GM bulk action buttons
    const hideRollAllDamage = targets.every(t => {
      const eligible = this.saveOnly || ["hit", "crit"].includes(String(t.summary?.status));
      return !eligible || t.missing || t.damage?.total != null;
    });

    const hideRollAllSaves = targets.every(t => !t.save || t.missing || !!t.save.roll);

    const gmToolbar = this.isGM ? `
      <div class="gm-toolbar">
        ${hideRollAllSaves ? "" : `<a class="mini-btn" data-action="gm-roll-all-saves">${l("SW5EHELPER.RollAllSaves")}</a>`}
        <a class="mini-btn" data-action="gm-apply-all-full">${l("SW5EHELPER.ApplyAllFull")}</a>
      </div>` : "";

    return `
      <div class="card-controls">
        <div class="damage-controls">
          ${hideRollAllDamage ? "" : `<a class="icon-btn" data-action="card-quick-damage" title="${l("SW5EHELPER.QuickDamage")}">⚡</a>`}
          ${hideRollAllDamage ? "" : `<a class="icon-btn" data-action="card-mod-damage" title="${l("SW5EHELPER.ModDamage")}">🎲</a>`}
        </div>
        ${gmToolbar}
        <a class="mini-btn toggle-all-btn" data-action="toggle-all">
          ${this.state.ui?.expandedAll ? l("SW5EHELPER.CollapseAll") : l("SW5EHELPER.ExpandAll")}
        </a>
      </div>
    `;
  }

  /**
   * Renders all target rows.
   * @private
   * @returns {string}
   */
  _renderTargets() {
    return (this.state.targets || []).map((t, i) => this._renderTargetRow(t, i)).join("");
  }

  /**
   * Renders a single target row (<details> element).
   * @private
   * @param {CardTarget} target The target data object.
   * @param {number} index The index of the target in the array.
   * @returns {string}
   */
  _renderTargetRow(target, index) {
    const ref = getTargetRef(target);
    const alternatingClass = index % 2 === 0 ? "even" : "odd";
    const canControl = canUserControl(target._actor);
    const nameAction = canControl ? "select-token" : "ping-token";
    
    return `
      <details class="target-row ${target.missing ? "missing" : ""} ${alternatingClass}" data-target-ref="${ref}" ${this.state.ui?.expandedAll ? "open" : ""}>
        <summary class="summary-row" data-action="toggle-details">
            <span class="expand-arrow">▶</span>
            <img class="portrait" src="${target.img}" />
            <span class="tname" data-action="${nameAction}" data-target-ref="${ref}">${target.name}</span>
            ${this.saveOnly ? this._renderSaveSummary(target) : this._renderAttackSummary(target)}
            ${this._renderSummaryActions(target)}
        </summary>
        <div class="row-body">
          ${this.state.hasSave ? this._renderSaveLine(target) : ""}
          ${this._renderDamageLine(target)}
        </div>
      </details>
    `;
  }
  
  /**
   * Renders the summary portion for a standard attack.
   * @private
   * @param {CardTarget} target
   * @returns {string}
   */
  _renderAttackSummary(target) {
    const { status = "pending", attackTotal, keptDie } = target.summary || {};
    const kept = Number.isFinite(keptDie) ? ` (${keptDie})` : "";
    const atk = Number.isFinite(attackTotal) ? `${attackTotal}${kept}` : "—";
    const dmgDisplay = target.damage?.total != null ? `💥 ${target.damage.total}` : (["hit", "crit"].includes(status)) ? "💥 --" : "—";

    const statusMap = { hit: "●", miss: "○", crit: "◆", fumble: "○", pending: "●" };
    const statusIcon = statusMap[status] || "●";

    return `
      <span class="attack-total">${atk} 
        <span class="status-icon status-${status}" title="${status.toUpperCase()}">${statusIcon}</span>
      </span>
      <span class="damage-summary">${dmgDisplay}</span>
    `;
  }

  /**
   * Renders the summary portion for a save-only effect.
   * @private
   * @param {CardTarget} target
   * @returns {string}
   */
  _renderSaveSummary(target) {
    const { ability, dc, roll } = target.save || {};
    const outcomeMap = { success: "✅", fail: "❌", critical: "💥", fumble: "💩" };
    const rollInfo = roll ? ` | ${roll.total} ${outcomeMap[roll.outcome] || ""}` : '';
    
    return `
      <span class="save-summary">
        ${ability?.toUpperCase() || 'SAVE'} DC ${dc ?? '—'}${rollInfo}
      </span>
    `;
  }

  /**
   * Renders the action icons (apply full/half, info) on the summary row.
   * @private
   * @param {CardTarget} target
   * @returns {string}
   */
  _renderSummaryActions(target) {
    const ref = getTargetRef(target);
    const infoIcon = target.damage?.info 
        ? `<span class="info-icon" data-action="show-damage-formula" data-target-ref="${ref}" title="${l("SW5EHELPER.DamageFormulaTooltip")}">ⓘ</span>` 
        : "";

    if (target.damage?.applied) {
        return `<span class="row-actions applied">✓ ${infoIcon}</span>`;
    }

    // Don't show apply buttons if damage isn't possible (e.g. a miss)
    if (!this.saveOnly && !["hit", "crit"].includes(target.summary?.status)) {
        return `<span class="row-actions"></span>`;
    }

    return `
      <span class="row-actions">
        <a class="icon-btn" data-action="apply-full" title="${l("SW5EHELPER.ApplyFull")}" data-target-ref="${ref}">💯</a>
        <a class="icon-btn" data-action="apply-half" title="${l("SW5EHELPER.ApplyHalf")}" data-target-ref="${ref}">½</a>
        ${infoIcon}
      </span>
    `;
  }

  /**
   * Renders the save line in the expanded details section.
   * @private
   * @param {CardTarget} target
   * @returns {string}
   */
  _renderSaveLine(target) {
    const { ability, dc, formula, roll } = target.save || {};
    const ref = getTargetRef(target);

    const outcomeMap = { success: "✅", fail: "❌", critical: "💥", fumble: "💩" };
    const rollDisplay = roll 
      ? `<span class="save-result">${roll.total} ${outcomeMap[roll.outcome] || ""}</span>` 
      : `<a class="mini-btn" data-action="roll-save" data-target-ref="${ref}">${l("SW5EHELPER.RollSave")}</a>`;

    return `
      <div class="save-line">
        <span>🛡️ ${(ability?.toUpperCase() || l("SW5EHELPER.Save"))} | DC: 
          <span class="save-dc" ${formula ? `title="${formula}"` : ""}>${dc ?? "—"}</span>
        </span>
        ${rollDisplay}
      </div>
    `;
  }

  /**
   * Renders the damage line in the expanded details section.
   * @private
   * @param {CardTarget} target
   * @returns {string}
   */
  _renderDamageLine(target) {
    const { total, applied, info } = target.damage || {};
    const ref = getTargetRef(target);

    const appliedTag = applied ? `<span class="applied-tag">[${String(applied).toUpperCase()}]</span>` : "";
    
    const dmgControls = applied ? "" : `
      <span class="icons">
        <a class="icon-btn" data-action="row-mod-damage" data-target-ref="${ref}" title="${l("SW5EHELPER.ModDamage")}">🎲</a>
        <a class="icon-btn" data-action="apply-full" data-target-ref="${ref}" title="${l("SW5EHELPER.ApplyFull")}">💯</a>
        <a class="icon-btn" data-action="apply-half" data-target-ref="${ref}" title="${l("SW5EHELPER.ApplyHalf")}">½</a>
        <a class="icon-btn" data-action="apply-none" data-target-ref="${ref}" title="${l("SW5EHELPER.ApplyNone")}">Ø</a>
      </span>
    `;

    const infoIcon = info ? `<span class="info-icon" data-action="show-damage-formula" data-target-ref="${ref}" title="${l("SW5EHELPER.DamageFormulaTooltip")}">ⓘ</span>` : "";

    return `
      <div class="damage-line">
        <span>💥 ${l("SW5EHELPER.Damage")}:</span>
        <span class="dmg-val">${total ?? "—"}</span>
        ${appliedTag}
        ${dmgControls}
        ${infoIcon}
      </div>
    `;
  }
}