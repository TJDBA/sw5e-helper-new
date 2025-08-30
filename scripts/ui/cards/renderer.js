// scripts/ui/cards/renderer.js
/**
 * Simple, robust renderer for attack cards.
 */
export class CardRenderer {
  constructor(state) { this.state = state || {}; }

  render() {
    const h = [];
    const msgId = this.state.messageId || "";
    const headerImg = this.state.weaponImg || "icons/svg/sword.svg";
    const headerName = this.state.weaponName || "Attack";
    h.push(`<div class="sw5e-helper-card" data-message-id="${msgId}">`);
    h.push(`<div class="card-header"><img class="weapon-icon" src="${headerImg}"/><div class="weapon-title"><span class="name">${this._e(headerName)}</span></div></div>`);
    h.push(`<div class="card-controls"><a class="action-btn" data-action="toggle-all">Expand All</a></div>`);
    const targets = Array.isArray(this.state.targets) ? this.state.targets : [];
    h.push(`<div class="targets">`);
    for (const t of targets) h.push(this._targetRow(t));
    h.push(`</div></div>`);
    return h.join("");
  }

  _targetRow(t) {
    const ref = t.ref || "";
    const name = this._e(t.name || "Target");
    const ac = t.ac != null ? String(t.ac) : "—";
    const hit = t.attack?.total != null ? `<span class="hit">🎯 ${t.attack.total}</span>` : "";
    const dmg = t.damage?.total != null ? `<span class="dmg">💥 ${t.damage.total}</span>` : "";
    const save = t.save?.dc != null ? `<span class="save">🛡️ ${String(t.save.ability || "").toUpperCase()} DC ${t.save.dc}</span>` : "";
    const openAttr = t.ui?.expanded ? " open" : "";
    return `
<details class="target-row"${openAttr} data-target-ref="${ref}">
  <summary class="row-summary" data-action="toggle-row">
    <span class="expand-arrow">▶</span>
    <span class="tgt-name">${name}</span>
    <span class="tgt-ac">AC ${ac}</span>
    <span class="row-glance">${hit}${dmg}${save}</span>
  </summary>
  <div class="row-body">
    ${this._attackBlock(t.attack)}
    ${this._damageBlock(t.damage, ref)}
    ${this._saveBlock(t.save)}
  </div>
</details>`;
  }

  _attackBlock(att) {
    if (!att) return "";
    const total = att.total != null ? att.total : "—";
    return `<div class="attack-line"><span class="detail-label">🎯 Attack:</span> <span class="val">${total}</span></div>`;
  }

  _damageBlock(dmg, ref) {
    if (!dmg) return "";
    const total = dmg.total != null ? dmg.total : "—";
    return `<div class="damage-line">
      <span class="detail-label">💥 Damage:</span> <span class="val">${total}</span>
      <span class="actions">
        <a class="action-btn" data-action="row-mod-damage" data-target-ref="${ref}">🎲</a>
        <a class="action-btn" data-action="apply-full" data-target-ref="${ref}">💯</a>
        <a class="action-btn" data-action="apply-half" data-target-ref="${ref}">½</a>
        <a class="action-btn" data-action="apply-none" data-target-ref="${ref}">Ø</a>
      </span>
    </div>`;
  }

  _saveBlock(save) {
    if (!save?.dc) return "";
    const ability = String(save.ability || "").toUpperCase();
    return `<div class="save-line"><span class="detail-label">🛡️ Save:</span> ${ability} DC ${save.dc}</div>`;
  }

  _e(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
}
export default CardRenderer;
