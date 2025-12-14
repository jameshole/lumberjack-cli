#!/usr/bin/env bash
# Tests for --squashed detection

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup.sh"

echo "Testing --squashed detection"
echo "============================"

# ----------------------------------------------------------------------------
test_squashed_detects_squash_merged_branch() {
  create_repo

  create_squashed_branch "feature-squashed"

  output=$(run_chop --branch --squashed --dry-run)

  assert_contains "$output" "feature-squashed" "Should detect squash-merged branch"
}

run_test "detects squash-merged branch" test_squashed_detects_squash_merged_branch

# ----------------------------------------------------------------------------
test_squashed_ignores_branch_with_unique_changes() {
  create_repo

  # Create a branch with changes not in main
  create_branch "unique-changes"

  output=$(run_chop --branch --squashed --dry-run)

  assert_not_contains "$output" "unique-changes" "Should not detect branch with unique changes"
}

run_test "ignores branch with unique changes" test_squashed_ignores_branch_with_unique_changes

# ----------------------------------------------------------------------------
test_squashed_with_explicit_base() {
  create_repo

  # Create a release branch
  git checkout -q -b release
  echo "release" > release.txt
  git add .
  git commit -q -m "Release commit"

  # Create and squash merge into release
  git checkout -q -b "feature-for-release"
  echo "feature" > feature.txt
  git add .
  git commit -q -m "Feature commit"
  git checkout -q release
  git merge -q --squash feature-for-release
  git commit -q -m "Squash feature"

  git checkout -q main

  # Check against release branch
  output=$(run_chop --branch --squashed=release --dry-run)

  assert_contains "$output" "feature-for-release" "Should detect branch squashed into release"
}

run_test "works with explicit base branch" test_squashed_with_explicit_base

# ----------------------------------------------------------------------------
test_squashed_deletes_with_force() {
  create_repo

  create_squashed_branch "to-delete-squashed"

  output=$(run_chop --branch --squashed --force)

  assert_branch_deleted "to-delete-squashed" "Squashed branch should be deleted"
}

run_test "deletes squashed branch with --force" test_squashed_deletes_with_force

# ----------------------------------------------------------------------------
test_squashed_also_detects_regular_merge() {
  create_repo

  # Regular merge should also show as "squashed" since the diff is empty
  create_merged_branch "regular-merge"

  output=$(run_chop --branch --squashed --dry-run)

  assert_contains "$output" "regular-merge" "Should also detect regularly merged branch"
}

run_test "also detects regularly merged branches" test_squashed_also_detects_regular_merge

# ----------------------------------------------------------------------------
test_squashed_multiple_branches() {
  create_repo

  create_squashed_branch "squashed-1"
  create_squashed_branch "squashed-2"
  create_branch "not-squashed"

  output=$(run_chop --branch --squashed --dry-run)

  assert_contains "$output" "squashed-1" "Should detect squashed-1"
  assert_contains "$output" "squashed-2" "Should detect squashed-2"
  assert_not_contains "$output" "not-squashed" "Should not detect not-squashed"
}

run_test "handles multiple squashed branches" test_squashed_multiple_branches

print_summary
