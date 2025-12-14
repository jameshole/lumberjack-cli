#!/usr/bin/env bash
# Tests for --gone detection

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup.sh"

echo "Testing --gone detection"
echo "========================"

# ----------------------------------------------------------------------------
test_gone_detects_branch_with_deleted_remote() {
  create_repo
  create_bare_remote origin

  # Create a branch that tracks origin
  create_branch "feature-x" "origin"

  # Delete the remote branch
  delete_remote_branch origin feature-x

  # Run chop --gone --dry-run
  output=$(run_chop --branch --gone --dry-run)

  assert_contains "$output" "feature-x" "Should detect feature-x as gone"
  assert_contains "$output" "Would delete" "Should show dry run message"
  assert_branch_exists "feature-x" "Branch should still exist (dry run)"
}

run_test "detects branch with deleted remote" test_gone_detects_branch_with_deleted_remote

# ----------------------------------------------------------------------------
test_gone_deletes_branch_with_force() {
  create_repo
  create_bare_remote origin

  create_branch "feature-to-delete" "origin"
  delete_remote_branch origin feature-to-delete

  # Run without dry-run, with force
  output=$(run_chop --branch --gone --force)

  assert_contains "$output" "Deleted branch" "Should show deletion message"
  assert_branch_deleted "feature-to-delete" "Branch should be deleted"
}

run_test "deletes gone branch with --force" test_gone_deletes_branch_with_force

# ----------------------------------------------------------------------------
test_gone_ignores_local_only_branch() {
  create_repo
  create_bare_remote origin

  # Create a branch without tracking
  create_branch "local-only"

  output=$(run_chop --branch --gone --dry-run)

  assert_not_contains "$output" "local-only" "Should not detect local-only branch"
}

run_test "ignores local-only branches" test_gone_ignores_local_only_branch

# ----------------------------------------------------------------------------
test_gone_ignores_branch_with_active_remote() {
  create_repo
  create_bare_remote origin

  # Create a branch that still has its remote
  create_branch "active-feature" "origin"

  output=$(run_chop --branch --gone --dry-run)

  assert_not_contains "$output" "active-feature" "Should not detect branch with active remote"
}

run_test "ignores branches with active remote" test_gone_ignores_branch_with_active_remote

# ----------------------------------------------------------------------------
test_gone_protects_main_branch() {
  create_repo
  create_bare_remote origin

  # Even if we somehow mark main as gone, it should be protected
  output=$(run_chop --branch --gone --dry-run)

  assert_not_contains "$output" "main" "Should not list main as deletable"
}

run_test "protects main branch" test_gone_protects_main_branch

# ----------------------------------------------------------------------------
test_gone_with_multiple_branches() {
  create_repo
  create_bare_remote origin

  create_branch "gone-1" "origin"
  create_branch "gone-2" "origin"
  create_branch "still-active" "origin"

  delete_remote_branch origin gone-1
  delete_remote_branch origin gone-2

  output=$(run_chop --branch --gone --dry-run)

  assert_contains "$output" "gone-1" "Should detect gone-1"
  assert_contains "$output" "gone-2" "Should detect gone-2"
  assert_not_contains "$output" "still-active" "Should not detect still-active"
}

run_test "handles multiple gone branches" test_gone_with_multiple_branches

# ----------------------------------------------------------------------------
test_gone_json_output() {
  create_repo
  create_bare_remote origin

  create_branch "json-test" "origin"
  delete_remote_branch origin json-test

  output=$(run_chop --branch --gone --dry-run --json)

  assert_contains "$output" '"name": "json-test"' "JSON should contain branch name"
  assert_contains "$output" '"dryRun": true' "JSON should indicate dry run"
}

run_test "outputs valid JSON with --json flag" test_gone_json_output

print_summary
