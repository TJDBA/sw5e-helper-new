/**
 * Critical hit helpers.
 * @module core/dice/crit
 */

/**
 * Get the kept d20 result considering advantage/disadvantage.
 * @param {Roll} roll
 * @returns {number|null} natural die result or null
 */
export function keptNatD20(roll) {
  const d20s = (roll?.terms ?? []).flatMap(t => (t?.faces === 20 ? t?.results ?? [] : []));
  if (!d20s.length) return null;
  // prefer kept results
  const kept = d20s.filter(r => r?.active !== false);
  const list = kept.length ? kept : d20s;
  // when multiple kept, assume the last is meaningful
  const v = list[list.length - 1]?.result;
  return Number.isFinite(v) ? v : null;
}

/**
 * Apply critical logic to dice only, not static modifiers.
 * Example: 1d8+4 -> 2d8+4
 * @param {string} diceFormula
 * @returns {string}
 */
export function applyCritToDiceOnly(diceFormula) {
  return String(diceFormula).replace(/(\d+)d(\d+)/gi, (m, n, f) => `${Number(n) * 2}d${f}`);
}

/**
 * Add brutal dice after crit. E.g., brutal 2 on 1d8 -> 2d8 + 2d8(lowest dropped).
 * Implemented as "+ XdYdlX".
 * @param {string} diceFormula base dice part, e.g., "1d8 + 1d6"
 * @param {number} brutal count of brutal dice of the same first die
 * @returns {string}
 */
export function addBrutalDiceAfterCrit(diceFormula, brutal = 0) {
  if (!brutal) return diceFormula;
  const m = String(diceFormula).match(/(\d+)d(\d+)/i);
  if (!m) return diceFormula;
  const faces = Number(m[2]);
  return `${diceFormula} + ${brutal}d${faces}dl${brutal}`;
}

/**
 * Get crit threshold for an item. Defaults to 20. Honors keen/expanded crit if marked.
 * @param {Item} item
 * @returns {number}
 */
export function getCritThreshold(item) {
  const sys = item?.system ?? {};
  const keen = sys?.properties?.keen ?? sys?.properties?.ken ?? false;
  return keen ? 19 : 20;
}

/**
 * Check if a d20 roll is a critical hit
 * @param {number} natural - Natural d20 result
 * @param {Item} item - Weapon item (for keen property)
 * @returns {boolean} True if critical hit
 */
export function isCriticalHit(natural, item = null) {
  const threshold = getCritThreshold(item);
  return Number(natural) >= threshold;
}

/**
 * Check if a d20 roll is a fumble (natural 1)
 * @param {number} natural - Natural d20 result
 * @returns {boolean} True if fumble
 */
export function isFumble(natural) {
  return Number(natural) === 1;
}

/**
 * Apply brutal weapon property to damage formula
 * @param {string} formula - Base damage formula
 * @param {number} brutalCount - Number of brutal dice
 * @param {string} brutalDie - Die type for brutal (e.g., "d6", "d8")
 * @returns {string} Enhanced formula with brutal dice
 */
export function applyBrutalWeapon(formula, brutalCount = 0, brutalDie = "d6") {
  if (!brutalCount) return formula;
  
  // Ensure die type has 'd' prefix
  const dieType = brutalDie.startsWith('d') ? brutalDie : `d${brutalDie}`;
  
  return `${formula} + ${brutalCount}${dieType}`;
}

/**
 * Get maximum damage for a formula (all dice roll max)
 * @param {string} formula - Damage formula
 * @returns {number} Maximum possible damage
 */
export function getMaxDamage(formula) {
  let maxDamage = 0;
  
  // Replace dice with their maximum values
  const maxFormula = String(formula).replace(/(\d+)d(\d+)/gi, (match, count, faces) => {
    const diceMax = Number(count) * Number(faces);
    maxDamage += diceMax;
    return String(diceMax);
  });
  
  try {
    // Evaluate the formula with max dice values
    const roll = new Roll(maxFormula);
    roll.evaluate({ async: false });
    return roll.total;
  } catch {
    return maxDamage;
  }
}

/**
 * Double damage dice for critical hits
 * @param {string} formula - Original damage formula
 * @param {object} options - Options for doubling
 * @returns {string} Formula with doubled dice
 */
export function doubleDamageOnCrit(formula, options = {}) {
  const { 
    doubleAll = true,  // Double all dice vs just weapon dice
    maxNormalDice = false  // Use max damage for normal dice instead of doubling
  } = options;
  
  if (maxNormalDice) {
    // Replace first set of dice with maximum values, then add same dice again
    return String(formula).replace(/(\d+)d(\d+)/gi, (match, count, faces) => {
      const maxValue = Number(count) * Number(faces);
      return `${maxValue} + ${match}`;
    });
  }
  
  // Standard doubling approach
  return applyCritToDiceOnly(formula);
}

export default {
  keptNatD20,
  applyCritToDiceOnly,
  addBrutalDiceAfterCrit,
  getCritThreshold,
  isCriticalHit,
  isFumble,
  applyBrutalWeapon,
  getMaxDamage,
  doubleDamageOnCrit
};