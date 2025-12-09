# 🪓 Lumberjack

A minimal CLI tool for cleaning up stale git branches and worktrees.

```bash
npm install -g lumberjack
```

```bash
chop
```

## Why?

If you use git worktrees or work on a team with squash-merge workflows, you've probably got a graveyard of stale local branches and worktrees. Lumberjack helps you clean them up safely.

## Quick Start

```bash
# Interactive mode - walks you through cleanup options
chop

# Preview what would be deleted (always safe)
chop --dry-run

# Clean up branches where the remote has been deleted
chop --branch --gone

# Clean up worktrees where the remote branch was deleted
chop --tree --gone

# Clean up both branches and worktrees
chop --gone
```

---

## Usage

```bash
chop [options]
```

When run with no arguments (and no `defaultCommand` configured), Lumberjack enters interactive mode.

When run with detection flags but without `--branch` or `--tree`, both branches and worktrees are processed.

---

## Target Flags

Specify what to clean up. If neither is provided, both are targeted.

| Flag | Short | Description |
|------|-------|-------------|
| `--branch` | `-b` | Target local branches. |
| `--tree` | `-t` | Target git worktrees. |

```bash
chop --branch --gone         # Only branches
chop --tree --gone           # Only worktrees
chop --branch --tree --gone  # Both (explicit)
chop --gone                  # Both (implicit)
```

---

## Detection Flags

Specify the conditions for cleanup. Multiple flags use OR logic - items matching ANY condition will be flagged.

| Flag | Description | Branches | Worktrees |
|------|-------------|:--------:|:---------:|
| `--gone` | Upstream remote has been deleted. Best for squash-merge workflows where branches are auto-deleted. | ✅ | ✅ |
| `--merged[=<branch>]` | Has been merged into the specified branch, configured `mergeBase`, or current branch. | ✅ | ✅ |
| `--squashed[=<branch>]` | Changes are present in the target branch (tree comparison). Works for squash-merge even when remote still exists. | ✅ | ✅ |
| `--stale[=<days>]` | No commits in the specified number of days. Default: 30 (or config value). | ✅ | ✅ |
| `--all` | Shorthand for `--gone --merged --squashed --stale`. | ✅ | ✅ |

At least one detection flag is required for non-interactive mode.

### Examples

```bash
# Branches where remote is gone
chop --branch --gone

# Worktrees where remote branch was deleted
chop --tree --gone

# Branches with no commits in 60 days
chop --branch --stale=60

# Branches merged into main (explicit)
chop --branch --merged=main

# Branches whose changes are in main (works for squash-merge)
chop --branch --squashed=main

# Branches that are gone OR stale (OR logic)
chop --branch --gone --stale=30

# Both branches and worktrees, gone OR merged
chop --gone --merged

# Kitchen sink - branches and worktrees matching any condition
chop --all
```

---

## Global Options

| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | `-d` | Preview what would be deleted without actually deleting anything. |
| `--force` | `-f` | Skip confirmation prompts. Use with caution. |
| `--protect <patterns>` | `-p` | Comma-separated branch patterns to never delete (in addition to defaults). |
| `--no-protect` | | Disable default protected branches. Not recommended. |
| `--no-fetch` | | Skip the `git fetch --prune` step. Useful if you've just fetched. |
| `--json` | | Output results as JSON (useful for scripting). |
| `--verbose` | `-v` | Show detailed information about why each item was flagged. |
| `--help` | `-h` | Show help. |
| `--version` | `-V` | Show version. |

---

## Configuration

Lumberjack can be configured via a `.lumberjackrc` file in your home directory or project root, or via a `lumberjack` key in `package.json`.

### Config File

```json
// ~/.lumberjackrc or ./.lumberjackrc
{
  "protect": ["main", "master", "develop", "staging", "production"],
  "stale": 30,
  "fetch": true,
  "mergeBase": "main",
  "defaultCommand": "--branch --gone"
}
```

