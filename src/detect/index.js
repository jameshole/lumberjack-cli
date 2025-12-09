/**
 * Detection module aggregator
 * Combines all detection strategies
 */

import { detectGoneBranches, detectGoneWorktrees } from './gone.js';
import { detectMergedBranches, detectMergedWorktrees } from './merged.js';
import { detectSquashedBranches, detectSquashedWorktrees } from './squashed.js';
import { detectStaleBranches, detectStaleWorktrees } from './stale.js';
import { isProtected } from '../config.js';

/**
 * Run all enabled detection strategies and combine results
 * @param {object} options - Detection options
 * @returns {{branches: Array, worktrees: Array, protected: Array}}
 */
export function detectAll(options) {
  const targetBranches = options.branch || (!options.branch && !options.tree);
  const targetWorktrees = options.tree || (!options.branch && !options.tree);

  const branchResults = new Map();
  const worktreeResults = new Map();
  const protectedBranches = [];

  // Run branch detection
  if (targetBranches) {
    if (options.gone) {
      for (const result of detectGoneBranches(options)) {
        addOrMergeBranchResult(branchResults, result);
      }
    }

    if (options.merged !== null) {
      const base = typeof options.merged === 'string' ? options.merged : null;
      for (const result of detectMergedBranches(base, options)) {
        addOrMergeBranchResult(branchResults, result);
      }
    }

    if (options.squashed !== null) {
      const base = typeof options.squashed === 'string' ? options.squashed : null;
      for (const result of detectSquashedBranches(base, options)) {
        addOrMergeBranchResult(branchResults, result);
      }
    }

    if (options.stale !== null) {
      const days = typeof options.stale === 'number' ? options.stale : 30;
      for (const result of detectStaleBranches(days, options)) {
        addOrMergeBranchResult(branchResults, result);
      }
    }
  }

  // Run worktree detection
  if (targetWorktrees) {
    if (options.gone) {
      for (const result of detectGoneWorktrees(options)) {
        addOrMergeWorktreeResult(worktreeResults, result);
      }
    }

    if (options.merged !== null) {
      const base = typeof options.merged === 'string' ? options.merged : null;
      for (const result of detectMergedWorktrees(base, options)) {
        addOrMergeWorktreeResult(worktreeResults, result);
      }
    }

    if (options.squashed !== null) {
      const base = typeof options.squashed === 'string' ? options.squashed : null;
      for (const result of detectSquashedWorktrees(base, options)) {
        addOrMergeWorktreeResult(worktreeResults, result);
      }
    }

    if (options.stale !== null) {
      const days = typeof options.stale === 'number' ? options.stale : 30;
      for (const result of detectStaleWorktrees(days, options)) {
        addOrMergeWorktreeResult(worktreeResults, result);
      }
    }
  }

  // Filter out protected branches
  const branches = [];
  for (const [name, result] of branchResults) {
    if (isProtected(name, options.protect || [])) {
      protectedBranches.push({ name, reasons: result.reasons });
    } else {
      branches.push(result);
    }
  }

  // Filter out worktrees with protected branches
  const worktrees = [];
  for (const [path, result] of worktreeResults) {
    if (isProtected(result.branch, options.protect || [])) {
      protectedBranches.push({ name: result.branch, path, reasons: result.reasons });
    } else {
      worktrees.push(result);
    }
  }

  return { branches, worktrees, protected: protectedBranches };
}

/**
 * Add or merge a branch detection result
 * Multiple detection flags use OR logic - store all matching reasons
 */
function addOrMergeBranchResult(map, result) {
  const existing = map.get(result.name);
  if (existing) {
    existing.reasons.push(result.reason);
    existing.allDetails[result.reason] = result.details;
  } else {
    map.set(result.name, {
      name: result.name,
      reason: result.reason,
      reasons: [result.reason],
      details: result.details,
      allDetails: { [result.reason]: result.details },
    });
  }
}

/**
 * Add or merge a worktree detection result
 */
function addOrMergeWorktreeResult(map, result) {
  const existing = map.get(result.path);
  if (existing) {
    existing.reasons.push(result.reason);
    existing.allDetails[result.reason] = result.details;
  } else {
    map.set(result.path, {
      path: result.path,
      branch: result.branch,
      reason: result.reason,
      reasons: [result.reason],
      details: result.details,
      allDetails: { [result.reason]: result.details },
    });
  }
}
