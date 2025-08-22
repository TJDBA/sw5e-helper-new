/**
 * Universal dice roller for SW5E Helper
 * Handles all dice rolling operations with DSN integration
 */

export class DiceRoller {
  /**
   * Roll a formula with optional roll data
   * @param {string} formula - The dice formula to roll
   * @param {object} data - Roll data for evaluation
   * @param {object} options - Additional options
   * @returns {Promise<Roll>} The evaluated roll
   */
  static async roll(formula, data = {}, options = {}) {
    const roll = new Roll(formula, data);
    await roll.evaluate({ async: true });
    
    // Integrate with DSN if available and not disabled
    if (options.showDice !== false && game.dice3d) {
      try {
        await game.dice3d.showForRoll(roll, game.user, true);
      } catch (e) {
        console.warn("SW5E Helper: DSN animation failed", e);
      }
    }
    
    return roll;
  }

  /**
   * Roll multiple formulas in sequence
   * @param {string[]} formulas - Array of formulas to roll
   * @param {object} data - Roll data for evaluation
   * @param {object} options - Additional options
   * @returns {Promise<Roll[]>} Array of evaluated rolls
   */
  static async rollMultiple(formulas, data = {}, options = {}) {
    const rolls = [];
    
    for (const formula of formulas) {
      const roll = await this.roll(formula, data, options);
      rolls.push(roll);
    }
    
    return rolls;
  }

  /**
   * Create a roll without evaluating it
   * @param {string} formula - The dice formula
   * @param {object} data - Roll data
   * @returns {Roll} The unevaluated roll
   */
  static createRoll(formula, data = {}) {
    return new Roll(formula, data);
  }
}

export default DiceRoller;