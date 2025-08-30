/**
 * Updated scripts/ui/cards/card-renderer.js
 * Enhanced compact card rendering to match PF2e style
 */

//import { l } from './utils/localization.js';
//import { getTargetRef, canUserControl } from './utils/actor-utils.js';
//import { DEBUG } from '../constants.js';

/**
 * Renders an attack card based on a given state object with enhanced compactness
 */
export class AttackCardRenderer {
  constructor(state) {
    this.state = state;
    this.isGM = game.user?.isGM === true;
    this.saveOnly = !!this.state.options?.saveOnly;
  }

  render() {
    if (DEBUG) console.log("SW5E DEBUG: AttackCardRenderer.render() called", { state: this.state });
    
    return `
      <div class="sw5e-helper-card" data-message-id="${this.state.messageId ?? ""}">
        ${this._renderHeader()}
        ${this._renderControls()}
        <div class="target-rows">
          ${this._renderTargets()}
        </div>
      </div>
    `;
  }

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
          </div>
        </div>
        ${attackInfoIcon}
      </header>
    `;
  }

  _renderControls() {
    const targets = this.state.targets || [];
    
    // Determine visibility of action buttons
    const hideRollAllDamage = targets.every(t => {
      const eligible = this.saveOnly || ["hit", "crit"].includes(String(t.summary?.status));
      return !eligible || t.missing || t.damage?.total != null;
    });

    const hideRollAllSaves = targets.every(t => !t.save || t.missing || !!t.save.roll);

    const damageControls = `
      <div class="damage-controls">
        ${hideRollAllDamage ? "" : `<button class="quick-btn" data-action="card-quick-damage" title="${l("SW5EHELPER.QuickDamage")}">⚡ Quick</button>`}
        ${hideRollAllDamage ? "" : `<button class="quick-btn" data-action="card-mod-damage" title="${l("SW5EHELPER.ModDamage")}">🎲 Modify</button>`}
      </div>
    `;

    const gmToolbar = this.isGM ? `
      <div class="gm-toolbar">
        ${hideRollAllSaves ? "" : `<button class="gm-btn" data-action="gm-roll-all-saves">${l("SW5EHELPER.RollAllSaves")}</button>`}
        <button class="gm-btn" data-action="gm-apply-all-full">${l("SW5EHELPER.ApplyAllFull")}</button>
      </div>` : "";

    const expandToggle = `<button class="gm-btn toggle-all-btn" data-action="toggle-all">${this.state.ui?.expandedAll ? l("SW5EHELPER.CollapseAll") : l("SW5EHELPER.ExpandAll")}</button>`;

    return `
      <div class="card-controls">
        ${damageControls}
        ${gmToolbar}
        ${expandToggle}
      </div>
    `;
  }

  _renderTargets() {
    return (this.state.targets || []).map((t, i) => this._renderTargetRow(t, i)).join("");
  }

  _renderTargetRow(target, index) {
    const ref = getTargetRef(target);
    const alternatingClass = index % 2 === 0 ? "even" : "odd";
    const canControl = canUserControl(target._actor);
    const nameAction = canControl ? "select-token" : "ping-token";
    
    return `
      <details class="target-row ${target.missing ? "missing" : ""} ${alternatingClass}" data-target-ref="${ref}" ${this.state.ui?.expandedAll ? "open" : ""}>
        <summary class="summary-row" data-action="toggle-details">
          <span class="expand-arrow">▶</span>
          <img class="portrait" src="${target.img}" alt="${target.name}" />
          <span class="tname" data-action="${nameAction}" data-target-ref="${ref}">${target.name}</span>
          ${this.saveOnly ? this._renderSaveSummary(target) : this._renderAttackSummary(target)}
          <span class="row-actions${target.damage?.applied ? ' applied' : ''}">
            ${this._renderSummaryActions(target)}
            ${target.missing ? `<span class="missing">[${l("SW5EHELPER.Missing")}]</span>` : ""}
          </span>
        </summary>
        <div class="row-body">
          ${this.state.hasSave ? this._renderSaveLine(target) : ""}
          ${this._renderDamageLine(target)}
        </div>
      </details>
    `;
  }
  
  _renderSaveSummary(target) {
    const { ability = "save", dc, roll } = target.save || {};
    const outcomeMap = { success: "✅", fail: "❌", critical: "💥", fumble: "💩" };
    const rollInfo = roll ? ` | ${roll.total} ${outcomeMap[roll.outcome] || ""}` : '';
    
    return `
      <span class="save-summary">
        ${ability.toUpperCase()} DC ${dc ?? '—'}${rollInfo}
      </span>
    `;
  }

  _renderAttackSummary(target) {
    const { status = "pending", attackTotal, keptDie } = target.summary || {};
    const kept = Number.isFinite(keptDie) ? ` (${keptDie})` : "";
    const atk = Number.isFinite(attackTotal) ? `${attackTotal}${kept}` : "—";
    const dmgDisplay = target.damage?.total != null ? `💥 ${target.damage.total}` : (["hit", "crit"].includes(status)) ? "💥 --" : "—";

    const statusMap = { hit: "●", miss: "○", crit: "◆", fumble: "○", pending: "●" };
    const statusIcon = statusMap[status] || "●";
    const statusClass = `status-${status}`;

    return `
      <span class="attack-total">${atk} <span class="status-icon ${statusClass}" title="${status.toUpperCase()}">${statusIcon}</span></span>
      <span class="damage-summary">${dmgDisplay}</span>
    `;
  }

  _renderSummaryActions(target) {
    const ref = getTargetRef(target);
    const infoIcon = target.damage?.info 
      ? `<span class="info-icon" data-action="show-damage-formula" data-target-ref="${ref}" title="${l("SW5EHELPER.DamageFormulaTooltip")}">ⓘ</span>` 
      : "";

    if (target.damage?.applied) {
      return `✓ ${infoIcon}`;
    }

    // Don't show apply buttons if damage isn't possible
    if (!this.saveOnly && !["hit", "crit"].includes(target.summary?.status)) {
      return "";
    }

    return `
      <a class="action-btn" data-action="apply-full" title="${l("SW5EHELPER.ApplyFull")}" data-target-ref="${ref}">💯</a>
      <a class="action-btn" data-action="apply-half" title="${l("SW5EHELPER.ApplyHalf")}" data-target-ref="${ref}">½</a>
      ${infoIcon}
    `;
  }

  _renderSaveLine(target) {
    const { ability, dc, formula, roll } = target.save || {};
    const ref = getTargetRef(target);

    const outcomeMap = { success: "✅", fail: "❌", critical: "💥", fumble: "💩" };
    const rollDisplay = roll 
      ? `<span class="save-result">${roll.total} ${outcomeMap[roll.outcome] || ""}</span>` 
      : `<button class="gm-btn" data-action="roll-save" data-target-ref="${ref}">${l("SW5EHELPER.RollSave")}</button>`;

    return `
      <div class="save-line">
        <span class="detail-label">🛡️ ${(ability?.toUpperCase() || l("SW5EHELPER.Save"))} | DC: 
          <span class="save-dc" ${formula ? `title="${formula}"` : ""}>${dc ?? "—"}</span>
        </span>
        ${rollDisplay}
      </div>
    `;
  }

  _renderDamageLine(target) {
    const { total, applied, info } = target.damage || {};
    const ref = getTargetRef(target);

    const appliedTag = applied ? `<span class="applied-tag">[${String(applied).toUpperCase()}]</span>` : "";
    
    const dmgControls = applied ? "" : `
      <div class="damage-controls">
        <a class="action-btn" data-action="row-mod-damage" data-target-ref="${ref}" title="${l("SW5EHELPER.ModDamage")}">🎲</a>
        <a class="action-btn" data-action="apply-full" data-target-ref="${ref}" title="${l("SW5EHELPER.ApplyFull")}">💯</a>
        <a class="action-btn" data-action="apply-half" data-target-ref="${ref}" title="${l("SW5EHELPER.ApplyHalf")}">½</a>
        <a class="action-btn" data-action="apply-none" data-target-ref="${ref}" title="${l("SW5EHELPER.ApplyNone")}">Ø</a>
      </div>
    `;

    const infoIcon = info ? `<span class="info-icon" data-action="show-damage-formula" data-target-ref="${ref}" title="${l("SW5EHELPER.DamageFormulaTooltip")}">ⓘ</span>` : "";

    return `
      <div class="damage-line">
        <span class="detail-label">💥 ${l("SW5EHELPER.Damage")}: <span class="dmg-val">${total ?? "—"}</span></span>
        ${appliedTag}
        ${dmgControls}
        ${infoIcon}
      </div>
    `;
  }
}