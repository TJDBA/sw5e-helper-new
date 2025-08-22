# SW5E Helper Workflow Hook Events

This document describes all hook events emitted by the SW5E Helper Workflow Coordinator and Actions.

## Workflow Lifecycle Events

### `sw5e-helper.workflow.preStep`
Fired before each workflow step execution.

**Payload:**
```javascript
{
  workflow: "workflowName",    // Workflow name
  step: "stepId",              // Current step identifier
  context: { ... }             // Execution context
}
```

### `sw5e-helper.workflow.postStep`
Fired after each workflow step completion.

**Payload:**
```javascript
{
  workflow: "workflowName",    // Workflow name
  step: "stepId",              // Current step identifier
  context: { ... },            // Execution context
  result: { ... }              // Step execution result
}
```

### `sw5e-helper.workflow.compensate`
Fired during compensation phase for each compensated step.

**Payload:**
```javascript
{
  workflow: "workflowId",      // Workflow execution ID
  step: "stepId",              // Step being compensated
  context: { ... },            // Original execution context
  result: { ... }              // Original step result
}
```

### `sw5e-helper.workflow.completed`
Fired when workflow completes successfully.

**Payload:**
```javascript
{
  workflow: "workflowName",    // Workflow name
  context: { ... },            // Final execution context
  results: { ... }             // Complete workflow results
}
```

### `sw5e-helper.workflow.failed`
Fired when workflow execution fails.

**Payload:**
```javascript
{
  workflow: "workflowName",    // Workflow name
  context: { ... },            // Execution context at failure
  error: [...],                // Error messages array
  results: { ... }             // Partial results before failure
}
```

### `sw5e-helper.workflow.paused`
Fired when workflow is paused at a pause node.

**Payload:**
```javascript
{
  workflow: "workflowName",    // Workflow name
  context: { ... },            // Context at pause point
  resumeToken: "token"         // Resume token for continuing
}
```

### `sw5e-helper.workflow.resumed`
Fired when workflow is resumed from a pause.

**Payload:**
```javascript
{
  workflow: "workflowName",    // Workflow name
  context: { ... },            // Resumed context
  fromStep: "stepId"           // Step ID where resumption occurred
}
```

## Action Lifecycle Events

### `sw5e-helper.action.preExecute`
Fired before any action execution (within workflow or standalone).

**Payload:**
```javascript
{
  action: "actionName",        // Action name (attack, damage, save, apply)
  context: { ... }             // Action execution context
}
```

### `sw5e-helper.action.postExecute`
Fired after action execution completes.

**Payload:**
```javascript
{
  action: "actionName",        // Action name
  context: { ... },            // Action execution context
  result: { ... }              // Action execution result
}
```

### `sw5e-helper.action.compensated`
Fired when action is compensated during rollback.

**Payload:**
```javascript
{
  action: "actionName",        // Action name
  context: { ... },            // Original action context
  result: { ... }              // Original action result
}
```

## Coordinator Logging Events

### `sw5e-helper.coordinator.log`
Fired for all coordinator log entries (useful for external log handlers).

**Payload:**
```javascript
{
  level: "info",               // Log level (error, warn, info, debug, trace)
  message: "Log message",      // Log message text
  workflow: "workflowName",    // Workflow name (if applicable)
  step: "stepId",              // Step ID (if applicable)
  action: "actionName",        // Action name (if applicable)
  ctxIds: {                    // Context identifiers
    workflowId: "wf_123",
    actorId: "actor123",
    itemId: "item456",
    messageId: "msg789"
  },
  duration: 150,               // Step execution time in ms (if applicable)
  attempt: 1,                  // Retry attempt number (if applicable)
  timestamp: 1640995200000,    // Unix timestamp
  meta: { ... }                // Additional context data
}
```

## Legacy Hook Events (Maintained for Compatibility)

These hooks continue to be emitted by existing action handlers:

### Attack Action Hooks
- `sw5eHelper.preAttackRoll` - Before attack roll
- `sw5eHelper.postAttackRoll` - After attack roll
- `sw5eHelper.attackComplete` - Attack workflow complete

### Damage Action Hooks
- `sw5eHelper.preDamageRoll` - Before damage roll
- `sw5eHelper.postDamageRoll` - After damage roll
- `sw5eHelper.damageComplete` - Damage workflow complete

### Save Action Hooks
- `sw5eHelper.preSaveRoll` - Before save roll
- `sw5eHelper.postSaveRoll` - After save roll
- `sw5eHelper.saveComplete` - Save workflow complete

### Apply Action Hooks
- `sw5eHelper.preApplyDamage` - Before damage application
- `sw5eHelper.postApplyDamage` - After damage application

## Usage Examples

### Listening to Workflow Events
```javascript
// Listen for workflow completion
Hooks.on('sw5e-helper.workflow.completed', (data) => {
  console.log(`Workflow ${data.workflow} completed successfully`);
  console.log('Final results:', data.results);
});

// Listen for workflow failures
Hooks.on('sw5e-helper.workflow.failed', (data) => {
  ui.notifications.error(`Workflow ${data.workflow} failed: ${data.error.join(', ')}`);
});
```

### Listening to Action Events
```javascript
// Monitor all action executions
Hooks.on('sw5e-helper.action.postExecute', (data) => {
  if (data.action === 'attack' && !data.result.ok) {
    ui.notifications.warn(`Attack failed: ${data.result.errors.join(', ')}`);
  }
});
```

### Custom Logging Handler
```javascript
// Redirect coordinator logs to external service
Hooks.on('sw5e-helper.coordinator.log', (entry) => {
  if (entry.level === 'error') {
    // Send to error tracking service
    ExternalLogger.error(entry);
  }
});
```

### Workflow State Tracking
```javascript
// Track workflow progress in UI
Hooks.on('sw5e-helper.workflow.preStep', (data) => {
  updateProgressUI(data.workflow, data.step);
});

Hooks.on('sw5e-helper.workflow.postStep', (data) => {
  if (data.result.ok) {
    markStepComplete(data.workflow, data.step);
  } else {
    markStepFailed(data.workflow, data.step, data.result.errors);
  }
});
```

## Hook Event Order

For a typical workflow execution, events fire in this order:

1. `sw5e-helper.workflow.preStep` (for each step)
2. `sw5e-helper.action.preExecute` (if step is action)
3. `sw5e-helper.action.postExecute` (if step is action)
4. `sw5e-helper.workflow.postStep` (for each step)
5. `sw5e-helper.workflow.completed` (on success) OR `sw5e-helper.workflow.failed` (on failure)
6. `sw5e-helper.workflow.compensate` (for each compensated step, in reverse order, if failure occurred)
7. `sw5e-helper.action.compensated` (for each compensated action, if failure occurred)

## Error Handling in Hooks

Hook listeners should handle errors gracefully to avoid breaking workflow execution:

```javascript
Hooks.on('sw5e-helper.workflow.completed', (data) => {
  try {
    // Your hook logic here
    processWorkflowResults(data);
  } catch (error) {
    console.error('Hook handler error:', error);
    // Don't re-throw - let workflow complete normally
  }
});
```