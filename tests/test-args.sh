#!/usr/bin/env bash
# Tests for argument parsing and CLI behavior

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup.sh"

echo "Testing CLI arguments"
echo "====================="

# ----------------------------------------------------------------------------
test_help_flag() {
  create_repo

  output=$(run_chop --help)

  assert_contains "$output" "Usage:" "Should show usage"
  assert_contains "$output" "--branch" "Should list --branch flag"
  assert_contains "$output" "--gone" "Should list --gone flag"
}

run_test "--help shows usage" test_help_flag

# ----------------------------------------------------------------------------
test_version_flag() {
  create_repo

  output=$(run_chop --version)

  # Should output a version number
  assert_contains "$output" "." "Should contain version with dot"
}

run_test "--version shows version" test_version_flag

# ----------------------------------------------------------------------------
test_no_detection_flag_shows_help() {
  create_repo

  output=$(run_chop --branch)

  # Without a detection flag, should show help
  assert_contains "$output" "Usage:" "Should show help when no detection flag"
}

run_test "shows help without detection flag" test_no_detection_flag_shows_help

# ----------------------------------------------------------------------------
test_dry_run_prevents_deletion() {
  create_repo
  create_bare_remote origin

  create_branch "test-dry-run" "origin"
  delete_remote_branch origin test-dry-run

  output=$(run_chop --branch --gone --dry-run)

  assert_contains "$output" "DRY RUN" "Should indicate dry run"
  assert_branch_exists "test-dry-run" "Branch should still exist"
}

run_test "--dry-run prevents deletion" test_dry_run_prevents_deletion

# ----------------------------------------------------------------------------
test_protect_flag() {
  create_repo

  create_merged_branch "special-branch"

  # Protect special-branch
  output=$(run_chop --branch --merged --dry-run --protect special-branch)

  assert_not_contains "$output" "special-branch" "Should not list protected branch"
}

run_test "--protect prevents branch from being listed" test_protect_flag

# ----------------------------------------------------------------------------
test_protect_pattern() {
  create_repo

  create_merged_branch "release/1.0"
  create_merged_branch "release/2.0"
  create_merged_branch "feature-x"

  # Protect release/* pattern
  output=$(run_chop --branch --merged --dry-run --protect "release/*")

  assert_not_contains "$output" "release/1.0" "Should not list release/1.0"
  assert_not_contains "$output" "release/2.0" "Should not list release/2.0"
  assert_contains "$output" "feature-x" "Should list feature-x"
}

run_test "--protect supports glob patterns" test_protect_pattern

# ----------------------------------------------------------------------------
test_all_flag() {
  create_repo
  create_bare_remote origin

  # Create branches that match different detections
  create_branch "gone-branch" "origin"
  delete_remote_branch origin gone-branch

  create_merged_branch "merged-branch"
  create_stale_branch "stale-branch" 60

  output=$(run_chop --branch --all --dry-run)

  assert_contains "$output" "gone-branch" "Should detect gone branch"
  assert_contains "$output" "merged-branch" "Should detect merged branch"
  assert_contains "$output" "stale-branch" "Should detect stale branch"
}

run_test "--all combines all detection flags" test_all_flag

# ----------------------------------------------------------------------------
test_branch_only_flag() {
  create_repo
  create_bare_remote origin

  create_branch "test-branch" "origin"
  delete_remote_branch origin test-branch

  # Create a worktree too
  git checkout -q -b worktree-branch
  echo "wt" > wt.txt
  git add .
  git commit -q -m "wt commit"
  git checkout -q main
  git push -q origin worktree-branch
  delete_remote_branch origin worktree-branch
  create_worktree worktree-branch

  output=$(run_chop --branch --gone --dry-run)

  assert_contains "$output" "test-branch" "Should list branch"
  # Should not show worktree section when --branch only
  assert_not_contains "$output" "worktree" "Should not mention worktrees"
}

run_test "--branch targets only branches" test_branch_only_flag

# ----------------------------------------------------------------------------
test_short_flags() {
  create_repo

  # Test -b for --branch
  output=$(run_chop -b --gone --dry-run)
  assert_not_contains "$output" "Error" "Should accept -b flag"

  # Test -d for --dry-run
  output=$(run_chop --branch --gone -d)
  assert_contains "$output" "DRY RUN" "Should accept -d flag"
}

run_test "short flags work" test_short_flags

# ----------------------------------------------------------------------------
test_json_output_format() {
  create_repo

  create_merged_branch "json-format-test"

  output=$(run_chop --branch --merged --dry-run --json)

  # Check it's valid JSON structure
  assert_contains "$output" '"branches":' "Should have branches key"
  assert_contains "$output" '"summary":' "Should have summary key"
  assert_contains "$output" '"dryRun":' "Should have dryRun key"
}

run_test "--json outputs valid JSON" test_json_output_format

# ----------------------------------------------------------------------------
test_verbose_flag() {
  create_repo

  create_merged_branch "verbose-test"

  output=$(run_chop --branch --merged --dry-run --verbose)

  # Verbose should show more details
  # Just check it doesn't crash
  assert_not_contains "$output" "Error" "Should not error with verbose"
}

run_test "--verbose shows additional info" test_verbose_flag

# ----------------------------------------------------------------------------
test_combined_detections_or_logic() {
  create_repo
  create_bare_remote origin

  # Create a gone branch
  create_branch "only-gone" "origin"
  delete_remote_branch origin only-gone

  # Create a merged branch
  create_merged_branch "only-merged"

  # Using both --gone and --merged should detect both (OR logic)
  output=$(run_chop --branch --gone --merged --dry-run)

  assert_contains "$output" "only-gone" "Should detect gone branch"
  assert_contains "$output" "only-merged" "Should detect merged branch"
}

