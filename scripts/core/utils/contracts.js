/**
 * Contract Validation Utilities
 * Helper functions for validating action contracts and standardized objects
 */

/**
 * Create a standard validation result
 * @param {boolean} ok - Whether validation passed
 * @param {string[]} errors - Error messages
 * @param {string[]} warnings - Warning messages
 * @returns {object} Standard validation result
 */
export function createValidationResult(ok = true, errors = [], warnings = []) {
  return { ok, errors, warnings };
}

/**
 * Create a standard permission result
 * @param {boolean} ok - Whether permission check passed
 * @param {string} reason - Failure reason if applicable
 * @returns {object} Standard permission result
 */
export function createPermissionResult(ok = true, reason = undefined) {
  return { ok, reason };
}

/**
 * Create a standard Result object
 * @param {string} type - Action type
 * @param {boolean} ok - Whether action succeeded
 * @param {object} options - Additional result properties
 * @returns {object} Standard Result object
 */
export function createResult(type, ok = false, options = {}) {
  return {
    ok,
    type,
    data: options.data || null,
    errors: options.errors || [],
    warnings: options.warnings || [],
    meta: {
      duration: options.duration,
      workflowId: options.workflowId,
      actorId: options.actorId,
      itemId: options.itemId,
      timestamp: Date.now(),
      ...options.meta
    },
    rolls: options.rolls || [],
    effects: options.effects || []
  };
}

/**
 * Create a successful Result object
 * @param {string} type - Action type
 * @param {object} data - Result data
 * @param {object} options - Additional options
 * @returns {object} Successful Result object
 */
export function createSuccessResult(type, data = null, options = {}) {
  return createResult(type, true, { data, ...options });
}

/**
 * Create a failed Result object
 * @param {string} type - Action type
 * @param {string[]} errors - Error messages
 * @param {object} options - Additional options
 * @returns {object} Failed Result object
 */
export function createErrorResult(type, errors = [], options = {}) {
  return createResult(type, false, { errors, ...options });
}

/**
 * Validate that an object conforms to the Context contract
 * @param {object} context - Context to validate
 * @returns {object} Validation result
 */
