/**
 * Advanced Attack Workflow Test
 * Demonstrates all coordinator features: sequential, parallel, conditional, rollback, pause/resume, cancellation
 */

export const ATTACK_WORKFLOW_DEFINITION = {
  name: 'advancedAttackWorkflow',
  metadata: {
    description: 'Complete attack workflow with saves, damage application, and compensation',
    version: '1.0.0',
    author: 'SW5E Helper'
  },
  nodes: {
    // Start node - freeze current targets
    start: {
      type: 'action',
      action: 'freezeTargets',
      next: 'rollAttack',
      description: 'Freeze current target selection'
    },

    // Sequential: Roll attack against all targets
    rollAttack: {
      type: 'action',
      action: 'attack',
      next: 'checkHits',
      description: 'Roll attack against frozen targets'
    },

    // Conditional: Check if any attacks hit
    checkHits: {
      type: 'conditional',
      condition: 'hasAnyHits',
      onTrue: 'rollSavesParallel',
      onFalse: 'allMissed',
      description: 'Branch based on attack success'
    },

    // Parallel: Roll saves for each target that was hit
    rollSavesParallel: {
      type: 'parallel',
      branches: [
        {
          name: 'perTargetSaves',
          steps: [
            { type: 'action', action: 'save', targetMode: 'individual' }
          ]
        }
      ],
      next: 'pauseForDamageReview',
      description: 'Roll saves for all hit targets in parallel'
    },

    // Pause: Allow GM to review results before applying damage
    pauseForDamageReview: {
      type: 'pause',
      message: 'Review attack and save results. Click resume to apply damage.',
      next: 'applyDamageConditional',
      description: 'Pause for damage review'
    },

    // Conditional: Determine damage application per target
    applyDamageConditional: {
      type: 'conditional',
      condition: 'shouldApplyDamage',
      onTrue: 'calculateDamageAmounts',
      onFalse: 'workflowComplete',
      description: 'Check if damage should be applied'
    },

    // Action: Calculate damage amounts based on saves
    calculateDamageAmounts: {
      type: 'action',
      action: 'damage',
      next: 'applyDamageToTargets',
      description: 'Calculate damage amounts'
    },

    // Action: Apply damage to all targets
    applyDamageToTargets: {
      type: 'action',
      action: 'apply',
      next: 'workflowComplete',
      description: 'Apply calculated damage to targets'
    },

    // End states
    allMissed: {
      type: 'end',
      message: 'All attacks missed - no damage to apply',
      description: 'End state for complete miss'
    },

    workflowComplete: {
      type: 'end',
      message: 'Attack workflow completed successfully',
      description: 'Successful completion'
    }
  },
  start: 'start'
};

/**
 * Custom condition evaluators for the workflow
 */
export const WORKFLOW_CONDITIONS = {
  /**
   * Check if any attacks hit their targets
   */
  hasAnyHits(context) {
    const attackResult = context.results?.attack;
    if (!attackResult?.ok || !attackResult.data?.targets) {
      return false;
    }

    return attackResult.data.targets.some(target => 
      target.status === 'hit' || target.status === 'crit'
    );
  },

  /**
   * Check if damage should be applied based on hits and saves
   */
  shouldApplyDamage(context) {
    const attackResult = context.results?.attack;
    const saveResult = context.results?.save;

    // Must have hit targets
    if (!this.hasAnyHits(context)) {
      return false;
    }

    // If no saves required, apply damage
    if (!saveResult) {
      return true;
    }

    // If saves were made, check if any targets should take damage
    if (saveResult.data?.results) {
      for (const [targetId, save] of saveResult.data.results.entries()) {
        if (!save.passed) {
          return true; // At least one failed save
        }
      }
    }

    return false;
  }
};

/**
 * Mock FreezeTargets action for testing
 */
export class FreezeTargetsAction {
  static name = "freezeTargets";

  static validate(context) {
    // Always valid for testing
  }

  static checkPermission(context) {
    // Always allowed for testing
  }

  static async execute(context) {
    const targets = Array.from(game.user.targets || []);
    
    console.log(`SW5E Helper Test: Freezing ${targets.length} targets`);

    return {
      ok: true,
      type: 'freezeTargets',
      data: {
        frozenTargets: targets.map(token => ({
          tokenId: token.id,
          sceneId: token.document?.parent?.id || canvas.scene?.id,
          name: token.name,
          actorId: token.actor?.id
        }))
      },
      errors: [],
      warnings: [],
      meta: { targetCount: targets.length }
    };
  }

  static async compensate(context, result) {
    console.log("SW5E Helper Test: FreezeTargets compensation (no action needed)");
  }

  static idempotencyKey(context) {
    return `freeze_${Date.now()}`;
  }
}

/**
 * Workflow test configuration
 */
export const TEST_CONFIG = {
  actorName: 'Test Warrior',     // Actor to use for testing
  weaponName: 'Test Blaster',    // Weapon to use for testing
  targetCount: 3,                // Number of targets to create
  damage: {
    base: '1d8+3',
    type: 'energy'
  },
  save: {
    ability: 'dex',
    dc: 15,
    halfDamage: true
  },
  logLevel: 'debug'              // Detailed logging for test
};

/**
 * Test scenario configurations
 */
export const TEST_SCENARIOS = {
  // All attacks hit, all saves fail - full damage
  allHitAllFail: {
    name: 'All Hit, All Fail',
    attackMods: '+10',  // Ensure hits
    saveMods: '-10'     // Ensure failures
  },

  // All attacks hit, all saves succeed - half damage  
  allHitAllSave: {
    name: 'All Hit, All Save',
    attackMods: '+10',  // Ensure hits
    saveMods: '+10'     // Ensure successes
  },

  // Mixed results
  mixedResults: {
    name: 'Mixed Results',
    attackMods: '+0',   // Normal attack rolls
    saveMods: '+0'      // Normal save rolls
  },

  // All attacks miss - no damage
  allMiss: {
    name: 'All Miss',
    attackMods: '-20',  // Ensure misses
    saveMods: '+0'      // Saves irrelevant
  }
};

/**
 * Rollback test scenario - simulates failure during damage application
 */
export const ROLLBACK_SCENARIO = {
  name: 'Rollback Test',
  description: 'Forces failure during damage application to test compensation',
  failAt: 'applyDamageToTargets',  // Node where failure occurs
  expectedCompensation: [
    'damage calculation restored',
    'save results cleared', 
    'attack results cleared',
    'targets unfrozen'
  ]
};

/**
 * Cancellation test scenario
 */
export const CANCELLATION_SCENARIO = {
  name: 'Cancellation Test',
  description: 'Tests AbortSignal cancellation during execution',
  cancelAfter: 2000,  // Cancel after 2 seconds
  cancelAt: 'rollSavesParallel'  // Expected cancellation point
};