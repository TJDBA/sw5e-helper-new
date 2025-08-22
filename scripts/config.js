/**
 * Module Configuration
 * Central configuration and constants
 */

export const CONFIG = {
  module: {
    id: "sw5e-helper",
    name: "SW5E Helper",
    version: "1.0.0"
  },
  
  system: {
    required: "sw5e",
    minVersion: "2.0.0"
  },
  
  foundry: {
    minVersion: "11",
    verified: "12"
  },
  
  debug: {
    enabled: false,
    logLevel: "info" // error, warn, info, debug
  },
  
  defaults: {
    advantage: "normal",
    separateRolls: false,
    showDiceAnimations: true,
    autoApplyDamage: false,
    cardsDefaultExpanded: false,
    presetCleanupDays: 30
  },
  
  ui: {
    dialog: {
      attack: {
        width: 520,
        height: "auto"
      },
      damage: {
        width: 560,
        height: "auto"
      }
    },
    
    card: {
      maxTargets: 20,
      showPortraits: true,
      alternatingRows: true
    }
  },
  
  dice: {
    maxRolls: 100,
    showAnimations: true,
    animationTimeout: 5000,
    critThreshold: 20,
    fumbleThreshold: 1,
    minDieValues: {
      4: 2, 6: 2, 8: 3, 10: 4, 12: 5, 20: 8
    }
  },
  
  cache: {
    maxSize: 1000,
    maxAge: 5 * 60 * 1000, // 5 minutes
    cleanupInterval: 60 * 1000 // 1 minute
  },
  
  hooks: {
    attack: [
      "sw5eHelper.preAttackRoll",
      "sw5eHelper.postAttackRoll", 
      "sw5eHelper.attackComplete"
    ],
    damage: [
      "sw5eHelper.preDamageRoll",
      "sw5eHelper.postDamageRoll",
      "sw5eHelper.damageComplete"
    ],
    save: [
      "sw5eHelper.preSaveRoll",
      "sw5eHelper.postSaveRoll",
      "sw5eHelper.saveComplete"
    ],
    apply: [
      "sw5eHelper.preApplyDamage",
      "sw5eHelper.postApplyDamage"
    ]
  },
  
  templates: {
    attack: "modules/sw5e-helper/templates/dialogs/attack-dialog.hbs",
    damage: "modules/sw5e-helper/templates/dialogs/damage-dialog.hbs",
    card: "modules/sw5e-helper/templates/cards/attack-card.hbs"
  },
  
  styles: [
    "modules/sw5e-helper/styles/module.css",
    "modules/sw5e-helper/styles/dialogs.css", 
    "modules/sw5e-helper/styles/cards.css"
  ],
  
  abilities: ["str", "dex", "con", "int", "wis", "cha"],
  
  // Check types for generic evaluator
  checkTypes: {
    ATTACK: "attack",
    SAVE: "save",
    SKILL: "skill", 
    ABILITY: "ability",
    INITIATIVE: "initiative"
  },
  
  // Permission levels
  permissions: {
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3
  },
  
  advantageStates: ["normal", "advantage", "disadvantage"],
  
  damageTypes: [
    "kinetic", "energy", "ion", "acid", "cold", 
    "fire", "force", "lightning", "necrotic", 
    "poison", "psychic", "sonic", "true"
  ],
  
  applicationModes: ["full", "half", "none"],
  
  validationRules: {
    presetName: {
      minLength: 1,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9\s\-_]+$/
    },
    formula: {
      maxLength: 200
    },
    modifierValue: {
      min: -20,
      max: 20
    }
  }
};

/**
 * Get configuration value with dot notation
 * @param {string} path - Config path (e.g., "ui.dialog.attack.width")
 * @param {any} fallback - Fallback value
 * @returns {any} Configuration value
 */
export function getConfig(path, fallback = null) {
  // Handle both dot notation and simple paths
  if (!path.includes('.')) {
    return CONFIG[path] ?? fallback;
  }
  
  return path.split('.').reduce((obj, key) => 
    obj?.[key] ?? fallback, CONFIG
  );
}

/**
 * Check if debug mode is enabled
 * @returns {boolean} Debug mode status
 */
export function isDebug() {
  return CONFIG.debug.enabled || 
         game.settings?.get?.(CONFIG.module.id, "debugMode") === true;
}

/**
 * Log debug message if debug mode is enabled
 * @param {string} message - Debug message
 * @param {...any} args - Additional arguments
 */
export function debug(message, ...args) {
  if (isDebug()) {
    console.log(`SW5E Helper Debug: ${message}`, ...args);
  }
}

/**
 * Get localized string
 * @param {string} key - Localization key
 * @param {object} data - Interpolation data
 * @returns {string} Localized string
 */
export function localize(key, data = {}) {
  return game.i18n?.localize?.(key, data) ?? key;
}

/**
 * Validate module requirements
 * @returns {object} Validation result
 */
export function validateRequirements() {
  const issues = [];
  
  // Check system
  if (game.system.id !== CONFIG.system.required) {
    issues.push(`Wrong game system. Expected ${CONFIG.system.required}, got ${game.system.id}`);
  }
  
  // Check Foundry version
  const foundryVersion = game.version || game.data?.version;
  if (foundryVersion && isNewerVersion(CONFIG.foundry.minVersion, foundryVersion)) {
    issues.push(`Foundry VTT version too old. Minimum ${CONFIG.foundry.minVersion}, current ${foundryVersion}`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

export default CONFIG;