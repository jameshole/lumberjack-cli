#!/usr/bin/env bash
# Test helpers for lumberjack

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Get the project root (parent of tests dir)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHOP="$PROJECT_ROOT/bin/cli.js"

# Temp directory for test repos
TEST_TEMP=""

# ============================================================================
# Setup / Teardown
# ============================================================================

setup_test_env() {
  TEST_TEMP=$(mktemp -d)
  cd "$TEST_TEMP"

  # Configure git for tests
  git config --global init.defaultBranch main 2>/dev/null || true
}

teardown_test_env() {
  if [[ -n "$TEST_TEMP" && -d "$TEST_TEMP" ]]; then
    rm -rf "$TEST_TEMP"
  fi
}

# ============================================================================
# Git Repo Helpers
# ============================================================================

# Create a basic git repo with an initial commit
create_repo() {
  local name="${1:-repo}"
  mkdir -p "$name"
  cd "$name"
  git init -q
  git config user.email "test@test.com"
  git config user.name "Test User"
  echo "initial" > README.md
  git add .
  git commit -q -m "Initial commit"
}

# Create a bare repo to act as "remote"
create_bare_remote() {
  local name="${1:-origin}"
  local remote_path="$TEST_TEMP/${name}.git"
  git clone -q --bare "$(pwd)" "$remote_path"
  git remote add "$name" "$remote_path"
  git fetch -q "$name"
  git branch -u "${name}/main" main
}

# Create a branch with optional tracking
create_branch() {
  local branch="$1"
  local track="${2:-}"  # remote name to track, or empty

  git checkout -q -b "$branch"
  echo "content for $branch" > "$branch.txt"
  git add .
  git commit -q -m "Commit on $branch"

  if [[ -n "$track" ]]; then
    git push -q -u "$track" "$branch"
  fi

  git checkout -q main
}

# Create a branch that's merged into main
create_merged_branch() {
  local branch="$1"

  git checkout -q -b "$branch"
  echo "content for $branch" > "$branch.txt"
  git add .
  git commit -q -m "Commit on $branch"
  git checkout -q main
  git merge -q --no-ff "$branch" -m "Merge $branch"
}

# Create a branch that's squash-merged into main
create_squashed_branch() {
  local branch="$1"

  git checkout -q -b "$branch"
  echo "content for $branch" > "$branch.txt"
  git add .
  git commit -q -m "Commit on $branch"
  git checkout -q main
  git merge -q --squash "$branch"
  git commit -q -m "Squash merge $branch"
}

# Create a stale branch (with old commit date)
create_stale_branch() {
  local branch="$1"
  local days_ago="${2:-60}"

  local old_date=$(date -v-${days_ago}d "+%Y-%m-%dT12:00:00" 2>/dev/null || date -d "${days_ago} days ago" "+%Y-%m-%dT12:00:00")

  git checkout -q -b "$branch"
  echo "stale content" > "$branch.txt"
  git add .
  GIT_COMMITTER_DATE="$old_date" git commit -q -m "Stale commit" --date="$old_date"
  git checkout -q main
}

# Delete a remote branch (to simulate "gone")
delete_remote_branch() {
  local remote="$1"
  local branch="$2"

  git push -q "$remote" --delete "$branch" 2>/dev/null || true
  git fetch -q --prune "$remote"
}

# Create a worktree
create_worktree() {
  local branch="$1"
  local path="${2:-$TEST_TEMP/worktrees/$branch}"

  mkdir -p "$(dirname "$path")"
  git worktree add -q "$path" "$branch"
}

# ============================================================================
# Assertions
# ============================================================================

assert_equals() {
  local expected="$1"
  local actual="$2"
  local msg="${3:-Values should be equal}"

  if [[ "$expected" == "$actual" ]]; then
    return 0
  else
    echo -e "${RED}FAIL${NC}: $msg" >&2
    echo "  Expected: $expected" >&2
    echo "  Actual:   $actual" >&2
    exit 1
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local msg="${3:-Output should contain expected text}"

  if [[ "$haystack" == *"$needle"* ]]; then
    return 0
  else
    echo -e "${RED}FAIL${NC}: $msg" >&2
    echo "  Expected to contain: $needle" >&2
    echo "  Actual output: $haystack" >&2
    exit 1
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  local msg="${3:-Output should not contain text}"

  if [[ "$haystack" != *"$needle"* ]]; then
    return 0
  else
    echo -e "${RED}FAIL${NC}: $msg" >&2
    echo "  Should not contain: $needle" >&2
    echo "  Actual output: $haystack" >&2
    exit 1
  fi
}

assert_exit_code() {
  local expected="$1"
  local actual="$2"
  local msg="${3:-Exit code mismatch}"

  assert_equals "$expected" "$actual" "$msg"
}

assert_branch_exists() {
  local branch="$1"
  local msg="${2:-Branch '$branch' should exist}"

  if git show-ref -q --verify "refs/heads/$branch" 2>/dev/null; then
    return 0
  else
    echo -e "${RED}FAIL${NC}: $msg" >&2
    exit 1
  fi
}

assert_branch_deleted() {
  local branch="$1"
  local msg="${2:-Branch '$branch' should be deleted}"

  if ! git show-ref -q --verify "refs/heads/$branch" 2>/dev/null; then
    return 0
  else
    echo -e "${RED}FAIL${NC}: $msg" >&2
    exit 1
  fi
}

assert_worktree_exists() {
  local path="$1"
  local msg="${2:-Worktree at '$path' should exist}"

  if git worktree list | grep -q "$path"; then
    return 0
  else
    echo -e "${RED}FAIL${NC}: $msg" >&2
    exit 1
  fi
}

assert_worktree_removed() {
  local path="$1"
  local msg="${2:-Worktree at '$path' should be removed}"

  if ! git worktree list | grep -q "$path"; then
    return 0
  else
    echo -e "${RED}FAIL${NC}: $msg" >&2
    exit 1
  fi
}

# ============================================================================
# Test Runner
# ============================================================================

run_test() {
  local test_name="$1"
  local test_func="$2"

  TESTS_RUN=$((TESTS_RUN + 1))

  # Setup fresh environment for each test
  setup_test_env

  echo -n "  $test_name ... "

  # Run the test
  local result=0
  (set -e; $test_func) || result=$?

  if [[ $result -eq 0 ]]; then
    echo -e "${GREEN}OK${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}FAILED${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Cleanup
  teardown_test_env
}

print_summary() {
  echo ""
  echo "=================================="
  echo -e "Tests run: $TESTS_RUN"
  echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
  if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
  else
    echo -e "Failed: $TESTS_FAILED"
  fi
  echo "=================================="

  if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
  fi
}

# Run chop with common flags (always skip fetch, use force to avoid prompts in non-dry-run)
run_chop() {
  node "$CHOP" --no-fetch "$@" 2>&1
}
