/**
 * Chat card rendering utilities
 * Handles rendering attack cards from state data
 * @file Renders the HTML for a condensed, single-message attack card
 * @module scripts/ui/cards/renderer
 */

import { Helpers } from '../../core/utils/helpers.js';
import { PermissionChecker } from '../../core/actors/permissions.js';
import { isDebug } from '../../config.js';

/**
 * @typedef {object} TargetSave
 * @property {string} [ability] - The ability score for the save (e.g., 'dex')
 * @property {string} [type] - The type of save
 * @property {number} [dc] - The difficulty class of the save
 * @property {string} [formula] - The formula for the save DC
 * @property {object} [roll] - Information about the save roll
 * @property {number} roll.total - The total of the save roll
 * @property {string} roll.outcome - 'success', 'fail', 'critical', 'fumble'
 */

/**
 * @typedef {object} TargetDamage
 * @property {number} [total] - The total damage amount
 * @property {string} [applied] - The status of applied damage ('full', 'half', 'none')
 * @property {string} [info] - The damage formula or other info
 */

/**
 * @typedef {object} TargetSummary
 * @property {string} [status] - 'hit', 'miss', 'crit', 'fumble', 'pending', 'saveonly'
 * @property {number} [attackTotal] - The total attack roll
 * @property {number} [keptDie] - The result of the kept die in advantage/disadvantage
 */

/**
 * @typedef {object} CardTarget
 * @property {string} name - The target's name
 * @property {string} img - The URL for the target's portrait
 * @property {string} sceneId - The ID of the scene the target is in
 * @property {string} tokenId - The ID of the target's token
 * @property {boolean} [missing] - If the token is missing from the canvas
 * @property {Actor} [actor] - The actor object associated with the target
 * @property {TargetSummary} [summary] - The attack roll summary
 * @property {TargetDamage} [damage] - The damage information
 * @property {TargetSave} [save] - The saving throw information
 */

/**
 * @typedef {object} CardState
 * @property {string} [messageId] - The ID of the chat message
 * @property {string} [itemName] - The name of the item being used
 * @property {string} [weaponImg] - The URL for the item's image
 * @property {object} [attack]
 * @property {string} [attack.advState] - 'ADV', 'DIS', or 'NONE'
 * @property {string} [attack.info] - The attack roll formula
 * @property {CardTarget[]} [targets] - An array of target objects
 * @property {boolean} [hasSave] - Whether the attack forces a save
 * @property {object} [options]
 * @property {boolean} [options.saveOnly] - If the card is for a save-only effect
 * @property {object} [ui]
 * @property {boolean} [ui.expandedAll] - UI state for expanding/collapsing all rows
 */

/**
 * Renders attack cards based on state objects with comprehensive HTML output
 * This class builds complete HTML strings for optimal performance
 */
export class CardRenderer {
  /**
   * Render an attack card from state
   * @param {CardState} state - Card state object
   * @returns {string} Rendered HTML
   */
  static render(state) {
    if (isDebug()) {
      console.log("SW5E Helper Debug: CardRenderer.render() called", { state });
    }
    
    const context = this.buildRenderContext(state);
    return this.renderTemplate(context);
  }

  /**
   * Build rendering context from state
   * @param {object} state - Card state object
   * @returns {object} Template context
   */
  static buildRenderContext(state) {
    const isGM = PermissionChecker.isGM();
    const saveOnly = !!state?.options?.saveOnly;

    // Build header context
    const weaponName = state.itemName || state.weaponName || "Unknown Weapon";
    const weaponImg = state.weaponImg || "";
    
    // Build control visibility
    const controls = this.buildControlsContext(state, isGM);
    
    // Build target rows
    const targets = this.buildTargetsContext(state.targets || [], state, isGM);

    return {
      messageId: state.messageId || "",
      weaponName,
      weaponImg,
      attackInfo: state.attack?.info,
      saveOnly,
      isGM,
      ...controls,
      targets,
      hasSave: !!state.hasSave,
      expandedAll: !!state.ui?.expandedAll
    };
  }

