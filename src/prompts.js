/**
 * Interactive prompts for lumberjack
 * Uses built-in readline module
 */

import * as readline from 'readline';

// ANSI codes for terminal manipulation
const ANSI = {
  clearLine: '\x1b[2K',
  cursorUp: '\x1b[1A',
  cursorHide: '\x1b[?25l',
  cursorShow: '\x1b[?25h',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

/**
 * Create a readline interface
 * @returns {readline.Interface}
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a yes/no confirmation question
 * @param {string} question - Question to ask
 * @param {boolean} defaultValue - Default value if user presses enter
 * @returns {Promise<boolean>}
 */
export async function confirm(question, defaultValue = false) {
  const rl = createInterface();
  const hint = defaultValue ? '(Y/n)' : '(y/N)';

  return new Promise((resolve) => {
    rl.question(`${question} ${hint} `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') {
        resolve(defaultValue);
      } else {
        resolve(trimmed === 'y' || trimmed === 'yes');
      }
    });
  });
}

/**
 * Display a single-select menu
 * @param {string} question - Question to display
 * @param {Array<{label: string, value: any}>} options - Options to choose from
 * @returns {Promise<any>} Selected value
 */
export async function select(question, options) {
  return new Promise((resolve) => {
    let selectedIndex = 0;

    const renderOptions = () => {
      for (let i = 0; i < options.length; i++) {
        const marker = i === selectedIndex
          ? `${ANSI.cyan}  ○ ${ANSI.reset}`
          : `${ANSI.dim}  ○ ${ANSI.reset}`;
        process.stdout.write(`${marker}${options[i].label}\n`);
      }
    };

    const clearOptions = () => {
      for (let i = 0; i < options.length; i++) {
        process.stdout.write(ANSI.cursorUp + ANSI.clearLine);
      }
    };

    // Initial render - question + options
    process.stdout.write(ANSI.cursorHide);
    console.log(`\n${ANSI.cyan}?${ANSI.reset} ${question}`);
    renderOptions();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onKeypress = (key) => {
      // Ctrl+C
      if (key === '\u0003') {
        process.stdout.write(ANSI.cursorShow);
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeypress);
        process.exit(0);
      }

      // Enter
      if (key === '\r' || key === '\n') {
        clearOptions();
        process.stdout.write(ANSI.cursorShow);
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeypress);
        // Clear the question line too and reprint with selection
        process.stdout.write(ANSI.cursorUp + ANSI.clearLine);
        console.log(`${ANSI.cyan}?${ANSI.reset} ${question} ${ANSI.cyan}${options[selectedIndex].label}${ANSI.reset}`);
        resolve(options[selectedIndex].value);
        return;
      }

      // Arrow keys (escape sequences)
      if (key === '\u001b[A' || key === 'k') {
        // Up arrow or k
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
      } else if (key === '\u001b[B' || key === 'j') {
        // Down arrow or j
        selectedIndex = (selectedIndex + 1) % options.length;
      }

      // Re-render options only
      clearOptions();
      renderOptions();
    };

    process.stdin.on('data', onKeypress);
  });
}

/**
 * Display a multi-select checkbox menu
 * @param {string} question - Question to display
 * @param {Array<{label: string, value: any, checked?: boolean}>} options - Options to choose from
 * @returns {Promise<Array<any>>} Selected values
 */
