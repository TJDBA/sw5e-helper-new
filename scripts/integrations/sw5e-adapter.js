/**
 * SW5E System Adapter
 * Handles integration with the SW5E game system
 */

export class SW5EAdapter {
  /**
   * Initialize SW5E system integration
   */
  static init() {
    console.log("SW5E Helper: SW5E system adapter initialized");
    
    // Verify we're running on SW5E system
    if (game.system.id !== "sw5e") {
      console.warn("SW5E Helper: Not running on SW5E system, some features may not work correctly");
    }

    this.registerSystemHooks();
  }

  /**
   * Register system-specific hooks
   */
  static registerSystemHooks() {
    // SW5E specific hooks would go here
    Hooks.on("sw5e.preRollAttack", this.onPreRollAttack.bind(this));
    Hooks.on("sw5e.preRollDamage", this.onPreRollDamage.bind(this));
  }

  /**
   * Get equipped weapons for an actor
   * @param {Actor} actor - Actor to check
   * @returns {Array} Array of equipped weapons
   */
  static getEquippedWeapons(actor) {
    if (!actor?.items) return [];
    
    return actor.items
      .filter(item => 
        item.type === "weapon" && 
        item.system?.equipped === true
      )
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img,
        item
      }));
  }

  /**
   * Get weapon by ID
   * @param {Actor} actor - Actor
   * @param {string} weaponId - Weapon ID
   * @returns {Item|null} Weapon item
   */
  static getWeaponById(actor, weaponId) {
    return actor?.items?.get(weaponId) ?? null;
  }

  /**
   * Get item attack bonus
   * @param {Actor} actor - Actor
   * @param {Item} item - Weapon item
   * @returns {number} Attack bonus
   */
  static getItemAttackBonus(actor, item) {
    return Number(item?.system?.attackBonus ?? 0);
  }

  /**
   * Get save data from item
   * @param {Item} item - Item to check
   * @returns {object|null} Save data or null
   */
  static getSaveForItem(item) {
    try {
      const save = item?.system?.save;
      if (!save) return null;

      return {
        ability: save.ability || "cha",
        dc: save.dc || save.scaling || ""
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse smart weapon defaults
   * @param {Item} item - Weapon item
   * @returns {object|null} Smart defaults or null
   */
  static parseSmartDefaults(item) {
    try {
      if (!item?.system?.properties?.smr) return null;

      // This would parse the smart property text to extract defaults
      // For now, return reasonable defaults
      return {
        abilityMod: 0,
        profBonus: 0
      };
    } catch {
      return null;
    }
  }

  /**
   * Normalize actor for consistent access
   * @param {Actor} actor - Raw actor
   * @returns {Actor} Normalized actor
   */
  static normalizeActor(actor) {
    // Ensure we have the actual document, not a proxy
    if (actor?.getRollData) return actor;
    if (actor?.id) return game.actors?.get(actor.id) ?? actor;
    return actor;
  }

  /**
   * Get ability modifier from actor
   * @param {Actor} actor - Actor
   * @param {string} abilityKey - Ability key (str, dex, etc.)
   * @returns {number} Ability modifier
   */
  static getAbilityModifier(actor, abilityKey) {
    return actor?.system?.abilities?.[abilityKey]?.mod ?? 0;
  }

  /**
   * Get proficiency bonus from actor
   * @param {Actor} actor - Actor
   * @returns {number} Proficiency bonus
   */
  static getProficiencyBonus(actor) {
    return actor?.system?.attributes?.prof ?? 0;
  }

  /**
   * Get armor class from actor
   * @param {Actor} actor - Actor
   * @returns {number} Armor class
   */
  static getArmorClass(actor) {
    return actor?.system?.attributes?.ac?.value ?? 10;
  }

  /**
   * Get hit points from actor
   * @param {Actor} actor - Actor
   * @returns {object} HP information
   */
  static getHitPoints(actor) {
    const hp = actor?.system?.attributes?.hp ?? {};
    
    return {
      current: Number(hp.value ?? 0),
      max: Number(hp.max ?? 0),
      temp: Number(hp.temp ?? 0)
    };
  }

  /**
   * Apply damage to actor
   * @param {Actor} actor - Actor
   * @param {number} amount - Damage amount
   * @param {object} options - Application options
   * @returns {Promise<boolean>} Success status
   */
  static async applyDamage(actor, amount, options = {}) {
    try {
      // Use SW5E system damage application if available
      if (typeof actor.applyDamage === "function") {
        await actor.applyDamage(amount, options);
        return true;
      }

      // Fallback to manual HP modification
      const hp = this.getHitPoints(actor);
      const newValue = Math.max(0, hp.current - amount);
      
      await actor.update({
        "system.attributes.hp.value": newValue
      });
      
      return true;
    } catch (error) {
      console.error("SW5E Helper: Failed to apply damage", error);
      return false;
    }
  }

  /**
   * Get damage resistances/immunities
   * @param {Actor} actor - Actor
   * @returns {object} Damage traits
   */
  static getDamageTraits(actor) {
    const traits = actor?.system?.traits ?? {};
    
    return {
      immunities: traits.di?.value ?? [],
      resistances: traits.dr?.value ?? [],
      vulnerabilities: traits.dv?.value ?? []
    };
  }

  /**
   * Check if actor has damage resistance/immunity
   * @param {Actor} actor - Actor
   * @param {string} damageType - Damage type
   * @returns {number} Multiplier (0=immune, 0.5=resist, 1=normal, 2=vulnerable)
   */
  static getDamageMultiplier(actor, damageType) {
    const traits = this.getDamageTraits(actor);
    
    if (traits.immunities.includes(damageType)) return 0;
    if (traits.resistances.includes(damageType)) return 0.5;
    if (traits.vulnerabilities.includes(damageType)) return 2;
    
    return 1;
  }

  /**
   * Get spell save DC for actor
   * @param {Actor} actor - Actor
   * @param {string} ability - Spellcasting ability
   * @returns {number} Spell save DC
   */
  static getSpellSaveDC(actor, ability = "cha") {
    const abilityMod = this.getAbilityModifier(actor, ability);
    const profBonus = this.getProficiencyBonus(actor);
    
    return 8 + profBonus + abilityMod;
  }

  /**
   * Check weapon proficiency
   * @param {Actor} actor - Actor
   * @param {Item} weapon - Weapon item
   * @returns {boolean} True if proficient
   */
  static isProficientWithWeapon(actor, weapon) {
    // SW5E specific proficiency checking would go here
    // For now, assume proficient
    return true;
  }

  /**
   * Get weapon properties
   * @param {Item} weapon - Weapon item
   * @returns {object} Weapon properties
   */
  static getWeaponProperties(weapon) {
    return weapon?.system?.properties ?? {};
  }

  /**
   * Check if weapon has specific property
   * @param {Item} weapon - Weapon item
   * @param {string} property - Property key
   * @returns {boolean} True if weapon has property
   */
  static hasWeaponProperty(weapon, property) {
    const props = this.getWeaponProperties(weapon);
    return !!props[property];
  }

  /**
   * Get brutal weapon dice
   * @param {Item} weapon - Weapon item
   * @returns {number} Brutal dice count
   */
  static getBrutalDice(weapon) {
    return Number(weapon?.system?.properties?.brutal ?? 0);
  }

  /**
   * Check if weapon is smart
   * @param {Item} weapon - Weapon item
   * @returns {boolean} True if smart weapon
   */
  static isSmartWeapon(weapon) {
    return this.hasWeaponProperty(weapon, "smr");
  }

  /**
   * Hook handlers
   */
  static onPreRollAttack(actor, item, config) {
    console.log("SW5E Helper: Pre-attack roll hook", { actor, item, config });
  }

  static onPreRollDamage(actor, item, config) {
    console.log("SW5E Helper: Pre-damage roll hook", { actor, item, config });
  }
}

export default SW5EAdapter;