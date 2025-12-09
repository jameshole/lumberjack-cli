/**
 * Detection module for merged branches
 */

import { getMergedBranches, getWorktrees, getLastCommitDate, getCurrentBranch } from '../git.js';

/**
 * Detect branches that have been merged into a base branch
 * @param {string|null} baseBranch - Branch to check against (null = current branch)
 * @param {object} options - Detection options
 * @returns {Array<{name: string, reason: string, details: object}>}
 */
export function detectMergedBranches(baseBranch = null, options = {}) {
  const base = baseBranch || getCurrentBranch();
  if (!base) {
    return [];
  }

  const mergedBranches = getMergedBranches(base);
  const results = [];

  for (const name of mergedBranches) {
    const lastCommit = getLastCommitDate(name);
    const lastCommitAge = lastCommit
      ? Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    results.push({
      name,
      reason: 'merged',
      details: {
        mergedInto: base,
        lastCommit: lastCommit?.toISOString() || null,
        lastCommitAge,
      },
    });
  }

  return results;
}

/**
 * Detect worktrees whose branches have been merged into a base branch
 * @param {string|null} baseBranch - Branch to check against (null = current branch)
 * @param {object} options - Detection options
 * @returns {Array<{path: string, branch: string, reason: string, details: object}>}
 */
export function detectMergedWorktrees(baseBranch = null, options = {}) {
  const base = baseBranch || getCurrentBranch();
  if (!base) {
    return [];
  }

  const mergedBranches = new Set(getMergedBranches(base));
  const worktrees = getWorktrees();
  const results = [];

  for (const worktree of worktrees) {
    if (worktree.bare || !worktree.branch) continue;

    if (mergedBranches.has(worktree.branch)) {
      const lastCommit = getLastCommitDate(worktree.branch);
      const lastCommitAge = lastCommit
        ? Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      results.push({
        path: worktree.path,
        branch: worktree.branch,
        reason: 'merged',
        details: {
          mergedInto: base,
          lastCommit: lastCommit?.toISOString() || null,
          lastCommitAge,
        },
      });
    }
  }

  return results;
}
