#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// File contents
const files = {
  'module.json': `{
  "id": "sw5e-helper",
  "title": "SW5E Helper",
  "description": "Enhanced attack and damage workflow for SW5E",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "11",
    "verified": "12"
  },
  "authors": [{
    "name": "Your Name",
    "discord": "yourname"
  }],
  "esmodules": ["scripts/module.js"],
  "styles": [
    "styles/module.css",
    "styles/dialogs.css", 
    "styles/cards.css"
  ],
  "languages": [{
    "lang": "en",
    "name": "English",
    "path": "lang/en.json"
  }],
  "systems": [{
    "id": "sw5e",
    "manifest": "https://raw.githubusercontent.com/sw5e-foundry/sw5e/master/static/system.json"
  }],
  "url": "https://github.com/yourusername/sw5e-helper",
  "manifest": "https://raw.githubusercontent.com/yourusername/sw5e-helper/main/module.json",
  "download": "https://github.com/yourusername/sw5e-helper/releases/latest/download/module.zip"
}`,

  'scripts/module.js': `import { SW5EHelper } from "./api.js";
import { CONFIG } from "./config.js";
import { WorkflowOrchestrator } from "./workflow/orchestrator.js";
import { HookRegistry } from "./workflow/hooks.js";
import { CardHandlers } from "./ui/cards/handlers.js";

Hooks.once("init", () => {
  console.log("SW5E Helper | Initializing");
  
  // Register module configuration
  game.sw5eHelper = {
    api: SW5EHelper,
    config: CONFIG,
    workflow: new WorkflowOrchestrator()
  };
  
  // Register settings
  registerSettings();
  
  // Preload templates
  loadTemplates([
    "modules/sw5e-helper/templates/dialogs/attack-dialog.hbs",
    "modules/sw5e-helper/templates/dialogs/damage-dialog.hbs",
    "modules/sw5e-helper/templates/cards/attack-card.hbs"
  ]);
});

Hooks.once("ready", () => {
  console.log("SW5E Helper | Ready");
  
  // Initialize subsystems
  HookRegistry.initialize();
  CardHandlers.initialize();
  
  // Register API to global scope (optional)
  window.SW5EHelper = SW5EHelper;
});

function registerSettings() {
  game.settings.register("sw5e-helper", "debugMode", {
    name: "Debug Mode",
    hint: "Enable debug logging",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  
  game.settings.register("sw5e-helper", "compactCards", {
    name: "Compact Chat Cards",
    hint: "Use condensed layout for chat cards",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
}`,

  'scripts/config.js': `export const CONFIG = {
  MODULE_ID: "sw5e-helper",
  
  // Debug settings
  DEBUG: false,
  
  // Dice configuration
  DICE: {
    critThreshold: 20,
    fumbleThreshold: 1,
    minDieValues: {
      4: 2, 6: 2, 8: 3, 10: 4, 12: 5, 20: 8
    }
  },
  
  // Damage types
  DAMAGE_TYPES: [
    "kinetic", "energy", "ion", "acid", "cold", 
    "fire", "force", "lightning", "necrotic", 
    "poison", "psychic", "sonic", "true"
  ],
  
  // Abilities
  ABILITIES: ["str", "dex", "con", "int", "wis", "cha"],
  
  // Check types for generic evaluator
  CHECK_TYPES: {
    ATTACK: "attack",
    SAVE: "save",
    SKILL: "skill",
    ABILITY: "ability",
    INITIATIVE: "initiative"
  },
  
  // Permission levels
  PERMISSIONS: {
    NONE: 0,
    LIMITED: 1,
    OBSERVER: 2,
    OWNER: 3
  }
};`,

  'scripts/core/dice/roller.js': `/**
 * Universal dice roller with DSN support
 */
export class DiceRoller {
  static async roll(formula, data = {}, options = {}) {
    const {
      animate = true,
      hidden = false,
      flavor = "",
      minimize = false,
      maximize = false
    } = options;
    
    try {
      const roll = new Roll(formula, data);
      
      if (minimize) {
        roll.terms.forEach(term => {
          if (term instanceof Die) {
            term.results = term.results.map(r => ({ ...r, result: 1 }));
          }
        });
      }
      
      if (maximize) {
        roll.terms.forEach(term => {
          if (term instanceof Die) {
            term.results = term.results.map(r => ({ ...r, result: term.faces }));
          }
        });
      }
      
      await roll.evaluate({ async: true });
      
      // Dice So Nice animation
      if (animate && game.dice3d) {
        await game.dice3d.showForRoll(roll, game.user, !hidden);
      }
      
      return {
        roll,
        total: roll.total,
        formula: roll.formula,
        terms: roll.terms,
        dice: roll.dice
      };
    } catch (error) {
      console.error("SW5E Helper | Roll error:", error);
      throw error;
    }
  }
  
  static async rollMultiple(formulas, data = {}, options = {}) {
    const results = [];
    for (const formula of formulas) {
      results.push(await this.roll(formula, data, options));
    }
    return results;
  }
}`,

  'scripts/core/dice/formula.js': `/**
 * Formula manipulation utilities
 */
export class FormulaBuilder {
  static build(parts, options = {}) {
    const {
      isCrit = false,
      applyBrutal = 0,
      brutalFaces = 6,
      minDie = false,
      offhand = false,
      abilityMod = 0
    } = options;
    
    let formulas = parts.map(p => p.formula || p);
    
    if (isCrit) {
      formulas = formulas.map(f => this.doubleDice(f));
      if (applyBrutal > 0) {
        formulas.push(\`\${applyBrutal}d\${brutalFaces}\`);
      }
    }
    
    if (minDie) {
      formulas = formulas.map(f => this.applyMinimums(f));
    }
    
    if (!offhand && abilityMod) {
      formulas.push(this.signed(abilityMod));
    }
    
    return formulas.filter(Boolean).join(" + ") || "0";
  }
  
  static modify(formula, modifications = {}) {
    let result = formula;
    
    if (modifications.doubleDice) {
      result = this.doubleDice(result);
    }
    
    if (modifications.addBonus) {
      result = \`\${result} + \${modifications.addBonus}\`;
    }
    
    if (modifications.applyMin) {
      result = this.applyMinimums(result);
    }
    
    if (modifications.replaceVariables) {
      for (const [key, value] of Object.entries(modifications.replaceVariables)) {
        result = result.replace(new RegExp(key, 'g'), value);
      }
    }
    
    return result;
  }
  
  static doubleDice(formula) {
    return formula.replace(/(\\d+)d(\\d+)/gi, (_, n, f) => \`\${n * 2}d\${f}\`);
  }
  
  static applyMinimums(formula) {
    const minValues = CONFIG.DICE.minDieValues;
    return formula.replace(/(\\d+)d(\\d+)/gi, (match, n, faces) => {
      const min = minValues[faces];
      return min ? \`\${n}d\${faces}min\${min}\` : match;
    });
  }
  
  static extractDiceOnly(formula) {
    const matches = formula.match(/\\d+d\\d+/gi);
    return matches ? matches.join(" + ") : "0";
  }
  
  static signed(value) {
    const num = Number(value);
    return num >= 0 ? \`+\${num}\` : \`\${num}\`;
  }
}`,

  'scripts/core/dice/evaluator.js': `import { CONFIG } from "../../config.js";

/**
 * Generic D20 check evaluator
 */
export class CheckEvaluator {
  static evaluate(roll, dc, options = {}) {
    const {
      checkType = CONFIG.CHECK_TYPES.ABILITY,
      critThreshold = CONFIG.DICE.critThreshold,
      fumbleThreshold = CONFIG.DICE.fumbleThreshold,
      autoSuccessOn = 20,
      autoFailOn = 1
    } = options;
    
    // Extract the kept d20 value
    const d20Result = this.getKeptD20(roll);
    if (d20Result === null) {
      throw new Error("No d20 found in roll");
    }
    
    const total = roll.total;
    
    // Determine outcome
    let success = false;
    let critical = false;
    let fumble = false;
    let status = "";
    
    // Natural 20/1 handling
    if (d20Result === autoFailOn) {
      success = false;
      fumble = true;
      status = this.getStatusLabel(checkType, "fumble");
    } else if (d20Result === autoSuccessOn) {
      success = true;
      critical = true;
      status = this.getStatusLabel(checkType, "critical");
    } else if (dc !== null && dc !== undefined) {
      success = total >= dc;
      
      // Check for critical success/failure based on threshold
      if (checkType === CONFIG.CHECK_TYPES.ATTACK && success && d20Result >= critThreshold) {
        critical = true;
        status = this.getStatusLabel(checkType, "critical");
      } else {
        status = this.getStatusLabel(checkType, success ? "success" : "failure");
      }
    }
    
    return {
      checkType,
      success,
      critical,
      fumble,
      total,
      natural: d20Result,
      dc,
      margin: dc ? total - dc : null,
      status,
      details: this.getDetails(roll)
    };
  }
  
  static getKeptD20(roll) {
    const d20 = roll.dice?.find(d => d.faces === 20);
    if (!d20) return null;
    
    // Find the kept result (not discarded)
    const kept = d20.results?.find(r => !r.discarded);
    return kept?.result ?? d20.results?.[0]?.result ?? null;
  }
  
  static getDetails(roll) {
    const d20 = roll.dice?.find(d => d.faces === 20);
    if (!d20) return "";
    
    const allRolls = d20.results?.map(r => r.result) || [];
    const kept = this.getKeptD20(roll);
    
    if (allRolls.length <= 1) {
      return \`d20: \${kept}\`;
    }
    return \`d20: \${kept} (rolled \${allRolls.join(", ")})\`;
  }
  
  static getStatusLabel(checkType, outcome) {
    const labels = {
      [CONFIG.CHECK_TYPES.ATTACK]: {
        critical: "Critical Hit",
        success: "Hit",
        failure: "Miss",
        fumble: "Critical Miss"
      },
      [CONFIG.CHECK_TYPES.SAVE]: {
        critical: "Critical Success",
        success: "Success",
        failure: "Failure",
        fumble: "Critical Failure"
      },
      [CONFIG.CHECK_TYPES.SKILL]: {
        critical: "Critical Success",
        success: "Success",
        failure: "Failure",
        fumble: "Critical Failure"
      },
      default: {
        critical: "Critical",
        success: "Success",
        failure: "Failure",
        fumble: "Fumble"
      }
    };
    
    return labels[checkType]?.[outcome] || labels.default[outcome];
  }
}`,

  'scripts/core/state/manager.js': `import { CONFIG } from "../../config.js";

/**
 * Message state management
 */
export class StateManager {
  static getState(message) {
    return message?.getFlag(CONFIG.MODULE_ID, "state") || null;
  }
  
  static async setState(message, state) {
    return await message.setFlag(CONFIG.MODULE_ID, "state", state);
  }
  
  static async updateState(message, updates, options = {}) {
    const currentState = this.getState(message);
    const newState = foundry.utils.mergeObject(currentState, updates);
    
    if (options.validate) {
      const validation = StateValidator.validate(newState);
      if (!validation.valid) {
        throw new Error(\`Invalid state: \${validation.errors.join(", ")}\`);
      }
    }
    
    await this.setState(message, newState);
    
    if (options.rerender) {
      await this.rerenderMessage(message, newState);
    }
    
    return newState;
  }
  
  static async rerenderMessage(message, state) {
    const content = await renderTemplate(
      "modules/sw5e-helper/templates/cards/attack-card.hbs",
      { state, isGM: game.user.isGM }
    );
    
    await message.update({ content });
  }
  
  static async appendRolls(message, rolls) {
    const existingRolls = message.rolls || [];
    await message.update({ 
      rolls: [...existingRolls, ...rolls] 
    });
  }
}`,

  'scripts/core/state/freezer.js': `import { CONFIG } from "../../config.js";

/**
 * Target state freezing utilities
 */
export class TargetFreezer {
  static freeze(tokens = []) {
    return tokens.map(token => this.freezeToken(token));
  }
  
  static freezeToken(token) {
    const actor = token.actor;
    const tokenDoc = token.document || token;
    
    return {
      // Identity
      sceneId: tokenDoc.parent?.id || canvas.scene?.id,
      tokenId: tokenDoc.id,
      actorId: actor?.id,
      
      // Display
      name: tokenDoc.name || actor?.name || "Unknown",
      img: tokenDoc.texture?.src || actor?.img || "icons/svg/mystery-man.svg",
      
      // Combat stats (frozen at time of attack)
      ac: actor?.system?.attributes?.ac?.value || 10,
      hp: {
        value: actor?.system?.attributes?.hp?.value || 0,
        max: actor?.system?.attributes?.hp?.max || 0,
        temp: actor?.system?.attributes?.hp?.temp || 0
      },
      
      // Saves
      saves: this.freezeSaves(actor),
      
      // Conditions
      conditions: this.freezeConditions(actor),
      
      // Metadata
      frozenAt: Date.now()
    };
  }
  
  static freezeSaves(actor) {
    if (!actor) return {};
    
    const saves = {};
    for (const ability of CONFIG.ABILITIES) {
      saves[ability] = {
        mod: actor.system?.abilities?.[ability]?.save || 0,
        prof: actor.system?.abilities?.[ability]?.saveProf || 0
      };
    }
    return saves;
  }
  
  static freezeConditions(actor) {
    if (!actor) return [];
    
    const conditions = [];
    for (const effect of actor.effects) {
      if (effect.isTemporary) {
        conditions.push({
          id: effect.id,
          label: effect.label,
          icon: effect.icon
        });
      }
    }
    return conditions;
  }
  
  static thaw(frozenToken) {
    const scene = game.scenes.get(frozenToken.sceneId);
    const token = scene?.tokens.get(frozenToken.tokenId);
    const actor = token?.actor || game.actors.get(frozenToken.actorId);
    
    return {
      token,
      actor,
      exists: !!(token && actor),
      missing: !(token && actor),
      frozen: frozenToken
    };
  }
}`,

  'scripts/core/actors/resolver.js': `/**
 * Token and actor resolution utilities
 */
export class TokenResolver {
  static resolve(reference, options = {}) {
    const {
      requireActor = true,
      allowMissing = false
    } = options;
    
    // Handle different reference formats
    let sceneId, tokenId;
    
    if (typeof reference === "string") {
      // "sceneId:tokenId" format
      [sceneId, tokenId] = reference.split(":");
    } else if (reference.sceneId && reference.tokenId) {
      // Object format
      sceneId = reference.sceneId;
      tokenId = reference.tokenId;
    } else if (reference instanceof Token) {
      // Token object
      sceneId = reference.scene?.id;
      tokenId = reference.id;
    } else {
      throw new Error("Invalid token reference");
    }
    
    const scene = game.scenes.get(sceneId) || canvas.scene;
    const token = scene?.tokens.get(tokenId);
    const actor = token?.actor;
    
    const result = {
      scene,
      token,
      actor,
      exists: !!(token && (!requireActor || actor)),
      missing: !(token && (!requireActor || actor)),
      reference: \`\${sceneId}:\${tokenId}\`
    };
    
    if (!allowMissing && result.missing) {
      throw new Error(\`Token not found: \${reference}\`);
    }
    
    return result;
  }
  
  static resolveMultiple(references, options = {}) {
    const results = new Map();
    
    for (const ref of references) {
      try {
        const resolved = this.resolve(ref, { ...options, allowMissing: true });
        results.set(resolved.reference, resolved);
      } catch (error) {
        console.warn("SW5E Helper | Failed to resolve token:", ref, error);
      }
    }
    
    return results;
  }
  
  static getCurrentTargets() {
    return Array.from(game.user.targets);
  }
  
  static getControlledTokens() {
    return canvas.tokens?.controlled || [];
  }
}`,

  'scripts/workflow/orchestrator.js': `/**
 * Main workflow orchestrator
 */
export class WorkflowOrchestrator {
  constructor() {
    this.actions = new Map();
    this.registerDefaultActions();
  }
  
  registerDefaultActions() {
    // Import and register all action types
    // These will be added as you migrate each action
  }
  
  registerAction(type, handler) {
    this.actions.set(type, handler);
  }
  
  async execute(actionType, context = {}) {
    const handler = this.actions.get(actionType);
    if (!handler) {
      throw new Error(\`Unknown action type: \${actionType}\`);
    }
    
    // Validate context
    const validation = await handler.validate?.(context);
    if (validation === false) {
      throw new Error(\`Invalid context for action: \${actionType}\`);
    }
    
    // Check permissions
    const permission = await handler.checkPermission?.(context);
    if (permission === false) {
      throw new Error(\`Permission denied for action: \${actionType}\`);
    }
    
    // Execute action
    try {
      const result = await handler.execute(context);
      
      // Post-execution hook
      await Hooks.callAll(\`sw5eHelper.post\${actionType.charAt(0).toUpperCase() + actionType.slice(1)}\`, {
        context,
        result
      });
      
      return result;
    } catch (error) {
      console.error(\`SW5E Helper | Action failed: \${actionType}\`, error);
      throw error;
    }
  }
  
  async executeChain(actions) {
    const results = [];
    let context = {};
    
    for (const action of actions) {
      const result = await this.execute(action.type, {
        ...context,
        ...action.context
      });
      
      results.push(result);
      
      // Pass result to next action
      context = { ...context, previous: result };
    }
    
    return results;
  }
}`,

  'scripts/workflow/hooks.js': `/**
 * Custom hook registry for SW5E Helper
 */
export class HookRegistry {
  static initialize() {
    // Register all custom hooks
    this.registerHooks();
  }
  
  static registerHooks() {
    // Pre-action hooks
    Hooks.on("sw5eHelper.preAttack", this.onPreAttack.bind(this));
    Hooks.on("sw5eHelper.preDamage", this.onPreDamage.bind(this));
    Hooks.on("sw5eHelper.preSave", this.onPreSave.bind(this));
    Hooks.on("sw5eHelper.preApply", this.onPreApply.bind(this));
    
    // Post-action hooks
    Hooks.on("sw5eHelper.postAttack", this.onPostAttack.bind(this));
    Hooks.on("sw5eHelper.postDamage", this.onPostDamage.bind(this));
    Hooks.on("sw5eHelper.postSave", this.onPostSave.bind(this));
    Hooks.on("sw5eHelper.postApply", this.onPostApply.bind(this));
  }
  
  static async onPreAttack(data) {
    // Override or modify attack data
    return data;
  }
  
  static async onPostAttack(data) {
    // React to attack completion
  }
  
  static async onPreDamage(data) {
    // Override or modify damage data
    return data;
  }
  
  static async onPostDamage(data) {
    // React to damage completion
  }
  
  static async onPreSave(data) {
    // Override or modify save data
    return data;
  }
  
  static async onPostSave(data) {
    // React to save completion
  }
  
  static async onPreApply(data) {
    // Override or modify apply data
    return data;
  }
  
  static async onPostApply(data) {
    // React to apply completion
  }
}`
};

// Create directories and files
async function createStructure() {
  const directories = [
    'refactored',
    'refactored/scripts',
    'refactored/scripts/core',
    'refactored/scripts/core/dice',
    'refactored/scripts/core/state',
    'refactored/scripts/core/actors',
    'refactored/scripts/workflow',
    'refactored/scripts/ui',
    'refactored/scripts/ui/cards',
    'refactored/scripts/ui/dialogs',
    'refactored/templates',
    'refactored/templates/cards',
    'refactored/templates/dialogs',
    'refactored/styles',
    'refactored/lang'
  ];

  console.log('Creating refactored structure...');
  
  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true });
    console.log(`Created: ${dir}`);
  }

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join('refactored', filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    console.log(`Created: ${fullPath}`);
  }

  console.log('\\nRefactored structure created successfully!');
  console.log('\\nNext steps:');
  console.log('1. Review the files in the "refactored" directory');
  console.log('2. Copy your existing assets (templates, styles, lang files)');
  console.log('3. Begin migrating your existing code using the AI tools');
}

createStructure().catch(console.error);