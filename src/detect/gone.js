/**
 * Detection module for branches with deleted remotes (gone)
 */

import { getBranchesWithTracking, getWorktrees, getLastCommitDate } from '../git.js';

/**
 * Detect branches where the upstream remote has been deleted
 * @param {object} options - Detection options
 * @returns {Array<{name: string, reason: string, details: object}>}
 */
export function detectGoneBranches(options = {}) {
  const branches = getBranchesWithTracking();
  const results = [];

  for (const branch of branches) {
    if (branch.gone) {
      const lastCommit = getLastCommitDate(branch.name);
      const lastCommitAge = lastCommit
        ? Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      results.push({
        name: branch.name,
        reason: 'gone',
        details: {
          upstream: branch.tracking,
          lastCommit: lastCommit?.toISOString() || null,
          lastCommitAge,
        },
      });
    }
  }

  return results;
}

/**
 * Detect worktrees where the branch's upstream remote has been deleted
 * @param {object} options - Detection options
 * @returns {Array<{path: string, branch: string, reason: string, details: object}>}
 */
export function detectGoneWorktrees(options = {}) {
  const worktrees = getWorktrees();
  const branches = getBranchesWithTracking();
  const goneBranches = new Map(
    branches.filter(b => b.gone).map(b => [b.name, b])
  );

  const results = [];

  for (const worktree of worktrees) {
    // Skip bare repos and main worktree (first one)
    if (worktree.bare || !worktree.branch) continue;

    const branchInfo = goneBranches.get(worktree.branch);
    if (branchInfo) {
      const lastCommit = getLastCommitDate(worktree.branch);
      const lastCommitAge = lastCommit
        ? Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      results.push({
        path: worktree.path,
        branch: worktree.branch,
        reason: 'gone',
        details: {
          upstream: branchInfo.tracking,
          lastCommit: lastCommit?.toISOString() || null,
          lastCommitAge,
        },
      });
    }
  }

  return results;
}
