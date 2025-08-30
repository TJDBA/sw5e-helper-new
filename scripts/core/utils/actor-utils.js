/**
 * Actor utility functions for SW5E Helper
 * Handles target reference generation and user control checks
 */

/**
 * Generate a unique target reference string from a target object
 * @param {object} target - Target object with sceneId and tokenId
 * @returns {string} Unique target reference in format "sceneId:tokenId"
 */
export function getTargetRef(target) {
  if (!target) return "";
  
  // If target already has a ref property, use it
  if (target.ref) return target.ref;
  
  // If target has sceneId and tokenId, combine them
  if (target.sceneId && target.tokenId) {
    return `${target.sceneId}:${target.tokenId}`;
  }
  
  // If target has scene and token properties, extract IDs
  if (target.scene && target.token) {
    const sceneId = target.scene.id || target.scene._id;
    const tokenId = target.token.id || target.token._id;
    if (sceneId && tokenId) {
      return `${sceneId}:${tokenId}`;
    }
  }
  
  // If target has _actor with scene and token info
  if (target._actor) {
    const sceneId = target._actor.scene?.id || target._actor.scene?._id;
    const tokenId = target._actor.token?.id || target._actor.token?._id;
    if (sceneId && tokenId) {
      return `${sceneId}:${tokenId}`;
    }
  }
  
  // Fallback: try to extract from any available ID properties
  const sceneId = target.sceneId || target.scene?.id || target.scene?._id || target._scene?.id || target._scene?._id;
  const tokenId = target.tokenId || target.token?.id || target.token?._id || target._token?.id || target._token?._id;
  
  if (sceneId && tokenId) {
    return `${sceneId}:${tokenId}`;
  }
  
  // Last resort: use any available ID
  if (target.id) return target.id;
  if (target._id) return target._id;
  
  console.warn("SW5E Helper: Could not generate target reference for target:", target);
  return "unknown:unknown";
}

/**
 * Check if the current user can control a target
 * @param {object} target - Target object (actor, token, or target)
 * @returns {boolean} True if user can control the target
 */
export function canUserControl(target) {
  if (!target) return false;
  
  // If target explicitly specifies control permission
  if (target.canControl !== undefined) {
    return !!target.canControl;
  }
  
  // If target has an actor, check actor permissions
  if (target._actor) {
    return canUserControlActor(target._actor);
  }
  
  // If target is an actor itself
  if (target.type === "Actor" || target.documentName === "Actor") {
    return canUserControlActor(target);
  }
  
  // If target is a token
  if (target.type === "Token" || target.documentName === "Token") {
    return canUserControlToken(target);
  }
  
  // If target has actor and token properties
  if (target.actor && target.token) {
    return canUserControlActor(target.actor) || canUserControlToken(target.token);
  }
  
  // Default: only GMs can control unknown targets
  return game.user?.isGM === true;
}

/**
 * Check if user can control an actor
 * @param {Actor} actor - Actor document
 * @returns {boolean} True if user can control the actor
 */
function canUserControlActor(actor) {
  if (!actor) return false;
  
  try {
    // Check if user owns the actor
    if (actor.ownership?.default >= 3) return true;
    
    // Check if user has specific ownership
    if (actor.ownership?.[game.user.id] >= 3) return true;
    
    // Check if user is GM
    if (game.user?.isGM) return true;
    
    // Check if actor has a permission check method
    if (typeof actor.canUserModify === "function") {
      return actor.canUserModify(game.user, "update");
    }
    
    return false;
  } catch (error) {
    console.warn("SW5E Helper: Error checking actor control:", error);
    return false;
  }
}

/**
 * Check if user can control a token
 * @param {Token} token - Token document
 * @returns {boolean} True if user can control the token
 */
function canUserControlToken(token) {
  if (!token) return false;
  
  try {
    // Check if user owns the token's actor
    if (token.actor && canUserControlActor(token.actor)) {
      return true;
    }
    
    // Check if user is GM
    if (game.user?.isGM) return true;
    
    // Check if token has a permission check method
    if (typeof token.canUserModify === "function") {
      return token.canUserModify(game.user, "update");
    }
    
    return false;
  } catch (error) {
    console.warn("SW5E Helper: Error checking token control:", error);
    return false;
  }
}

/**
 * Get the actor from a target object
 * @param {object} target - Target object
 * @returns {Actor|null} Actor document or null
 */
export function getActorFromTarget(target) {
  if (!target) return null;
  
  // Direct actor reference
  if (target._actor) return target._actor;
  if (target.actor) return target.actor;
  
  // If target is an actor itself
  if (target.type === "Actor" || target.documentName === "Actor") {
    return target;
  }
  
  // If target is a token, get its actor
  if (target.type === "Token" || target.documentName === "Token") {
    return target.actor;
  }
  
  return null;
}

/**
 * Get the token from a target object
 * @param {object} target - Target object
 * @returns {Token|null} Token document or null
 */
export function getTokenFromTarget(target) {
  if (!target) return null;
  
  // Direct token reference
  if (target._token) return target._token;
  if (target.token) return target.token;
  
  // If target is a token itself
  if (target.type === "Token" || target.documentName === "Token") {
    return target;
  }
  
  // If target has token info but not as a document
  if (target.tokenId && target.sceneId) {
    const scene = game.scenes.get(target.sceneId);
    if (scene) {
      return scene.tokens.get(target.tokenId);
    }
  }
  
  return null;
}

/**
 * Resolve a target reference string to actual objects
 * @param {string} ref - Target reference in format "sceneId:tokenId"
 * @returns {object|null} Object with actor, token, and scene properties
 */
export function resolveTargetRef(ref) {
  if (!ref || typeof ref !== "string") return null;
  
  const [sceneId, tokenId] = ref.split(":");
  if (!sceneId || !tokenId) return null;
  
  try {
    const scene = game.scenes.get(sceneId);
    if (!scene) return null;
    
    const token = scene.tokens.get(tokenId);
    if (!token) return null;
    
    return {
      scene,
      token,
      actor: token.actor,
      ref
    };
  } catch (error) {
    console.warn("SW5E Helper: Error resolving target reference:", error);
    return null;
  }
}
