/**
 * Feature Registry
 * Manages class features and special abilities
 */

export class FeatureRegistry {
  static features = new Map();

  /**
   * Initialize the feature registry
   */
  static init() {
    console.log("SW5E Helper: Feature registry initialized");
    this.registerDefaultFeatures();
  }

  /**
   * Register a feature
   * @param {string} key - Feature key
   * @param {object} feature - Feature definition
   */
  static register(key, feature) {
    this.features.set(key, feature);
    console.log(`SW5E Helper: Registered feature ${key}`);
  }

  /**
   * Get a feature by key
   * @param {string} key - Feature key
   * @returns {object|null} Feature definition
   */
  static get(key) {
    return this.features.get(key) ?? null;
  }

  /**
   * Get all features for an actor
   * @param {Actor} actor - Actor to check
   * @returns {Array} Array of applicable features
   */
  static getActorFeatures(actor) {
    const applicableFeatures = [];
    
    for (const [key, feature] of this.features) {
      if (this.isFeatureApplicable(actor, feature)) {
        applicableFeatures.push({ key, ...feature });
      }
    }
    
    return applicableFeatures;
  }

  /**
   * Check if feature applies to actor
   * @param {Actor} actor - Actor
   * @param {object} feature - Feature definition
   * @returns {boolean} True if applicable
   */
  static isFeatureApplicable(actor, feature) {
    // Check class requirements
    if (feature.classes && feature.classes.length > 0) {
      const actorClasses = this.getActorClasses(actor);
      if (!feature.classes.some(cls => actorClasses.includes(cls))) {
        return false;
      }
    }

    // Check level requirements
    if (feature.minLevel) {
      const level = this.getActorLevel(actor);
      if (level < feature.minLevel) {
        return false;
      }
    }

    // Check item requirements
    if (feature.requiresItem) {
      if (!actor.items?.some(item => feature.requiresItem(item))) {
        return false;
      }
    }

    // Check custom condition
    if (feature.condition) {
      return feature.condition(actor);
    }

    return true;
  }

  /**
   * Apply feature effects to attack
   * @param {object} attackData - Attack data
   * @param {Actor} actor - Attacking actor
   * @returns {object} Modified attack data
   */
  static applyAttackFeatures(attackData, actor) {
    const features = this.getActorFeatures(actor);
    
    for (const feature of features) {
      if (feature.modifyAttack) {
        attackData = feature.modifyAttack(attackData, actor);
      }
    }
    
    return attackData;
  }

  /**
   * Apply feature effects to damage
   * @param {object} damageData - Damage data
   * @param {Actor} actor - Actor
   * @returns {object} Modified damage data
   */
  static applyDamageFeatures(damageData, actor) {
    const features = this.getActorFeatures(actor);
    
    for (const feature of features) {
      if (feature.modifyDamage) {
        damageData = feature.modifyDamage(damageData, actor);
      }
    }
    
    return damageData;
  }

  /**
   * Get actor classes
   * @param {Actor} actor - Actor
   * @returns {Array} Array of class names
   */
  static getActorClasses(actor) {
    const classes = [];
    
    if (actor.items) {
      for (const item of actor.items) {
        if (item.type === "class") {
          classes.push(item.name.toLowerCase());
        }
      }
    }
    
    return classes;
  }

  /**
   * Get actor level
   * @param {Actor} actor - Actor
   * @returns {number} Actor level
   */
  static getActorLevel(actor) {
    return actor?.system?.details?.level ?? 1;
  }

