/**
 * Target state freezing utilities
 * Captures rich target data including combat stats, saves, and conditions
 */

import { getConfig } from '../../config.js';

export class TargetFreezer {
  /**
   * Freeze current canvas targets into a rich state-safe format
   * @param {Array} tokens - Optional tokens array, defaults to current targets
   * @returns {Array} Array of frozen target objects
   */
  static freezeCurrentTargets(tokens = []) {
    const targets = tokens.length ? tokens : Array.from(game.user?.targets ?? []);
    
    return targets.map(token => this.freezeToken(token));
  }

  /**
   * Freeze multiple tokens
   * @param {Array} tokens - Array of tokens to freeze
   * @returns {Array} Array of frozen token data
   */
  static freeze(tokens = []) {
    return tokens.map(token => this.freezeToken(token));
  }
  
  /**
   * Freeze a single token with rich combat data
   * @param {Token} token - Token to freeze
   * @returns {object} Frozen token data
   */
  static freezeToken(token) {
    const actor = token.actor;
    const tokenDoc = token.document || token;
    
    return {
      // Identity
      sceneId: tokenDoc.parent?.id || canvas.scene?.id,
      tokenId: tokenDoc.id,
      actorId: actor?.id,
      
      // Display
      name: tokenDoc.name || actor?.name || "Unknown",
      img: tokenDoc.texture?.src || actor?.img || "icons/svg/mystery-man.svg",
      
      // Combat stats (frozen at time of attack)
      ac: actor?.system?.attributes?.ac?.value || 10,
      hp: {
        value: actor?.system?.attributes?.hp?.value || 0,
        max: actor?.system?.attributes?.hp?.max || 0,
        temp: actor?.system?.attributes?.hp?.temp || 0
      },
      
      // Saves
      saves: this.freezeSaves(actor),
      
      // Conditions
      conditions: this.freezeConditions(actor),
      
      // Legacy compatibility
      missing: false,
      
      // Metadata
      frozenAt: Date.now()
    };
  }
  
  /**
   * Freeze actor saving throws
   * @param {Actor} actor - Actor to freeze saves from
   * @returns {object} Frozen save data
   */
  static freezeSaves(actor) {
    if (!actor) return {};
    
    const saves = {};
    const abilities = getConfig("ABILITIES", ["str", "dex", "con", "int", "wis", "cha"]);
    
    for (const ability of abilities) {
      saves[ability] = {
        mod: actor.system?.abilities?.[ability]?.save || 0,
        prof: actor.system?.abilities?.[ability]?.saveProf || 0
      };
    }
    return saves;
  }
  
  /**
   * Freeze actor conditions and effects
   * @param {Actor} actor - Actor to freeze conditions from
   * @returns {Array} Array of condition data
   */
  static freezeConditions(actor) {
    if (!actor) return [];
    
    const conditions = [];
    for (const effect of actor.effects) {
      if (effect.isTemporary) {
        conditions.push({
          id: effect.id,
          label: effect.label,
          icon: effect.icon
        });
      }
    }
    return conditions;
  }
  
  /**
   * Thaw frozen token data back to live objects
   * @param {object} frozenToken - Frozen token data
   * @returns {object} Thawed token data with live references
   */
  static thaw(frozenToken) {
    const scene = game.scenes.get(frozenToken.sceneId);
    const token = scene?.tokens.get(frozenToken.tokenId);
    const actor = token?.actor || game.actors.get(frozenToken.actorId);
    
    return {
      token,
      actor,
      exists: !!(token && actor),
      missing: !(token && actor),
      frozen: frozenToken
    };
  }

  /**
   * Get the appropriate image for a token
   * @param {Token} token - The token object
   * @returns {string} Image path
   */
  static getTokenImage(token) {
    return token.document?.texture?.src ?? 
           token.document?.img ?? 
           token.actor?.img ?? 
           "icons/svg/mystery-man.svg";
  }

  /**
   * Check if targets have changed since freezing
   * @param {Array} frozenTargets - Previously frozen targets
   * @returns {boolean} True if targets have changed
   */
  static haveTargetsChanged(frozenTargets) {
    const currentTargets = this.freezeCurrentTargets();
    
    if (currentTargets.length !== frozenTargets.length) {
      return true;
    }
    
    for (let i = 0; i < currentTargets.length; i++) {
      const current = currentTargets[i];
      const frozen = frozenTargets[i];
      
      if (current.sceneId !== frozen.sceneId || 
          current.tokenId !== frozen.tokenId) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Update target missing status based on current scene state
   * @param {Array} targets - Target array to update
   */
  static updateMissingStatus(targets) {
    for (const target of targets) {
      const scene = game.scenes?.get(target.sceneId);
      const token = scene?.tokens?.get(target.tokenId);
      
      target.missing = !token;
    }
  }

  /**
   * Create target references for engine calls
   * @param {Array} targets - Target objects
   * @returns {Array} Array of target reference strings
   */
  static createTargetRefs(targets) {
    return targets.map(t => `${t.sceneId}:${t.tokenId}`);
  }

  /**
   * Parse a target reference string
   * @param {string} ref - Reference string in format "sceneId:tokenId"
   * @returns {object} Parsed reference
   */
  static parseTargetRef(ref) {
    const [sceneId, tokenId] = String(ref).split(":");
    return { sceneId, tokenId };
  }

  /**
   * Find target by reference
   * @param {Array} targets - Target array
   * @param {string} ref - Target reference
   * @returns {object|null} Found target or null
   */
  static findTargetByRef(targets, ref) {
    const { sceneId, tokenId } = this.parseTargetRef(ref);
    
    return targets.find(t => 
      t.sceneId === sceneId && t.tokenId === tokenId
    ) ?? null;
  }

  /**
   * Resolve scene and token objects from reference
   * @param {string} ref - Target reference
   * @returns {object} Scene and token objects
   */
  static resolveSceneAndToken(ref) {
    const { sceneId, tokenId } = this.parseTargetRef(ref);
    const scene = game.scenes?.get(sceneId) ?? canvas?.scene;
    const token = scene?.tokens?.get(tokenId);
    
    return { scene, token };
  }
}

export default TargetFreezer;