#!/usr/bin/env bash
# Tests for worktree handling

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup.sh"

echo "Testing worktree handling"
echo "========================="

# ----------------------------------------------------------------------------
test_worktree_gone_detection() {
  create_repo
  create_bare_remote origin

  # Create a branch with tracking and a worktree
  create_branch "wt-gone" "origin"
  create_worktree "wt-gone" "$TEST_TEMP/worktrees/wt-gone"

  # Delete the remote
  delete_remote_branch origin wt-gone

  output=$(run_chop --tree --gone --dry-run)

  assert_contains "$output" "wt-gone" "Should detect worktree with gone remote"
}

run_test "detects worktree with gone remote" test_worktree_gone_detection

# ----------------------------------------------------------------------------
test_worktree_squashed_detection() {
  create_repo

  # Create a branch, squash merge it, then create a worktree
  git checkout -q -b "wt-squash"
  echo "content" > wt-squash.txt
  git add .
  git commit -q -m "wt-squash commit"
  git checkout -q main
  git merge -q --squash wt-squash
  git commit -q -m "Squash merge wt-squash"

  create_worktree "wt-squash" "$TEST_TEMP/worktrees/wt-squash"

  output=$(run_chop --tree --squashed --dry-run)

  assert_contains "$output" "wt-squash" "Should detect squashed worktree"
}

run_test "detects worktree for squashed branch" test_worktree_squashed_detection

# ----------------------------------------------------------------------------
test_worktree_stale_detection() {
  create_repo

  create_stale_branch "wt-stale" 60
  create_worktree "wt-stale" "$TEST_TEMP/worktrees/wt-stale"

  output=$(run_chop --tree --stale=30 --dry-run)

  assert_contains "$output" "wt-stale" "Should detect stale worktree"
}

run_test "detects stale worktree" test_worktree_stale_detection

# ----------------------------------------------------------------------------
test_worktree_removal_with_force() {
  create_repo
  create_bare_remote origin

  create_branch "wt-to-remove" "origin"
  local wt_path="$TEST_TEMP/worktrees/wt-to-remove"
  create_worktree "wt-to-remove" "$wt_path"

  delete_remote_branch origin wt-to-remove

  output=$(run_chop --tree --gone --force)

  assert_worktree_removed "$wt_path" "Worktree should be removed"
  # Branch should also be deleted
  assert_branch_deleted "wt-to-remove" "Associated branch should be deleted"
}

run_test "removes worktree and branch with --force" test_worktree_removal_with_force

# ----------------------------------------------------------------------------
test_keep_branch_flag() {
  create_repo
  create_bare_remote origin

  create_branch "wt-keep" "origin"
  local wt_path="$TEST_TEMP/worktrees/wt-keep"
  create_worktree "wt-keep" "$wt_path"

  delete_remote_branch origin wt-keep

  output=$(run_chop --tree --gone --force --keep-branch)

  assert_worktree_removed "$wt_path" "Worktree should be removed"
  # Branch should NOT be deleted with --keep-branch
  assert_branch_exists "wt-keep" "Branch should be kept with --keep-branch"
}

run_test "--keep-branch preserves branch when removing worktree" test_keep_branch_flag

# ----------------------------------------------------------------------------
test_tree_only_flag() {
  create_repo
  create_bare_remote origin

  # Create a gone branch without worktree
  create_branch "branch-only" "origin"
  delete_remote_branch origin branch-only

  # Create a gone branch with worktree
  create_branch "with-worktree" "origin"
  create_worktree "with-worktree" "$TEST_TEMP/worktrees/with-worktree"
  delete_remote_branch origin with-worktree

  output=$(run_chop --tree --gone --dry-run)

  # Should only show worktree, not the standalone branch
  assert_contains "$output" "with-worktree" "Should list worktree"
  assert_not_contains "$output" "branch-only" "Should not list standalone branch"
}

run_test "--tree targets only worktrees" test_tree_only_flag

# ----------------------------------------------------------------------------
test_both_branches_and_worktrees() {
  create_repo
  create_bare_remote origin

  # Create a gone branch without worktree
  create_branch "branch-gone" "origin"
  delete_remote_branch origin branch-gone

  # Create a gone branch with worktree
  create_branch "wt-branch-gone" "origin"
  create_worktree "wt-branch-gone" "$TEST_TEMP/worktrees/wt-branch-gone"
  delete_remote_branch origin wt-branch-gone

  # No --branch or --tree means both
  output=$(run_chop --gone --dry-run)

  assert_contains "$output" "branch-gone" "Should list branch"
  assert_contains "$output" "wt-branch-gone" "Should list worktree"
}

run_test "detects both branches and worktrees by default" test_both_branches_and_worktrees

# ----------------------------------------------------------------------------
test_worktree_json_output() {
  create_repo
  create_bare_remote origin

  create_branch "wt-json" "origin"
  create_worktree "wt-json" "$TEST_TEMP/worktrees/wt-json"
  delete_remote_branch origin wt-json

  output=$(run_chop --tree --gone --dry-run --json)

  assert_contains "$output" '"worktrees":' "Should have worktrees key"
  assert_contains "$output" 'wt-json' "Should contain worktree info"
}

run_test "JSON output includes worktrees" test_worktree_json_output

print_summary
