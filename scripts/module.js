/**
 * SW5E Helper - Main Module Entry Point
 * Enhanced attack and damage dialogs with preset support for SW5E system
 */

import { CONFIG, validateRequirements, isDebug } from './config.js';
import { installAPI, uninstallAPI } from './api.js';

// Import all subsystems
import core from './core/index.js';
import ui from './ui/index.js';
import workflow from './workflow/index.js';
import data from './data/index.js';
import integrations from './integrations/index.js';

/**
 * Main Module Class
 */
class SW5EHelper {
  constructor() {
    this.ready = false;
    this.core = core;
    this.ui = ui;
    this.workflow = workflow;
    this.data = data;
    this.integrations = integrations;
  }

  /**
   * Initialize the module
   */
  async init() {
    console.log("SW5E Helper: Initializing...");

    try {
      // Validate requirements
      console.log("SW5E Helper: Validating requirements...");
      const validation = validateRequirements();
      if (!validation.valid) {
        console.error("SW5E Helper: Requirements not met:", validation.issues);
        console.error(`SW5E Helper: ${validation.issues.join(', ')}`);
        return;
      }

      // Register settings
      console.log("SW5E Helper: Registering settings...");
      this.registerSettings();

      // Register templates
      console.log("SW5E Helper: Registering templates...");
      await this.registerTemplates();

      // Initialize subsystems
      console.log("SW5E Helper: Initializing subsystems...");
      await this.initializeSubsystems();

      // Install API
      console.log("SW5E Helper: Installing API...");
      installAPI();

      // Mark as ready
      this.ready = true;
      
      console.log("SW5E Helper: Initialization complete - API should now be available");
      
      // Fire ready hook
      Hooks.callAll("sw5eHelper.ready", this);

    } catch (error) {
      console.error("SW5E Helper: Initialization failed", error);
      console.error("Stack trace:", error?.stack);
      console.error("SW5E Helper: Initialization failed - see console for details");
    }
  }

  /**
   * Register module settings
   */
  registerSettings() {
    if (isDebug()) {
      console.log("SW5E Helper: Registering settings");
    }

    try {
      data.StorageManager.registerSettings();
    } catch (error) {
      console.error("SW5E Helper: Failed to register settings", error);
    }
  }

