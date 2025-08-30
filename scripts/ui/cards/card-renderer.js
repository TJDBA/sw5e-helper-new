/**
 * Updated scripts/ui/cards/card-renderer.js
 * Enhanced compact card rendering to match PF2e style
 */

import { l } from './utils/localization.js';
import { getTargetRef, canUserControl } from '../../core/utils/actor-utils.js';
import { CONFIG, isDebug } from '../../config.js';

/**
 * Renders an attack card based on a given state object with enhanced compactness
 */
export class AttackCardRenderer {
  constructor(state) {
    this.state = state;
    this.isGM = game.user?.isGM === true;
    this.saveOnly = !!this.state.options?.saveOnly;
  }

  async render() {
    if (isDebug()) console.log("SW5E DEBUG: AttackCardRenderer.render() called", { state: this.state });
    
    // Build context for Handlebars template
    const context = this.buildTemplateContext();
    
    // Use the Handlebars template directly
    const templatePath = 'modules/sw5e-helper-new/templates/cards/attack-card.hbs';
    
    try {
      // Try to get the compiled template
      let template = Handlebars.partials[templatePath];
      if (!template) {
        // If not found, compile it from the template file
        const templateContent = await renderTemplate(templatePath, {});
        template = Handlebars.compile(templateContent);
      }
      
      return template(context);
    } catch (error) {
      console.error("SW5E Helper: Template rendering failed, falling back", error);
      return this.buildFallbackHTML(context);
    }
  }
  
  buildTemplateContext() {
    const isGM = game.user?.isGM === true;
    const saveOnly = !!this.state.options?.saveOnly;
    
    return {
      messageId: this.state.messageId || "",
      weaponName: this.state.itemName || "Unknown Weapon",
      weaponImg: this.state.weaponImg || "",
      attackInfo: this.state.attack?.info,
      saveOnly,
      isGM,
      hasSave: !!this.state.hasSave,
      expandedAll: !!this.state.ui?.expandedAll,
      hideQuickDamage: this.shouldHideQuickDamage(),
      hideModDamage: this.shouldHideModDamage(),
      hideRollAllSaves: this.shouldHideRollAllSaves(),
      targets: this.buildTargetContexts()
    };
  }
  
  buildTargetContexts() {
    const targets = this.state.targets || [];
    const saveOnly = !!this.state.options?.saveOnly;
    
    console.log("SW5E Helper Debug: buildTargetContexts() called", { targets });  
    
    return targets.map((target, index) => {
      const ref = `${target.sceneId}:${target.tokenId}`;
      const summary = target.summary || {};
      const damage = target.damage || {};
      const save = target.save || {};
      
      // Build attack display
      const attackTotal = Number.isFinite(summary.attackTotal) ? summary.attackTotal : null;
      const keptDie = Number.isFinite(summary.keptDie) ? summary.keptDie : null;
      const status = String(summary.status || "pending");
      
      const attackDisplay = attackTotal !== null 
        ? `${attackTotal}${keptDie !== null ? ` (${keptDie})` : ""}`
        : "—";
      
      // Build damage display
      const damageTotal = damage.total;
      let damageDisplay;
      if (damageTotal != null) {
        damageDisplay = `💥 ${damageTotal}`;
      } else if (saveOnly || ["hit", "crit"].includes(status)) {
        damageDisplay = "💥 --";
      } else {
        damageDisplay = "—";
      }
      
      // Build save display
      const saveAbility = save.ability?.toUpperCase() || "SAVE";
      const saveDC = save.dc ?? "—";
      let saveResult = null;
      if (save.roll) {
        const outcomeIcons = { success: "✅", fail: "❌", critical: "💥", fumble: "💩" };
        saveResult = {
          total: save.roll.total,
          icon: outcomeIcons[save.roll.outcome] || ""
        };
      }
      
      // Status styling
      const statusClass = `status-${status}`;
      const statusIcons = { hit: "●", miss: "○", crit: "◆", fumble: "○", pending: "●" };
      const statusIcon = statusIcons[status] || "●";
      const statusText = status.toUpperCase();
      
      return {
        ref,
        name: target.name || "Unknown",
        img: target.img || "icons/svg/mystery-man.svg",
        missing: !!target.missing,
        canControl: this.canControlTarget(target),
        ac: target.ac || "—", // Add AC property
        
        // Attack info
        attackDisplay,
        statusClass,
        statusIcon,
        statusText,
        summary, // Keep original for template access
        
        // Damage info  
        damageDisplay,
        damageTotal,
        damageApplied: damage.applied,
        damageInfo: damage.info,
        damage, // Keep original for template access
        
        // Save info
        saveAbility,
        saveDC,
        saveFormula: save.formula,
        saveResult,
        showSave: !!save.ability,
        save // Keep original for template access
      };
    });
  }
  
