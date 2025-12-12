/**
 * Configuration loader for lumberjack
 * Loads and merges config from multiple sources
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Config, ParsedOptions, MergedOptions } from './types.js';

const DEFAULT_CONFIG: Config = {
  protect: ['main', 'master', 'develop'],
  stale: 30,
  fetch: true,
  mergeBase: null,
  defaultCommand: null,
};

/**
 * Safely parse JSON, returning null on error
 */
function safeParseJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Load config from a file path if it exists
 */
function loadConfigFile(filePath: string): Partial<Config> | null {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    return safeParseJson(content) as Partial<Config> | null;
  } catch {
    return null;
  }
}

/**
 * Load config from package.json lumberjack key
 */
function loadPackageJsonConfig(dir: string): Partial<Config> | null {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const content = readFileSync(pkgPath, 'utf-8');
    const pkg = safeParseJson(content);
    return (pkg?.lumberjack as Partial<Config>) || null;
  } catch {
    return null;
  }
}

/**
 * Load configuration from all sources and merge
 * Priority: CLI flags > project .lumberjackrc > home .lumberjackrc > package.json > defaults
 */
export function loadConfig(cwd: string = process.cwd()): Config {
  // Load from various sources (lowest to highest priority)
  const sources = [
    DEFAULT_CONFIG,
    loadPackageJsonConfig(cwd),
    loadConfigFile(join(homedir(), '.lumberjackrc')),
    loadConfigFile(join(cwd, '.lumberjackrc')),
  ].filter((source): source is Config | Partial<Config> => source !== null);

  // Merge configs
  const merged: Config = { ...DEFAULT_CONFIG };

  for (const source of sources) {
    if (source.protect !== undefined) {
      merged.protect = source.protect;
    }
    if (source.stale !== undefined) {
      merged.stale = source.stale;
    }
    if (source.fetch !== undefined) {
      merged.fetch = source.fetch;
    }
    if (source.mergeBase !== undefined) {
      merged.mergeBase = source.mergeBase;
    }
    if (source.defaultCommand !== undefined) {
      merged.defaultCommand = source.defaultCommand;
    }
  }

  return merged;
}

/**
 * Merge CLI options with loaded config
 * CLI options take precedence
 */
export function mergeOptions(cliOptions: ParsedOptions, config: Config): MergedOptions {
  const merged: MergedOptions = { ...cliOptions };

  // Handle protect patterns
  if (cliOptions.noProtect) {
    merged.protect = [];
  } else {
    // Combine config protect with CLI protect
    merged.protect = [...(config.protect || []), ...cliOptions.protect];
  }

  // Handle stale days - if stale is true (flag without value), use config
  if (merged.stale === true) {
    merged.stale = config.stale || DEFAULT_CONFIG.stale;
  }

  // Handle merged base - if merged is true (flag without value), use config or keep true (will use current branch)
  if (merged.merged === true) {
    merged.merged = config.mergeBase || true;
  }

  // Handle squashed base - if squashed is true (flag without value), use config or keep true (will use current branch)
  if (merged.squashed === true) {
    merged.squashed = config.mergeBase || true;
  }

  // Handle fetch - CLI --no-fetch overrides config
  if (!cliOptions.noFetch && config.fetch === false) {
    merged.noFetch = true;
  }

  // Store original config values for reference
  merged._config = config;

  return merged;
}

/**
 * Check if a branch name matches any protected pattern
 * Supports simple glob patterns with * wildcard
 */
export function isProtected(branchName: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Convert glob pattern to regex
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$'
      );
      if (regex.test(branchName)) return true;
    } else {
      if (branchName === pattern) return true;
    }
  }
  return false;
}
