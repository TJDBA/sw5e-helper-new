/**
 * Permission checking utilities
 * Handles user permissions for tokens and actors
 */

export class PermissionChecker {
  /**
   * Check if user can control a token
   * @param {object} target - Target object with actorId or _actor
   * @returns {boolean} True if user can control
   */
  static canControlTarget(target) {
    try {
      // Get actor from target
      let actor = target._actor;
      if (!actor && target.actorId) {
        actor = game.actors?.get(target.actorId);
      }
      
      if (!actor) return false;
      
      // GM can control everything
      if (game.user?.isGM) return true;
      
      // Check ownership
      return this.hasOwnership(actor);
    } catch {
      return game.user?.isGM === true;
    }
  }

  /**
   * Check if user has ownership of an actor
   * @param {Actor} actor - Actor to check
   * @returns {boolean} True if user owns the actor
   */
  static hasOwnership(actor) {
    try {
      // Check isOwner property (Foundry v10+)
      if (actor.isOwner === true) return true;
      
      // Check ownership levels (Foundry v9)
      const userId = game.user?.id;
      const ownershipLevel = actor.ownership?.[userId];
      const requiredLevel = CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
      
      return ownershipLevel >= requiredLevel;
    } catch {
      return false;
    }
  }

  /**
   * Check if user can view an actor
   * @param {Actor} actor - Actor to check
   * @returns {boolean} True if user can view
   */
  static canViewActor(actor) {
    try {
      // GM can view everything
      if (game.user?.isGM) return true;
      
      // Check if user has at least observer permission
      const userId = game.user?.id;
      const ownershipLevel = actor.ownership?.[userId];
      const requiredLevel = CONST.DOCUMENT_PERMISSION_LEVELS?.OBSERVER ?? 1;
      
      return ownershipLevel >= requiredLevel;
    } catch {
      return game.user?.isGM === true;
    }
  }

  /**
   * Check if user can modify an actor
   * @param {Actor} actor - Actor to check
   * @returns {boolean} True if user can modify
   */
  static canModifyActor(actor) {
    try {
      // GM can modify everything
      if (game.user?.isGM) return true;
      
      // Check if user has owner permission
      return this.hasOwnership(actor);
    } catch {
      return game.user?.isGM === true;
    }
  }

  /**
   * Check if user can apply damage to a token
   * @param {object} target - Target object
   * @returns {boolean} True if user can apply damage
   */
  static canApplyDamage(target) {
    // For now, same as control permissions
    // Could be extended to have separate damage application permissions
    return this.canControlTarget(target);
  }

  /**
   * Check if user can roll dice for a token
   * @param {object} target - Target object
   * @returns {boolean} True if user can roll
   */
  static canRollForTarget(target) {
    // GM can always roll
    if (game.user?.isGM) return true;
    
    // Otherwise need ownership
    return this.canControlTarget(target);
  }

  /**
   * Filter targets based on user permissions
   * @param {Array} targets - Array of target objects
   * @param {string} permission - Permission type to check
   * @returns {Array} Filtered targets
   */
  static filterTargetsByPermission(targets, permission = "control") {
    return targets.filter(target => {
      switch (permission) {
        case "control":
          return this.canControlTarget(target);
        case "view":
          return this.canViewTarget(target);
        case "damage":
          return this.canApplyDamage(target);
        case "roll":
          return this.canRollForTarget(target);
        default:
          return true;
      }
    });
  }

  /**
   * Check if user can view a target
   * @param {object} target - Target object
   * @returns {boolean} True if user can view
   */
  static canViewTarget(target) {
    try {
      let actor = target._actor;
      if (!actor && target.actorId) {
        actor = game.actors?.get(target.actorId);
      }
      
      if (!actor) return false;
      
      return this.canViewActor(actor);
    } catch {
      return false;
    }
  }

  /**
   * Get the action name for a target based on permissions
   * @param {object} target - Target object
   * @returns {string} Action name ("select-token" or "ping-token")
   */
  static getTargetActionName(target) {
    return this.canControlTarget(target) ? "select-token" : "ping-token";
  }

  /**
   * Check if current user is GM
   * @returns {boolean} True if user is GM
   */
  static isGM() {
    return game.user?.isGM === true;
  }

  /**
   * Get user ID
   * @returns {string} Current user ID
   */
  static getUserId() {
    return game.user?.id ?? "";
  }
}

export default PermissionChecker;