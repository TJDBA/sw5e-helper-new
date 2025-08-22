/**
 * Advanced formula manipulation utilities
 * Handles dice formula building, parsing, and modification with comprehensive options
 */

import { getConfig } from '../../config.js';

export class FormulaBuilder {
  /**
   * Build a complete formula from parts with comprehensive options
   * @param {Array} parts - Array of formula parts or objects with formula property
   * @param {object} options - Building options
   * @returns {string} Complete formula string
   */
  static build(parts, options = {}) {
    const {
      isCrit = false,
      applyBrutal = 0,
      brutalFaces = 6,
      minDie = false,
      offhand = false,
      abilityMod = 0,
      extraTerms = []
    } = options;
    
    // Extract formulas from parts
    let formulas = parts.map(p => p.formula || p).filter(Boolean);
    
    // Apply critical hit modifications
    if (isCrit) {
      formulas = formulas.map(f => this.doubleDice(f));
      if (applyBrutal > 0) {
        formulas.push(`${applyBrutal}d${brutalFaces}`);
      }
    }
    
    // Apply minimum die values (Great Weapon Fighting, etc.)
    if (minDie) {
      formulas = formulas.map(f => this.applyMinimums(f));
    }
    
    // Add ability modifier (unless offhand with positive mod)
    if (!offhand && abilityMod) {
      formulas.push(this.signed(abilityMod));
    }
    
    // Add any extra terms
    if (extraTerms.length > 0) {
      formulas.push(...extraTerms.map(term => String(term)));
    }
    
    return formulas.filter(Boolean).join(" + ") || "0";
  }
  
  /**
   * Modify an existing formula with various transformations
   * @param {string} formula - Base formula to modify
   * @param {object} modifications - Modifications to apply
   * @returns {string} Modified formula
   */
  static modify(formula, modifications = {}) {
    let result = String(formula);
    
    if (modifications.doubleDice) {
      result = this.doubleDice(result);
    }
    
    if (modifications.addBonus) {
      result = `${result} + ${modifications.addBonus}`;
    }
    
    if (modifications.applyMin) {
      result = this.applyMinimums(result);
    }
    
    if (modifications.replaceVariables) {
      for (const [key, value] of Object.entries(modifications.replaceVariables)) {
        result = result.replace(new RegExp(key, 'g'), String(value));
      }
    }
    
    if (modifications.wrapInParens) {
      result = `(${result})`;
    }
    
    return result;
  }
  
  /**
   * Double all dice in a formula for critical hits
   * @param {string} formula - The original formula
   * @returns {string} Formula with doubled dice
   */
  static doubleDice(formula) {
    return String(formula).replace(/(\d+)d(\d+)/gi, (match, count, faces) => {
      const newCount = Math.max(1, Number(count)) * 2;
      return `${newCount}d${faces}`;
    });
  }
  
  /**
   * Apply minimum die values to a formula (Great Weapon Fighting style)
   * @param {string} formula - Formula to modify
   * @returns {string} Formula with minimum values applied
   */
  static applyMinimums(formula) {
    const minValues = getConfig("dice.minDieValues", {});
    return String(formula).replace(/(\d+)d(\d+)/gi, (match, count, faces) => {
      const min = minValues[faces];
      return min ? `${count}d${faces}min${min}` : match;
    });
  }
  
  /**
   * Extract only dice terms from a formula, removing modifiers
   * @param {string} formula - Formula to process
   * @returns {string} Dice-only formula
   */
  static extractDiceOnly(formula) {
    const matches = String(formula).match(/\d+d\d+/gi);
    return matches ? matches.join(" + ") : "0";
  }
  
  /**
   * Format a number with proper sign for formula concatenation
   * @param {number} value - Number to format
   * @returns {string} Signed number string
   */
  static signed(value) {
    const num = Number(value);
    return num >= 0 ? `+${num}` : `${num}`;
  }

  /**
   * Extract the first die faces value from a formula
   * @param {string} formula - The dice formula
   * @returns {number|null} The faces of the first die, or null if none found
   */
  static getFirstDieFaces(formula) {
    const match = String(formula || "").match(/(\d*)d(\d+)/i);
    return match ? Number(match[2]) : null;
  }

  /**
   * Check if a formula contains @mod token
   * @param {string} formula - The formula to check
   * @returns {boolean} True if formula uses @mod
   */
  static usesAtMod(formula) {
    return /@mod\b/i.test(String(formula));
  }

  /**
   * Combine multiple damage parts into a single formula
   * @param {Array} parts - Array of damage parts [formula, type] or objects
   * @returns {string} Combined formula
   */
  static combineFormulas(parts) {
    const formulas = parts
      .map(part => {
        if (Array.isArray(part)) return part[0];
        if (part?.formula) return part.formula;
        return part;
      })
      .filter(Boolean)
      .map(f => String(f));
    
    return formulas.length ? formulas.join(" + ") : "0";
  }

