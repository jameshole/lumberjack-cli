/**
 * Shared types for lumberjack CLI
 */

export interface ParsedOptions {
  // Target flags
  branch: boolean;
  tree: boolean;

  // Detection flags
  gone: boolean;
  merged: string | boolean | null;
  squashed: string | boolean | null;
  stale: number | boolean | null;
  all: boolean;

  // Global options
  dryRun: boolean;
  force: boolean;
  protect: string[];
  noProtect: boolean;
  noFetch: boolean;
  keepBranch: boolean;
  json: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
}

export interface MergedOptions extends ParsedOptions {
  _config?: Config;
}

export interface Config {
  protect: string[];
  stale: number;
  fetch: boolean;
  mergeBase: string | null;
  defaultCommand: string | null;
}

export interface BranchInfo {
  name: string;
  tracking: string | null;
  gone: boolean;
  isCurrent: boolean;
}

export interface WorktreeInfo {
  path: string;
  branch: string | null;
  bare: boolean;
  head?: string;
}

export interface BranchResult {
  name: string;
  reason: string;
  reasons: string[];
  details: Record<string, unknown>;
  allDetails: Record<string, Record<string, unknown>>;
}

export interface WorktreeResult {
  path: string;
  branch: string;
  reason: string;
  reasons: string[];
  details: Record<string, unknown>;
  allDetails: Record<string, Record<string, unknown>>;
}

export interface DetectionResult {
  branches: BranchResult[];
  worktrees: WorktreeResult[];
  protected: Array<{ name: string; path?: string; reasons: string[] }>;
}

export interface DeletionResult {
  success: boolean;
  error?: string;
  name?: string;
  path?: string;
}

export interface DeletionSummary {
  branchesDeleted: number;
  worktreesDeleted: number;
  failed: number;
  skipped: number;
}

export interface Summary extends DeletionSummary {
  branchesFound?: number;
  worktreesFound?: number;
  protected?: number;
}

export interface GitOptions {
  cwd?: string;
  allowFailure?: boolean;
}
