/**
 * Advanced Workflow Coordinator
 * Composes actions into complex workflows with compensation, pause/resume, and graph execution
 * 
 * @author SW5E Helper
 * @version 1.0.0
 */

import { StateManager } from '../core/state/manager.js';
import { getConfig, isDebug } from '../config.js';

/**
 * @typedef {Object} WorkflowGraph
 * @property {string} name - Workflow identifier
 * @property {Object} nodes - Graph nodes by ID
 * @property {string} start - Starting node ID
 * @property {Object} metadata - Optional workflow metadata
 */

/**
 * @typedef {Object} Context
 * @property {string} actorId - Actor performing action
 * @property {string} [itemId] - Item being used
 * @property {string[]} targetIds - Target token/actor IDs
 * @property {string} [messageId] - Chat message ID
 * @property {string} [workflowId] - Unique workflow execution ID
 * @property {string} [stepId] - Current step identifier
 * @property {Roll[]} [rolls] - Accumulated rolls
 * @property {Object} [flags] - Custom state flags
 * @property {Object} [config] - Action configuration
 * @property {Object} [results] - Results from previous steps
 * @property {number} [timestamp] - Execution start time
 * @property {string} [userId] - Initiating user ID
 */

/**
 * @typedef {Object} Result
 * @property {boolean} ok - Success status
 * @property {string} type - Result type
 * @property {any} [data] - Action-specific result data
 * @property {string[]} errors - Error messages
 * @property {string[]} warnings - Warning messages
 * @property {Object} meta - Metadata
 * @property {Roll[]} [rolls] - Foundry Roll objects
 * @property {string[]} [effects] - Side effects performed
 */

/**
 * @typedef {Object} ExecuteOptions
 * @property {AbortSignal} [signal] - Cancellation signal
 * @property {string} [logLevel] - Override log level
 * @property {string} [resumeToken] - Resume from pause point
 * @property {boolean} [dryRun] - Validate only, don't execute
 */

/**
 * Custom error classes
 */
class WorkflowError extends Error {
  constructor(message, code = 'WORKFLOW_ERROR') {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
  }
}

class ValidationError extends WorkflowError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class PermissionError extends WorkflowError {
  constructor(message) {
    super(message, 'PERMISSION_ERROR');
    this.name = 'PermissionError';
  }
}

class ResumeError extends WorkflowError {
  constructor(message) {
    super(message, 'RESUME_ERROR');
    this.name = 'ResumeError';
  }
}

/**
 * Advanced Workflow Coordinator
 * Orchestrates complex multi-step workflows with graph execution
 */
export class WorkflowCoordinator {
  constructor() {
    /** @type {Map<string, WorkflowGraph>} */
    this.workflows = new Map();
    
    /** @type {Map<string, Object>} */
    this.actions = new Map();
    
    /** @type {Map<string, Object>} */
    this.activeExecutions = new Map();
    
    this.config = {
      maxSteps: getConfig('coordinator.maxSteps', 50),
      defaultTimeout: getConfig('coordinator.defaultTimeout', 30000),
      resumeTokenTTL: getConfig('coordinator.resumeTokenTTL', 24 * 60 * 60 * 1000),
      maxParallelBranches: getConfig('coordinator.maxParallelBranches', 10),
      logLevel: getConfig('debug.logLevel', 'info')
    };
    
    this.init();
  }

  /**
   * Initialize coordinator and register default actions
   */
  async init() {
    this.log('info', 'Initializing WorkflowCoordinator');
    
    // Import and register default actions
    try {
      const { AttackAction, DamageAction, SaveAction, ApplyAction } = await import('./actions/index.js');
      
      this.registerAction('attack', AttackAction);
      this.registerAction('damage', DamageAction);  
      this.registerAction('save', SaveAction);
      this.registerAction('apply', ApplyAction);
      
      this.log('info', 'Default actions registered', { actions: Array.from(this.actions.keys()) });
    } catch (error) {
      this.log('error', 'Failed to register default actions', { error: error.message });
    }

    // Register built-in workflows
    this.registerBuiltinWorkflows();
    
    this.log('info', 'WorkflowCoordinator initialized');
  }

