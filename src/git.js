/**
 * Git command wrappers for lumberjack
 * Executes git commands and parses output
 */

import { execSync, spawnSync } from 'child_process';

/**
 * Execute a git command and return stdout
 * @param {string[]} args - Git command arguments
 * @param {object} options - Options
 * @returns {string} Command output
 */
export function git(args, options = {}) {
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
 * @returns {boolean}
 */
export function isGitRepo() {
  try {
    git(['rev-parse', '--git-dir'], { allowFailure: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name
 * @returns {string|null}
 */
export function getCurrentBranch() {
  try {
    return git(['branch', '--show-current']).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Fetch and prune remote tracking branches
 */
export function fetchPrune() {
  git(['fetch', '--prune'], { allowFailure: true });
}

/**
 * Get all local branches with tracking info
 * @returns {Array<{name: string, tracking: string|null, gone: boolean}>}
 */
export function getBranchesWithTracking() {
  const output = git(['branch', '-vv']);
  const branches = [];

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
    let tracking = null;
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
 * @param {string} baseBranch - Branch to check against
 * @returns {string[]} List of merged branch names
 */
export function getMergedBranches(baseBranch) {
  const output = git(['branch', '--merged', baseBranch], { allowFailure: true });
  return output
    .split('\n')
    .map(line => line.replace(/^\*?\s*/, '').trim())
    .filter(name => name && name !== baseBranch);
}

/**
 * Check if a branch's changes are in the base branch (for squash detection)
 * @param {string} branch - Branch to check
 * @param {string} baseBranch - Base branch
 * @returns {boolean} True if branch's changes are in base
 */
export function isBranchSquashed(branch, baseBranch) {
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
 * @param {string} branch - Branch name
 * @returns {Date|null}
 */
export function getLastCommitDate(branch) {
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
 * @returns {Array<{path: string, branch: string|null, bare: boolean}>}
 */
export function getWorktrees() {
  const output = git(['worktree', 'list', '--porcelain']);
  const worktrees = [];
  let current = {};

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
 * @param {string} branch - Branch name
 * @param {boolean} force - Force delete even if unmerged
 * @returns {{success: boolean, error?: string}}
 */
export function deleteBranch(branch, force = false) {
  try {
    git(['branch', force ? '-D' : '-d', branch]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Remove a worktree
 * @param {string} path - Worktree path
 * @param {boolean} force - Force removal
 * @returns {{success: boolean, error?: string}}
 */
export function removeWorktree(path, force = false) {
  try {
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(path);
    git(args);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check if a branch exists
 * @param {string} branch - Branch name
 * @returns {boolean}
 */
export function branchExists(branch) {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
  return result.status === 0;
}
