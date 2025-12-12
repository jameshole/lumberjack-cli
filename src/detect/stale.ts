/**
 * Detection module for stale branches
 */

import { getBranchesWithTracking, getWorktrees, getLastCommitDate } from '../git.js';
import type { MergedOptions } from '../types.js';

interface StaleBranchResult {
  name: string;
  reason: 'stale';
  details: {
    lastCommit: string;
    lastCommitAge: number;
    threshold: number;
  };
}

interface StaleWorktreeResult {
  path: string;
  branch: string;
  reason: 'stale';
  details: {
    lastCommit: string;
    lastCommitAge: number;
    threshold: number;
  };
}

/**
 * Detect branches with no commits in the specified number of days
 */
export function detectStaleBranches(days: number = 30, _options: MergedOptions = {} as MergedOptions): StaleBranchResult[] {
  const branches = getBranchesWithTracking();
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const results: StaleBranchResult[] = [];

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
 */
export function detectStaleWorktrees(days: number = 30, _options: MergedOptions = {} as MergedOptions): StaleWorktreeResult[] {
  const worktrees = getWorktrees();
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const results: StaleWorktreeResult[] = [];

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