  /**
   * Register default SW5E features
   */
  static registerDefaultFeatures() {
    // Example: Sneak Attack
    this.register("sneak-attack", {
      name: "Sneak Attack",
      classes: ["operative"],
      minLevel: 1,
      modifyDamage: (damageData, actor) => {
        // Add sneak attack damage if conditions are met
        const level = this.getActorLevel(actor);
        const sneakDice = Math.ceil(level / 2);
        
        // This would check for sneak attack conditions
        if (this.canSneakAttack(actor, damageData)) {
          damageData.extraDamage = (damageData.extraDamage || []);
          damageData.extraDamage.push({
            formula: `${sneakDice}d6`,
            type: "kinetic",
            label: "Sneak Attack"
          });
        }
        
        return damageData;
      }
    });

    // Example: Great Weapon Fighting
    this.register("great-weapon-fighting", {
      name: "Great Weapon Fighting",
      classes: ["fighter", "berserker"],
      condition: (actor) => {
        // Check if actor has great weapon fighting style
        return actor.items?.some(item => 
          item.name?.toLowerCase().includes("great weapon fighting")
        ) ?? false;
      },
      modifyDamage: (damageData, actor) => {
        // Reroll 1s and 2s on damage dice
        damageData.rerollLowDice = true;
        return damageData;
      }
    });

    // Example: Sharpshooter
    this.register("sharpshooter", {
      name: "Sharpshooter",
      condition: (actor) => {
        return actor.items?.some(item => 
          item.name?.toLowerCase().includes("sharpshooter")
        ) ?? false;
      },
      modifyAttack: (attackData, actor) => {
        // Option to take -5 attack for +10 damage
        if (attackData.useSharpshooter) {
          attackData.attackBonus -= 5;
        }
        return attackData;
      },
      modifyDamage: (damageData, actor) => {
        if (damageData.useSharpshooter) {
          damageData.bonusDamage = (damageData.bonusDamage || 0) + 10;
        }
        return damageData;
      }
    });
  }

  /**
   * Check sneak attack conditions
   * @param {Actor} actor - Actor
   * @param {object} damageData - Damage data
   * @returns {boolean} True if can sneak attack
   */
  static canSneakAttack(actor, damageData) {
    // Simplified sneak attack check
    // Would need proper condition checking for advantage, flanking, etc.
    return damageData.hasAdvantage || damageData.hasAlly;
  }

  /**
   * Create feature UI elements
   * @param {Array} features - Features to create UI for
   * @returns {string} HTML for feature toggles
   */
  static createFeatureUI(features) {
    if (!features.length) return "";
    
    const featureToggles = features.map(feature => `
      <div class="feature-toggle">
        <input type="checkbox" id="feature-${feature.key}" name="features" value="${feature.key}">
        <label for="feature-${feature.key}">${feature.name}</label>
      </div>
    `).join("");
    
    return `
      <div class="feature-section">
        <div class="section-title">Class Features</div>
        ${featureToggles}
      </div>
    `;
  }

  /**
   * Process feature selections from dialog
   * @param {FormData} formData - Form data
   * @returns {Array} Selected features
   */
  static processFeatureSelections(formData) {
    const selectedFeatures = [];
    const features = formData.getAll("features");
    
    for (const featureKey of features) {
      const feature = this.get(featureKey);
      if (feature) {
        selectedFeatures.push({ key: featureKey, ...feature });
      }
    }
    
    return selectedFeatures;
  }

  /**
   * Get all registered features
   * @returns {Map} All features
   */
  static getAllFeatures() {
    return new Map(this.features);
  }

  /**
   * Clear all features (for testing)
   */
  static clear() {
    this.features.clear();
  }

  /**
   * Export features to JSON
   * @returns {string} JSON string
   */
  static exportFeatures() {
    const featuresArray = Array.from(this.features.entries()).map(([key, feature]) => ({
      key,
      ...feature
    }));
    
    return JSON.stringify(featuresArray, null, 2);
  }

  /**
   * Import features from JSON
   * @param {string} jsonData - JSON data
   */
  static importFeatures(jsonData) {
    try {
      const featuresArray = JSON.parse(jsonData);
      
      for (const feature of featuresArray) {
        const { key, ...featureData } = feature;
        this.register(key, featureData);
      }
      
      console.log(`SW5E Helper: Imported ${featuresArray.length} features`);
    } catch (error) {
      console.error("SW5E Helper: Failed to import features", error);
    }
  }
}

export default FeatureRegistry;