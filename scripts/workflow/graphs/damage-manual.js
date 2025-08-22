/**
 * Manual Damage Workflow Graph
 * Standalone damage rolling and application
 */

/**
 * Manual damage workflow for standalone damage rolls
 */
export const manualDamageWorkflow = {
  name: "manualDamageWorkflow",
  description: "Standalone damage rolling with optional application",
  version: "1.0.0",
  
  nodes: {
    // Start with damage roll
    start: {
      type: "action",
      action: "damage",
      next: "checkAutoApply",
      onError: "end"
    },

    // Check if damage should be auto-applied
    checkAutoApply: {
      type: "conditional", 
      condition: "shouldAutoApply",
      onTrue: "applyDamage",
      onFalse: "pause"
    },

    // Auto-apply damage
    applyDamage: {
      type: "action",
      action: "apply",
      next: "end",
      onError: "end",
      config: {
        mode: "full",
        respectImmunities: true
      }
    },

    // Pause for manual application decision
    pause: {
      type: "pause",
      message: "Damage rolled. Choose application method.",
      resumeOptions: [
        { label: "Apply Full Damage", next: "applyFull" },
        { label: "Apply Half Damage", next: "applyHalf" },
        { label: "No Damage", next: "applyNone" },
        { label: "Finish", next: "end" }
      ],
      next: "end"
    },

    // Apply full damage
    applyFull: {
      type: "action",
      action: "apply",
      next: "end",
      onError: "end",
      config: {
        mode: "full"
      }
    },

    // Apply half damage
    applyHalf: {
      type: "action", 
      action: "apply",
      next: "end",
      onError: "end",
      config: {
        mode: "half"
      }
    },

    // Apply no damage
    applyNone: {
      type: "action",
      action: "apply", 
      next: "end",
      onError: "end",
      config: {
        mode: "none"
      }
    },

    // Workflow complete
    end: {
      type: "end"
    }
  },

  start: "start",

  // Default configuration
  config: {
    timeout: 180000, // 3 minutes
    allowUserCancel: true,
    logLevel: "info"
  }
};

/**
 * Quick damage workflow for immediate application
 */
export const quickDamageWorkflow = {
  name: "quickDamageWorkflow", 
  description: "Quick damage roll and immediate application",
  version: "1.0.0",
  
  nodes: {
    // Parallel execution of damage and application
    start: {
      type: "parallel",
      branches: [
        {
          name: "damage",
          steps: [
            { type: "action", action: "damage" }
          ]
        }
      ],
      next: "applyDamage"
    },

    // Apply the rolled damage
    applyDamage: {
      type: "action",
      action: "apply",
      next: "end",
      onError: "end",
      config: {
        mode: "full",
        source: "damage" // Use damage from previous step
      }
    },

    // Workflow complete
    end: {
      type: "end"
    }
  },

  start: "start",

  config: {
    timeout: 60000, // 1 minute
    allowUserCancel: false,
    logLevel: "info"
  }
};

export default {
  manualDamageWorkflow,
  quickDamageWorkflow
};