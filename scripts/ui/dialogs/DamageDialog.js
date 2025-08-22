/**
 * Damage Dialog Class
 * Handles damage configuration and validation
 */

import { Helpers } from '../../core/utils/helpers.js';
import { FormulaUtils } from '../../core/dice/formula.js';

export class DamageDialog extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "modules/sw5e-helper/templates/dialogs/damage-dialog.hbs",
      width: 560,
      height: "auto",
      title: Helpers.localize("SW5EHELPER.DamageTitle"),
      classes: ["sw5e-helper", "sw5e-helper-damage"],
      resizable: true
    });
  }

  constructor(options = {}) {
    super();
    this.actor = options.actor;
    this.item = options.item ?? null;
    this.weapons = options.weapons ?? null;
    this.scope = options.scope || { type: "card" };
    this.seed = options.seed || {};
    
    this._resolve = null;
    this._reject = null;

    // Initialize state
    this.state = {
      // Core options
      weaponId: this.seed.weaponId || this.item?.id || (this.weapons?.[0]?.id ?? ""),
      ability: this.seed.ability || "",
      offhand: !!this.seed.offhand,
      separate: !!this.seed.separate,
      isCrit: !!this.seed.isCrit,

      // Smart weapon
      smart: !!this.seed.smart,
      smartAbility: Number(this.seed.smartAbility ?? 0) || 0,

      // Extra damage modifiers
      extraRows: this.seed.extraRows ?? [],

      // Preset management
      presetName: ""
    };
  }

  async getData() {
    const data = await super.getData();

    // Resolve item if not provided (for manual mode)
    if (!this.item && this.weapons) {
      const selectedId = this.state.weaponId;
      this.item = this.actor?.items?.get(selectedId) ?? null;
    }

    if (!this.item) {
      throw new Error("DamageDialog requires a valid weapon item");
    }

    // Get weapon damage information
    const weaponDamage = this.getWeaponDamageInfo();
    const showSmart = !!this.item.system?.properties?.smr;
    const weaponLocked = this.scope?.type === "card" || this.scope?.type === "row";

    return foundry.utils.mergeObject(data, {
      weapons: this.weapons ? this.weapons.map(w => ({
        id: w.id,
        name: w.name,
        selected: w.id === this.state.weaponId
      })) : [{
        id: this.item.id,
        name: this.item.name,
        selected: true
      }],
      weaponLocked,
      abilities: ["str", "dex", "con", "int", "wis", "cha"],
      showSmart,
      weaponDamageParts: weaponDamage.parts,
      showBrutal: weaponDamage.showBrutal,
      brutalXdY: weaponDamage.brutalDisplay,
      damageTypes: ["kinetic", "energy", "ion", "acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "sonic", "true"],
      ...this.state
    });
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Form submission prevention
    html.on("submit", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      return false;
    });

    // Weapon change (manual mode only)
    html.find('select[name="weaponId"]').on("change", () => {
      this.readForm();
      if (this.scope?.type === "manual" && this.state.weaponId) {
        this.item = this.actor?.items?.get(this.state.weaponId) ?? this.item;
      }
      this.render(true);
    });

    // Extra damage row management
    html.find('[data-action="add-row"]').on("click", () => {
      this.addExtraDamageRow();
    });

    html.on("click", '[data-action="del-row"]', (ev) => {
      this.removeExtraDamageRow(ev);
    });

    // Action buttons
    html.find('[data-action="roll"]').on("click", async (ev) => {
      ev.preventDefault();
      await this.handleRoll();
    });

    html.find('[data-action="cancel"]').on("click", (ev) => {
      ev.preventDefault();
      this.handleCancel();
    });

    // Keyboard shortcuts
    html.find("form").on("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        this.handleRoll();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        this.handleCancel();
      }
    });
  }

  /**
   * Read form data into state
   */
  readForm() {
    const form = this.element[0].querySelector("form");
    if (!form) return;

    const formData = new FormData(form);

    // Read extra damage rows
    const extraRows = [];
    form.querySelectorAll(".modrow").forEach(row => {
      const id = row.dataset.id;
      extraRows.push({
        id,
        formula: row.querySelector(".mod-formula")?.value?.trim() || "",
        type: row.querySelector(".mod-type")?.value || "kinetic",
        inCrit: !!row.querySelector(".mod-incrit")?.checked
      });
    });

    // Update state
    this.state = {
      ...this.state,
      weaponId: (formData.get("weaponId") || this.state.weaponId).toString(),
      ability: (formData.get("ability") || "").toString().trim(),
      offhand: !!form.querySelector('input[name="offhand"]')?.checked,
      smart: !!form.querySelector('input[name="smart"]')?.checked,
      smartAbility: Number(formData.get("smartAbility") ?? 0) || 0,
      separate: !!form.querySelector('input[name="separate"]')?.checked,
      isCrit: !!form.querySelector('input[name="isCrit"]')?.checked,
      extraRows
    };
  }

  /**
   * Add a new extra damage row
   */
  addExtraDamageRow() {
    const id = Helpers.uuid();
    this.state.extraRows = [
      ...(this.state.extraRows || []),
      { id, formula: "", type: "kinetic", inCrit: false }
    ];
    this.render(false);
  }

  /**
   * Remove an extra damage row
   */
  removeExtraDamageRow(event) {
    const row = event.currentTarget.closest(".modrow");
    const id = row?.dataset?.id;
    if (!id) return;

    this.state.extraRows = (this.state.extraRows || [])
      .filter(r => String(r.id) !== String(id));
    this.render(false);
  }

  /**
   * Get weapon damage information
   */
  getWeaponDamageInfo() {
    const sys = this.item.system ?? {};
    const parts = Array.isArray(sys.damage?.parts) ? sys.damage.parts : [];
    
    const weaponDamageParts = parts.map(([formula, type], idx) => ({
      formula: String(formula || "0"),
      typeLabel: String(type || ""),
      isBase: idx === 0
    }));

    const brutalVal = Number(sys.properties?.brutal ?? 0) || 0;
    const showBrutal = brutalVal > 0;
    const baseFaces = weaponDamageParts[0] ? FormulaUtils.getFirstDieFaces(weaponDamageParts[0].formula) : null;
    const brutalDisplay = showBrutal && baseFaces ? `${brutalVal}d${baseFaces}` : "";

    return {
      parts: weaponDamageParts,
      showBrutal,
      brutalDisplay
    };
  }

  /**
   * Handle roll button click
   */
  async handleRoll() {
    this.readForm();
    
    const errors = this.validateForm();
    if (errors.length > 0) {
      Helpers.notify(errors[0], "warn");
      return;
    }

    const result = this.sanitizeState();
    this._resolve?.(result);
    this.close();
  }

  /**
   * Handle cancel button click  
   */
  handleCancel() {
    this._reject?.("cancel");
    this.close();
  }

  /**
   * Validate form data
   */
  validateForm() {
    const errors = [];

    // Validate extra damage formulas
    for (const row of this.state.extraRows || []) {
      if (row.formula && !FormulaUtils.isValidFormula(row.formula)) {
        errors.push(`Invalid damage formula: ${row.formula}`);
      }
    }

    return errors;
  }

  /**
   * Clean up state for result
   */
  sanitizeState() {
    return {
      weaponId: this.state.weaponId,
      ability: this.state.ability,
      offhand: this.state.offhand,
      smart: this.state.smart,
      smartAbility: this.state.smartAbility,
      separate: this.state.separate,
      isCrit: this.state.isCrit,
      extraRows: (this.state.extraRows || []).filter(row => row.formula.trim())
    };
  }

  /**
   * Close handler
   */
  async close(options) {
    // Don't auto-reject if already resolved
    return super.close(options);
  }

  /**
   * Promise wrapper for dialog interaction
   */
  async wait() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * Static factory methods
   */
  static async prompt(options) {
    const dialog = new DamageDialog(options);
    dialog.render(true);
    return dialog.wait();
  }
}

/**
 * Convenience function for opening damage dialog
 */
export async function openDamageDialog(options) {
  return DamageDialog.prompt(options);
}

export default DamageDialog;