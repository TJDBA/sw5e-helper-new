/**
 * Damage application utilities
 * Handles applying damage to actors
 */

import { TokenResolver } from './resolver.js';

export class DamageApplicator {
  /**
   * Apply damage to an actor
   * @param {Actor} actor - Actor to damage
   * @param {number} amount - Damage amount
   * @param {object} options - Application options
   * @returns {Promise<boolean>} True if successful
   */
  static async applyDamage(actor, amount, options = {}) {
    if (!actor || !Number.isFinite(amount)) return false;
    
    try {
      // Use actor's built-in damage application if available
      if (typeof actor.applyDamage === "function") {
        await actor.applyDamage(amount, options);
        return true;
      }
      
      // Fallback to manual HP reduction
      return await this.manualDamageApplication(actor, amount, options);
    } catch (error) {
      console.error("SW5E Helper: Failed to apply damage", error);
      return false;
    }
  }

  /**
   * Manual damage application by modifying HP
   * @param {Actor} actor - Actor to damage
   * @param {number} amount - Damage amount
   * @param {object} options - Application options
   * @returns {Promise<boolean>} True if successful
   */
  static async manualDamageApplication(actor, amount, options = {}) {
    const { mode = "damage" } = options;
    
    // Get current HP values
    const hp = actor.system?.attributes?.hp;
    if (!hp) return false;
    
    const currentHP = Number(hp.value ?? 0);
    const maxHP = Number(hp.max ?? 0);
    
    let newHP;
    
    switch (mode) {
      case "damage":
        newHP = Math.max(0, currentHP - amount);
        break;
      case "heal":
        newHP = Math.min(maxHP, currentHP + amount);
        break;
      case "temp":
        // Handle temporary HP if supported
        const currentTemp = Number(hp.temp ?? 0);
        const newTemp = Math.max(0, currentTemp + amount);
        await actor.update({ "system.attributes.hp.temp": newTemp });
        return true;
      default:
        return false;
    }
    
    // Update HP
    await actor.update({ "system.attributes.hp.value": newHP });
    return true;
  }

  /**
   * Apply damage to multiple actors
   * @param {Array} targets - Array of {actor, amount, options}
   * @returns {Promise<Array>} Array of results
   */
  static async applyDamageToMultiple(targets) {
    const results = [];
    
    for (const { actor, amount, options = {} } of targets) {
      const success = await this.applyDamage(actor, amount, options);
      results.push({ actor, amount, success });
    }
    
    return results;
  }

  /**
   * Calculate damage amount based on application mode
   * @param {number} baseDamage - Base damage amount
   * @param {string} mode - Application mode ("full", "half", "none")
   * @returns {number} Final damage amount
   */
  static calculateDamageAmount(baseDamage, mode) {
    const amount = Number(baseDamage || 0);
    
    switch (mode) {
      case "none":
        return 0;
      case "half":
        return Math.floor(amount / 2);
      case "full":
      default:
        return amount;
    }
  }

  /**
   * Get damage resistance/immunity multiplier
   * @param {Actor} actor - Actor to check
   * @param {string} damageType - Type of damage
   * @returns {number} Damage multiplier (0 = immune, 0.5 = resistant, 1 = normal, 2 = vulnerable)
   */
  static getDamageMultiplier(actor, damageType) {
    try {
      const traits = actor.system?.traits;
      if (!traits) return 1;
      
      // Check immunities
      if (traits.di?.value?.includes?.(damageType) || 
          traits.di?.custom?.includes?.(damageType)) {
        return 0;
      }
      
      // Check resistances
      if (traits.dr?.value?.includes?.(damageType) || 
          traits.dr?.custom?.includes?.(damageType)) {
        return 0.5;
      }
      
      // Check vulnerabilities
      if (traits.dv?.value?.includes?.(damageType) || 
          traits.dv?.custom?.includes?.(damageType)) {
        return 2;
      }
      
      return 1;
    } catch {
      return 1;
    }
  }

  /**
   * Apply damage with type-based resistances
   * @param {Actor} actor - Actor to damage
   * @param {object} damageMap - Map of damage types to amounts
   * @param {object} options - Application options
   * @returns {Promise<object>} Application result
   */
  static async applyTypedDamage(actor, damageMap, options = {}) {
    let totalDamage = 0;
    const typeBreakdown = {};
    
    // Calculate damage per type with resistances
    for (const [type, amount] of Object.entries(damageMap)) {
      const multiplier = this.getDamageMultiplier(actor, type);
      const finalAmount = Math.floor(amount * multiplier);
      
      totalDamage += finalAmount;
      typeBreakdown[type] = {
        original: amount,
        multiplier,
        final: finalAmount
      };
    }
    
    // Apply the total damage
    const success = await this.applyDamage(actor, totalDamage, options);
    
    return {
      success,
      totalDamage,
      typeBreakdown
    };
  }

  /**
   * Check if actor is at 0 HP
   * @param {Actor} actor - Actor to check
   * @returns {boolean} True if at 0 HP
   */
  static isAtZeroHP(actor) {
    const hp = actor.system?.attributes?.hp;
    return Number(hp?.value ?? 0) <= 0;
  }

  /**
   * Get actor's current HP information
   * @param {Actor} actor - Actor to check
   * @returns {object} HP information
   */
  static getHPInfo(actor) {
    const hp = actor.system?.attributes?.hp;
    
    return {
      current: Number(hp?.value ?? 0),
      max: Number(hp?.max ?? 0),
      temp: Number(hp?.temp ?? 0),
      percentage: hp?.max ? Math.round((hp.value / hp.max) * 100) : 0
    };
  }
}

/**
 * CONVENIENCE FUNCTION FOR QUICK TESTING WORKFLOWS
 * Apply damage to a token's actor using token reference.
 * Integrates half-damage and leaves room for resistances.
 * @param {string|{sceneId:string,tokenId:string}} ref - Token reference
 * @param {number} amount - Damage amount
 * @param {{half?:boolean}} opts - Damage options
 * @returns {Promise<number>} Applied damage amount
 */
export async function applyDamageToToken(ref, amount, { half = false } = {}) {
  try {
    const resolved = TokenResolver.resolve(ref, { allowMissing: false });
    const { actor } = resolved;
    
    if (!actor) return 0;
    
    let dmg = Number(amount) || 0;
    if (half) dmg = Math.floor(dmg / 2);

    // TODO: apply resistances/reductions from actor.system
    const hp = actor.system?.attributes?.hp;
    if (!hp) return 0;

    const before = Number(hp.value ?? 0);
    const after = Math.max(0, before - dmg);

    await actor.update({ "system.attributes.hp.value": after });
    return before - after;
  } catch (error) {
    console.error("SW5E Helper: applyDamageToToken failed", error);
    return 0;
  }
}

export default DamageApplicator;