  /**
   * Build controls context (buttons, GM toolbar)
   * @param {object} state - Card state
   * @param {boolean} isGM - Is current user GM
   * @returns {object} Controls context
   */
  static buildControlsContext(state, isGM) {
    const targets = state.targets || [];
    const saveOnly = !!state?.options?.saveOnly;

    // Check if quick damage should be hidden
    const hideQuickDamage = targets.every(t => {
      const eligible = saveOnly || ["hit", "crit"].includes(String(t?.summary?.status || ""));
      if (!eligible || t.missing) return true;
      return t?.damage?.total != null;
    });

    // Check if roll all saves should be hidden  
    const hideRollAllSaves = targets.every(t => {
      if (!t?.save || t.missing) return true;
      return !!t.save?.roll;
    });

    return {
      hideQuickDamage,
      hideModDamage: hideQuickDamage, // Same logic for both
      hideRollAllSaves
    };
  }

  /**
   * Build targets context for rendering
   * @param {Array} targets - Target objects
   * @param {object} state - Full card state
   * @param {boolean} isGM - Is current user GM
   * @returns {Array} Target render contexts
   */
  static buildTargetsContext(targets, state, isGM) {
    const saveOnly = !!state?.options?.saveOnly;

    return targets.map((target, index) => {
      const ref = `${target.sceneId}:${target.tokenId}`;
      const status = String(target?.summary?.status || "pending");
      
      // Build attack display
      const attackContext = this.buildAttackContext(target);
      
      // Build damage display
      const damageContext = this.buildDamageContext(target, saveOnly, status);
      
      // Build save display
      const saveContext = this.buildSaveContext(target, state.hasSave);

      // Check permissions
      const canControl = PermissionChecker.canControlTarget(target);

      return {
        ...target,
        ref,
        index,
        canControl,
        ...attackContext,
        ...damageContext,
        ...saveContext,
        alternatingClass: index % 2 === 0 ? "even" : "odd"
      };
    });
  }

  /**
   * Build attack context for a target
   * @param {object} target - Target object
   * @returns {object} Attack context
   */
  static buildAttackContext(target) {
    const kept = Number.isFinite(target?.summary?.keptDie) ? ` (${target.summary.keptDie})` : "";
    const total = Number.isFinite(target?.summary?.attackTotal) ? target.summary.attackTotal : null;
    const status = String(target?.summary?.status || "pending");

    const attackDisplay = total !== null ? `${total}${kept}` : "—";
    
    const statusClass = ({
      hit: "status-hit",
      miss: "status-miss", 
      crit: "status-crit",
      fumble: "status-fumble",
      saveonly: "status-saveonly",
      pending: "status-pending"
    })[status] || "status-pending";

    const statusIcon = ({
      hit: "●",
      miss: "○",
      crit: "◆", 
      fumble: "○",
      saveonly: "🛡️",
      pending: "●"
    })[status] || "●";

    const statusText = status.toUpperCase();

    return {
      attackDisplay,
      statusClass,
      statusIcon,
      statusText
    };
  }

  /**
   * Build damage context for a target
   * @param {object} target - Target object
   * @param {boolean} saveOnly - Save-only mode
   * @param {string} status - Target status
   * @returns {object} Damage context
   */
  static buildDamageContext(target, saveOnly, status) {
    const hasTotal = target.damage?.total != null;
    const total = hasTotal ? target.damage.total : null;
    
    let damageDisplay;
    if (hasTotal) {
      damageDisplay = `💥 ${total}`;
    } else if (saveOnly || ["hit", "crit"].includes(status)) {
      damageDisplay = "💥 --";
    } else {
      damageDisplay = "—";
    }

    const appliedTag = target.damage?.applied 
      ? `[${String(target.damage.applied).toUpperCase()}]`
      : "";

    return {
      damageDisplay,
      appliedTag,
      damageTotal: total,
      damageApplied: target.damage?.applied,
      damageInfo: target.damage?.info
    };
  }

  /**
   * Build save context for a target
   * @param {object} target - Target object
   * @param {boolean} hasSave - Card has save configuration
   * @returns {object} Save context
   */
  static buildSaveContext(target, hasSave) {
    if (!hasSave || !target.save) {
      return { showSave: false };
    }

    const ability = target.save.ability?.toUpperCase() || "SAVE";
    const dc = target.save.dc ?? "—";
    const formula = target.save.formula || "";

    let saveResult = null;
    if (target.save.roll) {
      const outcome = target.save.roll.outcome;
      const icon = ({
        success: "✅",
        fail: "❌", 
        critical: "💥",
        fumble: "💩"
      })[outcome] || "";
      
      saveResult = {
        total: target.save.roll.total,
        icon
      };
    }

    return {
      showSave: true,
      saveAbility: ability,
      saveDC: dc,
      saveFormula: formula,
      saveResult
    };
  }