### Package.json

```json
{
  "lumberjack": {
    "protect": ["main", "master", "develop"],
    "stale": 30
  }
}
```

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `protect` | `string[]` | `["main", "master", "develop"]` | Branch patterns to never delete. Supports glob patterns. |
| `stale` | `number` | `30` | Default number of days for `--stale` flag. |
| `fetch` | `boolean` | `true` | Run `git fetch --prune` before detection. Set to `false` to always skip. |
| `mergeBase` | `string` | `null` | Default branch for `--merged` check. If not set, uses current branch. |
| `defaultCommand` | `string` | `null` | If set, `chop` without arguments runs this instead of interactive mode. |

### Config Precedence

1. CLI flags (highest)
2. Project `.lumberjackrc`
3. Home directory `~/.lumberjackrc`
4. `package.json` lumberjack key
5. Defaults (lowest)

---

## Interactive Mode

When run without arguments (and no `defaultCommand` configured), Lumberjack enters interactive mode.

```
$ chop

? What would you like to clean up?
  ○ Branches
  ○ Worktrees
  ○ Both

? What conditions? (select all that apply)
  ◉ Remote gone (squash-merge cleanup)
  ◯ Merged into current branch
  ◯ Stale (no commits in 30+ days)
```

### Branch Selection

```
Scanning branches...

Found 5 branches to review:

  feat/auth-flow
  └─ remote gone (deleted 12 days ago)

  feat/user-settings
  └─ remote gone (deleted 3 days ago)

  fix/modal-bug
  └─ merged into main

  experiment/new-nav
  └─ stale (last commit 45 days ago)

  wip/testing
  └─ stale (last commit 90 days ago)

? Select branches to delete:
  ◉ feat/auth-flow
  ◉ feat/user-settings
  ◉ fix/modal-bug
  ◯ experiment/new-nav
  ◯ wip/testing

? Confirm deletion of 3 branches? (y/N)
```

### Worktree Selection

```
Scanning worktrees...

Found 3 worktrees to review:

  ~/code/myproject-feat-auth
  └─ branch: feat/auth (remote gone)

  ~/code/myproject-old-feature
  └─ branch: old-feature (squashed into main)

  ~/code/myproject-experiment
  └─ branch: experiment (stale - 60 days)

? Select worktrees to remove:
  ◉ ~/code/myproject-feat-auth
  ◉ ~/code/myproject-old-feature
  ◯ ~/code/myproject-experiment

? Confirm removal of 2 worktrees? (y/N)
```

---

## Dry Run Output

```
$ chop --branch --gone --dry-run

DRY RUN - no changes will be made

Would delete 3 branches:

  feat/auth-flow
  └─ remote gone (upstream: origin/feat/auth-flow)

  feat/user-settings  
  └─ remote gone (upstream: origin/feat/user-settings)

  hotfix/typo
  └─ remote gone (upstream: origin/hotfix/typo)

Run without --dry-run to delete.
```

---

## JSON Output

For scripting and automation:

```bash
$ chop --branch --gone --json --dry-run
```

```json
{
  "dryRun": true,
  "branches": [
    {
      "name": "feat/auth-flow",
      "reason": "gone",
      "details": {
        "upstream": "origin/feat/auth-flow",
        "lastCommit": "2025-01-15T10:30:00Z",
        "lastCommitAge": 12
      }
    },
    {
      "name": "feat/user-settings",
      "reason": "gone",
      "details": {
        "upstream": "origin/feat/user-settings",
        "lastCommit": "2025-01-24T14:20:00Z",
        "lastCommitAge": 3
      }
    }
  ],
  "worktrees": [],
  "summary": {
    "branchesFound": 2,
    "branchesDeleted": 0,
    "worktreesFound": 0,
    "worktreesDeleted": 0,
    "protected": 0,
    "skipped": 0
  }
}
```

---

## Protected Branches

By default, Lumberjack will never delete these branches:

