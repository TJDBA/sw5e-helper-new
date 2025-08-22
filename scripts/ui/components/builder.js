/**
 * UI Component Builder
 * Reusable UI component creation utilities
 */

import { Helpers } from '../../core/utils/helpers.js';

export class ComponentBuilder {
  /**
   * Create a button element
   * @param {object} options - Button options
   * @returns {string} Button HTML
   */
  static createButton(options = {}) {
    const {
      text = "",
      action = "",
      classes = [],
      title = "",
      icon = "",
      disabled = false
    } = options;

    const classStr = classes.length ? ` class="${classes.join(' ')}"` : "";
    const titleStr = title ? ` title="${title}"` : "";
    const actionStr = action ? ` data-action="${action}"` : "";
    const disabledStr = disabled ? " disabled" : "";

    const content = icon ? `${icon} ${text}`.trim() : text;

    return `<button type="button"${classStr}${titleStr}${actionStr}${disabledStr}>${content}</button>`;
  }

  /**
   * Create an icon button
   * @param {object} options - Icon button options
   * @returns {string} Icon button HTML
   */
  static createIconButton(options = {}) {
    const {
      icon = "",
      action = "",
      title = "",
      targetRef = "",
      classes = ["icon-btn"]
    } = options;

    const classStr = ` class="${classes.join(' ')}"`;
    const titleStr = title ? ` title="${title}" aria-label="${title}"` : "";
    const actionStr = action ? ` data-action="${action}"` : "";
    const targetRefStr = targetRef ? ` data-target-ref="${targetRef}"` : "";

    return `<a${classStr}${titleStr}${actionStr}${targetRefStr}>${icon}</a>`;
  }

  /**
   * Create a form group (label + input)
   * @param {object} options - Form group options
   * @returns {string} Form group HTML
   */
  static createFormGroup(options = {}) {
    const {
      label = "",
      input = "",
      classes = ["form-group"]
    } = options;

    const classStr = classes.length ? ` class="${classes.join(' ')}"` : "";

    return `
      <div${classStr}>
        <label>${label}</label>
        ${input}
      </div>
    `;
  }

  /**
   * Create a select input
   * @param {object} options - Select options
   * @returns {string} Select HTML
   */
  static createSelect(options = {}) {
    const {
      name = "",
      value = "",
      options: selectOptions = [],
      classes = []
    } = options;

    const classStr = classes.length ? ` class="${classes.join(' ')}"` : "";
    const nameStr = name ? ` name="${name}"` : "";

    const optionsHTML = selectOptions.map(opt => {
      const selected = opt.value === value ? " selected" : "";
      return `<option value="${opt.value}"${selected}>${opt.text}</option>`;
    }).join("");

    return `<select${nameStr}${classStr}>${optionsHTML}</select>`;
  }

  /**
   * Create a checkbox input
   * @param {object} options - Checkbox options
   * @returns {string} Checkbox HTML
   */
  static createCheckbox(options = {}) {
    const {
      name = "",
      id = "",
      checked = false,
      label = "",
      classes = ["checkbox-item"]
    } = options;

    const idStr = id ? ` id="${id}"` : "";
    const nameStr = name ? ` name="${name}"` : "";
    const checkedStr = checked ? " checked" : "";
    const classStr = classes.length ? ` class="${classes.join(' ')}"` : "";
    const forStr = id ? ` for="${id}"` : "";

    return `
      <div${classStr}>
        <input type="checkbox"${nameStr}${idStr}${checkedStr}>
        <label${forStr}>${label}</label>
      </div>
    `;
  }

  /**
   * Create radio button group
   * @param {object} options - Radio group options  
   * @returns {string} Radio group HTML
   */
  static createRadioGroup(options = {}) {
    const {
      name = "",
      value = "",
      options: radioOptions = [],
      classes = ["radio-group"]
    } = options;

    const classStr = classes.length ? ` class="${classes.join(' ')}"` : "";

    const radios = radioOptions.map((opt, index) => {
      const id = `${name}-${opt.value}`;
      const checked = opt.value === value ? " checked" : "";
      
      return `
        <div class="radio-item">
          <input type="radio" name="${name}" value="${opt.value}" id="${id}"${checked}>
          <label for="${id}">${opt.text}</label>
        </div>
      `;
    }).join("");

    return `<div${classStr}>${radios}</div>`;
  }

  /**
   * Create a progress bar
   * @param {object} options - Progress options
   * @returns {string} Progress bar HTML
   */
  static createProgressBar(options = {}) {
    const {
      value = 0,
      max = 100,
      label = "",
      classes = ["progress-bar"]
    } = options;

    const percentage = Math.round((value / max) * 100);
    const classStr = classes.length ? ` class="${classes.join(' ')}"` : "";

    return `
      <div${classStr}>
        ${label ? `<span class="progress-label">${label}</span>` : ""}
        <div class="progress-track">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
        <span class="progress-text">${value}/${max}</span>
      </div>
    `;
  }

  /**
   * Create a status indicator
   * @param {object} options - Status options
   * @returns {string} Status indicator HTML
   */
  static createStatusIndicator(options = {}) {
    const {
      status = "pending",
      icon = "",
      text = "",
      classes = ["status-indicator"]
    } = options;

    const statusClass = `status-${status}`;
    const allClasses = [...classes, statusClass];
    const classStr = ` class="${allClasses.join(' ')}"`;

    return `<span${classStr} title="${text}">${icon}</span>`;
  }

  /**
   * Create a tooltip wrapper
   * @param {object} options - Tooltip options
   * @returns {string} Tooltip HTML
   */
  static createTooltip(options = {}) {
    const {
      content = "",
      tooltip = "",
      classes = ["tooltip"]
    } = options;

    const classStr = classes.length ? ` class="${classes.join(' ')}"` : "";
    const titleStr = tooltip ? ` title="${tooltip}"` : "";

    return `<span${classStr}${titleStr}>${content}</span>`;
  }

  /**
   * Create an info icon with tooltip
   * @param {object} options - Info icon options
   * @returns {string} Info icon HTML
   */
  static createInfoIcon(options = {}) {
    const {
      tooltip = "",
      action = "show-info",
      targetRef = "",
      classes = ["info-icon"]
    } = options;

    const classStr = ` class="${classes.join(' ')}"`;
    const titleStr = tooltip ? ` title="${tooltip}"` : "";
    const actionStr = action ? ` data-action="${action}"` : "";
    const targetRefStr = targetRef ? ` data-target-ref="${targetRef}"` : "";

    return `<span${classStr}${titleStr}${actionStr}${targetRefStr}>ⓘ</span>`;
  }

  /**
   * Create a collapsible section
   * @param {object} options - Section options
   * @returns {string} Collapsible section HTML
   */
  static createCollapsibleSection(options = {}) {
    const {
      title = "",
      content = "",
      open = false,
      classes = ["collapsible-section"]
    } = options;

    const classStr = classes.length ? ` class="${classes.join(' ')}"` : "";
    const openStr = open ? " open" : "";

    return `
      <details${classStr}${openStr}>
        <summary>${title}</summary>
        <div class="section-content">
          ${content}
        </div>
      </details>
    `;
  }
}

export default ComponentBuilder;