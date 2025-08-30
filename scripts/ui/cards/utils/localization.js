/**
 * Localization utility for SW5E Helper
 * Provides consistent localization across the module
 */

/**
 * Localize a string using FoundryVTT's localization system
 * @param {string} key - Localization key
 * @param {object} data - Data for interpolation
 * @returns {string} Localized string
 */
export function l(key, data = {}) {
  try {
    // Try to use Foundry's localization system
    if (game.i18n && typeof game.i18n.localize === "function") {
      return game.i18n.localize(key);
    }
    
    // Fallback: return the key itself
    return key;
  } catch (error) {
    console.warn("SW5E Helper: Localization failed for key:", key, error);
    return key;
  }
}

/**
 * Localize with data interpolation
 * @param {string} key - Localization key
 * @param {object} data - Data for interpolation
 * @returns {string} Localized string with interpolated data
 */
export function lf(key, data = {}) {
  try {
    // Try to use Foundry's localization system with data
    if (game.i18n && typeof game.i18n.localize === "function") {
      return game.i18n.localize(key, data);
    }
    
    // Fallback: return the key itself
    return key;
  } catch (error) {
    console.warn("SW5E Helper: Localization with data failed for key:", key, error);
    return key;
  }
}

/**
 * Check if a localization key exists
 * @param {string} key - Localization key to check
 * @returns {boolean} True if the key exists
 */
export function hasLocalization(key) {
  try {
    if (game.i18n && typeof game.i18n.localize === "function") {
      const localized = game.i18n.localize(key);
      return localized !== key; // If localization returns the key, it doesn't exist
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get all available localization keys for a namespace
 * @param {string} namespace - Namespace to search (e.g., "SW5EHELPER")
 * @returns {string[]} Array of available keys
 */
export function getLocalizationKeys(namespace) {
  try {
    if (game.i18n && game.i18n.translations) {
      const translations = game.i18n.translations[game.i18n.lang] || {};
      const namespaceTranslations = translations[namespace] || {};
      return Object.keys(namespaceTranslations);
    }
    return [];
  } catch (error) {
    console.warn("SW5E Helper: Failed to get localization keys:", error);
    return [];
  }
}
