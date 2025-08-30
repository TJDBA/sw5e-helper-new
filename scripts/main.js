// scripts/main.js
// Delegate to the real bootstrap so API installs on `ready`.
import './module.js';

Hooks.once('ready', () => {
  console.log('sw5e-helper-new |', game.sw5eHelper?.getInfo?.() ?? 'API not installed');
});