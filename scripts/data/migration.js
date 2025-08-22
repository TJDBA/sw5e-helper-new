/**
 * Data Migration System
 * Handles migrating data between module versions
 */

export class MigrationManager {
  static currentVersion = "1.0.0";
  static migrationKey = "migrationVersion";

  /**
   * Run migrations if needed
   */
  static async runMigrations() {
    try {
      const lastVersion = game.settings.get("sw5e-helper-new", this.migrationKey) || "0.0.0";
    
      if (this.needsMigration(lastVersion, this.currentVersion)) {
        console.log(`SW5E Helper: Running migrations from ${lastVersion} to ${this.currentVersion}`);
        
        await this.executeMigrations(lastVersion);
        
        await game.settings.set("sw5e-helper-new", this.migrationKey, this.currentVersion);
        console.log("SW5E Helper: Migrations complete");
      }
    } catch (error) {
      console.warn("SW5E Helper: Migration failed:", error);
      // Don't block initialization if migration fails
    }
  }

  /**
   * Check if migration is needed
   */
  static needsMigration(fromVersion, toVersion) {
    return this.compareVersions(fromVersion, toVersion) < 0;
  }

  /**
   * Compare version strings
   * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  static compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(n => parseInt(n, 10));
    const parts2 = v2.split('.').map(n => parseInt(n, 10));
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    
    return 0;
  }

  /**
   * Execute migrations from a specific version
   */
  static async executeMigrations(fromVersion) {
    const migrations = [
      { version: "0.1.0", migration: this.migrateFrom000 },
      { version: "0.2.0", migration: this.migrateFrom010 },
      { version: "1.0.0", migration: this.migrateFrom020 }
    ];

    for (const { version, migration } of migrations) {
      if (this.compareVersions(fromVersion, version) < 0) {
        console.log(`SW5E Helper: Running migration to ${version}`);
        await migration.call(this);
      }
    }
  }

  /**
   * Migration from 0.0.0 to 0.1.0
   */
  static async migrateFrom000() {
    // Initial migration - set up basic structure
    console.log("SW5E Helper: Migration 0.0.0 -> 0.1.0");
    
    // Could migrate from old data format if it existed
    for (const actor of game.actors) {
      // Example: migrate old flag structure
      const oldData = actor.getFlag("sw5e-helper", "oldPresets");
      if (oldData) {
        await actor.setFlag("sw5e-helper", "attackPresets", oldData.attacks || []);
        await actor.setFlag("sw5e-helper", "damagePresets", oldData.damage || []);
        await actor.unsetFlag("sw5e-helper", "oldPresets");
      }
    }
  }

  /**
   * Migration from 0.1.0 to 0.2.0
   */
  static async migrateFrom010() {
    console.log("SW5E Helper: Migration 0.1.0 -> 0.2.0");
    
    // Example: add new fields to existing presets
    for (const actor of game.actors) {
      const attackPresets = actor.getFlag("sw5e-helper", "attackPresets") || [];
      const updatedAttackPresets = attackPresets.map(preset => ({
        ...preset,
        // Add new field with default value
        smartAbility: preset.smartAbility ?? 0,
        smartProf: preset.smartProf ?? 0
      }));
      
      if (attackPresets.length > 0) {
        await actor.setFlag("sw5e-helper", "attackPresets", updatedAttackPresets);
      }
    }
  }

  /**
   * Migration from 0.2.0 to 1.0.0
   */
  static async migrateFrom020() {
    console.log("SW5E Helper: Migration 0.2.0 -> 1.0.0");
    
    // Example: major restructure for 1.0 release
    for (const actor of game.actors) {
      // Migrate settings structure
      const flags = actor.flags?.["sw5e-helper"];
      if (!flags) continue;
      
      // Example: rename fields
      if (flags.attackBonus !== undefined) {
        await actor.setFlag("sw5e-helper", "itemAttackBonus", flags.attackBonus);
        await actor.unsetFlag("sw5e-helper", "attackBonus");
      }
    }
  }

  /**
   * Backup data before migration
   */
  static async createBackup() {
    const backup = {
      version: game.system.version,
      moduleVersion: this.currentVersion,
      timestamp: Date.now(),
      actors: []
    };

    for (const actor of game.actors) {
      const flags = actor.flags?.["sw5e-helper"];
      if (flags) {
        backup.actors.push({
          id: actor.id,
          name: actor.name,
          flags
        });
      }
    }

    // Save backup to settings (if small enough) or prompt download
    const backupJson = JSON.stringify(backup, null, 2);
    
    if (backupJson.length < 100000) { // Under 100KB
      await game.settings.set("sw5e-helper", "lastBackup", backup);
    } else {
      // Prompt user to download backup
      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `sw5e-helper-backup-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      ui.notifications.info("SW5E Helper: Backup downloaded to your Downloads folder");
    }

    return backup;
  }

  /**
   * Restore data from backup
   */
  static async restoreFromBackup(backupData) {
    if (!backupData?.actors) {
      throw new Error("Invalid backup data");
    }

    let restored = 0;

    for (const actorData of backupData.actors) {
      const actor = game.actors?.get(actorData.id);
      if (!actor) continue;
      
      // Clear existing flags
      await actor.unsetFlag("sw5e-helper");
      
      // Restore flags
      for (const [key, value] of Object.entries(actorData.flags)) {
        await actor.setFlag("sw5e-helper", key, value);
      }
      
      restored++;
    }

    ui.notifications.info(`SW5E Helper: Restored data for ${restored} actors`);
    return restored;
  }

  /**
   * Validate data integrity after migration
   */
  static async validateData() {
    const issues = [];

    for (const actor of game.actors) {
      const flags = actor.flags?.["sw5e-helper"];
      if (!flags) continue;

      // Check preset structure
      const attackPresets = flags.attackPresets || [];
      for (const preset of attackPresets) {
        if (!preset.name) {
          issues.push(`Actor ${actor.name}: Attack preset missing name`);
        }
      }

      const damagePresets = flags.damagePresets || [];
      for (const preset of damagePresets) {
        if (!preset.name) {
          issues.push(`Actor ${actor.name}: Damage preset missing name`);
        }
      }

      // Check last used structure
      const lastUsedAttack = flags.lastUsedAttack;
      if (lastUsedAttack && typeof lastUsedAttack.adv === "undefined") {
        issues.push(`Actor ${actor.name}: Last used attack missing advantage setting`);
      }
    }

    if (issues.length > 0) {
      console.warn("SW5E Helper: Data validation issues:", issues);
      return issues;
    }

    console.log("SW5E Helper: Data validation passed");
    return [];
  }

  /**
   * Get migration history
   */
  static getMigrationHistory() {
    return game.settings.get("sw5e-helper", "migrationHistory") || [];
  }

  /**
   * Record migration in history
   */
  static async recordMigration(fromVersion, toVersion) {
    const history = this.getMigrationHistory();
    history.push({
      from: fromVersion,
      to: toVersion,
      timestamp: Date.now(),
      user: game.user.id
    });

    // Keep only last 10 migrations
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }

    await game.settings.set("sw5e-helper", "migrationHistory", history);
  }
}

export default MigrationManager;