  /**
   * Register built-in workflow definitions
   */
  registerBuiltinWorkflows() {
    // Basic attack workflow
    this.defineWorkflow('attackWorkflow', {
      name: 'attackWorkflow',
      nodes: {
        start: { type: 'action', action: 'attack', next: 'checkTargets' },
        checkTargets: { 
          type: 'conditional',
          condition: 'ctx.results.attack?.data?.targets?.length > 0',
          onTrue: 'rollSaves',
          onFalse: 'end'
        },
        rollSaves: {
          type: 'parallel',
          branches: [
            { steps: [{ type: 'action', action: 'save' }] }
          ],
          next: 'applyDamage'
        },
        applyDamage: {
          type: 'conditional', 
          condition: 'shouldApplyDamage',
          onTrue: 'applyStep',
          onFalse: 'end'
        },
        applyStep: { type: 'action', action: 'apply', next: 'end' },
        end: { type: 'end' }
      },
      start: 'start'
    });
  }

  /**
   * Register an action with the coordinator
   * @param {string} name - Action name
   * @param {Object} handler - Action handler class
   */
  registerAction(name, handler) {
    if (!handler.execute) {
      throw new Error(`Action ${name} missing execute method`);
    }
    
    this.actions.set(name, {
      name,
      handler,
      validate: handler.validate?.bind(handler) || (() => {}),
      checkPermission: handler.checkPermission?.bind(handler) || (() => {}),
      execute: handler.execute.bind(handler),
      compensate: handler.compensate?.bind(handler) || null,
      idempotencyKey: handler.idempotencyKey?.bind(handler) || null
    });
    
    this.log('debug', 'Action registered', { name });
  }

  /**
   * Get registered action
   * @param {string} name - Action name
   * @returns {Object|null} Action handler
   */
  getAction(name) {
    return this.actions.get(name) || null;
  }

  /**
   * List all registered actions
   * @returns {string[]} Action names
   */
  listActions() {
    return Array.from(this.actions.keys());
  }

  /**
   * Define a workflow
   * @param {string} name - Workflow name
   * @param {WorkflowGraph} graph - Workflow graph definition
   */
  defineWorkflow(name, graph) {
    this.validateWorkflowGraph(graph);
    this.workflows.set(name, { ...graph, name });
    this.log('info', 'Workflow defined', { name, nodeCount: Object.keys(graph.nodes).length });
  }

  /**
   * Get workflow definition
   * @param {string} name - Workflow name
   * @returns {WorkflowGraph|null} Workflow graph
   */
  getWorkflow(name) {
    return this.workflows.get(name) || null;
  }

  /**
   * List all registered workflows
   * @returns {string[]} Workflow names
   */
  listWorkflows() {
    return Array.from(this.workflows.keys());
  }

  /**
   * Execute a workflow
   * @param {string} name - Workflow name
   * @param {Context} context - Execution context
   * @param {ExecuteOptions} options - Execution options
   * @returns {Promise<Result>} Workflow result
   */
  async execute(name, context = {}, options = {}) {
    const startTime = Date.now();
    const workflowId = this.generateWorkflowId();
    const { signal, logLevel, resumeToken, dryRun = false } = options;

    // Override log level if provided
    const originalLogLevel = this.config.logLevel;
    if (logLevel) this.config.logLevel = logLevel;

    try {
      this.log('info', 'Starting workflow execution', { 
        workflow: name, 
        workflowId, 
        dryRun,
        resumeToken: !!resumeToken 
      });

      // Get workflow definition
      const workflow = this.getWorkflow(name);
      if (!workflow) {
        throw new WorkflowError(`Unknown workflow: ${name}`);
      }

      // Handle resume
      let ctx = context;
      let currentNodeId = workflow.start;
      
      if (resumeToken) {
        const resumeData = await this.validateResumeToken(resumeToken);
        ctx = { ...resumeData.context, ...context }; // Allow context override
        currentNodeId = resumeData.nodeId;
        this.log('info', 'Resuming workflow', { workflowId, nodeId: currentNodeId });
        
        Hooks.callAll('sw5e-helper.workflow.resumed', {
          workflow: name,
          context: ctx,
          fromStep: currentNodeId
        });
      }

      // Initialize execution context
      ctx = {
        ...ctx,
        workflowId,
        timestamp: ctx.timestamp || startTime,
        userId: ctx.userId || game.user?.id,
        results: ctx.results || {}
      };

      // Track active execution
      const execution = {
        workflowId,
        workflow: name,
        context: ctx,
        startTime,
        currentNode: currentNodeId,
        aborted: false
      };
      this.activeExecutions.set(workflowId, execution);

      // Set up cancellation
      if (signal) {
        signal.addEventListener('abort', () => {
          execution.aborted = true;
          this.log('warn', 'Workflow execution aborted', { workflowId });
        });
      }

      // Execute workflow graph
      const result = await this.executeGraph(workflow, ctx, currentNodeId, execution, dryRun);
      
      // Emit completion event
      if (result.ok) {
        this.log('info', 'Workflow completed successfully', { 
          workflowId, 
          duration: Date.now() - startTime 
        });
        
        Hooks.callAll('sw5e-helper.workflow.completed', {
          workflow: name,
          context: ctx,
          results: result
        });
      } else {
        this.log('error', 'Workflow execution failed', { 
          workflowId,
          errors: result.errors,
          duration: Date.now() - startTime
        });
        
        Hooks.callAll('sw5e-helper.workflow.failed', {
          workflow: name,
          context: ctx,
          error: result.errors,
          results: result
        });
      }

      return result;

    } catch (error) {
      this.log('error', 'Workflow execution error', { 
        workflowId, 
        error: error.message,
        stack: error.stack 
      });

      return {
        ok: false,
        type: 'workflow',
        errors: [error.message],
        warnings: [],
        meta: { workflowId, duration: Date.now() - startTime }
      };
    } finally {
      // Cleanup
      this.activeExecutions.delete(workflowId);
      if (logLevel) this.config.logLevel = originalLogLevel;
    }
  }