export function validateContext(context) {
  const errors = [];
  const warnings = [];

  if (!context || typeof context !== 'object') {
    errors.push("Context must be an object");
    return createValidationResult(false, errors, warnings);
  }

  // Required fields
  if (typeof context.actorId !== 'string') {
    errors.push("Context.actorId must be a string");
  }

  // Optional but typed fields
  if (context.itemId !== undefined && typeof context.itemId !== 'string') {
    errors.push("Context.itemId must be a string if provided");
  }

  if (context.targetIds !== undefined && !Array.isArray(context.targetIds)) {
    errors.push("Context.targetIds must be an array if provided");
  } else if (context.targetIds && !context.targetIds.every(id => typeof id === 'string')) {
    errors.push("All context.targetIds must be strings");
  }

  if (context.messageId !== undefined && typeof context.messageId !== 'string') {
    errors.push("Context.messageId must be a string if provided");
  }

  if (context.workflowId !== undefined && typeof context.workflowId !== 'string') {
    errors.push("Context.workflowId must be a string if provided");
  }

  if (context.userId !== undefined && typeof context.userId !== 'string') {
    errors.push("Context.userId must be a string if provided");
  }

  if (context.timestamp !== undefined && typeof context.timestamp !== 'number') {
    errors.push("Context.timestamp must be a number if provided");
  }

  // Check if context is serializable
  try {
    JSON.stringify(context);
  } catch (error) {
    errors.push("Context must be serializable (JSON.stringify failed)");
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}

/**
 * Validate that an object conforms to the Result contract
 * @param {object} result - Result to validate
 * @returns {object} Validation result
 */
export function validateResult(result) {
  const errors = [];
  const warnings = [];

  if (!result || typeof result !== 'object') {
    errors.push("Result must be an object");
    return createValidationResult(false, errors, warnings);
  }

  // Required fields
  if (typeof result.ok !== 'boolean') {
    errors.push("Result.ok must be a boolean");
  }

  if (typeof result.type !== 'string') {
    errors.push("Result.type must be a string");
  }

  if (!Array.isArray(result.errors)) {
    errors.push("Result.errors must be an array");
  } else if (!result.errors.every(e => typeof e === 'string')) {
    errors.push("All Result.errors must be strings");
  }

  if (!Array.isArray(result.warnings)) {
    errors.push("Result.warnings must be an array");
  } else if (!result.warnings.every(w => typeof w === 'string')) {
    errors.push("All Result.warnings must be strings");
  }

  if (result.meta !== undefined && (typeof result.meta !== 'object' || result.meta === null)) {
    errors.push("Result.meta must be an object if provided");
  }

  if (result.rolls !== undefined && !Array.isArray(result.rolls)) {
    errors.push("Result.rolls must be an array if provided");
  }

  if (result.effects !== undefined && !Array.isArray(result.effects)) {
    errors.push("Result.effects must be an array if provided");
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}

/**
 * Validate that a class conforms to the Action contract
 * @param {Function} ActionClass - Action class to validate
 * @returns {object} Validation result
 */
export function validateActionContract(ActionClass) {
  const errors = [];
  const warnings = [];

  if (!ActionClass || typeof ActionClass !== 'function') {
    errors.push("ActionClass must be a constructor function");
    return createValidationResult(false, errors, warnings);
  }

  // Check required static properties
  if (typeof ActionClass.name !== 'string') {
    errors.push("ActionClass.name must be a string");
  }

  // Check required static methods
  const requiredMethods = ['validate', 'checkPermission', 'execute'];
  for (const method of requiredMethods) {
    if (typeof ActionClass[method] !== 'function') {
      errors.push(`ActionClass.${method} must be a function`);
    }
  }

  // Check optional methods
  const optionalMethods = ['compensate', 'idempotencyKey'];
  for (const method of optionalMethods) {
    if (ActionClass[method] !== undefined && typeof ActionClass[method] !== 'function') {
      warnings.push(`ActionClass.${method} should be a function if provided`);
    }
  }

  return createValidationResult(errors.length === 0, errors, warnings);
}

/**
 * Test an action's contract compliance by calling methods with sample data
 * @param {Function} ActionClass - Action class to test
 * @param {object} sampleContext - Sample context for testing
 * @returns {Promise<object>} Test result
 */
export async function testActionContract(ActionClass, sampleContext = {}) {
  const results = {
    validate: { ok: false, errors: [] },
    checkPermission: { ok: false, errors: [] },
    execute: { ok: false, errors: [] },
    overall: { ok: false, errors: [] }
  };

  // Test validate method
  try {
    const validateResult = ActionClass.validate(sampleContext);
    if (typeof validateResult !== 'object' || typeof validateResult.ok !== 'boolean') {
      results.validate.errors.push("validate() must return {ok: boolean, errors: string[], warnings: string[]}");
    } else {
      results.validate.ok = true;
    }
  } catch (error) {
    results.validate.errors.push(`validate() threw error: ${error.message}`);
  }

  // Test checkPermission method
  try {
    const permissionResult = ActionClass.checkPermission(sampleContext);
    if (typeof permissionResult !== 'object' || typeof permissionResult.ok !== 'boolean') {
      results.checkPermission.errors.push("checkPermission() must return {ok: boolean, reason?: string}");
    } else {
      results.checkPermission.ok = true;
    }
  } catch (error) {
    results.checkPermission.errors.push(`checkPermission() threw error: ${error.message}`);
  }

  // Test execute method (only if previous tests passed)
  if (results.validate.ok && results.checkPermission.ok) {
    try {
      const executeResult = await ActionClass.execute(sampleContext);
      const validation = validateResult(executeResult);
      if (!validation.ok) {
        results.execute.errors.push(...validation.errors);
      } else {
        results.execute.ok = true;
      }
    } catch (error) {
      results.execute.errors.push(`execute() threw error: ${error.message}`);
    }
  }

  // Overall result
  results.overall.ok = results.validate.ok && results.checkPermission.ok && results.execute.ok;
  results.overall.errors = [
    ...results.validate.errors,
    ...results.checkPermission.errors,
    ...results.execute.errors
  ];

  return results;
}

/**
 * Utility to wrap legacy functions to return standard Result objects
 * @param {Function} legacyFn - Legacy function to wrap
 * @param {string} type - Action type for result
 * @returns {Function} Wrapped function that returns Result object
 */
export function wrapLegacyFunction(legacyFn, type) {
  return async function(...args) {
    const startTime = Date.now();
    
    try {
      const legacyResult = await legacyFn.apply(this, args);
      
      return createSuccessResult(type, legacyResult, {
        duration: Date.now() - startTime
      });
    } catch (error) {
      return createErrorResult(type, [error.message || 'Unknown error'], {
        duration: Date.now() - startTime
      });
    }
  };
}

export default {
  createValidationResult,
  createPermissionResult,
  createResult,
  createSuccessResult,
  createErrorResult,
  validateContext,
  validateResult,
  validateActionContract,
  testActionContract,
  wrapLegacyFunction
};