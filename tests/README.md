# Lumberjack Test Suite

Integration tests for the `chop` CLI command.

## Running Tests

```bash
# Run all tests
npm test

# Run a specific test suite
bash tests/test-args.sh
bash tests/test-config.sh
bash tests/test-gone.sh
bash tests/test-merged.sh
bash tests/test-squashed.sh
bash tests/test-stale.sh
bash tests/test-worktrees.sh
```

## Test Structure

```
tests/
├── setup.sh           # Shared helpers and test runner
├── run.sh             # Main test runner (runs all test-*.sh files)
├── test-args.sh       # CLI argument parsing and flag combinations
├── test-config.sh     # Configuration file loading and precedence
├── test-gone.sh       # --gone detection (deleted remotes)
├── test-merged.sh     # --merged detection
├── test-squashed.sh   # --squashed detection
├── test-stale.sh      # --stale detection
└── test-worktrees.sh  # Worktree handling
```

## Writing Tests

### Basic Test Structure

Each test file should:
1. Source the setup helpers
2. Define test functions
3. Run tests using `run_test`
4. Print summary at the end

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup.sh"

echo "Testing feature X"
echo "=================="

test_my_feature() {
  create_repo

  # Setup test scenario...
  create_merged_branch "feature-branch"

  # Run chop and capture output
  output=$(run_chop --branch --merged --dry-run)

  # Assert expected results
  assert_contains "$output" "feature-branch" "Should detect merged branch"
}

run_test "my feature works" test_my_feature

print_summary
```

### Available Helpers

#### Git Repository Setup

| Helper | Description |
|--------|-------------|
| `create_repo [name]` | Create a git repo with initial commit |
| `create_bare_remote <name>` | Create a bare remote (simulates origin) |
| `create_branch <name> [remote]` | Create a branch, optionally tracking a remote |
| `create_merged_branch <name>` | Create a branch merged into main |
| `create_squashed_branch <name>` | Create a branch squash-merged into main |
| `create_stale_branch <name> [days]` | Create a branch with old commit date (default: 60 days) |
| `delete_remote_branch <remote> <branch>` | Delete a remote branch (creates "gone" state) |
| `create_worktree <branch> [path]` | Create a worktree for a branch |

#### Running the CLI

```bash
output=$(run_chop --branch --gone --dry-run)
```

The `run_chop` helper:
- Runs the CLI with `--no-fetch` (avoids network calls)
- Captures both stdout and stderr
- Returns the combined output

#### Assertions

| Assertion | Description |
|-----------|-------------|
| `assert_equals <expected> <actual> [msg]` | Values should be equal |
| `assert_contains <output> <text> [msg]` | Output should contain text |
| `assert_not_contains <output> <text> [msg]` | Output should NOT contain text |
| `assert_exit_code <expected> <actual> [msg]` | Exit code should match |
| `assert_branch_exists <name> [msg]` | Branch should exist |
| `assert_branch_deleted <name> [msg]` | Branch should be deleted |
| `assert_worktree_exists <path> [msg]` | Worktree should exist |
| `assert_worktree_removed <path> [msg]` | Worktree should be removed |

### Test Isolation

Each test runs in a fresh temporary directory. The `run_test` function:
1. Creates a new temp directory
2. Runs your test function
3. Cleans up the temp directory

You don't need to worry about cleanup - just set up your scenario and test.

### Testing Actual Deletions

For tests that verify actual deletion (not just `--dry-run`):

```bash
test_actual_deletion() {
  create_repo
  create_bare_remote origin
  create_branch "to-delete" "origin"
  delete_remote_branch origin to-delete

  # Use --force to skip confirmation prompts
  run_chop --branch --gone --force

  # Verify branch was actually deleted
  assert_branch_deleted "to-delete" "Branch should be deleted"
}
```

### Testing Configuration

```bash
test_config_option() {
  create_repo

  # Create a .lumberjackrc file
  echo '{"protect": ["main", "staging"]}' > .lumberjackrc

  create_merged_branch "staging"

  output=$(run_chop --branch --merged --dry-run)

  # staging should be protected by config
  assert_not_contains "$output" "staging" "Config should protect staging"
}
```

### Naming Conventions

- Test files: `test-<feature>.sh`
- Test functions: `test_<description>` (snake_case)
- Test names (for output): Human-readable descriptions
