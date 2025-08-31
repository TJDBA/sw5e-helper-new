/**
 * Data Storage Management
 * Handles persistent data storage for the module
 */

export class StorageManager {
  /**
   * Get module setting
   * @param {string} key - Setting key
   * @returns {any} Setting value
   */
  static getSetting(key) {
    return game.settings.get("sw5e-helper-new", key);
  }

  /**
   * Set module setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  static async setSetting(key, value) {
    return game.settings.set("sw5e-helper-new", key, value);
  }

  /**
   * Register module settings
   */
  static registerSettings() {
    // Debug mode
    game.settings.register("sw5e-helper-new", "debugMode", {
      name: "Debug Mode",
      hint: "Enable debug logging and features",
      scope: "client",
      config: true,
      type: Boolean,
      default: false
    });

    // Auto-apply damage
    game.settings.register("sw5e-helper-new", "autoApplyDamage", {
      name: "Auto-Apply Damage", 
      hint: "Automatically apply damage to actor HP when applying full damage",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });

    // Show DSN animations
    game.settings.register("sw5e-helper-new", "showDiceAnimations", {
      name: "Show Dice Animations",
      hint: "Show Dice So Nice animations for rolls",
      scope: "client", 
      config: true,
      type: Boolean,
      default: true
    });

    // Default advantage mode
    game.settings.register("sw5e-helper-new", "defaultAdvantage", {
      name: "Default Advantage Mode",
      hint: "Default advantage/disadvantage mode for attack rolls",
      scope: "client",
      config: true,
      type: String,
      choices: {
        "normal": "Normal",
        "advantage": "Advantage", 
        "disadvantage": "Disadvantage"
      },
      default: "normal"
    });

    // Preset auto-cleanup
    game.settings.register("sw5e-helper-new", "presetCleanupDays", {
      name: "Preset Cleanup Days",
      hint: "Automatically remove presets older than this many days (0 = never)",
      scope: "world",
      config: true,
      type: Number,
      default: 30,
      range: { min: 0, max: 365, step: 1 }
    });

    // Card default expanded state
    game.settings.register("sw5e-helper-new", "cardsDefaultExpanded", {
      name: "Cards Default Expanded",
      hint: "Chat cards start with all targets expanded by default",
      scope: "client",
      config: true, 
      type: Boolean,
      default: false
    });

    // Resume tokens (not visible in config)
    game.settings.register("sw5e-helper-new", "resumeTokens", {
      name: "Resume Tokens",
      hint: "Storage for workflow resume tokens",
      scope: "world",
      config: false,
      type: Object,
      default: {}
    });

    // Migration version (not visible in config)
    game.settings.register("sw5e-helper-new", "migrationVersion", {
      name: "Migration Version",
      hint: "Tracks the last migration version applied",
      scope: "world",
      config: false,
      type: String,
      default: "0.0.0"
    });
  }

  /**
   * Get user data for actor
   * @param {string} actorId - Actor ID
   * @param {string} key - Data key
   * @returns {Promise<any>} User data
   */
  static async getUserData(actorId, key) {
    const actor = game.actors?.get(actorId);
    if (!actor) return null;
    
    return actor.getFlag("sw5e-helper-new", key);
  }

  /**
   * Set user data for actor
   * @param {string} actorId - Actor ID
   * @param {string} key - Data key
   * @param {any} value - Data value
   */
  static async setUserData(actorId, key, value) {
    const actor = game.actors?.get(actorId);
    if (!actor) return;
    
    return actor.setFlag("sw5e-helper-new", key, value);
  }

  /**
   * Clear user data for actor
   * @param {string} actorId - Actor ID
   * @param {string} key - Data key (optional, clears all if not provided)
   */
  static async clearUserData(actorId, key = null) {
    const actor = game.actors?.get(actorId);
    if (!actor) return;
    
    if (key) {
      return actor.unsetFlag("sw5e-helper-new", key);
    } else {
              return actor.unsetFlag("sw5e-helper-new");
    }
  }

  /**
   * Get global module data
   * @param {string} key - Data key
   * @returns {any} Global data
   */
  static getGlobalData(key) {
    return game.settings.get("sw5e-helper-new", `global.${key}`);
  }

  /**
   * Set global module data
   * @param {string} key - Data key
   * @param {any} value - Data value
   */
  static async setGlobalData(key, value) {
    return game.settings.set("sw5e-helper-new", `global.${key}`, value);
  }