  /**
   * Execute workflow graph starting from specified node
   * @param {WorkflowGraph} workflow - Workflow definition
   * @param {Context} context - Execution context
   * @param {string} startNodeId - Starting node ID
   * @param {Object} execution - Execution state
   * @param {boolean} dryRun - Validation only mode
   * @returns {Promise<Result>} Execution result
   */
  async executeGraph(workflow, context, startNodeId, execution, dryRun = false) {
    const result = {
      ok: true,
      type: 'workflow',
      errors: [],
      warnings: [],
      meta: { workflowId: context.workflowId, steps: [] },
      rolls: context.rolls || []
    };

    const executedSteps = [];
    let currentNodeId = startNodeId;
    let stepCount = 0;

    while (currentNodeId && stepCount < this.config.maxSteps) {
      // Check for abort
      if (execution.aborted) {
        result.ok = false;
        result.errors.push('Workflow execution was aborted');
        break;
      }

      const node = workflow.nodes[currentNodeId];
      if (!node) {
        result.ok = false;
        result.errors.push(`Unknown node: ${currentNodeId}`);
        break;
      }

      this.log('debug', 'Executing node', { 
        workflowId: context.workflowId, 
        nodeId: currentNodeId, 
        type: node.type 
      });

      try {
        // Execute node based on type
        const stepResult = await this.executeNode(workflow, node, currentNodeId, context, dryRun);
        
        // Handle step result
        if (stepResult.pause) {
          // Workflow paused - generate resume token
          const resumeToken = await this.generateResumeToken(workflow.name, currentNodeId, context);
          
          this.log('info', 'Workflow paused', { workflowId: context.workflowId, nodeId: currentNodeId });
          
          Hooks.callAll('sw5e-helper.workflow.paused', {
            workflow: workflow.name,
            context,
            resumeToken
          });

          return {
            ok: true,
            type: 'workflow-paused',
            data: { resumeToken },
            errors: [],
            warnings: result.warnings,
            meta: { ...result.meta, paused: true, resumeToken }
          };
        }

        if (!stepResult.ok) {
          result.ok = false;
          result.errors.push(...stepResult.errors);
          
          // Execute compensation for completed steps
          if (executedSteps.length > 0) {
            await this.compensateSteps(executedSteps, context);
          }
          break;
        }

        // Track successful step for compensation
        executedSteps.push({
          nodeId: currentNodeId,
          action: node.action,
          result: stepResult,
          context: { ...context }
        });

        // Update context with step results
        if (node.action) {
          context.results[node.action] = stepResult;
        }

        // Add rolls to accumulator
        if (stepResult.rolls?.length) {
          result.rolls.push(...stepResult.rolls);
        }

        result.warnings.push(...stepResult.warnings);
        result.meta.steps.push({
          nodeId: currentNodeId,
          type: node.type,
          action: node.action,
          duration: stepResult.meta?.duration || 0
        });

        // Determine next node
        currentNodeId = this.getNextNode(node, stepResult, context);

      } catch (error) {
        result.ok = false;
        result.errors.push(`Step ${currentNodeId} failed: ${error.message}`);
        
        // Execute compensation
        if (executedSteps.length > 0) {
          await this.compensateSteps(executedSteps, context);
        }
        break;
      }

      stepCount++;
    }

    if (stepCount >= this.config.maxSteps) {
      result.ok = false;
      result.errors.push('Workflow exceeded maximum step limit');
    }

    return result;
  }

