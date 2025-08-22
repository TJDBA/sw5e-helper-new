/**
 * Workflow Test Runner
 * Executes comprehensive tests of the advanced attack workflow
 */

import { WorkflowCoordinator } from '../coordinator.js';
import { 
  ATTACK_WORKFLOW_DEFINITION, 
  WORKFLOW_CONDITIONS,
  FreezeTargetsAction,
  TEST_CONFIG,
  TEST_SCENARIOS,
  ROLLBACK_SCENARIO,
  CANCELLATION_SCENARIO 
} from './attack-workflow.js';

/**
 * Test runner for workflow coordinator
 */
export class WorkflowTestRunner {
  constructor() {
    this.coordinator = null;
    this.testResults = [];
    this.activeTest = null;
    this.logEntries = [];
  }

  /**
   * Initialize test environment
   */
  async initialize() {
    console.log('SW5E Helper: Initializing workflow test environment');

    // Create coordinator instance
    this.coordinator = new WorkflowCoordinator();
    await this.coordinator.init();

    // Register test action
    this.coordinator.registerAction('freezeTargets', FreezeTargetsAction);

    // Extend condition evaluator
    this.coordinator.evaluateCondition = (condition, context) => {
      if (WORKFLOW_CONDITIONS[condition]) {
        return WORKFLOW_CONDITIONS[condition](context);
      }
      
      // Fallback to default evaluation
      return this.coordinator.constructor.prototype.evaluateCondition.call(
        this.coordinator, condition, context
      );
    };

    // Define the test workflow
    this.coordinator.defineWorkflow(
      ATTACK_WORKFLOW_DEFINITION.name, 
      ATTACK_WORKFLOW_DEFINITION
    );

    // Set up logging capture
    this.setupLogging();

    console.log('SW5E Helper: Test environment initialized');
  }

  /**
   * Set up logging to capture test execution details
   */
  setupLogging() {
    // Hook into coordinator logging
    Hooks.on('sw5e-helper.coordinator.log', (entry) => {
      this.logEntries.push({
        ...entry,
        testName: this.activeTest
      });
    });

    // Hook into workflow events for test monitoring
    Hooks.on('sw5e-helper.workflow.completed', (data) => {
      console.log(`Test workflow ${data.workflow} completed`, data);
    });

    Hooks.on('sw5e-helper.workflow.failed', (data) => {
      console.error(`Test workflow ${data.workflow} failed`, data);
    });

    Hooks.on('sw5e-helper.workflow.paused', (data) => {
      console.log(`Test workflow ${data.workflow} paused at token: ${data.resumeToken}`);
    });
  }

  /**
   * Run all test scenarios
   */
  async runAllTests() {
    console.log('SW5E Helper: Starting comprehensive workflow tests');

    try {
      await this.initialize();

      // Test 1: Sequential and conditional execution
      await this.testSequentialFlow();

      // Test 2: Parallel execution
      await this.testParallelExecution();

      // Test 3: Pause and resume
      await this.testPauseResume();

      // Test 4: Rollback and compensation
      await this.testRollbackCompensation();

      // Test 5: Cancellation
      await this.testCancellation();

      // Test 6: Error handling
      await this.testErrorHandling();

      // Generate test report
      this.generateTestReport();

    } catch (error) {
      console.error('SW5E Helper: Test suite failed', error);
      return false;
    }

    console.log('SW5E Helper: All workflow tests completed');
    return true;
  }

  /**
   * Test sequential and conditional workflow execution
   */
  async testSequentialFlow() {
    this.activeTest = 'Sequential Flow Test';
    console.log(`\n=== ${this.activeTest} ===`);

    const context = this.createTestContext(TEST_SCENARIOS.allHitAllFail);
    
    const result = await this.coordinator.execute(
      ATTACK_WORKFLOW_DEFINITION.name,
      context,
      { logLevel: 'debug' }
    );

    this.testResults.push({
      name: this.activeTest,
      success: result.ok,
      duration: result.meta?.duration || 0,
      details: {
        stepsExecuted: result.meta?.steps?.length || 0,
        errors: result.errors,
        finalState: result.type
      }
    });

    console.log(`Sequential test result:`, result);
  }

