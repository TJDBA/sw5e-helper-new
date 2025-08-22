/**
 * Formula and result caching utilities
 * Improves performance by caching expensive operations
 */

export class Cache {
  constructor() {
    this.storage = new Map();
    this.timestamps = new Map();
    this.maxAge = 5 * 60 * 1000; // 5 minutes default
    this.maxSize = 1000;
  }

  /**
   * Get a cached value
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    if (!this.storage.has(key)) {
      return null;
    }

    const timestamp = this.timestamps.get(key);
    const now = Date.now();

    // Check if expired
    if (timestamp && (now - timestamp) > this.maxAge) {
      this.delete(key);
      return null;
    }

    return this.storage.get(key);
  }

  /**
   * Set a cached value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} maxAge - Custom max age in ms (optional)
   */
  set(key, value, maxAge = null) {
    // Ensure cache size limit
    if (this.storage.size >= this.maxSize) {
      this.cleanup();
    }

    this.storage.set(key, value);
    this.timestamps.set(key, Date.now());

    // Set custom expiration if provided
    if (maxAge) {
      setTimeout(() => this.delete(key), maxAge);
    }
  }

  /**
   * Delete a cached value
   * @param {string} key - Cache key
   */
  delete(key) {
    this.storage.delete(key);
    this.timestamps.delete(key);
  }

  /**
   * Check if a key exists in cache (and is not expired)
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is valid
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Clear all cached values
   */
  clear() {
    this.storage.clear();
    this.timestamps.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, timestamp] of this.timestamps.entries()) {
      if ((now - timestamp) > this.maxAge) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }

    // If still over size limit, remove oldest entries
    if (this.storage.size >= this.maxSize) {
      const sortedEntries = Array.from(this.timestamps.entries())
        .sort(([,a], [,b]) => a - b);
      
      const toRemove = sortedEntries.slice(0, Math.floor(this.maxSize * 0.2));
      for (const [key] of toRemove) {
        this.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      size: this.storage.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge,
      oldestEntry: Math.min(...this.timestamps.values()),
      newestEntry: Math.max(...this.timestamps.values())
    };
  }
}

/**
 * Global caches for different data types
 */
export class GlobalCache {
  static formulaCache = new Cache();
  static rollCache = new Cache();
  static actorCache = new Cache();

  /**
   * Cache a formula evaluation result
   * @param {string} formula - Formula string
   * @param {object} data - Roll data
   * @param {any} result - Evaluation result
   */
  static cacheFormula(formula, data, result) {
    const key = `${formula}:${JSON.stringify(data)}`;
    this.formulaCache.set(key, result);
  }

  /**
   * Get cached formula result
   * @param {string} formula - Formula string
   * @param {object} data - Roll data
   * @returns {any|null} Cached result or null
   */
  static getFormulaCache(formula, data) {
    const key = `${formula}:${JSON.stringify(data)}`;
    return this.formulaCache.get(key);
  }

  /**
   * Cache a roll result
   * @param {string} rollKey - Roll identifier
   * @param {Roll} roll - Roll object
   */
  static cacheRoll(rollKey, roll) {
    this.rollCache.set(rollKey, {
      total: roll.total,
      formula: roll.formula,
      terms: roll.terms
    });
  }

  /**
   * Get cached roll
   * @param {string} rollKey - Roll identifier
   * @returns {object|null} Cached roll data or null
   */
  static getRollCache(rollKey) {
    return this.rollCache.get(rollKey);
  }

  /**
   * Cache actor data
   * @param {string} actorId - Actor ID
   * @param {object} data - Actor data to cache
   */
  static cacheActor(actorId, data) {
    this.actorCache.set(actorId, data);
  }

  /**
   * Get cached actor data
   * @param {string} actorId - Actor ID
   * @returns {object|null} Cached actor data or null
   */
  static getActorCache(actorId) {
    return this.actorCache.get(actorId);
  }

  /**
   * Clear all global caches
   */
  static clearAll() {
    this.formulaCache.clear();
    this.rollCache.clear();
    this.actorCache.clear();
  }

  /**
   * Clean up all global caches
   */
  static cleanupAll() {
    this.formulaCache.cleanup();
    this.rollCache.cleanup();
    this.actorCache.cleanup();
  }

  /**
   * Get statistics for all caches
   * @returns {object} Combined cache statistics
   */
  static getAllStats() {
    return {
      formula: this.formulaCache.getStats(),
      roll: this.rollCache.getStats(),
      actor: this.actorCache.getStats()
    };
  }
}

// Clean up caches periodically
setInterval(() => {
  GlobalCache.cleanupAll();
}, 5 * 60 * 1000); // Every 5 minutes

export default { Cache, GlobalCache };