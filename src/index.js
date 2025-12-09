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
  printDeletionResult,
  printSummary,
  printError,
  printInfo,
  printSuccess,
  outputJson,
  buildJsonOutput,
} from './output.js';
import {
  runInteractiveMode,
  selectItemsToDelete,
  formatBranchLabel,
  formatWorktreeLabel,
  confirm,
} from './prompts.js';

/**
 * Main entry point
 * @param {string[]} argv - Command line arguments
 */
export async function main(argv) {
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
  options = mergeOptions(options, config);

  // Determine mode: interactive or command-line
  const isInteractive = !hasDetectionFlags(options);

  if (isInteractive) {
    await runInteractive(options);
  } else {
    await runCommandLine(options);
  }
}

/**
 * Run in interactive mode
 * @param {object} options - Initial options
 */
async function runInteractive(options) {
  // Get user preferences
  options = await runInteractiveMode(options);

  // Check if any detection was selected
  if (!hasDetectionFlags(options)) {
    printInfo('No conditions selected. Exiting.');
    return;
  }

  // Fetch if needed
  if (!options.noFetch) {
    printInfo('Fetching and pruning...');
    fetchPrune();
  }

  // Run detection
  printInfo('Scanning...');
  const results = detectAll(options);

  // Check if anything was found
  if (results.branches.length === 0 && results.worktrees.length === 0) {
    printNothingFound();
    return;
  }

  // Show and select branches
  let selectedBranches = [];
  if (results.branches.length > 0) {
    console.log();
    printBranchesHeader(results.branches.length);
    for (const branch of results.branches) {
      printBranch(branch, options);
    }

    selectedBranches = await selectItemsToDelete(
      results.branches,
      'branches',
      formatBranchLabel
    );
  }

  // Show and select worktrees
  let selectedWorktrees = [];
  if (results.worktrees.length > 0) {
    console.log();
    printWorktreesHeader(results.worktrees.length);
    for (const worktree of results.worktrees) {
      printWorktree(worktree, options);
    }

    selectedWorktrees = await selectItemsToDelete(
      results.worktrees,
      'worktrees',
      formatWorktreeLabel
    );
  }

  // Confirm and delete
  if (selectedBranches.length === 0 && selectedWorktrees.length === 0) {
    printInfo('Nothing selected. Exiting.');
    return;
  }

  const totalSelected = selectedBranches.length + selectedWorktrees.length;
  const confirmed = await confirm(
    `Confirm deletion of ${totalSelected} item${totalSelected !== 1 ? 's' : ''}?`,
    false
  );

  if (!confirmed) {
    printInfo('Cancelled.');
    return;
  }

  // Perform deletions
  const summary = await performDeletions(selectedBranches, selectedWorktrees);
  printSummary(summary);
}

/**
 * Run in command-line mode
 * @param {object} options - Parsed options
 */
async function runCommandLine(options) {
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
      true // silent
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
  const deletionSummary = await performDeletions(results.branches, results.worktrees);
  printSummary(deletionSummary);
}

/**
 * Perform actual deletions
 * @param {Array} branches - Branches to delete
 * @param {Array} worktrees - Worktrees to remove
 * @param {boolean} silent - Suppress output
 * @returns {object} Summary of operations
 */
async function performDeletions(branches, worktrees, silent = false) {
  const summary = {
    branchesDeleted: 0,
    worktreesDeleted: 0,
    failed: 0,
    skipped: 0,
  };

  // Delete branches
  for (const branch of branches) {
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

  // Remove worktrees (and their branches)
  for (const worktree of worktrees) {
    // First remove the worktree
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

      // Also delete the associated branch if it still exists
      const branchResult = deleteBranch(worktree.branch, true);
      if (branchResult.success && !silent) {
        printSuccess(`Deleted branch: ${worktree.branch}`);
      }
    } else {
      summary.failed++;
      if (!silent) {
        printError(`Failed to remove ${worktree.path}: ${result.error}`);
      }
    }
  }

  return summary;
}