  /**
   * Render template with context
   * @param {object} context - Template context
   * @returns {string} Rendered HTML
   */
  static renderTemplate(context) {
    return `
      <div class="sw5e-helper-card" data-message-id="${context.messageId || ""}">
        ${this.renderHeader(context)}
        ${this.renderControls(context)}
        <hr class="target-separator" />
        <div class="target-rows">
          ${this.renderTargets(context.targets, context)}
        </div>
      </div>
    `;
  }

  /**
   * Render card header
   * @param {object} context - Template context
   * @returns {string} Header HTML
   */
  static renderHeader(context) {
    const attackInfo = context.attackInfo 
      ? `<span class="info-icon" data-action="show-attack-formula" title="${Helpers.localize('SW5EHELPER.AttackFormulaTooltip')}">ⓘ</span>`
      : "";
    
    const headerTitle = context.weaponName || "Unknown Weapon";

    return `
      <header class="card-header">
        <div class="weapon-banner">
          <img src="${context.weaponImg || ""}" alt="${headerTitle}" class="weapon-icon" />
          <div class="weapon-title">
            <span class="name">${headerTitle}</span>
            ${attackInfo}
          </div>
        </div>
      </header>
    `;
  }

  /**
   * Render control buttons
   * @param {object} context - Template context
   * @returns {string} Controls HTML
   */
  static renderControls(context) {
    const quickDamage = !context.hideQuickDamage 
      ? `<a class="icon-btn" data-action="card-quick-damage" title="${Helpers.localize('SW5EHELPER.QuickDamage')}">⚡</a>`
      : "";

    const modDamage = !context.hideModDamage
      ? `<a class="icon-btn" data-action="card-mod-damage" title="${Helpers.localize('SW5EHELPER.ModDamage')}">🎲</a>`
      : "";

    const gmToolbar = context.isGM ? `
      <div class="gm-toolbar">
        ${!context.hideRollAllSaves ? `<a class="mini-btn" data-action="gm-roll-all-saves">${Helpers.localize('SW5EHELPER.RollAllSaves')}</a>` : ""}
        <a class="mini-btn" data-action="gm-apply-all-full">${Helpers.localize('SW5EHELPER.ApplyAllFull')}</a>
      </div>
    ` : "";

    const expandToggle = `<a class="mini-btn toggle-all-btn" data-action="toggle-all">${context.expandedAll ? Helpers.localize('SW5EHELPER.CollapseAll') : Helpers.localize('SW5EHELPER.ExpandAll')}</a>`;

    return `
      <div class="card-controls">
        <div class="damage-controls">
          ${quickDamage}
          ${modDamage}
        </div>
        ${gmToolbar}
        ${expandToggle}
      </div>
    `;
  }

  /**
   * Render all targets
   * @param {Array} targets - Target contexts
   * @param {object} context - Full context
   * @returns {string} Targets HTML
   */
  static renderTargets(targets, context) {
    return targets.map(target => this.renderTarget(target, context)).join("");
  }

  /**
   * Render a single target
   * @param {CardTarget} target - Target context
   * @param {object} context - Full context
   * @returns {string} Target HTML
   */
  static renderTarget(target, context) {
    const openAttr = context.expandedAll ? "open" : "";
    const missingClass = target.missing ? " missing" : "";
    const altClass = ` ${target.alternatingClass}`;
    
    const actionName = target.canControl ? "select-token" : "ping-token";
    
    // Build summary content
    const summary = context.saveOnly 
      ? this.renderSaveSummary(target)
      : this.renderAttackSummary(target);

    // Build row body
    const body = `
      <div class="row-body">
        ${context.hasSave && target.showSave ? this.renderSaveLine(target) : ""}
        ${this.renderDamageLine(target)}
      </div>
    `;

    return `
      <details class="target-row${missingClass}${altClass}" data-target-ref="${target.ref}" ${openAttr}>
        <summary class="summary-row" data-action="toggle-details">
          <span class="expand-arrow">▶</span>
          <img class="portrait" src="${target.img}" />
          <span class="tname" data-action="${actionName}" data-target-ref="${target.ref}">${target.name}</span>
          ${summary}
          <span class="row-actions">
            ${this.renderSummaryActions(target)}
            ${target.missing ? `<span class="missing">[${Helpers.localize('SW5EHELPER.Missing')}]</span>` : ""}
          </span>
        </summary>
        ${body}
      </details>
    `;
  }