run_test "multiple detection flags use OR logic" test_combined_detections_or_logic

# ----------------------------------------------------------------------------
test_gone_and_squashed_combination() {
  create_repo
  create_bare_remote origin

  # Create a gone branch
  create_branch "combo-gone" "origin"
  delete_remote_branch origin combo-gone

  # Create a squashed branch
  create_squashed_branch "combo-squashed"

  # Create a branch that's neither
  create_branch "combo-neither"

  output=$(run_chop --branch --gone --squashed --dry-run)

  assert_contains "$output" "combo-gone" "Should detect gone branch"
  assert_contains "$output" "combo-squashed" "Should detect squashed branch"
  assert_not_contains "$output" "combo-neither" "Should not detect unmatched branch"
}

run_test "--gone --squashed detects both" test_gone_and_squashed_combination

# ----------------------------------------------------------------------------
test_merged_and_stale_combination() {
  create_repo

  # Create a merged branch
  create_merged_branch "combo-merged"

  # Create a stale branch (not merged)
  create_stale_branch "combo-stale" 60

  # Create a fresh unmerged branch
  create_branch "combo-fresh"

  output=$(run_chop --branch --merged --stale=30 --dry-run)

  assert_contains "$output" "combo-merged" "Should detect merged branch"
  assert_contains "$output" "combo-stale" "Should detect stale branch"
  assert_not_contains "$output" "combo-fresh" "Should not detect fresh unmerged branch"
}

run_test "--merged --stale detects both" test_merged_and_stale_combination

# ----------------------------------------------------------------------------
test_three_detection_flags() {
  create_repo
  create_bare_remote origin

  # Create branches for each detection type
  create_branch "triple-gone" "origin"
  delete_remote_branch origin triple-gone

  create_merged_branch "triple-merged"

  create_squashed_branch "triple-squashed"

  # Create unmatched branch
  create_branch "triple-none"

  output=$(run_chop --branch --gone --merged --squashed --dry-run)

  assert_contains "$output" "triple-gone" "Should detect gone"
  assert_contains "$output" "triple-merged" "Should detect merged"
  assert_contains "$output" "triple-squashed" "Should detect squashed"
  assert_not_contains "$output" "triple-none" "Should not detect unmatched"
}

run_test "three detection flags work together" test_three_detection_flags

# ----------------------------------------------------------------------------
test_branch_and_tree_together() {
  create_repo
  create_bare_remote origin

  # Create a gone branch without worktree
  create_branch "both-branch" "origin"
  delete_remote_branch origin both-branch

  # Create a gone branch with worktree
  create_branch "both-tree" "origin"
  create_worktree "both-tree" "$TEST_TEMP/worktrees/both-tree"
  delete_remote_branch origin both-tree

  # Explicitly specify both --branch and --tree
  output=$(run_chop --branch --tree --gone --dry-run)

  assert_contains "$output" "both-branch" "Should list standalone branch"
  assert_contains "$output" "both-tree" "Should list worktree"
}

run_test "--branch --tree targets both explicitly" test_branch_and_tree_together

# ----------------------------------------------------------------------------
test_branch_matching_multiple_conditions() {
  create_repo
  create_bare_remote origin

  # Create a branch that's both gone AND stale
  create_stale_branch "multi-match" 60
  git branch -u origin/main multi-match 2>/dev/null || git push -q origin multi-match
  delete_remote_branch origin multi-match

  output=$(run_chop --branch --gone --stale=30 --dry-run)

  # Should only appear once despite matching both conditions
  count=$(echo "$output" | grep -c "multi-match" || true)
  if [ "$count" -gt 2 ]; then
    echo -e "${RED}FAIL${NC}: Branch appeared too many times ($count)" >&2
    exit 1
  fi
  assert_contains "$output" "multi-match" "Should detect multi-match branch"
}

run_test "branch matching multiple conditions listed once" test_branch_matching_multiple_conditions

# ----------------------------------------------------------------------------
test_tree_only_with_multiple_detections() {
  create_repo
  create_bare_remote origin

  # Create a gone worktree
  create_branch "tree-gone" "origin"
  create_worktree "tree-gone" "$TEST_TEMP/worktrees/tree-gone"
  delete_remote_branch origin tree-gone

  # Create a stale worktree
  create_stale_branch "tree-stale" 60
  create_worktree "tree-stale" "$TEST_TEMP/worktrees/tree-stale"

  # Create a standalone gone branch (should NOT appear with --tree)
  create_branch "branch-only-gone" "origin"
  delete_remote_branch origin branch-only-gone

  output=$(run_chop --tree --gone --stale=30 --dry-run)

  assert_contains "$output" "tree-gone" "Should detect gone worktree"
  assert_contains "$output" "tree-stale" "Should detect stale worktree"
  assert_not_contains "$output" "branch-only-gone" "Should not show branch-only"
}

run_test "--tree with multiple detections targets only worktrees" test_tree_only_with_multiple_detections

# ----------------------------------------------------------------------------
test_no_false_positives() {
  create_repo
  create_bare_remote origin

  # Create various branches that should NOT be detected
  create_branch "active-local"
  create_branch "active-tracked" "origin"  # Has active remote

  # Run with all detection flags
  output=$(run_chop --branch --gone --merged --squashed --stale=30 --dry-run)

  assert_not_contains "$output" "active-local" "Should not detect active local branch"
  assert_not_contains "$output" "active-tracked" "Should not detect active tracked branch"
}

run_test "no false positives for active branches" test_no_false_positives

print_summary
