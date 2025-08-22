/**
 * Public API for SW5E Helper
 * Exposed functions for other modules to use
 */

import { WorkflowOrchestrator } from './workflow/orchestrator.js';
import { CONFIG, isDebug } from './config.js';

/**
 * SW5E Helper Public API
 */
export const API = {
  /**
   * Execute attack workflow
   * @param {object} seed - Initial configuration
   * @returns {Promise<object>} Attack result
   */
  async openAttack(seed = {}) {
    if (isDebug()) {
      console.log("SW5E Helper API: openAttack() called", seed);
    }
    
    return WorkflowOrchestrator.executeAttack(seed);
  },

  /**
   * Execute damage workflow
   * @param {object} seed - Initial configuration
   * @returns {Promise<object>} Damage result
   */
  async openDamage(seed = {}) {
    if (isDebug()) {
      console.log("SW5E Helper API: openDamage() called", seed);
    }
    
    return WorkflowOrchestrator.executeDamage(seed);
  },

  /**
   * Get module configuration
   * @param {string} path - Config path
   * @param {any} fallback - Fallback value
   * @returns {any} Config value
   */
  getConfig(path, fallback = null) {
    return path ? path.split('.').reduce((obj, key) => 
      obj?.[key] ?? fallback, CONFIG) : CONFIG;
  },

  /**
   * Get module version
   * @returns {string} Module version
   */
  getVersion() {
    return CONFIG.module.version;
  },

  /**
   * Check if module is ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return !!globalThis.sw5eHelper?.ready;
  },

  /**
   * Get debug mode status
   * @returns {boolean} Debug enabled
   */
  isDebug() {
    return isDebug();
  },

  /**
   * Access to internal modules (for advanced usage)
   */
  get modules() {
    return {
      core: globalThis.sw5eHelper?.core,
      ui: globalThis.sw5eHelper?.ui,
      workflow: globalThis.sw5eHelper?.workflow,
      data: globalThis.sw5eHelper?.data,
      integrations: globalThis.sw5eHelper?.integrations
    };
  },

  /**
   * Register a custom hook
   * @param {string} hookName - Hook name
   * @param {Function} callback - Callback function
   */
  onHook(hookName, callback) {
    Hooks.on(hookName, callback);
  },

  /**
   * Fire a custom hook
   * @param {string} hookName - Hook name
   * @param {...any} args - Hook arguments
   */
  callHook(hookName, ...args) {
    Hooks.callAll(hookName, ...args);
  },

  /**
   * Utility functions
   */
  utils: {
    /**
     * Localize a string
     * @param {string} key - Localization key
     * @param {object} data - Data for interpolation
     * @returns {string} Localized string
     */
    localize(key, data = {}) {
      return game.i18n?.localize?.(key, data) ?? key;
    },

    /**
     * Show notification
     * @param {string} message - Message text
     * @param {string} type - Notification type
     */
    notify(message, type = "info") {
      ui.notifications?.[type]?.(message);
    },

    /**
     * Deep clone an object
     * @param {object} obj - Object to clone
     * @returns {object} Cloned object
     */
    deepClone(obj) {
      return foundry.utils?.deepClone?.(obj) ?? JSON.parse(JSON.stringify(obj));
    },

    /**
     * Merge objects
     * @param {object} target - Target object
     * @param {object} source - Source object
     * @returns {object} Merged object
     */
    mergeObject(target, source) {
      return foundry.utils?.mergeObject?.(target, source) ?? { ...target, ...source };
    }
  }
};

/**
 * Install API on global scope
 */
export function installAPI() {
  if (globalThis.sw5eHelper) {
    console.warn("SW5E Helper: API already installed");
    return;
  }

  // Install main API
  globalThis.sw5eHelper = API;

  // Install convenient shortcuts
  globalThis.sw5eAttack = API.openAttack.bind(API);
  globalThis.sw5eDamage = API.openDamage.bind(API);

  if (isDebug()) {
    console.log("SW5E Helper: API installed on global scope");
  }
}

/**
 * Uninstall API from global scope
 */
export function uninstallAPI() {
  delete globalThis.sw5eHelper;
  delete globalThis.sw5eAttack;
  delete globalThis.sw5eDamage;

  if (isDebug()) {
    console.log("SW5E Helper: API uninstalled from global scope");
  }
}

export default API;