  /**
   * Register Handlebars templates
   */
  async registerTemplates() {
    if (isDebug()) {
      console.log("SW5E Helper: Registering templates");
    }

    const templatePaths = [
      CONFIG.templates.attack,
      CONFIG.templates.damage,
      CONFIG.templates.card
    ];

    try {
      await loadTemplates(templatePaths);
    } catch (error) {
      console.error("SW5E Helper: Failed to load templates", error);
    }

    try {
      await loadTemplates(templatePaths);
      
      // Verify templates loaded
      if (isDebug()) {
        console.log("SW5E Helper: Templates loaded successfully");
        console.log("Available partials:", Object.keys(Handlebars.partials));
      }
      } catch (error) {
        console.error("SW5E Helper: Failed to load templates", error);
    }

    try {
      Handlebars.registerHelper('localize', function(key, options) {
        return game.i18n?.localize?.(key) ?? key;
      });
    } catch (error) {
      console.error("SW5E Helper: Failed to load templates - localize", error);
    }
      
    try {
      Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
      });
    } catch (error) {
      console.error("SW5E Helper: Failed to load templates - function", error);
    }
    
    try {  
      Handlebars.registerHelper('capitalize', function(str) {
        return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
      });
    } catch (error) {
      console.error("SW5E Helper: Failed to load templates - capitalize", error);
    }
      
    try {
      Handlebars.registerHelper('uppercase', function(str) {
        return String(str || '').toUpperCase();
      });
    } catch (error) {
      console.error("SW5E Helper: Failed to load templates - uppercase", error);
    }

  }

  /**
   * Initialize all subsystems
   */
  async initializeSubsystems() {
    if (isDebug()) {
      console.log("SW5E Helper: Initializing subsystems");
    }

    // Initialize in dependency order
    await this.initializeCore();
    await this.initializeUI();
    await this.initializeWorkflow();
    await this.initializeData();
    await this.initializeIntegrations();
  }

  /**
   * Initialize core systems
   */
  async initializeCore() {
    // Core systems are mostly static, no special initialization needed
    if (isDebug()) {
      console.log("SW5E Helper: Core systems initialized");
    }
  }

  /**
   * Initialize UI systems
   */
  async initializeUI() {
    // Initialize card handlers
    ui.cards.CardHandlers.init();

    if (isDebug()) {
      console.log("SW5E Helper: UI systems initialized");
    }
  }

  /**
   * Initialize workflow systems
   */
  async initializeWorkflow() {
    // Initialize workflow orchestrator
    if (workflow.WorkflowOrchestrator?.init) {
      workflow.WorkflowOrchestrator.init();
      
      // Store the WorkflowOrchestrator class for API access
      this.workflowOrchestrator = workflow.WorkflowOrchestrator;
    }

    // Initialize workflow coordinator
    if (workflow.WorkflowCoordinator) {
      const coordinator = new workflow.WorkflowCoordinator();
      await coordinator.init();
      
      // Store coordinator instance for API access
      this.coordinator = coordinator;
    }

    // Initialize workflow hooks
    if (workflow.WorkflowHooks?.init) {
      workflow.WorkflowHooks.init();
    }

    if (isDebug()) {
      console.log("SW5E Helper: Workflow systems initialized", {
        orchestrator: !!this.workflowOrchestrator,
        coordinator: !!this.coordinator
      });
    }
  }

  /**
   * Initialize data systems
   */
  async initializeData() {
    // Run migrations if needed
    await data.MigrationManager.runMigrations();

    // Set up cleanup tasks
    this.scheduleCleanupTasks();

    if (isDebug()) {
      console.log("SW5E Helper: Data systems initialized");
    }
  }

  /**
   * Initialize integration systems
   */
  async initializeIntegrations() {
    // Initialize SW5E adapter
    integrations.SW5EAdapter.init();

    // Initialize feature registry
    integrations.features.FeatureRegistry.init();

    if (isDebug()) {
      console.log("SW5E Helper: Integration systems initialized");
    }
  }

  /**
   * Schedule periodic cleanup tasks
   */
  scheduleCleanupTasks() {
    // Clean up caches every hour
    setInterval(() => {
      core.utils.GlobalCache.cleanupAll();
    }, 60 * 60 * 1000);

    // Clean up old presets daily (if enabled)
    const cleanupDays = data.StorageManager.getSetting("presetCleanupDays");
    if (cleanupDays > 0) {
      setInterval(async () => {
        await data.StorageManager.cleanupStorage({
          maxPresetAge: cleanupDays * 24 * 60 * 60 * 1000
        });
      }, 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Shutdown the module
   */
  shutdown() {
    console.log("SW5E Helper: Shutting down");

    try {
      // Uninstall API
      uninstallAPI();

      // Clear caches
      core.utils.GlobalCache.clearAll();

      // Mark as not ready
      this.ready = false;

      console.log("SW5E Helper: Shutdown complete");
    } catch (error) {
      console.error("SW5E Helper: Shutdown error", error);
    }
  }

  /**
   * Get module information
   */
  getInfo() {
    return {
      id: CONFIG.module.id,
      name: CONFIG.module.name,
      version: CONFIG.module.version,
      ready: this.ready,
      system: game.system.id,
      foundry: game.version
    };
  }
}

// Create module instance
const sw5eHelper = new SW5EHelper();

// Make available globally for debugging and coordinator access
globalThis.sw5eHelperModule = sw5eHelper;

// Foundry hooks
Hooks.once("ready", () => {
  console.log("SW5E Helper: Foundry ready, initializing module...");
  sw5eHelper.init();
  
  if (isDebug()) {
    console.log("SW5E Helper: Module status after initialization:", sw5eHelper.getInfo());
  }
});

// Handle hot reload in development (only if available)
if (typeof module !== 'undefined' && module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    sw5eHelper.shutdown();
  });
}

export default sw5eHelper;