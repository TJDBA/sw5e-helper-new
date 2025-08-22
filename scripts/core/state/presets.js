/**
 * Preset persistence and state sanitizers.
 * @module core/state/presets
 */

const MOD = "sw5e-helper";
const LS  = `${MOD}:lastUsed`;

/**
 * Sanitize attack state for persistence in flags or local storage.
 * @param {object} state
 */
export function sanitizeAttackState(state = {}) {
  const s = { ...state };
  delete s.rolls;
  delete s.messageId;
  delete s._internal;
  return s;
}

/**
 * Sanitize damage state for persistence.
 * @param {object} state
 */
export function sanitizeDamageState(state = {}) {
  const s = { ...state };
  delete s.rolls;
  delete s.messageId;
  delete s._internal;
  return s;
}

export function setLastUsed(actorId, kind, state) {
  const key = `${LS}:${actorId}:${kind}`;
  const value = JSON.stringify(kind === "attack" ? sanitizeAttackState(state) : sanitizeDamageState(state));
  try { localStorage.setItem(key, value); } catch { /* no-op */ }
}

export function getLastUsed(actorId, kind) {
  const key = `${LS}:${actorId}:${kind}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function savePreset(name, payload) {
  const key = `${MOD}:preset:${name}`;
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch {}
}

export function deletePreset(name) {
  const key = `${MOD}:preset:${name}`;
  try { localStorage.removeItem(key); } catch {}
}

/**
 * Get all saved presets
 * @returns {Array<object>} Array of preset objects with name and data
 */
export function getAllPresets() {
  const presets = [];
  const prefix = `${MOD}:preset:`;
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const name = key.substring(prefix.length);
        const data = JSON.parse(localStorage.getItem(key));
        presets.push({ name, data });
      }
    }
  } catch {
    // Ignore errors
  }
  
  return presets.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a specific preset by name
 * @param {string} name - Preset name
 * @returns {object|null} Preset data or null if not found
 */
export function getPreset(name) {
  const key = `${MOD}:preset:${name}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Check if a preset exists
 * @param {string} name - Preset name
 * @returns {boolean} True if preset exists
 */
export function presetExists(name) {
  const key = `${MOD}:preset:${name}`;
  return localStorage.getItem(key) !== null;
}

/**
 * Clear all presets
 * @returns {number} Number of presets deleted
 */
export function clearAllPresets() {
  const prefix = `${MOD}:preset:`;
  const keysToDelete = [];
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => localStorage.removeItem(key));
    return keysToDelete.length;
  } catch {
    return 0;
  }
}

/**
 * Clear last used settings for an actor
 * @param {string} actorId - Actor ID
 * @returns {number} Number of settings cleared
 */
export function clearLastUsedForActor(actorId) {
  const prefix = `${LS}:${actorId}:`;
  const keysToDelete = [];
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => localStorage.removeItem(key));
    return keysToDelete.length;
  } catch {
    return 0;
  }
}

/**
 * Export all presets as JSON string
 * @returns {string} JSON string of all presets
 */
export function exportPresets() {
  const presets = getAllPresets();
  return JSON.stringify(presets, null, 2);
}

/**
 * Import presets from JSON string
 * @param {string} jsonString - JSON string of presets to import
 * @param {boolean} overwrite - Whether to overwrite existing presets
 * @returns {object} Import result with counts
 */
export function importPresets(jsonString, overwrite = false) {
  const result = {
    imported: 0,
    skipped: 0,
    errors: 0
  };
  
  try {
    const presets = JSON.parse(jsonString);
    if (!Array.isArray(presets)) {
      throw new Error("Invalid preset format: expected array");
    }
    
    for (const preset of presets) {
      if (!preset.name || !preset.data) {
        result.errors++;
        continue;
      }
      
      if (!overwrite && presetExists(preset.name)) {
        result.skipped++;
        continue;
      }
      
      savePreset(preset.name, preset.data);
      result.imported++;
    }
  } catch {
    result.errors++;
  }
  
  return result;
}

export default {
  sanitizeAttackState,
  sanitizeDamageState,
  setLastUsed,
  getLastUsed,
  savePreset,
  deletePreset,
  getAllPresets,
  getPreset,
  presetExists,
  clearAllPresets,
  clearLastUsedForActor,
  exportPresets,
  importPresets
};