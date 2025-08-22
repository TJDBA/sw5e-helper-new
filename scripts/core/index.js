/**
 * Core module exports
 * All core functionality exports
 */

export * from './dice/index.js';
export * from './state/index.js';
export * from './actors/index.js';
export * from './utils/index.js';

import dice from './dice/index.js';
import state from './state/index.js';
import actors from './actors/index.js';
import utils from './utils/index.js';

export default {
  dice,
  state,
  actors,
  utils
};