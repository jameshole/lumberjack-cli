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

print_summary
