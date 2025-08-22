/**
 * Item utilities extracted from 0.2.0 adapter.
 * Focus: weapons list, save DC parsing, attack bonus helpers, SMART defaults.
 * @module core/actors/items
 */

/**
 * Check if an item is equipped.
 * Accepts boolean, string "true", or {value:true}.
 * @param {Item} item
 * @returns {boolean}
 */
export function isEquipped(item) {
  const sys = item?.system ?? {};
  const eq = sys.equipped;
  return !!(eq === true || eq === "true" || (typeof eq === "object" && eq?.value === true));
}

/**
 * List equipped weapon items for an actor.
 * @param {Actor} actor
 * @returns {Array<Item>}
 */
export function listEquippedWeapons(actor) {
  const items = actor?.items ?? new Map();
  const arr = Array.from(items.values?.() ?? items);
  return arr.filter(it => (it?.type === "weapon") && isEquipped(it));
}

/**
 * Get a weapon by id from an actor.
 * @param {Actor} actor
 * @param {string} id
 * @returns {Item|null}
 */
export function getWeaponById(actor, id) {
  if (!actor || !id) return null;
  return actor.items?.get?.(id) ?? null;
}

/**
 * Compute an item's attack bonus from system fields.
 * Returns a signed string like +7 or -1 and the numeric value.
 * @param {Item} item
 * @param {object} ctx - { abilityMod:number, prof:number }
 */
export function getItemAttackBonus(item, { abilityMod = 0, prof = 0 } = {}) {
  const sys = item?.system ?? {};
  // some items store flat bonus under system.attackBonus or .bonuses?.atk
  const flat = Number(sys.attackBonus ?? sys.bonuses?.atk ?? 0) || 0;
  const useProf = !!(sys.proficient ?? true);
  const total = abilityMod + (useProf ? prof : 0) + flat;
  const signed = `${total >= 0 ? "+" : ""}${total}`;
  return { total, signed };
}

/**
 * Read save data from an item. Supports legacy fields.
 * @param {Item} item
 * @returns {{ability:string, dc:number}|null}
 */
export function getSaveForItem(item) {
  const sys = item?.system ?? {};
  const ability = sys.save?.ability ?? sys.saveAbility ?? null;
  const dcRaw   = sys.save?.dc ?? sys.saveDC;
  const dc      = Number(dcRaw ?? NaN);
  if (!ability || !Number.isFinite(dc)) return null;
  return { ability, dc };
}

/**
 * Parse SMART defaults from item description if flagged.
 * Expected pattern: SMART (17/+3)
 * @param {Item} item
 * @returns {{dc?:number, atk?:number}} extracted defaults
 */
export function parseSmartDefaults(item) {
  const isSmart = !!item?.system?.properties?.smr;
  if (!isSmart) return {};
  const html = String(item?.system?.description?.value ?? item?.system?.description ?? "");
  const m = html.match(/SMART\s*\(\s*(?<dc>-?\d+)\s*\/\s*(?<atk>-?\d+)\s*\)/i);
  if (!m?.groups) return {};
  const dc = Number(m.groups.dc ?? NaN);
  const atk = Number(m.groups.atk ?? NaN);
  const out = {};
  if (Number.isFinite(dc)) out.dc = dc;
  if (Number.isFinite(atk)) out.atk = atk;
  return out;
}

/**
 * Normalize an actor to a compact structure.
 * @param {Actor} actor
 * @returns {{actor:Actor, abilities:object, prof:number}}
 */
export function normalizeActor(actor) {
  return {
    actor,
    abilities: actor?.system?.abilities ?? {},
    prof: actor?.system?.attributes?.prof ?? 0
  };
}

/**
 * Get all items of a specific type from an actor
 * @param {Actor} actor - The actor
 * @param {string} type - Item type to filter for
 * @returns {Array<Item>} Array of items
 */
export function getItemsByType(actor, type) {
  const items = actor?.items ?? new Map();
  const arr = Array.from(items.values?.() ?? items);
  return arr.filter(it => it?.type === type);
}

/**
 * Check if an item has a specific property
 * @param {Item} item - The item to check
 * @param {string} property - Property to check for
 * @returns {boolean} True if item has the property
 */
export function hasProperty(item, property) {
  const props = item?.system?.properties ?? {};
  return !!(props[property] || props[property.substring(0, 3)]);
}

/**
 * Get an item's damage formula
 * @param {Item} item - The item
 * @returns {string} Damage formula or empty string
 */
export function getDamageFormula(item) {
  const damage = item?.system?.damage;
  if (!damage) return "";
  
  // Handle different damage structure formats
  if (typeof damage === "string") return damage;
  if (damage.formula) return damage.formula;
  if (damage.parts && Array.isArray(damage.parts)) {
    return damage.parts.map(part => Array.isArray(part) ? part[0] : part).join(" + ");
  }
  
  return "";
}

/**
 * Get an item's range information
 * @param {Item} item - The item
 * @returns {object} Range information {short, long, units}
 */
export function getItemRange(item) {
  const range = item?.system?.range ?? {};
  return {
    short: Number(range.value ?? 0),
    long: Number(range.long ?? 0),
    units: range.units ?? "ft"
  };
}

export default {
  isEquipped,
  listEquippedWeapons,
  getWeaponById,
  getItemAttackBonus,
  getSaveForItem,
  parseSmartDefaults,
  normalizeActor,
  getItemsByType,
  hasProperty,
  getDamageFormula,
  getItemRange
};