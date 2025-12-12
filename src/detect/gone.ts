/**
 * Detection module for branches with deleted remotes (gone)
 */

import { getBranchesWithTracking, getWorktrees, getLastCommitDate } from '../git.js';
import type { MergedOptions } from '../types.js';

interface GoneBranchResult {
  name: string;
  reason: 'gone';
  details: {
    upstream: string | null;
    lastCommit: string | null;
    lastCommitAge: number | null;
  };
}

interface GoneWorktreeResult {
  path: string;
  branch: string;
  reason: 'gone';
  details: {
    upstream: string | null;
    lastCommit: string | null;
    lastCommitAge: number | null;
  };
}

/**
 * Detect branches where the upstream remote has been deleted
 */
export function detectGoneBranches(_options: MergedOptions = {} as MergedOptions): GoneBranchResult[] {
  const branches = getBranchesWithTracking();
  const results: GoneBranchResult[] = [];

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
 */
export function detectGoneWorktrees(_options: MergedOptions = {} as MergedOptions): GoneWorktreeResult[] {
  const worktrees = getWorktrees();
  const branches = getBranchesWithTracking();
  const goneBranches = new Map(
    branches.filter(b => b.gone).map(b => [b.name, b])
  );

  const results: GoneWorktreeResult[] = [];

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