  /**
   * Parse a formula and extract individual terms with detailed analysis
   * @param {string} formula - The formula to parse
   * @returns {Array} Array of term objects with type classification
   */
  static parseTerms(formula) {
    const terms = [];
    const cleanFormula = String(formula || "").trim();
    
    if (!cleanFormula || cleanFormula === "0") {
      return [{ type: 'number', value: 0, raw: '0' }];
    }

    // Split on + and - while preserving the operators
    const parts = cleanFormula.split(/(\s*[+\-]\s*)/);
    let isNegative = false;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      
      if (part === '+') {
        isNegative = false;
        continue;
      } else if (part === '-') {
        isNegative = true;
        continue;
      }
      
      let multiplier = isNegative ? -1 : 1;
      
      if (part.match(/^\d*d\d+/i)) {
        // Dice term
        const match = part.match(/^(\d*)d(\d+)(.*)$/i);
        if (match) {
          const count = Number(match[1] || 1) * multiplier;
          const faces = Number(match[2]);
          const modifiers = match[3];
          
          terms.push({
            type: 'dice',
            count: Math.abs(count),
            faces,
            modifiers: modifiers || '',
            multiplier,
            value: `${Math.abs(count)}d${faces}${modifiers}`,
            raw: part
          });
        }
      } else if (part.match(/^\d+$/)) {
        // Number term
        const num = Number(part) * multiplier;
        terms.push({
          type: 'number',
          value: num,
          raw: part
        });
      } else if (part.match(/@\w+/)) {
        // Attribute reference
        terms.push({
          type: 'attribute',
          attribute: part,
          multiplier,
          value: part,
          raw: part
        });
      } else {
        // Unknown/complex term
        terms.push({
          type: 'complex',
          expression: part,
          multiplier,
          value: part,
          raw: part
        });
      }
      
      isNegative = false; // Reset for next term
    }
    
    return terms;
  }

  /**
   * Validate a dice formula with detailed error reporting
   * @param {string} formula - The formula to validate
   * @returns {object} Validation result with details
   */
  static validateFormula(formula) {
    const result = {
      valid: false,
      errors: [],
      warnings: []
    };

    try {
      const cleanFormula = String(formula || "").trim();
      
      if (!cleanFormula) {
        result.errors.push("Formula cannot be empty");
        return result;
      }

      // Try creating a roll to validate syntax
      new Roll(cleanFormula);
      
      // Additional validation checks
      const terms = this.parseTerms(cleanFormula);
      
      // Check for reasonable dice counts
      for (const term of terms) {
        if (term.type === 'dice') {
          if (term.count > 100) {
            result.warnings.push(`High dice count: ${term.count}d${term.faces}`);
          }
          if (term.faces < 2 || term.faces > 100) {
            result.warnings.push(`Unusual die faces: d${term.faces}`);
          }
        }
      }
      
      result.valid = true;
    } catch (error) {
      result.errors.push(`Invalid formula syntax: ${error.message}`);
    }

    return result;
  }

  /**
   * Simple validation for backwards compatibility
   * @param {string} formula - The formula to validate
   * @returns {boolean} True if the formula is valid
   */
  static isValidFormula(formula) {
    return this.validateFormula(formula).valid;
  }

  /**
   * Estimate average damage for a formula
   * @param {string} formula - Damage formula
   * @returns {number} Estimated average damage
   */
  static estimateAverage(formula) {
    const terms = this.parseTerms(formula);
    let average = 0;
    
    for (const term of terms) {
      switch (term.type) {
        case 'dice':
          // Average of a die is (faces + 1) / 2
          const dieAverage = (term.faces + 1) / 2;
          average += term.count * dieAverage * term.multiplier;
          break;
        case 'number':
          average += term.value;
          break;
        // Ignore attributes and complex terms for estimation
      }
    }
    
    return Math.max(0, Math.round(average * 10) / 10); // Round to 1 decimal
  }

  /**
   * Get all dice types used in a formula
   * @param {string} formula - Formula to analyze
   * @returns {Array} Array of die face values used
   */
  static getDiceTypes(formula) {
    const terms = this.parseTerms(formula);
    const diceTypes = new Set();
    
    for (const term of terms) {
      if (term.type === 'dice') {
        diceTypes.add(term.faces);
      }
    }
    
    return Array.from(diceTypes).sort((a, b) => a - b);
  }
}

// Legacy class alias for backwards compatibility
export class FormulaUtils {
  static doubleDice = FormulaBuilder.doubleDice;
  static getFirstDieFaces = FormulaBuilder.getFirstDieFaces;
  static usesAtMod = FormulaBuilder.usesAtMod;
  static combineFormulas = FormulaBuilder.combineFormulas;
  static parseTerms = FormulaBuilder.parseTerms;
  static isValidFormula = FormulaBuilder.isValidFormula;
}

export default FormulaBuilder;