  /**
   * Execute a single workflow node
   * @param {WorkflowGraph} workflow - Workflow definition
   * @param {Object} node - Node definition
   * @param {string} nodeId - Node identifier
   * @param {Context} context - Execution context
   * @param {boolean} dryRun - Validation only mode
   * @returns {Promise<Result>} Node execution result
   */
  async executeNode(workflow, node, nodeId, context, dryRun) {
    const startTime = Date.now();

    Hooks.callAll('sw5e-helper.workflow.preStep', {
      workflow: workflow.name,
      step: nodeId,
      context
    });

    let result;

    try {
      switch (node.type) {
        case 'action':
          result = await this.executeActionNode(node, context, dryRun);
          break;
        
        case 'parallel':
          result = await this.executeParallelNode(node, context, dryRun);
          break;
        
        case 'conditional':
          result = await this.executeConditionalNode(node, context);
          break;
        
        case 'loop':
          result = await this.executeLoopNode(workflow, node, context, dryRun);
          break;
        
        case 'pause':
          result = { ok: true, type: 'pause', pause: true, errors: [], warnings: [], meta: {} };
          break;
        
        case 'end':
          result = { ok: true, type: 'end', errors: [], warnings: [], meta: {} };
          break;
        
        default:
          throw new WorkflowError(`Unknown node type: ${node.type}`);
      }

      result.meta.duration = Date.now() - startTime;

      Hooks.callAll('sw5e-helper.workflow.postStep', {
        workflow: workflow.name,
        step: nodeId,
        context,
        result
      });

    } catch (error) {
      result = {
        ok: false,
        type: node.type,
        errors: [error.message],
        warnings: [],
        meta: { duration: Date.now() - startTime }
      };
    }

    return result;
  }

  /**
   * Execute action node
   * @param {Object} node - Action node definition
   * @param {Context} context - Execution context
   * @param {boolean} dryRun - Validation only mode
   * @returns {Promise<Result>} Action result
   */
  async executeActionNode(node, context, dryRun) {
    const action = this.getAction(node.action);
    if (!action) {
      throw new WorkflowError(`Unknown action: ${node.action}`);
    }

    this.log('debug', 'Executing action', { 
      action: node.action, 
      workflowId: context.workflowId 
    });

    // Validate context
    try {
      await action.validate(context);
    } catch (error) {
      throw new ValidationError(`Action validation failed: ${error.message}`);
    }

    // Check permissions
    try {
      await action.checkPermission(context);
    } catch (error) {
      throw new PermissionError(`Permission denied: ${error.message}`);
    }

    // Execute (skip in dry run mode)
    if (dryRun) {
      return {
        ok: true,
        type: node.action,
        data: { dryRun: true },
        errors: [],
        warnings: [],
        meta: {}
      };
    }

    // Execute action
    Hooks.callAll('sw5e-helper.action.preExecute', {
      action: node.action,
      context
    });

    const result = await action.execute(context);

    Hooks.callAll('sw5e-helper.action.postExecute', {
      action: node.action,
      context,
      result
    });

    return result;
  }

  /**
   * Execute parallel node - fan out to multiple branches
   * @param {Object} node - Parallel node definition
   * @param {Context} context - Execution context
   * @param {boolean} dryRun - Validation only mode
   * @returns {Promise<Result>} Combined results
   */
  async executeParallelNode(node, context, dryRun) {
    const branches = node.branches || [];
    
    if (branches.length > this.config.maxParallelBranches) {
      throw new WorkflowError(`Too many parallel branches: ${branches.length}`);
    }

    this.log('debug', 'Executing parallel branches', { 
      count: branches.length, 
      workflowId: context.workflowId 
    });

    // Execute all branches concurrently
    const promises = branches.map(async (branch, index) => {
      try {
        // For now, assume branches are simple action lists
        const step = branch.steps?.[0];
        if (step?.type === 'action') {
          return await this.executeActionNode(step, context, dryRun);
        }
        
        return {
          ok: true,
          type: 'parallel-branch',
          data: { branch: index },
          errors: [],
          warnings: [],
          meta: {}
        };
      } catch (error) {
        return {
          ok: false,
          type: 'parallel-branch',
          errors: [error.message],
          warnings: [],
          meta: { branch: index }
        };
      }
    });

    const results = await Promise.allSettled(promises);
    
    // Combine results
    const combined = {
      ok: true,
      type: 'parallel',
      data: { branches: [] },
      errors: [],
      warnings: [],
      meta: { branchCount: branches.length },
      rolls: []
    };

    for (let i = 0; i < results.length; i++) {
      const settledResult = results[i];
      
      if (settledResult.status === 'fulfilled') {
        const branchResult = settledResult.value;
        combined.data.branches.push(branchResult);
        
        if (!branchResult.ok) {
          combined.ok = false;
          combined.errors.push(...branchResult.errors);
        }
        
        combined.warnings.push(...branchResult.warnings);
        
        if (branchResult.rolls?.length) {
          combined.rolls.push(...branchResult.rolls);
        }
      } else {
        combined.ok = false;
        combined.errors.push(`Branch ${i} rejected: ${settledResult.reason}`);
      }
    }

    return combined;
  }

