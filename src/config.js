/**
 * Configuration loader for lumberjack
 * Loads and merges config from multiple sources
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULT_CONFIG = {
  protect: ['main', 'master', 'develop'],
  stale: 30,
  fetch: true,
  mergeBase: null,
  defaultCommand: null,
};

/**
 * Safely parse JSON, returning null on error
 * @param {string} content - JSON string
 * @returns {object|null}
 */
function safeParseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Load config from a file path if it exists
 * @param {string} filePath - Path to config file
 * @returns {object|null}
 */
function loadConfigFile(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    return safeParseJson(content);
  } catch {
    return null;
  }
}

/**
 * Load config from package.json lumberjack key
 * @param {string} dir - Directory containing package.json
 * @returns {object|null}
 */
function loadPackageJsonConfig(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const content = readFileSync(pkgPath, 'utf-8');
    const pkg = safeParseJson(content);
    return pkg?.lumberjack || null;
  } catch {
    return null;
  }
}

/**
 * Load configuration from all sources and merge
 * Priority: CLI flags > project .lumberjackrc > home .lumberjackrc > package.json > defaults
 * @param {string} cwd - Current working directory
 * @returns {object} Merged configuration
 */
export function loadConfig(cwd = process.cwd()) {
  // Load from various sources (lowest to highest priority)
  const sources = [
    DEFAULT_CONFIG,
    loadPackageJsonConfig(cwd),
    loadConfigFile(join(homedir(), '.lumberjackrc')),
    loadConfigFile(join(cwd, '.lumberjackrc')),
  ].filter(Boolean);

  // Merge configs
  const merged = { ...DEFAULT_CONFIG };

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
 * @param {object} cliOptions - Parsed CLI options
 * @param {object} config - Loaded config
 * @returns {object} Final merged options
 */
export function mergeOptions(cliOptions, config) {
  const merged = { ...cliOptions };

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
 * @param {string} branchName - Branch name to check
 * @param {string[]} patterns - Protected patterns
 * @returns {boolean}
 */
export function isProtected(branchName, patterns) {
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
