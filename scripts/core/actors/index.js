/**
 * Actors module exports
 */

import * as Items from './items.js';
import { ActorResolver, TokenResolver } from './resolver.js';
import { PermissionChecker } from './permissions.js';
import { DamageApplicator } from './damage.js';

export { ActorResolver, TokenResolver, resolveTokenRef } from './resolver.js';
export { PermissionChecker } from './permissions.js';
export { DamageApplicator, applyDamageToToken } from './damage.js';
export { Items };

export default {
  ActorResolver,
  TokenResolver,
  PermissionChecker,
  DamageApplicator,
  Items
};