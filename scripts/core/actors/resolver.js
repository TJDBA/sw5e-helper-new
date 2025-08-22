/**
 * Token and Actor resolution utilities
 * Handles finding and resolving game objects
 */

export class ActorResolver {
  /**
   * Get actor from various sources
   * @param {object} options - Resolution options
   * @returns {Actor|null} The resolved actor
   */
  static getActor(options = {}) {
    const { actorId, token, fallbackToSelected = true, fallbackToUser = true } = options;
    
    // Try direct ID lookup first
    if (actorId) {
      const actor = game.actors?.get(actorId);
      if (actor) return actor;
    }
    
    // Try from token
    if (token?.actor) {
      return token.actor;
    }
    
    // Fallback to selected token
    if (fallbackToSelected) {
      const controlled = canvas.tokens?.controlled?.[0];
      if (controlled?.actor) return controlled.actor;
    }
    
    // Fallback to user character
    if (fallbackToUser && game.user?.character) {
      return game.user.character;
    }
    
    return null;
  }

  /**
   * Get token from scene and token ID
   * @param {string} sceneId - Scene ID
   * @param {string} tokenId - Token ID
   * @returns {TokenDocument|null} The token document
   */
  static getToken(sceneId, tokenId) {
    const scene = game.scenes?.get(sceneId);
    return scene?.tokens?.get(tokenId) ?? null;
  }

  /**
   * Get token object (rendered token) from scene and token ID
   * @param {string} sceneId - Scene ID
   * @param {string} tokenId - Token ID
   * @returns {Token|null} The token object
   */
  static getTokenObject(sceneId, tokenId) {
    const tokenDoc = this.getToken(sceneId, tokenId);
    return tokenDoc?.object ?? null;
  }

  /**
   * Get actor from state object
   * @param {object} state - Card state
   * @returns {Actor|null} The actor
   */
  static getActorFromState(state) {
    return this.getActor({ 
      actorId: state.actorId,
      fallbackToSelected: false,
      fallbackToUser: false
    });
  }

  /**
   * Get item from actor and item ID
   * @param {Actor} actor - The actor
   * @param {string} itemId - Item ID
   * @returns {Item|null} The item
   */
  static getItem(actor, itemId) {
    return actor?.items?.get(itemId) ?? null;
  }

  /**
   * Get item from state object
   * @param {object} state - Card state
   * @returns {Item|null} The item
   */
  static getItemFromState(state) {
    const actor = this.getActorFromState(state);
    if (!actor) return null;
    
    const itemId = state.itemId ?? state.weaponId;
    return this.getItem(actor, itemId);
  }

  /**
   * Get all equipped weapons for an actor
   * @param {Actor} actor - The actor
   * @returns {Array} Array of equipped weapons
   */
  static getEquippedWeapons(actor) {
    if (!actor?.items) return [];
    
    return actor.items
      .filter(item => 
        item.type === "weapon" && 
        item.system?.equipped === true
      )
      .map(item => ({
        id: item.id,
        name: item.name,
        img: item.img,
        item
      }));
  }

  /**
   * Find weapon by ID in actor's items
   * @param {Actor} actor - The actor
   * @param {string} weaponId - Weapon ID to find
   * @returns {Item|null} The weapon item
   */
  static getWeaponById(actor, weaponId) {
    return actor?.items?.get(weaponId) ?? null;
  }

  /**
   * Resolve actor with proper roll data access
   * @param {Actor} actor - Raw actor object
   * @returns {Actor} Normalized actor with getRollData method
   */
  static normalizeActor(actor) {
    // Ensure we have the actual actor document, not a proxy
    if (actor?.getRollData) return actor;
    if (actor?.id) return game.actors?.get(actor.id) ?? actor;
    return actor;
  }

  /**
   * Get scene from ID or current scene
   * @param {string} sceneId - Scene ID (optional)
   * @returns {Scene|null} The scene
   */
  static getScene(sceneId) {
    if (sceneId) {
      return game.scenes?.get(sceneId) ?? null;
    }
    return canvas?.scene ?? null;
  }

