/**
 * Preset Management System
 * Handles saving and loading of user presets
 */

export class PresetManager {
  /**
   * Get all presets for an actor and type
   * @param {Actor} actor - Actor to get presets for
   * @param {string} type - Preset type ("attack" or "damage")
   * @returns {Promise<Array>} Array of presets
   */
  static async listPresets(actor, type) {
    const key = this.getPresetKey(actor, type);
    const presets = await actor.getFlag("sw5e-helper", key) || [];
    return Array.isArray(presets) ? presets : [];
  }

  /**
   * Get a specific preset
   * @param {Actor} actor - Actor 
   * @param {string} type - Preset type
   * @param {string} name - Preset name
   * @returns {Promise<object|null>} Preset data or null
   */
  static async getPreset(actor, type, name) {
    const presets = await this.listPresets(actor, type);
    return presets.find(p => p.name === name) || null;
  }

  /**
   * Save a preset
   * @param {Actor} actor - Actor
   * @param {string} type - Preset type  
   * @param {string} name - Preset name
   * @param {object} data - Preset data
   */
  static async savePreset(actor, type, name, data) {
    const presets = await this.listPresets(actor, type);
    
    // Remove existing preset with same name
    const filtered = presets.filter(p => p.name !== name);
    
    // Add new preset
    filtered.push({ name, ...data, savedAt: Date.now() });
    
    const key = this.getPresetKey(actor, type);
    await actor.setFlag("sw5e-helper", key, filtered);
  }

  /**
   * Delete a preset
   * @param {Actor} actor - Actor
   * @param {string} type - Preset type
   * @param {string} name - Preset name
   */
  static async deletePreset(actor, type, name) {
    const presets = await this.listPresets(actor, type);
    const filtered = presets.filter(p => p.name !== name);
    
    const key = this.getPresetKey(actor, type);
    await actor.setFlag("sw5e-helper", key, filtered);
  }

  /**
   * Get last used configuration
   * @param {Actor} actor - Actor
   * @param {string} type - Config type
   * @returns {Promise<object|null>} Last used config
   */
  static async getLastUsed(actor, type) {
    const key = `lastUsed${type.charAt(0).toUpperCase() + type.slice(1)}`;
    return await actor.getFlag("sw5e-helper", key) || null;
  }

  /**
   * Set last used configuration
   * @param {Actor} actor - Actor
   * @param {string} type - Config type
   * @param {object} data - Configuration data
   */
  static async setLastUsed(actor, type, data) {
    const key = `lastUsed${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const sanitized = this.sanitizeConfig(type, data);
    await actor.setFlag("sw5e-helper", key, { ...sanitized, usedAt: Date.now() });
  }

  /**
   * Generate preset key
   */
  static getPresetKey(actor, type) {
    return `${type}Presets`;
  }

  /**
   * Sanitize configuration data before saving
   * @param {string} type - Config type
   * @param {object} data - Raw configuration
   * @returns {object} Sanitized configuration
   */
  static sanitizeConfig(type, data) {
    if (type === "attack") {
      return this.sanitizeAttackConfig(data);
    } else if (type === "damage") {
      return this.sanitizeDamageConfig(data);
    }
    return data;
  }

  /**
   * Sanitize attack configuration
   */
  static sanitizeAttackConfig(data) {
    return {
      adv: data.adv || "normal",
      weaponId: data.weaponId || "",
      ability: data.ability || "",
      offhand: !!data.offhand,
      separate: !!data.separate,
      atkMods: data.atkMods || "",
      smart: !!data.smart,
      smartAbility: Number(data.smartAbility) || 0,
      smartProf: Number(data.smartProf) || 0,
      saveOnHit: !!data.saveOnHit,
      saveOnly: !!data.saveOnly,
      saveAbility: data.saveAbility || "",
      saveDcFormula: data.saveDcFormula || ""
    };
  }

  /**
   * Sanitize damage configuration
   */
  static sanitizeDamageConfig(data) {
    return {
      weaponId: data.weaponId || "",
      ability: data.ability || "",
      offhand: !!data.offhand,
      smart: !!data.smart,
      smartAbility: Number(data.smartAbility) || 0,
      separate: !!data.separate,
      isCrit: !!data.isCrit,
      extraRows: Array.isArray(data.extraRows) ? data.extraRows.filter(r => r.formula?.trim()) : []
    };
  }

  /**
   * Import presets from another actor
   * @param {Actor} fromActor - Source actor
   * @param {Actor} toActor - Target actor
   * @param {string} type - Preset type
   */
  static async importPresets(fromActor, toActor, type) {
    const presets = await this.listPresets(fromActor, type);
    
    for (const preset of presets) {
      const { name, savedAt, ...data } = preset;
      await this.savePreset(toActor, type, `${name} (imported)`, data);
    }
  }

  /**
   * Export presets to JSON
   * @param {Actor} actor - Actor
   * @param {string} type - Preset type
   * @returns {Promise<string>} JSON string
   */
  static async exportPresets(actor, type) {
    const presets = await this.listPresets(actor, type);
    return JSON.stringify(presets, null, 2);
  }

  /**
   * Import presets from JSON
   * @param {Actor} actor - Actor
   * @param {string} type - Preset type
   * @param {string} jsonData - JSON data
   */
  static async importFromJSON(actor, type, jsonData) {
    try {
      const presets = JSON.parse(jsonData);
      
      if (!Array.isArray(presets)) {
        throw new Error("Invalid preset data format");
      }

      for (const preset of presets) {
        if (preset.name) {
          const { name, savedAt, ...data } = preset;
          await this.savePreset(actor, type, name, data);
        }
      }
      
      ui.notifications.info(`Imported ${presets.length} presets`);
    } catch (error) {
      console.error("SW5E Helper: Failed to import presets", error);
      ui.notifications.error("Failed to import presets - invalid format");
    }
  }

  /**
   * Clean up old presets
   * @param {Actor} actor - Actor
   * @param {string} type - Preset type
   * @param {number} maxAge - Max age in milliseconds
   */
  static async cleanupOldPresets(actor, type, maxAge = 30 * 24 * 60 * 60 * 1000) {
    const presets = await this.listPresets(actor, type);
    const cutoff = Date.now() - maxAge;
    
    const filtered = presets.filter(p => 
      !p.savedAt || p.savedAt > cutoff
    );

    if (filtered.length !== presets.length) {
      const key = this.getPresetKey(actor, type);
      await actor.setFlag("sw5e-helper", key, filtered);
      
      const removed = presets.length - filtered.length;
      console.log(`SW5E Helper: Cleaned up ${removed} old presets for ${actor.name}`);
    }
  }
}

export default PresetManager;