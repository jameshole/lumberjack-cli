/**
 * Detection module for stale branches
 */

import { getBranchesWithTracking, getWorktrees, getLastCommitDate } from '../git.js';

/**
 * Detect branches with no commits in the specified number of days
 * @param {number} days - Number of days threshold
 * @param {object} options - Detection options
 * @returns {Array<{name: string, reason: string, details: object}>}
 */
export function detectStaleBranches(days = 30, options = {}) {
  const branches = getBranchesWithTracking();
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const results = [];

  for (const branch of branches) {
    // Skip current branch
    if (branch.isCurrent) continue;

    const lastCommit = getLastCommitDate(branch.name);
    if (!lastCommit) continue;

    if (lastCommit.getTime() < threshold) {
      const lastCommitAge = Math.floor(
        (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24)
      );

      results.push({
        name: branch.name,
        reason: 'stale',
        details: {
          lastCommit: lastCommit.toISOString(),
          lastCommitAge,
          threshold: days,
        },
      });
    }
  }

  return results;
}

/**
 * Detect worktrees whose branches are stale
 * @param {number} days - Number of days threshold
 * @param {object} options - Detection options
 * @returns {Array<{path: string, branch: string, reason: string, details: object}>}
 */
export function detectStaleWorktrees(days = 30, options = {}) {
  const worktrees = getWorktrees();
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const results = [];

  for (const worktree of worktrees) {
    if (worktree.bare || !worktree.branch) continue;

    const lastCommit = getLastCommitDate(worktree.branch);
    if (!lastCommit) continue;

    if (lastCommit.getTime() < threshold) {
      const lastCommitAge = Math.floor(
        (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24)
      );

      results.push({
        path: worktree.path,
        branch: worktree.branch,
        reason: 'stale',
        details: {
          lastCommit: lastCommit.toISOString(),
          lastCommitAge,
          threshold: days,
        },
      });
    }
  }

  return results;
}