  /**
   * Render save summary (save-only mode)
   */
  static renderSaveSummary(target) {
    const ability = target.saveAbility || "SAVE";
    const dc = target.saveDC;
    const result = target.saveResult ? ` | ${target.saveResult.total} ${target.saveResult.icon}` : "";
    
    return `<span class="save-summary">${ability} DC ${dc}${result}</span>`;
  }

  /**
   * Render attack summary (normal mode)
   */
  static renderAttackSummary(target) {
    return `
      <span class="attack-total">${target.attackDisplay} <span class="status-icon ${target.statusClass}" title="${target.statusText}">${target.statusIcon}</span></span>
      <span class="damage-summary">${target.damageDisplay}</span>
    `;
  }

  /**
   * Render summary action buttons
   */
  static renderSummaryActions(target) {
    if (target.damageApplied) {
      return `✓ ${target.damageInfo ? `<span class="info-icon" data-action="show-damage-formula" data-target-ref="${target.ref}">ⓘ</span>` : ""}`;
    }
    
    if (target.damageTotal != null) {
      return `
        <a class="icon-btn" data-action="apply-full" data-target-ref="${target.ref}">💯</a>
        <a class="icon-btn" data-action="apply-half" data-target-ref="${target.ref}">½</a>
        ${target.damageInfo ? `<span class="info-icon" data-action="show-damage-formula" data-target-ref="${target.ref}">ⓘ</span>` : ""}
      `;
    }
    
    return "";
  }

  /**
   * Render save line in row body
   * @param {CardTarget} target - Target object
   * @returns {string} Save line HTML
   */
  static renderSaveLine(target) {
    const dcDisplay = target.saveFormula 
      ? `<span class="save-dc" title="${target.saveFormula}">${target.saveDC}</span>`
      : `<span class="save-dc">${target.saveDC}</span>`;

    const result = target.saveResult 
      ? `<span class="save-result">${target.saveResult.total} ${target.saveResult.icon}</span>`
      : `<a class="mini-btn" data-action="roll-save" data-target-ref="${target.ref}">${Helpers.localize('SW5EHELPER.RollSave')}</a>`;

    return `
      <div class="save-line">
        <span>🛡️ ${target.saveAbility || Helpers.localize('SW5EHELPER.Save')} | DC: ${dcDisplay}</span>
        ${result}
      </div>
    `;
  }

  /**
   * Render damage line in row body
   */
  static renderDamageLine(target) {
    const controls = target.damageApplied ? "" : this.renderDamageControls(target);
    const info = target.damageInfo ? `<span class="info-icon" data-action="show-damage-formula" data-target-ref="${target.ref}">ⓘ</span>` : "";
    const applied = target.appliedTag ? `<span class="applied-tag">${target.appliedTag}</span>` : "";

    return `
      <div class="damage-line">
        <span>💥 ${Helpers.localize('SW5EHELPER.Damage')}:</span>
        <span class="dmg-val">${target.damageTotal ?? "—"}</span>
        ${applied}
        ${controls}
        ${info}
      </div>
    `;
  }

  /**
   * Render damage control buttons
   * @param {CardTarget} target - Target object
   * @returns {string} Damage controls HTML
   */
  static renderDamageControls(target) {
    if (!target.damageTotal) return "";

    return `
      <span class="icons">
        <a class="icon-btn" data-action="row-mod-damage" data-target-ref="${target.ref}" title="${Helpers.localize('SW5EHELPER.ModDamage')}">🎲</a>
        <a class="icon-btn" data-action="apply-full" data-target-ref="${target.ref}" title="${Helpers.localize('SW5EHELPER.ApplyFull')}">💯</a>
        <a class="icon-btn" data-action="apply-half" data-target-ref="${target.ref}" title="${Helpers.localize('SW5EHELPER.ApplyHalf')}">½</a>
        <a class="icon-btn" data-action="apply-none" data-target-ref="${target.ref}" title="${Helpers.localize('SW5EHELPER.ApplyNone')}">Ø</a>
      </span>
    `;
  }
}

export default CardRenderer;