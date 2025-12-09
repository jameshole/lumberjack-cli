/**
 * Detection module for squash-merged branches
 */

import {
  getBranchesWithTracking,
  getWorktrees,
  getLastCommitDate,
  getCurrentBranch,
  isBranchSquashed,
} from '../git.js';

/**
 * Detect branches whose changes are in the base branch (squash-merged)
 * @param {string|null} baseBranch - Branch to check against (null = current branch)
 * @param {object} options - Detection options
 * @returns {Array<{name: string, reason: string, details: object}>}
 */
export function detectSquashedBranches(baseBranch = null, options = {}) {
  const base = baseBranch || getCurrentBranch();
  if (!base) {
    return [];
  }

  const branches = getBranchesWithTracking();
  const results = [];

  for (const branch of branches) {
    // Skip the base branch itself and current branch
    if (branch.name === base || branch.isCurrent) continue;

    // This is an expensive check - runs git diff per branch
    if (isBranchSquashed(branch.name, base)) {
      const lastCommit = getLastCommitDate(branch.name);
      const lastCommitAge = lastCommit
        ? Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      results.push({
        name: branch.name,
        reason: 'squashed',
        details: {
          squashedInto: base,
          lastCommit: lastCommit?.toISOString() || null,
          lastCommitAge,
        },
      });
    }
  }

  return results;
}

/**
 * Detect worktrees whose branches are squash-merged into base
 * @param {string|null} baseBranch - Branch to check against (null = current branch)
 * @param {object} options - Detection options
 * @returns {Array<{path: string, branch: string, reason: string, details: object}>}
 */
export function detectSquashedWorktrees(baseBranch = null, options = {}) {
  const base = baseBranch || getCurrentBranch();
  if (!base) {
    return [];
  }

  const worktrees = getWorktrees();
  const results = [];

  for (const worktree of worktrees) {
    if (worktree.bare || !worktree.branch) continue;
    if (worktree.branch === base) continue;

    if (isBranchSquashed(worktree.branch, base)) {
      const lastCommit = getLastCommitDate(worktree.branch);
      const lastCommitAge = lastCommit
        ? Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      results.push({
        path: worktree.path,
        branch: worktree.branch,
        reason: 'squashed',
        details: {
          squashedInto: base,
          lastCommit: lastCommit?.toISOString() || null,
          lastCommitAge,
        },
      });
    }
  }

  return results;
}