- `main`
- `master`
- `develop`

You can add to this list via config or CLI:

```bash
# Add staging and production to protected list
chop --branch --gone --protect staging,production

# Protect branches matching a pattern
chop --branch --gone --protect "release/*"
```

To see which branches are protected:

```bash
chop --verbose
```

---

## Common Workflows

### Squash-Merge Cleanup

If your team uses squash-merge and auto-deletes branches on GitHub/GitLab:

```bash
# Best option - relies on remote branch being deleted
chop --branch --gone
```

If your workflow doesn't auto-delete remote branches:

```bash
# Detects if changes are in main regardless of merge strategy
chop --branch --squashed=main
```

### Weekly Maintenance

```bash
# Clean up everything that's clearly safe to remove
chop --all --dry-run

# If it looks good
chop --all
```

### Before Starting a New Feature

```bash
# Quick cleanup of stale worktrees
chop --tree --gone --stale
```

### CI/Automation

```bash
# Non-interactive, JSON output for logging
chop --branch --gone --force --json >> cleanup.log
```

### Configure a Default

If you always run the same cleanup, set it as default:

```json
// .lumberjackrc
{
  "defaultCommand": "--branch --gone"
}
```

Now bare `chop` runs `chop --branch --gone` instead of interactive mode.

---

## How Detection Works

### `--gone` Detection

1. Runs `git fetch --prune` (unless `--no-fetch`)
2. Runs `git branch -vv` to list branches with tracking info
3. Identifies branches where upstream shows as `[origin/branch: gone]`

This is the most reliable method for squash-merge workflows.

### `--merged` Detection

1. Determines the base branch:
   - If `--merged=<branch>` is provided, uses that branch
   - Else if `mergeBase` is set in config, uses that
   - Else uses the current branch
2. Runs `git branch --merged <base>` 
3. Returns all branches whose commits are reachable from the base branch

Note: This doesn't work for squash-merged branches since the commits are rewritten. Use `--gone` or `--squashed` for squash-merge workflows.

```bash
# Check against explicit branch
chop --branch --merged=main

# Check against configured mergeBase (or current if not set)
chop --branch --merged
```

### `--squashed` Detection

1. Determines the base branch:
   - If `--squashed=<branch>` is provided, uses that branch
   - Else if `mergeBase` is set in config, uses that
   - Else uses the current branch
2. For each branch, runs `git diff <base>...<branch> --quiet`
3. If the diff is empty, the branch's changes are already in the base (via squash, rebase, or regular merge)

This is more expensive than `--merged` (runs a diff per branch) but works for any merge strategy.

```bash
# Check if branch changes are already in main
chop --branch --squashed=main

# Check against configured mergeBase (or current if not set)
chop --branch --squashed
```

### `--stale` Detection

1. Determines the threshold:
   - If `--stale=<days>` is provided, uses that value
   - Else if `stale` is set in config, uses that
   - Else uses 30 days
2. For each branch, gets the date of the last commit
3. Flags branches with no commits within the threshold

```bash
# Check for branches stale for 60+ days
chop --branch --stale=60

# Check against configured stale threshold (or 30 if not set)
chop --branch --stale
```

---

## Comparison with Alternatives

| Tool | Branches | Worktrees | Interactive | Squash Detection |
|------|----------|-----------|-------------|------------------|
| Lumberjack | ✅ | ✅ | ✅ | ✅ |
| `git branch -d` | ✅ | ❌ | ❌ | ❌ |
| `git worktree prune` | ❌ | ✅ (partial) | ❌ | ❌ |
| git-sweep | ✅ | ❌ | ❌ | ❌ |
| git-trim | ✅ | ❌ | ❌ | ❌ |

---

## Requirements

- Node.js 18+
- Git 2.20+

---

## License

MIT

---

## Contributing

Issues and PRs welcome at [github.com/jameshole/lumberjack](https://github.com/jameshole/lumberjack).