  /**
   * Execute conditional node - branch based on condition
   * @param {Object} node - Conditional node definition
   * @param {Context} context - Execution context
   * @returns {Promise<Result>} Condition evaluation result
   */
  async executeConditionalNode(node, context) {
    this.log('debug', 'Evaluating condition', { 
      condition: node.condition, 
      workflowId: context.workflowId 
    });

    try {
      const conditionResult = this.evaluateCondition(node.condition, context);
      
      return {
        ok: true,
        type: 'conditional',
        data: { 
          condition: node.condition,
          result: conditionResult,
          nextNode: conditionResult ? node.onTrue : node.onFalse
        },
        errors: [],
        warnings: [],
        meta: {}
      };
    } catch (error) {
      return {
        ok: false,
        type: 'conditional',
        errors: [`Condition evaluation failed: ${error.message}`],
        warnings: [],
        meta: {}
      };
    }
  }

  /**
   * Execute loop node (simplified implementation)
   * @param {WorkflowGraph} workflow - Workflow definition
   * @param {Object} node - Loop node definition
   * @param {Context} context - Execution context
   * @param {boolean} dryRun - Validation only mode
   * @returns {Promise<Result>} Loop execution result
   */
  async executeLoopNode(workflow, node, context, dryRun) {
    // Simplified loop implementation - just return success for now
    return {
      ok: true,
      type: 'loop',
      data: { iterations: 0 },
      errors: [],
      warnings: ['Loop nodes not fully implemented'],
      meta: {}
    };
  }

  /**
   * Determine next node based on current node and execution result
   * @param {Object} node - Current node
   * @param {Result} result - Execution result
   * @param {Context} context - Execution context
   * @returns {string|null} Next node ID
   */
  getNextNode(node, result, context) {
    switch (node.type) {
      case 'conditional':
        return result.data?.nextNode || null;
      
      case 'end':
        return null;
      
      default:
        return node.next || null;
    }
  }

  /**
   * Compensate executed steps in LIFO order
   * @param {Array} steps - Executed steps
   * @param {Context} context - Execution context
   */
  async compensateSteps(steps, context) {
    this.log('info', 'Starting compensation', { 
      stepCount: steps.length, 
      workflowId: context.workflowId 
    });

    // Execute compensation in reverse order (LIFO)
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      
      try {
        const action = this.getAction(step.action);
        if (action?.compensate) {
          this.log('debug', 'Compensating step', { 
            step: step.nodeId, 
            action: step.action 
          });

          await action.compensate(step.context, step.result);
          
          Hooks.callAll('sw5e-helper.workflow.compensate', {
            workflow: context.workflowId,
            step: step.nodeId,
            context: step.context,
            result: step.result
          });

          Hooks.callAll('sw5e-helper.action.compensated', {
            action: step.action,
            context: step.context,
            result: step.result
          });
        } else {
          this.log('warn', 'Step not compensatable', { 
            step: step.nodeId, 
            action: step.action 
          });
        }
      } catch (error) {
        this.log('error', 'Compensation failed', { 
          step: step.nodeId, 
          error: error.message 
        });
      }
    }