export async function multiSelect(question, options) {
  return new Promise((resolve) => {
    let selectedIndex = 0;
    const selected = new Set(
      options
        .map((opt, i) => opt.checked ? i : -1)
        .filter(i => i >= 0)
    );

    const renderOptions = () => {
      for (let i = 0; i < options.length; i++) {
        const isSelected = selected.has(i);
        const isFocused = i === selectedIndex;
        const checkbox = isSelected
          ? `${ANSI.green}◉${ANSI.reset}`
          : `${ANSI.dim}◯${ANSI.reset}`;
        const label = isFocused
          ? `${ANSI.cyan}${options[i].label}${ANSI.reset}`
          : options[i].label;
        const pointer = isFocused ? `${ANSI.cyan}>${ANSI.reset}` : ' ';
        process.stdout.write(` ${pointer} ${checkbox} ${label}\n`);
      }
    };

    const clearOptions = () => {
      // Move up and clear each option line
      for (let i = 0; i < options.length; i++) {
        process.stdout.write(ANSI.cursorUp + ANSI.clearLine);
      }
    };

    // Initial render - question + options
    process.stdout.write(ANSI.cursorHide);
    console.log(`\n${ANSI.cyan}?${ANSI.reset} ${question} ${ANSI.dim}(space to toggle, enter to confirm)${ANSI.reset}`);
    renderOptions();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onKeypress = (key) => {
      // Ctrl+C
      if (key === '\u0003') {
        process.stdout.write(ANSI.cursorShow);
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeypress);
        process.exit(0);
      }

      // Enter - confirm selection
      if (key === '\r' || key === '\n') {
        clearOptions();
        process.stdout.write(ANSI.cursorShow);
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeypress);
        const selectedValues = [...selected].map(i => options[i].value);
        const selectedLabels = [...selected].map(i => options[i].label).join(', ');
        // Clear the question line too and reprint with selection
        process.stdout.write(ANSI.cursorUp + ANSI.clearLine);
        console.log(`${ANSI.cyan}?${ANSI.reset} ${question} ${ANSI.cyan}${selectedLabels || '(none)'}${ANSI.reset}`);
        resolve(selectedValues);
        return;
      }

      // Space - toggle selection
      if (key === ' ') {
        if (selected.has(selectedIndex)) {
          selected.delete(selectedIndex);
        } else {
          selected.add(selectedIndex);
        }
      }

      // Arrow keys
      if (key === '\u001b[A' || key === 'k') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
      } else if (key === '\u001b[B' || key === 'j') {
        selectedIndex = (selectedIndex + 1) % options.length;
      }

      // a - select all
      if (key === 'a') {
        if (selected.size === options.length) {
          selected.clear();
        } else {
          for (let i = 0; i < options.length; i++) {
            selected.add(i);
          }
        }
      }

      clearOptions();
      renderOptions();
    };

    process.stdin.on('data', onKeypress);
  });
}

/**
 * Run interactive mode for lumberjack
 * @param {object} options - Current options
 * @returns {Promise<object>} Updated options with user selections
 */
export async function runInteractiveMode(options) {
  console.log();

  // What to clean up?
  const target = await select('What would you like to clean up?', [
    { label: 'Branches', value: 'branch' },
    { label: 'Worktrees', value: 'tree' },
    { label: 'Both', value: 'both' },
  ]);

  options.branch = target === 'branch' || target === 'both';
  options.tree = target === 'tree' || target === 'both';

  // What conditions?
  const conditions = await multiSelect('What conditions? (select all that apply)', [
    { label: 'Remote gone (squash-merge cleanup)', value: 'gone', checked: true },
    { label: 'Merged into current branch', value: 'merged' },
    { label: 'Squashed into current branch', value: 'squashed' },
    { label: `Stale (no commits in ${options._config?.stale || 30}+ days)`, value: 'stale' },
  ]);

  options.gone = conditions.includes('gone');
  options.merged = conditions.includes('merged') ? true : null;
  options.squashed = conditions.includes('squashed') ? true : null;
  options.stale = conditions.includes('stale') ? true : null;

  // Apply config defaults for merged/squashed/stale
  // Keep as true if no mergeBase configured (will use current branch)
  if (options.merged === true && options._config?.mergeBase) {
    options.merged = options._config.mergeBase;
  }
  if (options.squashed === true && options._config?.mergeBase) {
    options.squashed = options._config.mergeBase;
  }
  if (options.stale === true) {
    options.stale = options._config?.stale || 30;
  }

  return options;
}

/**
 * Let user select which items to delete
 * @param {Array} items - Items to choose from
 * @param {string} type - 'branches' or 'worktrees'
 * @param {function} formatLabel - Function to format item label
 * @returns {Promise<Array>} Selected items
 */
export async function selectItemsToDelete(items, type, formatLabel) {
  if (items.length === 0) return [];

  const options = items.map(item => ({
    label: formatLabel(item),
    value: item,
    checked: true, // Default to selected
  }));

  const selected = await multiSelect(`Select ${type} to delete:`, options);
  return selected;
}

/**
 * Format a branch for selection display
 * @param {object} branch - Branch object
 * @returns {string}
 */
export function formatBranchLabel(branch) {
  const reasons = branch.reasons || [branch.reason];
  const reasonStr = reasons.join(', ');
  return `${branch.name} ${ANSI.dim}(${reasonStr})${ANSI.reset}`;
}

/**
 * Format a worktree for selection display
 * @param {object} worktree - Worktree object
 * @returns {string}
 */
export function formatWorktreeLabel(worktree) {
  const reasons = worktree.reasons || [worktree.reason];
  const reasonStr = reasons.join(', ');
  return `${worktree.path} ${ANSI.dim}[${worktree.branch}] (${reasonStr})${ANSI.reset}`;
}
