/**
 * Dice module exports
 */

import * as Crit from './crit.js';
import { DiceRoller } from './roller.js';
import { FormulaBuilder, FormulaUtils } from './formula.js';
import { CheckEvaluator, D20Evaluator } from './evaluator.js';

export { DiceRoller } from './roller.js';
export { FormulaBuilder, FormulaUtils } from './formula.js';
export { CheckEvaluator, D20Evaluator } from './evaluator.js';
export { Crit };

export default {
  DiceRoller,
  FormulaBuilder,
  FormulaUtils,
  CheckEvaluator,
  D20Evaluator,
  Crit
};