    this.log('info', 'Compensation completed', { workflowId: context.workflowId });
  }

  /**
   * Generate secure resume token
   * @param {string} workflowName - Workflow name
   * @param {string} nodeId - Current node ID
   * @param {Context} context - Execution context
   * @returns {Promise<string>} Resume token
   */
  async generateResumeToken(workflowName, nodeId, context) {
    const tokenData = {
      workflowName,
      nodeId,
      context: this.serializeContext(context),
      timestamp: Date.now(),
      expires: Date.now() + this.config.resumeTokenTTL
    };

    const token = btoa(JSON.stringify(tokenData));
    
    // Store token in StateManager
    await StateManager.storeResumeToken(token, tokenData);
    
    return token;
  }

  /**
   * Validate and parse resume token
   * @param {string} token - Resume token
   * @returns {Promise<Object>} Token data
   */
  async validateResumeToken(token) {
    try {
      const tokenData = await StateManager.retrieveResumeToken(token);
      
      if (!tokenData) {
        throw new ResumeError('Invalid or expired resume token');
      }

      if (Date.now() > tokenData.expires) {
        throw new ResumeError('Resume token has expired');
      }

      return {
        workflowName: tokenData.workflowName,
        nodeId: tokenData.nodeId,
        context: this.deserializeContext(tokenData.context)
      };
    } catch (error) {
      throw new ResumeError(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Serialize context for storage
   * @param {Context} context - Execution context
   * @returns {Object} Serializable context
   */
  serializeContext(context) {
    const serialized = { ...context };
    
    // Convert Foundry Roll objects to serializable format
    if (serialized.rolls) {
      serialized.rolls = serialized.rolls.map(roll => ({
        _roll: roll.toJSON ? roll.toJSON() : roll
      }));
    }

    return serialized;
  }

  /**
   * Deserialize context from storage
   * @param {Object} data - Serialized context
   * @returns {Context} Execution context
   */
  deserializeContext(data) {
    const context = { ...data };
    
    // Restore Foundry Roll objects
    if (context.rolls) {
      context.rolls = context.rolls.map(rollData => {
        if (rollData._roll) {
          return Roll.fromData ? Roll.fromData(rollData._roll) : rollData._roll;
        }
        return rollData;
      });
    }

    return context;
  }

  /**
   * Evaluate condition expression
   * @param {string} condition - Condition expression
   * @param {Context} context - Execution context
   * @returns {boolean} Condition result
   */
  evaluateCondition(condition, context) {
    // Simple condition evaluation - extend as needed
    if (condition === 'shouldApplyDamage') {
      return context.results?.save?.ok === true;
    }

    if (condition.includes('ctx.results')) {
      // Basic context property evaluation
      try {
        const expr = condition.replace(/ctx\./g, 'context.');
        return Function('context', `return ${expr}`)(context);
      } catch (error) {
        this.log('warn', 'Condition evaluation failed', { condition, error: error.message });
        return false;
      }
    }

    return Boolean(condition);
  }

  /**
   * Validate workflow graph structure
   * @param {WorkflowGraph} graph - Workflow graph
   */
  validateWorkflowGraph(graph) {
    if (!graph.name) {
      throw new ValidationError('Workflow name is required');
    }

    if (!graph.nodes || typeof graph.nodes !== 'object') {
      throw new ValidationError('Workflow nodes object is required');
    }

    if (!graph.start || !graph.nodes[graph.start]) {
      throw new ValidationError('Valid start node is required');
    }

    // Validate each node
    for (const [nodeId, node] of Object.entries(graph.nodes)) {
      if (!node.type) {
        throw new ValidationError(`Node ${nodeId} missing type`);
      }

      if (node.type === 'action' && !node.action) {
        throw new ValidationError(`Action node ${nodeId} missing action name`);
      }

      if (node.next && !graph.nodes[node.next]) {
        throw new ValidationError(`Node ${nodeId} references unknown next node: ${node.next}`);
      }
    }
  }

  /**
   * Generate unique workflow execution ID
   * @returns {string} Workflow ID
   */
  generateWorkflowId() {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log message with structured format
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    const logLevels = ['error', 'warn', 'info', 'debug', 'trace'];
    const currentLevelIndex = logLevels.indexOf(this.config.logLevel);
    const messageLevelIndex = logLevels.indexOf(level);

    if (messageLevelIndex > currentLevelIndex) return;

    const entry = {
      level,
      message,
      timestamp: Date.now(),
      ...meta
    };

    const logMethod = console[level] || console.log;
    logMethod(`SW5E Helper | Coordinator: ${message}`, meta);

    // Emit logging hook for external handlers
    Hooks.callAll('sw5e-helper.coordinator.log', entry);
  }
}

export default WorkflowCoordinator;