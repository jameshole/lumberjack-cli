/**
 * Main orchestration for lumberjack
 */

import { parseArgs, hasDetectionFlags, parseDefaultCommand, printHelp, printVersion } from './args.js';
import { loadConfig, mergeOptions } from './config.js';
import { isGitRepo, fetchPrune, deleteBranch, removeWorktree } from './git.js';
import { detectAll } from './detect/index.js';
import {
  printDryRunHeader,
  printDryRunFooter,
  printBranchesHeader,
  printWorktreesHeader,
  printBranch,
  printWorktree,
  printNothingFound,
  printProtectedInfo,
  printSummary,
  printError,
  printInfo,
  printSuccess,
  outputJson,
  buildJsonOutput,
} from './output.js';
import { confirm } from './prompts.js';
import type { MergedOptions, BranchResult, WorktreeResult, DeletionSummary } from './types.js';

/**
 * Main entry point
 */
export async function main(argv: string[]): Promise<void> {
  // Parse CLI arguments
  let options = parseArgs(argv);

  // Handle help and version
  if (options.help) {
    printHelp();
    return;
  }

  if (options.version) {
    printVersion();
    return;
  }

  // Check if we're in a git repo
  if (!isGitRepo()) {
    printError('Not a git repository');
    process.exit(1);
  }

  // Load config
  const config = loadConfig();

  // Check for default command if no detection flags
  if (!hasDetectionFlags(options) && config.defaultCommand) {
    const defaultArgs = parseDefaultCommand(config.defaultCommand);
    options = parseArgs([...defaultArgs, ...argv]);
  }

  // Merge CLI options with config
  const mergedOptions = mergeOptions(options, config);

  // If no detection flags, show help
  if (!hasDetectionFlags(mergedOptions)) {
    printHelp();
    return;
  }

  await runCommandLine(mergedOptions);

  // Ensure stdin is paused so process can exit
  process.stdin.pause();
}

/**
 * Run in command-line mode
 */
async function runCommandLine(options: MergedOptions): Promise<void> {
  // Fetch if needed
  if (!options.noFetch) {
    if (!options.json) {
      printInfo('Fetching and pruning...');
    }
    fetchPrune();
  }

  // Run detection
  if (!options.json) {
    printInfo('Scanning...');
  }
  const results = detectAll(options);

  // Build summary
  const summary = {
    branchesFound: results.branches.length,
    branchesDeleted: 0,
    worktreesFound: results.worktrees.length,
    worktreesDeleted: 0,
    protected: results.protected.length,
    skipped: 0,
    failed: 0,
  };

  // Handle JSON output
  if (options.json) {
    if (options.dryRun) {
      outputJson(buildJsonOutput(results, summary, true));
      return;
    }

    // For non-dry-run JSON, we still need to perform deletions
    if (!options.force) {
      // In JSON mode without force, we can't do interactive confirmation
      // Just output what would be deleted
      outputJson(buildJsonOutput(results, summary, true));
      return;
    }

    // Perform deletions and update summary
    const deletionSummary = await performDeletions(
      results.branches,
      results.worktrees,
      { silent: true, keepBranch: options.keepBranch }
    );

    summary.branchesDeleted = deletionSummary.branchesDeleted;
    summary.worktreesDeleted = deletionSummary.worktreesDeleted;
    summary.failed = deletionSummary.failed;

    outputJson(buildJsonOutput(results, summary, false));
    return;
  }

  // Handle dry run
  if (options.dryRun) {
    printDryRunHeader();

    if (results.branches.length === 0 && results.worktrees.length === 0) {
      printNothingFound();
      return;
    }

    if (results.branches.length > 0) {
      printBranchesHeader(results.branches.length, true);
      for (const branch of results.branches) {
        printBranch(branch, { dryRun: true });
      }
    }

    if (results.worktrees.length > 0) {
      printWorktreesHeader(results.worktrees.length, true);
      for (const worktree of results.worktrees) {
        printWorktree(worktree, { dryRun: true });
      }
    }

    if (options.verbose && results.protected.length > 0) {
      printProtectedInfo(results.protected);
    }

    printDryRunFooter();
    return;
  }

  // Check if anything was found
  if (results.branches.length === 0 && results.worktrees.length === 0) {
    printNothingFound();
    return;
  }

  // Show what will be deleted
  if (results.branches.length > 0) {
    console.log();
    printBranchesHeader(results.branches.length);
    for (const branch of results.branches) {
      printBranch(branch, options);
    }
  }

  if (results.worktrees.length > 0) {
    console.log();
    printWorktreesHeader(results.worktrees.length);
    for (const worktree of results.worktrees) {
      printWorktree(worktree, options);
    }
  }

  if (options.verbose && results.protected.length > 0) {
    printProtectedInfo(results.protected);
  }

  // Confirm unless --force
  if (!options.force) {
    const total = results.branches.length + results.worktrees.length;
    const confirmed = await confirm(
      `Delete ${total} item${total !== 1 ? 's' : ''}?`,
      false
    );

    if (!confirmed) {
      printInfo('Cancelled.');
      return;
    }
  }

  // Perform deletions
  const deletionSummary = await performDeletions(results.branches, results.worktrees, {
    keepBranch: options.keepBranch,
  });
  printSummary(deletionSummary);
}

/**
 * Perform actual deletions
 * Worktrees are processed first since their branches can't be deleted while checked out
 */
async function performDeletions(
  branches: BranchResult[],
  worktrees: WorktreeResult[],
  options: { silent?: boolean; keepBranch?: boolean } = {}
): Promise<DeletionSummary> {
  const { silent = false, keepBranch = false } = options;
  const summary: DeletionSummary = {
    branchesDeleted: 0,
    worktreesDeleted: 0,
    failed: 0,
    skipped: 0,
  };

  // Track branches deleted as part of worktree removal
  const deletedBranches = new Set<string>();

  // Remove worktrees first (branches can't be deleted while checked out in a worktree)
  for (const worktree of worktrees) {
    let result = removeWorktree(worktree.path, false);

    if (!result.success) {
      // Try force removal
      result = removeWorktree(worktree.path, true);
    }

    if (result.success) {
      summary.worktreesDeleted++;
      if (!silent) {
        printSuccess(`Removed worktree: ${worktree.path}`);
      }

      // Also delete the associated branch if it still exists (unless --keep-branch)
      if (!keepBranch) {
        const branchResult = deleteBranch(worktree.branch, true);
        if (branchResult.success) {
          deletedBranches.add(worktree.branch);
          if (!silent) {
            printSuccess(`Deleted branch: ${worktree.branch}`);
          }
        }
      }
    } else {
      summary.failed++;
      if (!silent) {
        printError(`Failed to remove ${worktree.path}: ${result.error}`);
      }
    }
  }

  // Delete branches (skip any already deleted with worktrees)
  for (const branch of branches) {
    // Skip if already deleted as part of worktree removal
    if (deletedBranches.has(branch.name)) {
      summary.branchesDeleted++;
      continue;
    }

    let result = deleteBranch(branch.name, false);

    // If safe delete fails, try force delete
    if (!result.success && result.error?.includes('not fully merged')) {
      if (!silent) {
        printInfo(`Branch ${branch.name} is not fully merged, using force delete...`);
      }
      result = deleteBranch(branch.name, true);
    }

    if (result.success) {
      summary.branchesDeleted++;
      if (!silent) {
        printSuccess(`Deleted branch: ${branch.name}`);
      }
    } else {
      summary.failed++;
      if (!silent) {
        printError(`Failed to delete ${branch.name}: ${result.error}`);
      }
    }
  }

  return summary;
}
