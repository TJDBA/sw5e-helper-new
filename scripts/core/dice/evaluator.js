/**
 * Generic D20 check evaluator
 * Handles all types of d20 checks uniformly with configurable options
 */

// Import configuration constants
import { getConfig } from '../../config.js';

export class CheckEvaluator {
  /**
   * Evaluate a generic d20 check
   * @param {Roll} roll - The d20 roll
   * @param {number} dc - Difficulty class or target number
   * @param {object} options - Evaluation options
   * @returns {object} Comprehensive check result
   */
  static evaluate(roll, dc, options = {}) {
    const {
      checkType = "ability",
      critThreshold = getConfig("dice.critThreshold", 20),
      fumbleThreshold = getConfig("dice.fumbleThreshold", 1),
      autoSuccessOn = 20,
      autoFailOn = 1
    } = options;
    
    // Extract the kept d20 value
    const d20Result = this.getKeptD20(roll);
    if (d20Result === null) {
      throw new Error("No d20 found in roll");
    }
    
    const total = roll.total;
    
    // Determine outcome
    let success = false;
    let critical = false;
    let fumble = false;
    let status = "";
    
    // Natural 20/1 handling
    if (d20Result === autoFailOn) {
      success = false;
      fumble = true;
      status = this.getStatusLabel(checkType, "fumble");
    } else if (d20Result === autoSuccessOn) {
      success = true;
      critical = true;
      status = this.getStatusLabel(checkType, "critical");
    } else if (dc !== null && dc !== undefined) {
      success = total >= dc;
      
      // Check for critical success/failure based on threshold
      if (checkType === "attack" && success && d20Result >= critThreshold) {
        critical = true;
        status = this.getStatusLabel(checkType, "critical");
      } else {
        status = this.getStatusLabel(checkType, success ? "success" : "failure");
      }
    }
    
    return {
      checkType,
      success,
      critical,
      fumble,
      total,
      natural: d20Result,
      dc,
      margin: dc ? total - dc : null,
      status,
      details: this.getDetails(roll)
    };
  }

  /**
   * Evaluate an attack roll result
   * @param {Roll} roll - The attack roll
   * @param {number} ac - Target AC
   * @returns {object} Attack result with status
   */
  static evaluateAttack(roll, ac) {
    const result = this.evaluate(roll, ac, { checkType: "attack" });
    
    // Convert to legacy format for backwards compatibility
    return {
      total: result.total,
      d20Result: result.natural,
      status: this.convertAttackStatus(result.status),
      roll: roll,
      ...result // Include all new data
    };
  }

  /**
   * Evaluate a saving throw result
   * @param {Roll} roll - The save roll
   * @param {number} dc - Save DC
   * @returns {object} Save result with outcome
   */
  static evaluateSave(roll, dc) {
    const result = this.evaluate(roll, dc, { checkType: "save" });
    
    // Convert to legacy format for backwards compatibility
    return {
      total: result.total,
      d20Result: result.natural,
      outcome: this.convertSaveOutcome(result.status),
      roll: roll,
      ...result // Include all new data
    };
  }

  /**
   * Extract the kept d20 result from a roll
   * @param {Roll} roll - The roll to examine
   * @returns {number|null} The kept d20 result
   */
  static getKeptD20(roll) {
    const d20 = roll.dice?.find(d => d.faces === 20);
    if (!d20) return null;
    
    // Find the kept result (not discarded)
    const kept = d20.results?.find(r => !r.discarded);
    return kept?.result ?? d20.results?.[0]?.result ?? null;
  }

  /**
   * Get detailed information about the roll
   * @param {Roll} roll - The roll to analyze
   * @returns {string} Formatted roll details
   */
  static getDetails(roll) {
    const d20 = roll.dice?.find(d => d.faces === 20);
    if (!d20) return "";
    
    const allRolls = d20.results?.map(r => r.result) || [];
    const kept = this.getKeptD20(roll);
    
    if (allRolls.length <= 1) {
      return `d20: ${kept}`;
    }
    return `d20: ${kept} (rolled ${allRolls.join(", ")})`;
  }

  /**
   * Get status label for check type and outcome
   * @param {string} checkType - Type of check
   * @param {string} outcome - Check outcome
   * @returns {string} Status label
   */
  static getStatusLabel(checkType, outcome) {
    const labels = {
      attack: {
        critical: "Critical Hit",
        success: "Hit", 
        failure: "Miss",
        fumble: "Critical Miss"
      },
      save: {
        critical: "Critical Success",
        success: "Success",
        failure: "Failure", 
        fumble: "Critical Failure"
      },
      skill: {
        critical: "Critical Success",
        success: "Success",
        failure: "Failure",
        fumble: "Critical Failure"
      },
      ability: {
        critical: "Critical Success", 
        success: "Success",
        failure: "Failure",
        fumble: "Critical Failure"
      },
      initiative: {
        critical: "Critical Initiative",
        success: "High Initiative",
        failure: "Low Initiative", 
        fumble: "Critical Fumble"
      },
      default: {
        critical: "Critical",
        success: "Success",
        failure: "Failure",
        fumble: "Fumble"
      }
    };
    
    return labels[checkType]?.[outcome] || labels.default[outcome];
  }

  /**
   * Convert new status format to legacy attack status
   * @param {string} status - New status format
   * @returns {string} Legacy attack status
   */
  static convertAttackStatus(status) {
    const map = {
      "Critical Hit": "crit",
      "Hit": "hit",
      "Miss": "miss", 
      "Critical Miss": "fumble"
    };
    return map[status] || "miss";
  }

  /**
   * Convert new status format to legacy save outcome
   * @param {string} status - New status format
   * @returns {string} Legacy save outcome
   */
  static convertSaveOutcome(status) {
    const map = {
      "Critical Success": "critical",
      "Success": "success",
      "Failure": "fail",
      "Critical Failure": "fumble"
    };
    return map[status] || "fail";
  }

  /**
   * Check if a roll has advantage/disadvantage
   * @param {Roll} roll - The roll to check
   * @returns {string} "advantage", "disadvantage", or "normal"
   */
  static getAdvantageState(roll) {
    try {
      const d20Terms = roll.terms?.filter(term => 
        term.faces === 20 && Array.isArray(term.results)
      ) ?? [];
      
      if (d20Terms.length > 1) {
        const results = d20Terms.flatMap(term => term.results?.map(r => r.result) ?? []);
        if (results.length >= 2) {
          const [first, second] = results;
          if (first > second) return "advantage";
          if (second > first) return "disadvantage";
        }
      }
      
      return "normal";
    } catch {
      return "normal";
    }
  }

  /**
   * Get the kept die result from an advantage/disadvantage roll
   * @param {Roll} roll - The roll to examine
   * @returns {number|null} The kept die result
   */
  static getKeptDie(roll) {
    return this.getKeptD20(roll);
  }

  // Legacy alias for backwards compatibility
  static getFirstD20Result(roll) {
    return this.getKeptD20(roll);
  }
}

// Export with legacy name alias for backwards compatibility
export const D20Evaluator = CheckEvaluator;

export default D20Evaluator;