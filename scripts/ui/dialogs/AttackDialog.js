/**
 * Updated AttackDialog.js - Compact Attack Dialog
 */
import { Helpers } from '../../core/utils/helpers.js';
import { moduleBasePath } from "../../config.js";


export class AttackDialog extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: `${moduleBasePath()}/templates/dialogs/attack-dialog.hbs`,
      width: 420,
      height: "auto",
      title: "Attack Configuration",
      classes: ["sw5e-helper", "sw5e-helper-attack"],
      resizable: false
    });
  }

  constructor(context, seed = {}) {
    super();
    this.context = context;
    this._resolve = null;
    this._reject = null;
    this._done = false;

    this.state = {
      adv: "normal",
      weaponId: context?.weapons?.[0]?.id ?? "",
      ability: "",
      offhand: false,
      separate: false,
      atkMods: "",
      smart: false,
      smartAbility: 0,
      smartProf: 0,
      saveOnHit: false,
      saveAbility: "",
      saveDcFormula: "",
      saveOnly: false,
      presetName: "",
      ...seed
    };
  }

  async getData() {
    const data = await super.getData();
    const weaponsAll = this.context.weapons ?? [];
    const selected = weaponsAll.find(w => w.id === this.state.weaponId) ?? weaponsAll[0];
    const item = selected?.item;

    const showSmart = !!item?.system?.properties?.smr;

    // Auto-populate save fields from item
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

    // Prevent form submission
    html.on("submit", ev => {
      ev.preventDefault();
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

    // Weapon change triggers re-render
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

  readForm() {
    const form = this.element[0].querySelector("form");
    if (!form) return;

    const formData = new FormData(form);
    const saveOnHitChecked = !!form.querySelector('input[name="saveOnHit"]')?.checked;
    const saveOnlyChecked = !!form.querySelector('input[name="saveOnly"]')?.checked;

    this.state = {
      ...this.state,
      weaponId: formData.get("weaponId") || this.state.weaponId,
      adv: form.querySelector('input[name="adv"]:checked')?.value || "normal",
      ability: (formData.get("ability") || "").trim(),
      offhand: !!form.querySelector('input[name="offhand"]')?.checked,
      separate: !!form.querySelector('input[name="separate"]')?.checked,
      atkMods: (formData.get("atkMods") || "").trim(),
      smart: !!form.querySelector('input[name="smart"]')?.checked,
      smartAbility: Number(formData.get("smartAbility") || 0),
      smartProf: Number(formData.get("smartProf") || 0),
      saveOnHit: saveOnHitChecked && !saveOnlyChecked,
      saveOnly: saveOnlyChecked && !saveOnHitChecked,
      saveAbility: (formData.get("saveAbility") || "").toString().trim(),
      saveDcFormula: (formData.get("saveDcFormula") || "").toString().trim(),
      presetName: formData.get("presetName") || ""
    };
  }

  validateForm() {
    const errors = [];

    if (this.state.smart) {
      const smartAbility = Number(this.state.smartAbility);
      const smartProf = Number(this.state.smartProf);

      if (!Number.isFinite(smartAbility) || !Number.isFinite(smartProf)) {
        errors.push("Smart weapon requires valid ability and proficiency values");
      }
    }

    return errors;
  }

  handleRoll() {
    this.readForm();
    
    const errors = this.validateForm();
    if (errors.length > 0) {
      Helpers.notify(errors[0], "warn");
      return;
    }

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

  handleCancel() {
    this._done = true;
    this._resolve?.(null);
    this.close();
  }

  sanitizeState() {
    return {
      adv: this.state.adv,
      weaponId: this.state.weaponId,
      ability: this.state.ability,
      offhand: this.state.offhand,
      separate: this.state.separate,
      atkMods: this.state.atkMods,
      smart: this.state.smart,
      smartAbility: this.state.smartAbility,
      smartProf: this.state.smartProf,
      saveOnHit: this.state.saveOnHit,
      saveOnly: this.state.saveOnly,
      saveAbility: this.state.saveAbility,
      saveDcFormula: this.state.saveDcFormula
    };
  }

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

  async close(options) {
    if (!this._done) {
      this._resolve?.(null);
    }
    return super.close(options);
  }

  async wait() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  static async prompt(context) {
    const dialog = new AttackDialog(context);
    dialog.render(true);
    return dialog.wait();
  }
}