  /**
   * Get session data (not persistent)
   * @param {string} key - Data key
   * @returns {any} Session data
   */
  static getSessionData(key) {
    if (!this._sessionData) {
      this._sessionData = new Map();
    }
    return this._sessionData.get(key);
  }

  /**
   * Set session data (not persistent)
   * @param {string} key - Data key
   * @param {any} value - Data value
   */
  static setSessionData(key, value) {
    if (!this._sessionData) {
      this._sessionData = new Map();
    }
    this._sessionData.set(key, value);
  }

  /**
   * Clear session data
   * @param {string} key - Data key (optional, clears all if not provided)
   */
  static clearSessionData(key = null) {
    if (!this._sessionData) return;
    
    if (key) {
      this._sessionData.delete(key);
    } else {
      this._sessionData.clear();
    }
  }

  /**
   * Export all actor data
   * @param {string} actorId - Actor ID
   * @returns {Promise<object>} Exported data
   */
  static async exportActorData(actorId) {
    const actor = game.actors?.get(actorId);
    if (!actor) return null;
    
    const data = actor.flags?.["sw5e-helper-new"] ?? {};
    
    return {
      actorId,
      actorName: actor.name,
      exportedAt: Date.now(),
      data
    };
  }

  /**
   * Import actor data
   * @param {string} actorId - Actor ID
   * @param {object} exportData - Exported data
   */
  static async importActorData(actorId, exportData) {
    const actor = game.actors?.get(actorId);
    if (!actor || !exportData?.data) return;
    
    // Clear existing data first
            await actor.unsetFlag("sw5e-helper-new");
    
    // Import new data
    for (const [key, value] of Object.entries(exportData.data)) {
              await actor.setFlag("sw5e-helper-new", key, value);
    }
    
    ui.notifications.info(`Imported data for ${actor.name}`);
  }

  /**
   * Get storage statistics
   * @returns {Promise<object>} Storage statistics
   */
  static async getStorageStats() {
    const stats = {
      actors: 0,
      totalPresets: 0,
      totalLastUsed: 0,
      storageSize: 0
    };

    for (const actor of game.actors) {
      const flags = actor.flags?.["sw5e-helper-new"];
      if (!flags) continue;
      
      stats.actors++;
      
      // Count presets
      if (flags.attackPresets) stats.totalPresets += flags.attackPresets.length;
      if (flags.damagePresets) stats.totalPresets += flags.damagePresets.length;
      
      // Count last used
      if (flags.lastUsedAttack) stats.totalLastUsed++;
      if (flags.lastUsedDamage) stats.totalLastUsed++;
      
      // Estimate storage size (rough)
      stats.storageSize += JSON.stringify(flags).length;
    }

    return stats;
  }

  /**
   * Cleanup storage
   * @param {object} options - Cleanup options
   */
  static async cleanupStorage(options = {}) {
    const {
      removeOldPresets = true,
      removeOldLastUsed = true,
      maxPresetAge = 30 * 24 * 60 * 60 * 1000, // 30 days
      maxLastUsedAge = 7 * 24 * 60 * 60 * 1000  // 7 days
    } = options;

    let cleaned = 0;

    for (const actor of game.actors) {
      const flags = actor.flags?.["sw5e-helper-new"];
      if (!flags) continue;
      
      const updates = {};
      let hasUpdates = false;

      // Clean old presets
      if (removeOldPresets && flags.attackPresets) {
        const cutoff = Date.now() - maxPresetAge;
        const filtered = flags.attackPresets.filter(p => 
          !p.savedAt || p.savedAt > cutoff
        );
        
        if (filtered.length !== flags.attackPresets.length) {
          updates.attackPresets = filtered;
          hasUpdates = true;
          cleaned += flags.attackPresets.length - filtered.length;
        }
      }

      // Clean old last used
      if (removeOldLastUsed && flags.lastUsedAttack) {
        const cutoff = Date.now() - maxLastUsedAge;
        if (flags.lastUsedAttack.usedAt && flags.lastUsedAttack.usedAt < cutoff) {
          updates["-=lastUsedAttack"] = null;
          hasUpdates = true;
          cleaned++;
        }
      }

      // Apply updates
      if (hasUpdates) {
        await actor.update({ "flags.sw5e-helper-new": updates });
      }
    }

    if (cleaned > 0) {
      ui.notifications.info(`Cleaned up ${cleaned} old data entries`);
    }

    return cleaned;
  }
}

export default StorageManager;