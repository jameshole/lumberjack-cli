#!/usr/bin/env bash
# Tests for --stale detection

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup.sh"

echo "Testing --stale detection"
echo "========================="

# ----------------------------------------------------------------------------
test_stale_detects_old_branch() {
  create_repo

  create_stale_branch "old-feature" 60

  output=$(run_chop --branch --stale=30 --dry-run)

  assert_contains "$output" "old-feature" "Should detect stale branch"
}

run_test "detects branch older than threshold" test_stale_detects_old_branch

# ----------------------------------------------------------------------------
test_stale_ignores_recent_branch() {
  create_repo

  # Create a branch with recent commit (default)
  create_branch "recent-feature"

  output=$(run_chop --branch --stale=30 --dry-run)

  assert_not_contains "$output" "recent-feature" "Should not detect recent branch"
}

run_test "ignores recent branches" test_stale_ignores_recent_branch

# ----------------------------------------------------------------------------
test_stale_with_custom_threshold() {
  create_repo

  # Create a branch 45 days old
  create_stale_branch "medium-old" 45

  # With 30 day threshold, should be detected
  output30=$(run_chop --branch --stale=30 --dry-run)
  assert_contains "$output30" "medium-old" "Should detect with 30 day threshold"

  # With 60 day threshold, should not be detected
  output60=$(run_chop --branch --stale=60 --dry-run)
  assert_not_contains "$output60" "medium-old" "Should not detect with 60 day threshold"
}

run_test "respects custom threshold" test_stale_with_custom_threshold

# ----------------------------------------------------------------------------
test_stale_deletes_with_force() {
  create_repo

  create_stale_branch "to-delete-stale" 60

  output=$(run_chop --branch --stale=30 --force)

  assert_branch_deleted "to-delete-stale" "Stale branch should be deleted"
}

run_test "deletes stale branch with --force" test_stale_deletes_with_force

# ----------------------------------------------------------------------------
test_stale_default_threshold() {
  create_repo

  # Create a branch 45 days old
  create_stale_branch "default-test" 45

  # Default threshold is 30 days
  output=$(run_chop --branch --stale --dry-run)

  assert_contains "$output" "default-test" "Should detect with default 30 day threshold"
}

run_test "uses default 30 day threshold" test_stale_default_threshold

# ----------------------------------------------------------------------------
test_stale_multiple_branches() {
  create_repo

  create_stale_branch "stale-1" 60
  create_stale_branch "stale-2" 90
  create_branch "fresh"

  output=$(run_chop --branch --stale=30 --dry-run)

  assert_contains "$output" "stale-1" "Should detect stale-1"
  assert_contains "$output" "stale-2" "Should detect stale-2"
  assert_not_contains "$output" "fresh" "Should not detect fresh"
}

run_test "handles multiple stale branches" test_stale_multiple_branches

# ----------------------------------------------------------------------------
test_stale_protects_main() {
  create_repo

  # Even if main hasn't been touched, it should be protected
  output=$(run_chop --branch --stale=1 --dry-run)

  assert_not_contains "$output" "main" "Should not list main as deletable"
}

run_test "protects main branch" test_stale_protects_main

print_summary
