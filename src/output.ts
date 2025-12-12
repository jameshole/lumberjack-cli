/**
 * Output formatting for lumberjack
 * Handles terminal output with colors and JSON output
 */

import type { BranchResult, WorktreeResult, Summary, DetectionResult } from './types.js';

// ANSI color codes - minimal implementation
const colors: Record<string, string> = {
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
 */
function c(text: string, color: string): string {
  if (noColor) return text;
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Format a reason for display
 */
function formatReason(reason: string, details: Record<string, unknown>): string {
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

interface PrintOptions {
  dryRun?: boolean;
}

/**
 * Print a branch result with tree formatting
 */
export function printBranch(branch: BranchResult, options: PrintOptions = {}): void {
  const name = options.dryRun
    ? c(branch.name, 'yellow')
    : c(branch.name, 'red');

  console.log(`  ${name}`);

  // Print all reasons
  const reasons = branch.reasons || [branch.reason];
  const allDetails = branch.allDetails || { [branch.reason]: branch.details };

  for (let i = 0; i < reasons.length; i++) {
    const reason = reasons[i];
    const details = allDetails[reason] || {};
    const prefix = i === reasons.length - 1 ? '└─' : '├─';
    console.log(c(`  ${prefix} ${formatReason(reason, details)}`, 'dim'));
  }

  console.log();
}

/**
 * Print a worktree result with tree formatting
 */
export function printWorktree(worktree: WorktreeResult, options: PrintOptions = {}): void {
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
    const details = allDetails[reason] || {};
    const prefix = i === reasons.length - 1 ? '└─' : '├─';
    console.log(c(`  ${prefix} ${formatReason(reason, details)}`, 'dim'));
  }

  console.log();
}

/**
 * Print dry run header
 */
export function printDryRunHeader(): void {
  console.log();
  console.log(c('DRY RUN - no changes will be made', 'yellow'));
  console.log();
}

/**
 * Print dry run footer
 */
export function printDryRunFooter(): void {
  console.log(c('Run without --dry-run to delete.', 'dim'));
  console.log();
}

/**
 * Print branches section header
 */
export function printBranchesHeader(count: number, dryRun: boolean = false): void {
  if (dryRun) {
    console.log(`Would delete ${c(count.toString(), 'bold')} branch${count !== 1 ? 'es' : ''}:`);
  } else {
    console.log(`Found ${c(count.toString(), 'bold')} branch${count !== 1 ? 'es' : ''} to review:`);
  }
  console.log();
}

/**
 * Print worktrees section header
 */
export function printWorktreesHeader(count: number, dryRun: boolean = false): void {
  if (dryRun) {
    console.log(`Would remove ${c(count.toString(), 'bold')} worktree${count !== 1 ? 's' : ''}:`);
  } else {
    console.log(`Found ${c(count.toString(), 'bold')} worktree${count !== 1 ? 's' : ''} to review:`);
  }
  console.log();
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(c(`✓ ${message}`, 'green'));
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.error(c(`✗ ${message}`, 'red'));
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.log(c(`! ${message}`, 'yellow'));
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  console.log(c(message, 'dim'));
}

/**
 * Print nothing found message
 */
export function printNothingFound(): void {
  console.log();
  console.log(c('No branches or worktrees found matching the criteria.', 'dim'));
  console.log();
}

/**
 * Print protected branches info (verbose mode)
 */
export function printProtectedInfo(protectedItems: Array<{ name: string }>): void {
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
 */
export function printDeletionResult(result: { success: boolean; name?: string; path?: string; error?: string }, type: string): void {
  if (result.success) {
    printSuccess(`Deleted ${type}: ${result.name || result.path}`);
  } else {
    printError(`Failed to delete ${type} ${result.name || result.path}: ${result.error}`);
  }
}

/**
 * Print final summary
 */
export function printSummary(summary: Summary): void {
  console.log();
  const parts: string[] = [];

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
 */
export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

interface JsonOutput {
  dryRun: boolean;
  branches: Array<{
    name: string;
    reason: string;
    reasons: string[];
    details: Record<string, unknown>;
  }>;
  worktrees: Array<{
    path: string;
    branch: string;
    reason: string;
    reasons: string[];
    details: Record<string, unknown>;
  }>;
  summary: Summary;
}

/**
 * Build JSON output object
 */
export function buildJsonOutput(results: DetectionResult, summary: Summary, dryRun: boolean): JsonOutput {
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