  /**
   * Check if an actor is a valid target for operations
   * @param {Actor} actor - Actor to check
   * @returns {boolean} True if valid
   */
  static isValidActor(actor) {
    return !!(actor && actor.id && actor.system);
  }

  /**
   * Check if an item is a valid weapon for operations
   * @param {Item} item - Item to check
   * @returns {boolean} True if valid weapon
   */
  static isValidWeapon(item) {
    return !!(item && item.type === "weapon" && item.system);
  }
}

/**
 * Enhanced token resolver with flexible reference handling
 */
export class TokenResolver {
  /**
   * Resolve token and actor from various reference formats
   * @param {string|object|Token} reference - Token reference
   * @param {object} options - Resolution options
   * @returns {object} Resolved token data
   */
  static resolve(reference, options = {}) {
    const {
      requireActor = true,
      allowMissing = false
    } = options;
    
    // Handle different reference formats
    let sceneId, tokenId;
    
    if (typeof reference === "string") {
      // "sceneId:tokenId" format
      [sceneId, tokenId] = reference.split(":");
    } else if (reference.sceneId && reference.tokenId) {
      // Object format
      sceneId = reference.sceneId;
      tokenId = reference.tokenId;
    } else if (reference instanceof Token) {
      // Token object
      sceneId = reference.scene?.id;
      tokenId = reference.id;
    } else {
      throw new Error("Invalid token reference");
    }
    
    const scene = game.scenes.get(sceneId) || canvas.scene;
    const token = scene?.tokens.get(tokenId);
    const actor = token?.actor;
    
    const result = {
      scene,
      token,
      actor,
      exists: !!(token && (!requireActor || actor)),
      missing: !(token && (!requireActor || actor)),
      reference: `${sceneId}:${tokenId}`
    };
    
    if (!allowMissing && result.missing) {
      throw new Error(`Token not found: ${reference}`);
    }
    
    return result;
  }
  
  /**
   * Resolve multiple token references
   * @param {Array} references - Array of token references
   * @param {object} options - Resolution options
   * @returns {Map} Map of reference to resolved data
   */
  static resolveMultiple(references, options = {}) {
    const results = new Map();
    
    for (const ref of references) {
      try {
        const resolved = this.resolve(ref, { ...options, allowMissing: true });
        results.set(resolved.reference, resolved);
      } catch (error) {
        console.warn("SW5E Helper | Failed to resolve token:", ref, error);
      }
    }
    
    return results;
  }
  
  /**
   * Get current user targets
   * @returns {Array} Array of targeted tokens
   */
  static getCurrentTargets() {
    return Array.from(game.user.targets);
  }
  
  /**
   * Get controlled tokens on canvas
   * @returns {Array} Array of controlled tokens
   */
  static getControlledTokens() {
    return canvas.tokens?.controlled || [];
  }
}

/**
 * CONVENIENCE FUNCTION FOR QUICK TESTING WORKFLOWS
 * Resolve a token reference "sceneId:tokenId" or an object {sceneId, tokenId}
 * into the Foundry TokenDocument and Actor.
 * @param {string|{sceneId:string,tokenId:string}} ref - Token reference
 * @returns {{scene:Scene|null, token:TokenDocument|null, actor:Actor|null}}
 */
export function resolveTokenRef(ref) {
  let sceneId, tokenId;
  if (typeof ref === "string") {
    [sceneId, tokenId] = ref.split(":");
  } else {
    sceneId = ref?.sceneId;
    tokenId = ref?.tokenId;
  }
  const scene = game.scenes?.get(sceneId) ?? canvas?.scene ?? null;
  const token = scene?.tokens?.get?.(tokenId) ?? null;
  const actor = token?.actor ?? null;
  return { scene, token, actor };
}

export default TokenResolver;