  /**
   * Test parallel execution capabilities
   */
  async testParallelExecution() {
    this.activeTest = 'Parallel Execution Test';
    console.log(`\n=== ${this.activeTest} ===`);

    // Create context with multiple targets
    const context = this.createTestContext(TEST_SCENARIOS.mixedResults);
    context.targetIds = ['target1', 'target2', 'target3', 'target4'];

    const startTime = Date.now();
    const result = await this.coordinator.execute(
      ATTACK_WORKFLOW_DEFINITION.name,
      context,
      { logLevel: 'info' }
    );
    const duration = Date.now() - startTime;

    this.testResults.push({
      name: this.activeTest,
      success: result.ok,
      duration,
      details: {
        parallelBranches: result.meta?.parallelBranches || 0,
        targetCount: context.targetIds.length,
        errors: result.errors
      }
    });

    console.log(`Parallel test result:`, result);
  }

  /**
   * Test pause and resume functionality
   */
  async testPauseResume() {
    this.activeTest = 'Pause/Resume Test';
    console.log(`\n=== ${this.activeTest} ===`);

    const context = this.createTestContext(TEST_SCENARIOS.allHitAllSave);
    
    // First execution - should pause
    const pauseResult = await this.coordinator.execute(
      ATTACK_WORKFLOW_DEFINITION.name,
      context,
      { logLevel: 'debug' }
    );

    if (pauseResult.type !== 'workflow-paused') {
      throw new Error('Expected workflow to pause');
    }

    console.log('Workflow paused successfully, resumeToken:', pauseResult.data.resumeToken);

    // Wait a moment to simulate user review
    await this.sleep(1000);

    // Resume execution
    const resumeResult = await this.coordinator.execute(
      ATTACK_WORKFLOW_DEFINITION.name,
      { ...context, modified: true }, // Test context merging
      { 
        resumeToken: pauseResult.data.resumeToken,
        logLevel: 'debug' 
      }
    );

    this.testResults.push({
      name: this.activeTest,
      success: pauseResult.ok && resumeResult.ok,
      duration: (pauseResult.meta?.duration || 0) + (resumeResult.meta?.duration || 0),
      details: {
        pausedAt: pauseResult.meta?.paused ? 'pauseForDamageReview' : 'unknown',
        resumedSuccessfully: resumeResult.ok,
        contextMerged: resumeResult.context?.modified === true,
        errors: [...(pauseResult.errors || []), ...(resumeResult.errors || [])]
      }
    });

    console.log('Pause result:', pauseResult);
    console.log('Resume result:', resumeResult);
  }

  /**
   * Test rollback and compensation
   */
  async testRollbackCompensation() {
    this.activeTest = 'Rollback/Compensation Test';
    console.log(`\n=== ${this.activeTest} ===`);

    // Create a workflow that will fail at damage application
    const failingWorkflow = {
      ...ATTACK_WORKFLOW_DEFINITION,
      name: 'failingAttackWorkflow',
      nodes: {
        ...ATTACK_WORKFLOW_DEFINITION.nodes,
        // Override apply node to force failure
        applyDamageToTargets: {
          type: 'action',
          action: 'forcedFailure',
          next: 'workflowComplete',
          description: 'Simulated failure for testing rollback'
        }
      }
    };

    // Register failing action
    this.coordinator.registerAction('forcedFailure', {
      name: 'forcedFailure',
      validate: () => {},
      checkPermission: () => {},
      execute: async () => {
        throw new Error('Simulated failure for rollback testing');
      },
      compensate: async (context, result) => {
        console.log('SW5E Test: ForcedFailure compensation called');
      }
    });

    this.coordinator.defineWorkflow(failingWorkflow.name, failingWorkflow);

    const context = this.createTestContext(TEST_SCENARIOS.allHitAllFail);
    
    // Capture compensation events
    const compensationEvents = [];
    const compensationHandler = (data) => {
      compensationEvents.push(data);
    };
    
    Hooks.on('sw5e-helper.workflow.compensate', compensationHandler);
    Hooks.on('sw5e-helper.action.compensated', compensationHandler);

    try {
      const result = await this.coordinator.execute(
        failingWorkflow.name,
        context,
        { logLevel: 'debug' }
      );

      this.testResults.push({
        name: this.activeTest,
        success: !result.ok && compensationEvents.length > 0, // Should fail but compensate
        duration: result.meta?.duration || 0,
        details: {
          expectedFailure: !result.ok,
          compensationSteps: compensationEvents.length,
          compensationEvents: compensationEvents.map(e => e.step || e.action),
          errors: result.errors
        }
      });

      console.log('Rollback test result:', result);
      console.log('Compensation events:', compensationEvents);

    } finally {
      Hooks.off('sw5e-helper.workflow.compensate', compensationHandler);
      Hooks.off('sw5e-helper.action.compensated', compensationHandler);
    }
  }

