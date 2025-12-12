/**
 * Detection module for merged branches
 */

import { getMergedBranches, getWorktrees, getLastCommitDate, getCurrentBranch } from '../git.js';
import type { MergedOptions } from '../types.js';

interface MergedBranchResult {
  name: string;
  reason: 'merged';
  details: {
    mergedInto: string;
    lastCommit: string | null;
    lastCommitAge: number | null;
  };
}

interface MergedWorktreeResult {
  path: string;
  branch: string;
  reason: 'merged';
  details: {
    mergedInto: string;
    lastCommit: string | null;
    lastCommitAge: number | null;
  };
}

/**
 * Detect branches that have been merged into a base branch
 */
export function detectMergedBranches(baseBranch: string | null = null, _options: MergedOptions = {} as MergedOptions): MergedBranchResult[] {
  const base = baseBranch || getCurrentBranch();
  if (!base) {
    return [];
  }

  const mergedBranches = getMergedBranches(base);
  const results: MergedBranchResult[] = [];

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
 */
export function detectMergedWorktrees(baseBranch: string | null = null, _options: MergedOptions = {} as MergedOptions): MergedWorktreeResult[] {
  const base = baseBranch || getCurrentBranch();
  if (!base) {
    return [];
  }

  const mergedBranches = new Set(getMergedBranches(base));
  const worktrees = getWorktrees();
  const results: MergedWorktreeResult[] = [];

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
