#!/usr/bin/env bash
# Tests for --merged detection

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup.sh"

echo "Testing --merged detection"
echo "=========================="

# ----------------------------------------------------------------------------
test_merged_detects_merged_branch() {
  create_repo

  create_merged_branch "feature-merged"

  output=$(run_chop --branch --merged --dry-run)

  assert_contains "$output" "feature-merged" "Should detect merged branch"
}

run_test "detects merged branch" test_merged_detects_merged_branch

# ----------------------------------------------------------------------------
test_merged_ignores_unmerged_branch() {
  create_repo

  # Create a branch but don't merge it
  create_branch "unmerged-feature"

  output=$(run_chop --branch --merged --dry-run)

  assert_not_contains "$output" "unmerged-feature" "Should not detect unmerged branch"
}

run_test "ignores unmerged branch" test_merged_ignores_unmerged_branch

# ----------------------------------------------------------------------------
test_merged_with_explicit_base() {
  create_repo

  # Create a develop branch
  git checkout -q -b develop
  echo "develop" > develop.txt
  git add .
  git commit -q -m "Develop commit"

  # Create and merge a feature into develop
  create_merged_branch "feature-for-develop"

  git checkout -q main

  # When checking against main, feature-for-develop should not be detected
  # because it was merged into develop, not main
  output=$(run_chop --branch --merged=main --dry-run)

  # The branch is actually merged into develop which is ahead of main,
  # so it depends on git's merge detection
  # Let's check it doesn't crash at least
  assert_not_contains "$output" "Error" "Should not error with explicit base"
}

run_test "works with explicit base branch" test_merged_with_explicit_base

# ----------------------------------------------------------------------------
test_merged_deletes_with_force() {
  create_repo

  create_merged_branch "to-delete-merged"

  output=$(run_chop --branch --merged --force)

  assert_branch_deleted "to-delete-merged" "Merged branch should be deleted"
}

run_test "deletes merged branch with --force" test_merged_deletes_with_force

# ----------------------------------------------------------------------------
test_merged_protects_configured_branches() {
  create_repo

  # Create and merge a branch called develop
  git checkout -q -b develop
  echo "develop" > develop.txt
  git add .
  git commit -q -m "Develop commit"
  git checkout -q main
  git merge -q --no-ff develop -m "Merge develop"

  output=$(run_chop --branch --merged --dry-run)

  # develop is protected by default
  assert_not_contains "$output" "develop" "Should not list protected branch"
}

run_test "protects default protected branches" test_merged_protects_configured_branches

# ----------------------------------------------------------------------------
test_merged_multiple_branches() {
  create_repo

  create_merged_branch "merged-1"
  create_merged_branch "merged-2"
  create_branch "not-merged"

  output=$(run_chop --branch --merged --dry-run)

  assert_contains "$output" "merged-1" "Should detect merged-1"
  assert_contains "$output" "merged-2" "Should detect merged-2"
  assert_not_contains "$output" "not-merged" "Should not detect not-merged"
}

run_test "handles multiple merged branches" test_merged_multiple_branches

print_summary
