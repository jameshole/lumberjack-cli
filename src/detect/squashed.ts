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
import type { MergedOptions } from '../types.js';

interface SquashedBranchResult {
  name: string;
  reason: 'squashed';
  details: {
    squashedInto: string;
    lastCommit: string | null;
    lastCommitAge: number | null;
  };
}

interface SquashedWorktreeResult {
  path: string;
  branch: string;
  reason: 'squashed';
  details: {
    squashedInto: string;
    lastCommit: string | null;
    lastCommitAge: number | null;
  };
}

/**
 * Detect branches whose changes are in the base branch (squash-merged)
 */
export function detectSquashedBranches(baseBranch: string | null = null, _options: MergedOptions = {} as MergedOptions): SquashedBranchResult[] {
  const base = baseBranch || getCurrentBranch();
  if (!base) {
    return [];
  }

  const branches = getBranchesWithTracking();
  const results: SquashedBranchResult[] = [];

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
 */
export function detectSquashedWorktrees(baseBranch: string | null = null, _options: MergedOptions = {} as MergedOptions): SquashedWorktreeResult[] {
  const base = baseBranch || getCurrentBranch();
  if (!base) {
    return [];
  }

  const worktrees = getWorktrees();
  const results: SquashedWorktreeResult[] = [];

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
