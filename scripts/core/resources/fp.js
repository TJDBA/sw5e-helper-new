/**
 * Force Points helpers.
 * @module core/resources/fp
 */

/**
 * Compute FP cost based on power level and casting options.
 * @param {number} level
 * @param {object} opts
 * @returns {number}
 */
export function computeFpCost(level, opts = {}) {
  // baseline: 1 per level, with simple modifiers
  const base = Number(level) || 0;
  const distant = opts.distant ? 1 : 0;
  const quick = opts.quick ? 1 : 0;
  return Math.max(0, base + distant + quick);
}

/**
 * Check if actor can spend FP.
 * @param {Actor} actor
 * @param {number} amount
 * @returns {boolean}
 */
export function canSpend(actor, amount) {
  const cur = Number(actor?.system?.resources?.fp?.value ?? 0);
  return cur >= Number(amount || 0);
}

/**
 * Spend FP on actor. Returns new value.
 * @param {Actor} actor
 * @param {number} amount
 * @returns {Promise<number>}
 */
export async function spend(actor, amount) {
  const cur = Number(actor?.system?.resources?.fp?.value ?? 0);
  const val = Math.max(0, cur - Number(amount || 0));
  await actor?.update?.({ "system.resources.fp.value": val });
  return val;
}

/**
 * Get current FP value for an actor
 * @param {Actor} actor
 * @returns {number} Current FP value
 */
export function getCurrentFP(actor) {
  return Number(actor?.system?.resources?.fp?.value ?? 0);
}

/**
 * Get maximum FP value for an actor
 * @param {Actor} actor
 * @returns {number} Maximum FP value
 */
export function getMaxFP(actor) {
  return Number(actor?.system?.resources?.fp?.max ?? 0);
}

/**
 * Restore FP to an actor
 * @param {Actor} actor
 * @param {number} amount - Amount to restore
 * @returns {Promise<number>} New FP value
 */
export async function restore(actor, amount) {
  const cur = getCurrentFP(actor);
  const max = getMaxFP(actor);
  const val = Math.min(max, cur + Number(amount || 0));
  await actor?.update?.({ "system.resources.fp.value": val });
  return val;
}

/**
 * Set FP to specific value
 * @param {Actor} actor
 * @param {number} value - New FP value
 * @returns {Promise<number>} Set FP value
 */
export async function setFP(actor, value) {
  const max = getMaxFP(actor);
  const val = Math.max(0, Math.min(max, Number(value || 0)));
  await actor?.update?.({ "system.resources.fp.value": val });
  return val;
}

/**
 * Get FP information for display
 * @param {Actor} actor
 * @returns {object} FP status information
 */
export function getFPStatus(actor) {
  const current = getCurrentFP(actor);
  const max = getMaxFP(actor);
  
  return {
    current,
    max,
    percentage: max > 0 ? Math.round((current / max) * 100) : 0,
    canSpendAny: current > 0,
    isEmpty: current === 0,
    isFull: current >= max
  };
}

/**
 * Calculate Force power save DC
 * @param {Actor} actor - Force user
 * @param {string} ability - Ability used for Force powers (default: 'wis')
 * @returns {number} Save DC
 */
export function getForceSaveDC(actor, ability = 'wis') {
  const abilityMod = actor?.system?.abilities?.[ability]?.mod ?? 0;
  const profBonus = actor?.system?.attributes?.prof ?? 0;
  return 8 + profBonus + abilityMod;
}

/**
 * Get Force power attack bonus
 * @param {Actor} actor - Force user
 * @param {string} ability - Ability used for Force powers (default: 'wis')
 * @returns {number} Attack bonus
 */
export function getForceAttackBonus(actor, ability = 'wis') {
  const abilityMod = actor?.system?.abilities?.[ability]?.mod ?? 0;
  const profBonus = actor?.system?.attributes?.prof ?? 0;
  return profBonus + abilityMod;
}

export default {
  computeFpCost,
  canSpend,
  spend,
  getCurrentFP,
  getMaxFP,
  restore,
  setFP,
  getFPStatus,
  getForceSaveDC,
  getForceAttackBonus
};