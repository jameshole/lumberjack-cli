/**
 * Git command wrappers for lumberjack
 * Executes git commands and parses output
 */

import { spawnSync } from 'child_process';
import type { BranchInfo, WorktreeInfo, DeletionResult, GitOptions } from './types.js';

/**
 * Execute a git command and return stdout
 */
export function git(args: string[], options: GitOptions = {}): string {
  const result = spawnSync('git', args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Git command failed: ${result.error.message}`);
  }

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`Git command failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout || '';
}

/**
 * Check if we're in a git repository
 */
export function isGitRepo(): boolean {
  try {
    git(['rev-parse', '--git-dir'], { allowFailure: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name
 */
export function getCurrentBranch(): string | null {
  try {
    return git(['branch', '--show-current']).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Fetch and prune remote tracking branches
 */
export function fetchPrune(): void {
  git(['fetch', '--prune'], { allowFailure: true });
}

/**
 * Get all local branches with tracking info
 */
export function getBranchesWithTracking(): BranchInfo[] {
  const output = git(['branch', '-vv']);
  const branches: BranchInfo[] = [];

  for (const line of output.split('\n')) {
    if (!line.trim()) continue;

    // Parse branch line: "* main   abc1234 [origin/main] commit message"
    // or: "  feature abc1234 [origin/feature: gone] commit message"
    const isCurrent = line.startsWith('*');
    const trimmed = line.slice(2).trim();

    // Extract branch name (first word)
    const match = trimmed.match(/^(\S+)\s+/);
    if (!match) continue;

    const name = match[1];

    // Look for tracking info in brackets
    const trackingMatch = trimmed.match(/\[([^\]]+)\]/);
    let tracking: string | null = null;
    let gone = false;

    if (trackingMatch) {
      const trackingInfo = trackingMatch[1];
      if (trackingInfo.includes(': gone')) {
        gone = true;
        tracking = trackingInfo.replace(': gone', '').trim();
      } else if (trackingInfo.includes(':')) {
        // Has ahead/behind info
        tracking = trackingInfo.split(':')[0].trim();
      } else {
        tracking = trackingInfo.trim();
      }
    }

    branches.push({ name, tracking, gone, isCurrent });
  }

  return branches;
}

/**
 * Get branches merged into a base branch
 */
export function getMergedBranches(baseBranch: string): string[] {
  const output = git(['branch', '--merged', baseBranch], { allowFailure: true });
  return output
    .split('\n')
    .map(line => line.replace(/^\*?\s*/, '').trim())
    .filter(name => name && name !== baseBranch);
}

/**
 * Check if a branch's changes are in the base branch (for squash detection)
 */
export function isBranchSquashed(branch: string, baseBranch: string): boolean {
  // git diff base...branch shows changes in branch not in base
  // If there are no changes, the branch is effectively merged/squashed
  const result = spawnSync('git', ['diff', '--quiet', `${baseBranch}...${branch}`], {
    encoding: 'utf-8',
  });
  // Exit code 0 = no diff = changes are in base
  return result.status === 0;
}

/**
 * Get the last commit date for a branch
 */
export function getLastCommitDate(branch: string): Date | null {
  try {
    const output = git(['log', '-1', '--format=%ci', branch]);
    const dateStr = output.trim();
    if (!dateStr) return null;
    return new Date(dateStr);
  } catch {
    return null;
  }
}

/**
 * Get all worktrees
 */
export function getWorktrees(): WorktreeInfo[] {
  const output = git(['worktree', 'list', '--porcelain']);
  const worktrees: WorktreeInfo[] = [];
  let current: WorktreeInfo = { path: '', branch: null, bare: false };

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(current);
      }
      current = { path: line.slice(9), branch: null, bare: false };
    } else if (line.startsWith('branch ')) {
      // refs/heads/branch-name -> branch-name
      current.branch = line.slice(7).replace('refs/heads/', '');
    } else if (line === 'bare') {
      current.bare = true;
    } else if (line.startsWith('HEAD ')) {
      // Detached HEAD
      current.head = line.slice(5);
    }
  }

  if (current.path) {
    worktrees.push(current);
  }

  return worktrees;
}

/**
 * Delete a local branch
 */
export function deleteBranch(branch: string, force: boolean = false): DeletionResult {
  try {
    git(['branch', force ? '-D' : '-d', branch]);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Remove a worktree
 */
export function removeWorktree(path: string, force: boolean = false): DeletionResult {
  try {
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(path);
    git(args);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Check if a branch exists
 */
export function branchExists(branch: string): boolean {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
  return result.status === 0;
}
