/**
 * General utility functions
 * Common helpers used throughout the module
 */

export class Helpers {
  /**
   * Localize a string key
   * @param {string} key - Localization key
   * @param {object} data - Interpolation data
   * @returns {string} Localized string
   */
  static localize(key, data = {}) {
    return game.i18n.localize(key, data);
  }

  /**
   * Format a localization key with data
   * @param {string} key - Localization key
   * @param {object} data - Interpolation data
   * @returns {string} Formatted string
   */
  static format(key, data = {}) {
    return game.i18n.format(key, data);
  }

  /**
   * Capitalize first letter of a string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  static capitalize(str) {
    return String(str || "").charAt(0).toUpperCase() + String(str || "").slice(1);
  }

  /**
   * Convert string to uppercase
   * @param {string} str - String to convert
   * @returns {string} Uppercase string
   */
  static uppercase(str) {
    return String(str || "").toUpperCase();
  }

  /**
   * Check if two values are equal (for Handlebars eq helper)
   * @param {any} a - First value
   * @param {any} b - Second value
   * @returns {boolean} True if equal
   */
  static eq(a, b) {
    return a === b;
  }

  /**
   * Get modulo of two numbers (for alternating row helper)
   * @param {number} a - Dividend
   * @param {number} b - Divisor
   * @returns {number} Remainder
   */
  static mod(a, b) {
    return Number(a || 0) % Number(b || 1);
  }

  /**
   * Deep clone an object
   * @param {object} obj - Object to clone
   * @returns {object} Cloned object
   */
  static deepClone(obj) {
    return foundry.utils.deepClone(obj);
  }

  /**
   * Merge objects deeply
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} Merged object
   */
  static mergeObject(target, source) {
    return foundry.utils.mergeObject(target, source);
  }

  /**
   * Generate a random UUID
   * @returns {string} Random UUID
   */
  static uuid() {
    return crypto.randomUUID?.() ?? foundry.utils.randomID(16);
  }

  /**
   * Debounce a function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function} Debounced function
   */
  static debounce(func, wait) {
    return foundry.utils.debounce(func, wait);
  }

  /**
   * Throttle a function
   * @param {Function} func - Function to throttle
   * @param {number} wait - Wait time in ms
   * @returns {Function} Throttled function
   */
  static throttle(func, wait) {
    let timeout;
    let previous = 0;
    
    return function(...args) {
      const now = Date.now();
      const remaining = wait - (now - previous);
      
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        return func.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          previous = Date.now();
          timeout = null;
          return func.apply(this, args);
        }, remaining);
      }
    };
  }

  /**
   * Convert a value to a number, with fallback
   * @param {any} value - Value to convert
   * @param {number} fallback - Fallback value
   * @returns {number} Numeric value
   */
  static toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  /**
   * Convert a value to a boolean
   * @param {any} value - Value to convert
   * @returns {boolean} Boolean value
   */
  static toBoolean(value) {
    return !!value;
  }

  /**
   * Clamp a number between min and max
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  static clamp(value, min, max) {
    return Math.min(Math.max(Number(value || 0), Number(min || 0)), Number(max || Infinity));
  }

  /**
   * Check if a value is empty (null, undefined, empty string, empty array)
   * @param {any} value - Value to check
   * @returns {boolean} True if empty
   */
  static isEmpty(value) {
    if (value == null) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Get a nested property from an object safely
   * @param {object} obj - Object to search
   * @param {string} path - Dot notation path
   * @param {any} fallback - Fallback value
   * @returns {any} Property value or fallback
   */
  static getProperty(obj, path, fallback = undefined) {
    return foundry.utils.getProperty(obj, path) ?? fallback;
  }

  /**
   * Set a nested property on an object safely
   * @param {object} obj - Object to modify
   * @param {string} path - Dot notation path
   * @param {any} value - Value to set
   */
  static setProperty(obj, path, value) {
    return foundry.utils.setProperty(obj, path, value);
  }

  /**
   * Wait for a specified amount of time
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after the delay
   */
  static wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a dialog prompt for text input
   * @param {string} title - Dialog title
   * @param {string} label - Input label
   * @param {string} defaultValue - Default input value
   * @returns {Promise<string|null>} Entered text or null if cancelled
   */
  static async promptText(title, label = "Input:", defaultValue = "") {
    return new Promise(resolve => {
      new Dialog({
        title,
        content: `<div class="form-group"><label>${label}</label><input type="text" name="input" value="${defaultValue}" style="width:100%"></div>`,
        buttons: {
          ok: {
            label: "OK",
            callback: html => resolve(html.find('[name="input"]').val()?.trim() || null)
          },
          cancel: {
            label: "Cancel", 
            callback: () => resolve(null)
          }
        },
        default: "ok",
        close: () => resolve(null)
      }).render(true);
    });
  }

  /**
   * Show a notification message
   * @param {string} message - Message to show
   * @param {string} type - Notification type (info, warn, error)
   */
  static notify(message, type = "info") {
    ui.notifications?.[type]?.(message);
  }
}

export default Helpers;