  canControlTarget(target) {
    try {
      return PermissionChecker.canControlTarget(target);
    } catch {
      return false;
    }
  }
  
  shouldHideQuickDamage() {
    const targets = this.state.targets || [];
    const saveOnly = !!this.state.options?.saveOnly;
    
    return targets.every(t => {
      const eligible = saveOnly || ["hit", "crit"].includes(String(t?.summary?.status));
      if (!eligible || t.missing) return true;
      return t?.damage?.total != null;
    });
  }
  
  shouldHideModDamage() {
    const targets = this.state.targets || [];
    const saveOnly = !!this.state.options?.saveOnly;
    
    return targets.every(t => {
      const eligible = saveOnly || ["hit", "crit"].includes(String(t?.summary?.status));
      if (!eligible || t.missing) return true;
      return t?.damage?.total != null;
    });
  }
  
  shouldHideRollAllSaves() {
    const targets = this.state.targets || [];
    return targets.every(t => {
      if (!t?.save || t.missing) return true;
      return !!t.save?.roll;
    });
  }
  
  buildFallbackHTML(context) {
    // Fallback HTML if template fails
    return `
      <div class="sw5e-helper-card" data-message-id="${context.messageId}">
        <div class="card-header">
          <div class="weapon-banner">
            <img src="${context.weaponImg}" alt="${context.weaponName}" class="weapon-icon" />
            <div class="weapon-title">
              <span class="name">${context.weaponName}</span>
            </div>
          </div>
        </div>
        <div class="target-rows">
          ${context.targets.map(t => `
            <div class="target-row" data-target-ref="${t.ref}">
              <div class="summary-row">
                <img class="portrait" src="${t.img}" alt="${t.name}" />
                <span class="tname">${t.name}</span>
                <span class="attack-total">${t.attackDisplay}</span>
                <span class="damage-summary">${t.damageDisplay}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderTemplate(context) {
    // Force compile the template inline to ensure it works
    const templateSource = `
      <div class="sw5e-helper-card" data-message-id="{{messageId}}">
        <div class="card-header">
          <div class="weapon-banner">
            <img src="{{weaponImg}}" alt="{{weaponName}}" class="weapon-icon" />
            <div class="weapon-title">
              <span class="name">{{weaponName}}</span>
            </div>
          </div>
          {{#if attackInfo}}
          <span class="info-icon" data-action="show-attack-formula">ⓘ</span>
          {{/if}}
        </div>
        
        <div class="card-controls">
          <div class="damage-controls">
            {{#unless hideQuickDamage}}
            <button class="quick-btn" data-action="card-quick-damage">⚡ Quick</button>
            {{/unless}}
            {{#unless hideModDamage}}
            <button class="quick-btn" data-action="card-mod-damage">🎲 Modify</button>
            {{/unless}}
          </div>
          
          {{#if isGM}}
          <div class="gm-toolbar">
            {{#unless hideRollAllSaves}}
            <button class="gm-btn" data-action="gm-roll-all-saves">Roll All Saves</button>
            {{/unless}}
            <button class="gm-btn" data-action="gm-apply-all-full">Apply All (Full)</button>
          </div>
          {{/if}}
          
          <button class="gm-btn toggle-all-btn" data-action="toggle-all">
            {{#if expandedAll}}Collapse All{{else}}Expand All{{/if}}
          </button>
        </div>
  
        <div class="target-rows">
          {{#each targets}}
          <details class="target-row{{#if missing}} missing{{/if}}" data-target-ref="{{ref}}" {{#if ../expandedAll}}open{{/if}}>
            <summary class="summary-row">
              <span class="expand-arrow">▶</span>
              <img class="portrait" src="{{img}}" alt="{{name}}" />
              <span class="tname" data-action="{{#if canControl}}select-token{{else}}ping-token{{/if}}" data-target-ref="{{ref}}">{{name}}</span>
              
              {{#if ../saveOnly}}
              <span class="save-summary">{{saveAbility}} DC {{saveDC}}{{#if saveResult}} | {{saveResult.total}} {{saveResult.icon}}{{/if}}</span>
              {{else}}
              <span class="attack-total">{{attackDisplay}} <span class="status-icon {{statusClass}}">{{statusIcon}}</span></span>
              <span class="damage-summary">{{damageDisplay}}</span>
              {{/if}}
              
              <span class="row-actions{{#if damageApplied}} applied{{/if}}">
                {{#if damageApplied}}
                ✓ {{#if damageInfo}}<span class="info-icon" data-action="show-damage-formula" data-target-ref="{{ref}}">ⓘ</span>{{/if}}
                {{else if damageTotal}}
                <a class="action-btn" data-action="apply-full" data-target-ref="{{ref}}">💯</a>
                <a class="action-btn" data-action="apply-half" data-target-ref="{{ref}}">½</a>
                {{#if damageInfo}}<span class="info-icon" data-action="show-damage-formula" data-target-ref="{{ref}}">ⓘ</span>{{/if}}
                {{/if}}
                {{#if missing}}<span class="missing">[Missing]</span>{{/if}}
              </span>
            </summary>
            
            <div class="row-body">
              {{#if ../hasSave}}
              {{#if showSave}}
              <div class="save-line">
                <span class="detail-label">🛡️ {{saveAbility}} | DC: <span class="save-dc">{{saveDC}}</span></span>
                {{#if saveResult}}
                <span class="save-result">{{saveResult.total}} {{saveResult.icon}}</span>
                {{else}}
                <button class="gm-btn" data-action="roll-save" data-target-ref="{{ref}}">Roll Save</button>
                {{/if}}
              </div>
              {{/if}}
              {{/if}}
              
              <div class="damage-line">
                <span class="detail-label">💥 Damage: <span class="dmg-val">{{#if damageTotal}}{{damageTotal}}{{else}}—{{/if}}</span></span>
                {{#if damageApplied}}
                <span class="applied-tag">[{{damageApplied}}]</span>
                {{else if damageTotal}}
                <div class="damage-controls">
                  <a class="action-btn" data-action="row-mod-damage" data-target-ref="{{ref}}">🎲</a>
                  <a class="action-btn" data-action="apply-full" data-target-ref="{{ref}}">💯</a>
                  <a class="action-btn" data-action="apply-half" data-target-ref="{{ref}}">½</a>
                  <a class="action-btn" data-action="apply-none" data-target-ref="{{ref}}">Ø</a>
                </div>
                {{/if}}
                {{#if damageInfo}}
                <span class="info-icon" data-action="show-damage-formula" data-target-ref="{{ref}}">ⓘ</span>
                {{/if}}
              </div>
            </div>
          </details>
          {{/each}}
        </div>
      </div>
    `;
    
    const template = Handlebars.compile(templateSource);
    return template(context);
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

  renderTargets() {
    const uiAll = !!this.state?.ui?.expandedAll;
    return (this.state.targets || []).map(t => this.renderTargetRow(t, uiAll)).join('');
  }

  renderTargetRow(t, forceOpen=false) {
    const ref = t.ref;                      // stable string "a:<actorId>|t:<tokenId>"
    const name = t.name ?? 'Target';
    const ac   = t.ac ?? '—';
    const hit  = t.attack?.total ?? null;
    const dmg  = t.damage?.total ?? null;
    const save = t.save?.dc ? `${t.save.ability?.toUpperCase() ?? ''} DC ${t.save.dc}` : null;
  
    const open = forceOpen || !!t.ui?.expanded;
    const hitFrag  = hit  != null ? `<span class="hit">🎯 ${hit}</span>` : '';
    const dmgFrag  = dmg  != null ? `<span class="dmg">💥 ${dmg}</span>` : '';
    const saveFrag = save ? `<span class="save">🛡️ ${save}</span>` : '';
  
    return `
    <details class="target-row" data-target-ref="${ref}" ${open ? 'open' : ''}>
      <summary class="row-summary" data-action="toggle-row">
        <span class="expand-arrow">▶</span>
        <span class="tgt-name">${name}</span>
        <span class="tgt-ac">AC ${ac}</span>
        <span class="row-glance">${hitFrag}${dmgFrag}${saveFrag}</span>
      </summary>
      <div class="row-body">
        ${this.renderAttackBlock(t.attack)}
        ${this.renderDamageBlock(t.damage, ref)}
        ${this.renderSaveBlock(t.save)}
      </div>
    </details>`;
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