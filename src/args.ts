/**
 * Argument parser for lumberjack CLI
 * Parses command line arguments without external dependencies
 */

import type { ParsedOptions } from './types.js';

/**
 * Parse command line arguments into a structured options object
 */
export function parseArgs(argv: string[]): ParsedOptions {
  const options: ParsedOptions = {
    // Target flags
    branch: false,
    tree: false,

    // Detection flags
    gone: false,
    merged: null,
    squashed: null,
    stale: null,
    all: false,

    // Global options
    dryRun: false,
    force: false,
    protect: [],
    noProtect: false,
    noFetch: false,
    json: false,
    verbose: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    // Handle --flag=value syntax
    const [flag, value] = arg.includes('=') ? arg.split('=') : [arg, null];

    switch (flag) {
      // Target flags
      case '-b':
      case '--branch':
        options.branch = true;
        break;
      case '-t':
      case '--tree':
        options.tree = true;
        break;

      // Detection flags
      case '--gone':
        options.gone = true;
        break;
      case '--merged':
        options.merged = value || true;
        break;
      case '--squashed':
        options.squashed = value || true;
        break;
      case '--stale':
        options.stale = value ? parseInt(value, 10) : true;
        break;
      case '--all':
        options.all = true;
        break;

      // Global options
      case '-d':
      case '--dry-run':
        options.dryRun = true;
        break;
      case '-f':
      case '--force':
        options.force = true;
        break;
      case '-p':
      case '--protect':
        if (value) {
          options.protect.push(...value.split(',').map(s => s.trim()));
        } else if (argv[i + 1] && !argv[i + 1].startsWith('-')) {
          options.protect.push(...argv[++i].split(',').map(s => s.trim()));
        }
        break;
      case '--no-protect':
        options.noProtect = true;
        break;
      case '--no-fetch':
        options.noFetch = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-V':
      case '--version':
        options.version = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  // If --all is set, enable all detection flags
  if (options.all) {
    options.gone = true;
    if (options.merged === null) options.merged = true;
    if (options.squashed === null) options.squashed = true;
    if (options.stale === null) options.stale = true;
  }

  return options;
}

/**
 * Check if any detection flags are set
 */
export function hasDetectionFlags(options: ParsedOptions): boolean {
  return options.gone ||
         options.merged !== null ||
         options.squashed !== null ||
         options.stale !== null;
}

/**
 * Parse a defaultCommand string into argv array
 */
export function parseDefaultCommand(command: string | null): string[] {
  if (!command) return [];
  // Simple split on whitespace, handles basic cases
  return command.trim().split(/\s+/).filter(Boolean);
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
Usage: chop [options]

Target Flags (if neither, both are targeted):
  -b, --branch           Target local branches
  -t, --tree             Target git worktrees

Detection Flags (OR logic - any match qualifies):
  --gone                 Upstream remote has been deleted
  --merged[=<branch>]    Has been merged into specified branch
  --squashed[=<branch>]  Changes are present in target branch
  --stale[=<days>]       No commits in N days (default: 30)
  --all                  Shorthand for --gone --merged --squashed --stale

Global Options:
  -d, --dry-run          Preview without deleting
  -f, --force            Skip confirmation prompts
  -p, --protect <list>   Comma-separated patterns to protect
  --no-protect           Disable default protected branches
  --no-fetch             Skip git fetch --prune
  --json                 Output as JSON
  -v, --verbose          Show detailed information
  -h, --help             Show help
  -V, --version          Show version

Examples:
  chop                         Interactive mode
  chop --branch --gone         Delete branches with deleted remotes
  chop --tree --stale=60       Remove worktrees stale for 60+ days
  chop --all --dry-run         Preview all cleanup candidates
`);
}

/**
 * Print version
 */
export function printVersion(): void {
  console.log('lumberjack v0.0.8');
}