  /**
   * Test workflow cancellation via AbortSignal
   */
  async testCancellation() {
    this.activeTest = 'Cancellation Test';
    console.log(`\n=== ${this.activeTest} ===`);

    const context = this.createTestContext(TEST_SCENARIOS.mixedResults);
    const abortController = new AbortController();

    // Cancel after 2 seconds
    const cancelTimer = setTimeout(() => {
      console.log('SW5E Test: Cancelling workflow execution');
      abortController.abort();
    }, 2000);

    try {
      const result = await this.coordinator.execute(
        ATTACK_WORKFLOW_DEFINITION.name,
        context,
        { 
          signal: abortController.signal,
          logLevel: 'debug' 
        }
      );

      clearTimeout(cancelTimer);

      this.testResults.push({
        name: this.activeTest,
        success: !result.ok && result.errors.some(e => e.includes('abort')),
        duration: result.meta?.duration || 0,
        details: {
          wasCancelled: !result.ok,
          errors: result.errors,
          partialSteps: result.meta?.steps?.length || 0
        }
      });

      console.log('Cancellation test result:', result);

    } catch (error) {
      clearTimeout(cancelTimer);
      throw error;
    }
  }

  /**
   * Test error handling and validation
   */
  async testErrorHandling() {
    this.activeTest = 'Error Handling Test';
    console.log(`\n=== ${this.activeTest} ===`);

    const testCases = [
      {
        name: 'Invalid workflow',
        test: () => this.coordinator.execute('nonExistentWorkflow', {})
      },
      {
        name: 'Missing context',
        test: () => this.coordinator.execute(ATTACK_WORKFLOW_DEFINITION.name, null)
      },
      {
        name: 'Invalid context',
        test: () => this.coordinator.execute(ATTACK_WORKFLOW_DEFINITION.name, { invalid: true })
      }
    ];

    const errorResults = [];

    for (const testCase of testCases) {
      try {
        const result = await testCase.test();
        errorResults.push({
          name: testCase.name,
          success: !result.ok, // Should fail gracefully
          errors: result.errors
        });
      } catch (error) {
        errorResults.push({
          name: testCase.name,
          success: true, // Caught expected error
          errors: [error.message]
        });
      }
    }

    this.testResults.push({
      name: this.activeTest,
      success: errorResults.every(r => r.success),
      duration: 0,
      details: { testCases: errorResults }
    });

    console.log('Error handling results:', errorResults);
  }

  /**
   * Create test execution context
   */
  createTestContext(scenario) {
    return {
      actorId: 'test-actor-123',
      itemId: 'test-weapon-456',
      targetIds: ['target1', 'target2', 'target3'],
      config: {
        scenario: scenario.name,
        attack: {
          advantage: 'normal',
          modifier: scenario.attackMods
        },
        save: {
          ability: TEST_CONFIG.save.ability,
          dc: TEST_CONFIG.save.dc,
          modifier: scenario.saveMods
        },
        damage: TEST_CONFIG.damage
      },
      flags: {
        test: true,
        scenario: scenario.name
      }
    };
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    console.log('\n=== WORKFLOW TEST REPORT ===');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average Duration: ${(totalDuration / totalTests).toFixed(0)}ms`);

    console.log('\nDetailed Results:');
    this.testResults.forEach(test => {
      const status = test.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name} (${test.duration}ms)`);
      
      if (!test.success) {
        console.log(`  Errors:`, test.details.errors);
      }
      
      if (test.details) {
        Object.entries(test.details).forEach(([key, value]) => {
          if (key !== 'errors') {
            console.log(`  ${key}:`, value);
          }
        });
      }
    });

    // Log level distribution
    const logLevels = this.logEntries.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + 1;
      return acc;
    }, {});

    console.log('\nLogging Summary:');
    console.log(`Total Log Entries: ${this.logEntries.length}`);
    Object.entries(logLevels).forEach(([level, count]) => {
      console.log(`  ${level.toUpperCase()}: ${count}`);
    });

    return {
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: (passedTests / totalTests) * 100,
        totalDuration,
        averageDuration: totalDuration / totalTests
      },
      tests: this.testResults,
      logs: this.logEntries,
      logLevels
    };
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function to run all tests
 */
export async function runWorkflowTests() {
  const runner = new WorkflowTestRunner();
  const success = await runner.runAllTests();
  
  if (success) {
    console.log('✅ All workflow tests completed successfully');
  } else {
    console.error('❌ Some workflow tests failed');
  }
  
  return success;
}

export default WorkflowTestRunner;