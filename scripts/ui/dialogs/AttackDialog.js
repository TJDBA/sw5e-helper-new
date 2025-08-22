/**
 * Attack Dialog Class
 * Handles attack configuration and validation
 */

import { Helpers } from '../../core/utils/helpers.js';

export class AttackDialog extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "modules/sw5e-helper/templates/dialogs/attack-dialog.hbs",
      width: 520,
      height: "auto",
      title: Helpers.localize("SW5EHELPER.AttackTitle"),
      classes: ["sw5e-helper", "sw5e-helper-attack"],
      resizable: true
    });
  }

  constructor(context, seed = {}) {
    super();
    this.context = context; // { actor, weapons }
    this._resolve = null;
    this._reject = null;
    this._done = false;

    // Initialize state with defaults
    this.state = {
      // Core attack options
      adv: "normal",
      weaponId: context?.weapons?.[0]?.id ?? "",
      ability: "",
      offhand: false,
      separate: false,
      atkMods: "",

      // Smart weapon override
      smart: false,
      smartAbility: "",
      smartProf: "",

      // Saving throw configuration
      saveOnHit: false,
      saveAbility: "",
      saveDcFormula: "",
      saveOnly: false,

      // Preset management
      presetName: "",

      // Override with any seed data
      ...seed
    };
  }

  async getData() {
    const data = await super.getData();
    const weaponsAll = this.context.weapons ?? [];
    const selected = weaponsAll.find(w => w.id === this.state.weaponId) ?? weaponsAll[0];
    const item = selected?.item;

    // Check if smart weapon features should be shown
    const showSmart = !!item?.system?.properties?.smr;

    // Auto-populate save fields from item if available
    const itemSave = this.getItemSaveData(item);
    if (itemSave && !this.state.saveAbility) {
      this.state.saveAbility = itemSave.ability;
    }
    if (itemSave && !this.state.saveDcFormula) {
      this.state.saveDcFormula = String(itemSave.dc);
    }

    return foundry.utils.mergeObject(data, {
      weapons: weaponsAll.map(w => ({
        id: w.id,
        name: w.name,
        selected: w.id === this.state.weaponId
      })),
      abilities: ["str", "dex", "con", "int", "wis", "cha"],
      showSmart,
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

    // Mutual exclusion for save checkboxes
    const saveOnHitCheck = html.find('input[name="saveOnHit"]');
    const saveOnlyCheck = html.find('input[name="saveOnly"]');

    saveOnHitCheck.on("change", (ev) => {
      if (ev.currentTarget.checked) {
        saveOnlyCheck.prop("checked", false);
      }
    });

    saveOnlyCheck.on("change", (ev) => {
      if (ev.currentTarget.checked) {
        saveOnHitCheck.prop("checked", false);
      }
    });

    // Weapon change triggers re-render for smart/save updates
    html.find('select[name="weaponId"]').on("change", () => {
      this.readForm();
      this.render(false);
    });

    // Action buttons
    html.find('[data-action="roll"]').on("click", (ev) => {
      ev.preventDefault();
      this.handleRoll();
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
    const saveOnHitChecked = !!form.querySelector('input[name="saveOnHit"]')?.checked;
    const saveOnlyChecked = !!form.querySelector('input[name="saveOnly"]')?.checked;

    // Update state from form
    this.state = {
      ...this.state,
      weaponId: formData.get("weaponId") || this.state.weaponId,
      adv: form.querySelector('input[name="adv"]:checked')?.value || "normal",
      ability: (formData.get("ability") || "").trim(),
      offhand: !!form.querySelector('input[name="offhand"]')?.checked,
      separate: !!form.querySelector('input[name="separate"]')?.checked,
      atkMods: (formData.get("atkMods") || "").trim(),

      // Smart weapon
      smart: !!form.querySelector('input[name="smart"]')?.checked,
      smartAbility: (formData.get("smartAbility") || "").toString().trim(),
      smartProf: (formData.get("smartProf") || "").toString().trim(),

      // Save configuration with mutual exclusion
      saveOnHit: saveOnHitChecked && !saveOnlyChecked,
      saveOnly: saveOnlyChecked && !saveOnHitChecked,
      saveAbility: (formData.get("saveAbility") || "").toString().trim(),
      saveDcFormula: (formData.get("saveDcFormula") || "").toString().trim(),

      presetName: formData.get("presetName") || ""
    };
  }

  /**
   * Validate form data before submission
   */
  validateForm() {
    const errors = [];

    // Smart weapon validation
    if (this.state.smart) {
      const smartAbility = Number(this.state.smartAbility);
      const smartProf = Number(this.state.smartProf);

      if (!Number.isFinite(smartAbility) || !Number.isFinite(smartProf)) {
        errors.push(Helpers.localize("SW5EHELPER.SmartValuesRequired"));
      }
    }

    return errors;
  }

  /**
   * Handle roll button click
   */
  handleRoll() {
    this.readForm();
    
    const errors = this.validateForm();
    if (errors.length > 0) {
      Helpers.notify(errors[0], "warn");
      return;
    }

    // Build result payload
    const result = {
      ...this.sanitizeState(),
      save: {
        requireOnHit: this.state.saveOnHit,
        ability: this.state.saveAbility || "",
        dcFormula: this.state.saveDcFormula || ""
      }
    };

    this._done = true;
    this._resolve?.(result);
    this.close();
  }

  /**
   * Handle cancel button click
   */
  handleCancel() {
    this._done = true;
    this._resolve?.(null);
    this.close();
  }

  /**
   * Clean up state for result
   */
  sanitizeState() {
    return {
      adv: this.state.adv,
      weaponId: this.state.weaponId,
      ability: this.state.ability,
      offhand: this.state.offhand,
      separate: this.state.separate,
      atkMods: this.state.atkMods,
      smart: this.state.smart,
      smartAbility: Number(this.state.smartAbility) || 0,
      smartProf: Number(this.state.smartProf) || 0,
      saveOnHit: this.state.saveOnHit,
      saveOnly: this.state.saveOnly,
      saveAbility: this.state.saveAbility,
      saveDcFormula: this.state.saveDcFormula
    };
  }

  /**
   * Get save data from item
   */
  getItemSaveData(item) {
    try {
      const save = item?.system?.save;
      if (!save) return null;

      return {
        ability: save.ability || "",
        dc: save.dc || save.scaling || ""
      };
    } catch {
      return null;
    }
  }

  /**
   * Close handler - resolve with null if not already done
   */
  async close(options) {
    if (!this._done) {
      this._resolve?.(null);
    }
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
   * Static factory method
   */
  static async prompt(context) {
    const dialog = new AttackDialog(context);
    dialog.render(true);
    return dialog.wait();
  }
}

export default AttackDialog;