/**
 * Output formatting for lumberjack
 * Handles terminal output with colors and JSON output
 */

// ANSI color codes - minimal implementation
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Check if colors should be disabled
const noColor = process.env.NO_COLOR !== undefined || !process.stdout.isTTY;

/**
 * Apply color to text
 * @param {string} text - Text to colorize
 * @param {string} color - Color name
 * @returns {string}
 */
function c(text, color) {
  if (noColor) return text;
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Format a reason for display
 * @param {string} reason - Reason code
 * @param {object} details - Details object
 * @returns {string}
 */
function formatReason(reason, details) {
  switch (reason) {
    case 'gone':
      return `remote gone${details.upstream ? ` (upstream: ${details.upstream})` : ''}`;
    case 'merged':
      return `merged into ${details.mergedInto}`;
    case 'squashed':
      return `squashed into ${details.squashedInto}`;
    case 'stale':
      return `stale (last commit ${details.lastCommitAge} days ago)`;
    default:
      return reason;
  }
}

/**
 * Print a branch result with tree formatting
 * @param {object} branch - Branch result
 * @param {object} options - Output options
 */
export function printBranch(branch, options = {}) {
  const name = options.dryRun
    ? c(branch.name, 'yellow')
    : c(branch.name, 'red');

  console.log(`  ${name}`);

  // Print all reasons
  const reasons = branch.reasons || [branch.reason];
  const allDetails = branch.allDetails || { [branch.reason]: branch.details };

  for (let i = 0; i < reasons.length; i++) {
    const reason = reasons[i];
    const details = allDetails[reason];
    const prefix = i === reasons.length - 1 ? '└─' : '├─';
    console.log(c(`  ${prefix} ${formatReason(reason, details)}`, 'dim'));
  }

  console.log();
}

/**
 * Print a worktree result with tree formatting
 * @param {object} worktree - Worktree result
 * @param {object} options - Output options
 */
export function printWorktree(worktree, options = {}) {
  const path = options.dryRun
    ? c(worktree.path, 'yellow')
    : c(worktree.path, 'red');

  console.log(`  ${path}`);
  console.log(c(`  ├─ branch: ${worktree.branch}`, 'dim'));

  // Print all reasons
  const reasons = worktree.reasons || [worktree.reason];
  const allDetails = worktree.allDetails || { [worktree.reason]: worktree.details };

  for (let i = 0; i < reasons.length; i++) {
    const reason = reasons[i];
    const details = allDetails[reason];
    const prefix = i === reasons.length - 1 ? '└─' : '├─';
    console.log(c(`  ${prefix} ${formatReason(reason, details)}`, 'dim'));
  }

  console.log();
}

/**
 * Print dry run header
 */
export function printDryRunHeader() {
  console.log();
  console.log(c('DRY RUN - no changes will be made', 'yellow'));
  console.log();
}

/**
 * Print dry run footer
 */
export function printDryRunFooter() {
  console.log(c('Run without --dry-run to delete.', 'dim'));
  console.log();
}

/**
 * Print branches section header
 * @param {number} count - Number of branches
 * @param {boolean} dryRun - Whether this is a dry run
 */
export function printBranchesHeader(count, dryRun = false) {
  if (dryRun) {
    console.log(`Would delete ${c(count.toString(), 'bold')} branch${count !== 1 ? 'es' : ''}:`);
  } else {
    console.log(`Found ${c(count.toString(), 'bold')} branch${count !== 1 ? 'es' : ''} to review:`);
  }
  console.log();
}

/**
 * Print worktrees section header
 * @param {number} count - Number of worktrees
 * @param {boolean} dryRun - Whether this is a dry run
 */
export function printWorktreesHeader(count, dryRun = false) {
  if (dryRun) {
    console.log(`Would remove ${c(count.toString(), 'bold')} worktree${count !== 1 ? 's' : ''}:`);
  } else {
    console.log(`Found ${c(count.toString(), 'bold')} worktree${count !== 1 ? 's' : ''} to review:`);
  }
  console.log();
}

/**
 * Print a success message
 * @param {string} message - Message to print
 */
export function printSuccess(message) {
  console.log(c(`✓ ${message}`, 'green'));
}

/**
 * Print an error message
 * @param {string} message - Message to print
 */
export function printError(message) {
  console.error(c(`✗ ${message}`, 'red'));
}

/**
 * Print a warning message
 * @param {string} message - Message to print
 */
export function printWarning(message) {
  console.log(c(`! ${message}`, 'yellow'));
}

/**
 * Print an info message
 * @param {string} message - Message to print
 */
export function printInfo(message) {
  console.log(c(message, 'dim'));
}

/**
 * Print nothing found message
 */
export function printNothingFound() {
  console.log();
  console.log(c('No branches or worktrees found matching the criteria.', 'dim'));
  console.log();
}

/**
 * Print protected branches info (verbose mode)
 * @param {Array} protected - Protected branches
 */
export function printProtectedInfo(protectedItems) {
  if (protectedItems.length === 0) return;

  console.log();
  console.log(c(`Skipped ${protectedItems.length} protected branch${protectedItems.length !== 1 ? 'es' : ''}:`, 'dim'));
  for (const item of protectedItems) {
    console.log(c(`  - ${item.name}`, 'dim'));
  }
  console.log();
}

/**
 * Print deletion result
 * @param {object} result - Deletion result
 * @param {string} type - 'branch' or 'worktree'
 */
export function printDeletionResult(result, type) {
  if (result.success) {
    printSuccess(`Deleted ${type}: ${result.name || result.path}`);
  } else {
    printError(`Failed to delete ${type} ${result.name || result.path}: ${result.error}`);
  }
}

/**
 * Print final summary
 * @param {object} summary - Summary object
 */
export function printSummary(summary) {
  console.log();
  const parts = [];

  if (summary.branchesDeleted > 0) {
    parts.push(c(`${summary.branchesDeleted} branch${summary.branchesDeleted !== 1 ? 'es' : ''} deleted`, 'green'));
  }
  if (summary.worktreesDeleted > 0) {
    parts.push(c(`${summary.worktreesDeleted} worktree${summary.worktreesDeleted !== 1 ? 's' : ''} removed`, 'green'));
  }
  if (summary.failed > 0) {
    parts.push(c(`${summary.failed} failed`, 'red'));
  }
  if (summary.skipped > 0) {
    parts.push(c(`${summary.skipped} skipped`, 'dim'));
  }

  if (parts.length > 0) {
    console.log(parts.join(', '));
  }
  console.log();
}

/**
 * Output results as JSON
 * @param {object} data - Data to output
 */
export function outputJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Build JSON output object
 * @param {object} results - Detection results
 * @param {object} summary - Summary stats
 * @param {boolean} dryRun - Whether this was a dry run
 * @returns {object}
 */
export function buildJsonOutput(results, summary, dryRun) {
  return {
    dryRun,
    branches: results.branches.map(b => ({
      name: b.name,
      reason: b.reason,
      reasons: b.reasons,
      details: b.details,
    })),
    worktrees: results.worktrees.map(w => ({
      path: w.path,
      branch: w.branch,
      reason: w.reason,
      reasons: w.reasons,
      details: w.details,
    })),
    summary,
  };
}
