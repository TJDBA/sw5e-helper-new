# SW5E Helper New (WIP)

A comprehensive automation module for Star Wars 5th Edition (SW5E) in Foundry VTT, providing enhanced attack, damage, and save workflows with a modern, extensible architecture.


## 🚧 Work In Progress

**Current Status: Active Refactor (v1.0.0-alpha)**
This module is undergoing a complete architectural overhaul from v0.1.5 to v0.2.0.

⚠️  **Alpha Version Notice** : This is pre-release software. Features may change, and bugs may occur. Use in production at your own risk.

### Refactor Progress

#### ✅ Completed

- [X] Core module structure
- [X] Configuration system
- [X] Dice utilities (roller, formula builder, evaluator)
- [X] State management foundation
- [X] Actor/token resolution utilities
- [X] Permission system
- [X] Target freezing system

#### 🔄 In Progress

- [ ] Workflow orchestrator
- [ ] Attack action migration
- [ ] Damage action migration
- [ ] Card rendering system
- [ ] Dialog UI updates

#### 📋 Planned

- [ ] Save workflow integration
- [ ] Class feature packs
- [ ] Advanced damage mitigation
- [ ] Reaction system
- [ ] Full test suite

## Features

### Core Capabilities

- **Unified Attack Workflow**: Single-click attack resolution with advantage/disadvantage handling
- **Smart Damage Calculation**: Automatic critical damage, brutal weapons, and off-hand calculations
- **Condensed Chat Cards**: Information-dense, interactive chat cards that update in place
- **Save Integration**: Attack-triggered saves with DC calculation and automatic resolution
- **Preset System**: Save and load attack/damage configurations per character

### Technical Features

- **Modern ES6 Architecture**: Fully modular design with clear separation of concerns
- **Generic D20 Evaluator**: Unified system for all d20 checks (attacks, saves, skills)
- **State Management**: Robust state tracking for complex multi-step workflows
- **Extensible Workflow System**: Easy to add new actions and features
- **Performance Optimized**: Minimal DOM manipulation, efficient caching

## Installation

### Method 1: Manifest URL

1. Open Foundry VTT
2. Navigate to Add-on Modules
3. Click "Install Module"
4. Paste the manifest URL:
