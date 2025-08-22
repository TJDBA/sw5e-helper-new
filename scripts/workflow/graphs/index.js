/**
 * Workflow Graphs Index
 * Central registry for all workflow graph definitions
 */

import { fullAttackWorkflow, conditions as attackConditions } from './attack-full.js';
import { manualDamageWorkflow, quickDamageWorkflow } from './damage-manual.js';
import { saveOnlyWorkflow, multiSaveWorkflow, saveConditions } from './save-only.js';

/**
 * All available workflow graphs
 */
export const workflows = {
  // Attack workflows
  fullAttackWorkflow,
  
  // Damage workflows  
  manualDamageWorkflow,
  quickDamageWorkflow,
  
  // Save workflows
  saveOnlyWorkflow,
  multiSaveWorkflow
};

/**
 * All condition evaluation functions
 */
export const conditions = {
  ...attackConditions,
  ...saveConditions,
  
  /**
   * Check if auto-apply damage is enabled
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if auto-apply is enabled
   */
  shouldAutoApply: (ctx) => {
    return game.settings?.get?.("sw5e-helper-new", "autoApplyDamage") === true;
  },

  /**
   * Always returns true - for testing and simple flows
   * @param {object} ctx - Workflow context
   * @returns {boolean} Always true
   */
  always: (ctx) => true,

  /**
   * Always returns false - for testing and simple flows
   * @param {object} ctx - Workflow context  
   * @returns {boolean} Always false
   */
  never: (ctx) => false,

  /**
   * Check if user is GM
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if current user is GM
   */
  isGM: (ctx) => {
    return game.user?.isGM === true;
  },

  /**
   * Check if debug mode is enabled
   * @param {object} ctx - Workflow context
   * @returns {boolean} True if debug mode is on
   */
  isDebug: (ctx) => {
    return game.settings?.get?.("sw5e-helper-new", "debugMode") === true;
  }
};

/**
 * Workflow registry with metadata
 */
export const workflowRegistry = [
  {
    name: "fullAttackWorkflow",
    displayName: "Full Attack Workflow",
    description: "Complete attack sequence with damage, saves, and application",
    category: "attack",
    tags: ["attack", "damage", "save", "apply"],
    version: "1.0.0",
    workflow: fullAttackWorkflow
  },
  {
    name: "manualDamageWorkflow", 
    displayName: "Manual Damage",
    description: "Standalone damage rolling with manual application options",
    category: "damage",
    tags: ["damage", "manual"],
    version: "1.0.0",
    workflow: manualDamageWorkflow
  },
  {
    name: "quickDamageWorkflow",
    displayName: "Quick Damage",
    description: "Fast damage roll with immediate application", 
    category: "damage",
    tags: ["damage", "quick"],
    version: "1.0.0",
    workflow: quickDamageWorkflow
  },
  {
    name: "saveOnlyWorkflow",
    displayName: "Save Only",
    description: "Saving throws for spells and abilities",
    category: "save", 
    tags: ["save", "spell", "ability"],
    version: "1.0.0",
    workflow: saveOnlyWorkflow
  },
  {
    name: "multiSaveWorkflow",
    displayName: "Multi-Save",
    description: "Complex multi-stage saving throw workflow",
    category: "save",
    tags: ["save", "complex", "multi-stage"],
    version: "1.0.0", 
    workflow: multiSaveWorkflow
  }
];

/**
 * Get workflow by name
 * @param {string} name - Workflow name
 * @returns {object|null} Workflow definition
 */
export function getWorkflow(name) {
  return workflows[name] || null;
}

/**
 * Get all workflows in a category
 * @param {string} category - Category name
 * @returns {object[]} Array of workflow registry entries
 */
export function getWorkflowsByCategory(category) {
  return workflowRegistry.filter(entry => entry.category === category);
}

/**
 * Get all workflows with a specific tag
 * @param {string} tag - Tag to search for
 * @returns {object[]} Array of workflow registry entries
 */
export function getWorkflowsByTag(tag) {
  return workflowRegistry.filter(entry => 
    entry.tags.includes(tag)
  );
}

/**
 * Get condition function by name
 * @param {string} name - Condition name
 * @returns {Function|null} Condition function
 */
export function getCondition(name) {
  return conditions[name] || null;
}

/**
 * Validate workflow definition
 * @param {object} workflow - Workflow to validate
 * @returns {object} Validation result
 */
export function validateWorkflow(workflow) {
  const errors = [];
  const warnings = [];

  if (!workflow || typeof workflow !== 'object') {
    errors.push("Workflow must be an object");
    return { ok: false, errors, warnings };
  }

  // Required fields
  if (!workflow.name) errors.push("Workflow must have a name");
  if (!workflow.nodes) errors.push("Workflow must have nodes");
  if (!workflow.start) errors.push("Workflow must have a start node");

  // Validate nodes
  if (workflow.nodes) {
    for (const [nodeId, node] of Object.entries(workflow.nodes)) {
      if (!node.type) {
        errors.push(`Node ${nodeId} must have a type`);
      }

      // Validate node-specific requirements
      if (node.type === 'action' && !node.action) {
        errors.push(`Action node ${nodeId} must specify an action`);
      }

      if (node.type === 'conditional' && !node.condition) {
        errors.push(`Conditional node ${nodeId} must specify a condition`);
      }
    }

    // Check if start node exists
    if (workflow.start && !workflow.nodes[workflow.start]) {
      errors.push(`Start node '${workflow.start}' does not exist`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

export default {
  workflows,
  conditions, 
  workflowRegistry,
  getWorkflow,
  getWorkflowsByCategory,
  getWorkflowsByTag,
  getCondition,
  validateWorkflow
};