#!/usr/bin/env bash
# Tests for configuration file loading and precedence

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/setup.sh"

echo "Testing configuration"
echo "====================="

# ----------------------------------------------------------------------------
test_project_lumberjackrc() {
  create_repo

  # Create a branch that would be protected by config
  create_merged_branch "staging"

  # Create project .lumberjackrc that protects staging
  echo '{"protect": ["main", "master", "develop", "staging"]}' > .lumberjackrc

  output=$(run_chop --branch --merged --dry-run)

  assert_not_contains "$output" "staging" "Project config should protect staging"
}

run_test "project .lumberjackrc protects branches" test_project_lumberjackrc

# ----------------------------------------------------------------------------
test_config_stale_default() {
  create_repo

  # Create branch that's 45 days old
  create_stale_branch "medium-old" 45

  # Config sets stale to 60 days
  echo '{"stale": 60}' > .lumberjackrc

  # Without explicit value, should use config's 60 days
  output=$(run_chop --branch --stale --dry-run)

  # 45 day old branch should NOT be detected with 60 day threshold
  assert_not_contains "$output" "medium-old" "Config stale threshold should be used"
}

run_test "config stale threshold is used when flag has no value" test_config_stale_default

# ----------------------------------------------------------------------------
test_cli_overrides_config_stale() {
  create_repo

  # Create branch that's 45 days old
  create_stale_branch "medium-old" 45

  # Config sets stale to 60 days
  echo '{"stale": 60}' > .lumberjackrc

  # CLI specifies 30 days, should override config
  output=$(run_chop --branch --stale=30 --dry-run)

  # 45 day old branch SHOULD be detected with CLI's 30 day threshold
  assert_contains "$output" "medium-old" "CLI should override config stale threshold"
}

run_test "CLI --stale=N overrides config stale" test_cli_overrides_config_stale

# ----------------------------------------------------------------------------
test_config_merge_base() {
  create_repo

  # Create a release branch
  git checkout -q -b release
  echo "release" > release.txt
  git add .
  git commit -q -m "Release commit"

  # Create branch merged into release (not main)
  git checkout -q -b "feature-for-release"
  echo "feature" > feature.txt
  git add .
  git commit -q -m "Feature commit"
  git checkout -q release
  git merge -q feature-for-release
  git checkout -q main

  # Config sets mergeBase to release
  echo '{"mergeBase": "release"}' > .lumberjackrc

  # Without explicit base, should use config's release
  output=$(run_chop --branch --merged --dry-run)

  assert_contains "$output" "feature-for-release" "Config mergeBase should be used"
}

run_test "config mergeBase is used for --merged" test_config_merge_base

# ----------------------------------------------------------------------------
test_config_default_command() {
  create_repo

  create_merged_branch "auto-detect"

  # Config sets defaultCommand
  echo '{"defaultCommand": "--branch --merged --dry-run"}' > .lumberjackrc

  # Running without arguments should use defaultCommand
  output=$(run_chop)

  assert_contains "$output" "auto-detect" "defaultCommand should be used"
}

run_test "config defaultCommand is used when no flags given" test_config_default_command

# ----------------------------------------------------------------------------
test_cli_protect_adds_to_config() {
  create_repo

  create_merged_branch "config-protected"
  create_merged_branch "cli-protected"

  # Config protects one branch
  echo '{"protect": ["main", "config-protected"]}' > .lumberjackrc

  # CLI adds another protected branch
  output=$(run_chop --branch --merged --dry-run --protect cli-protected)

  assert_not_contains "$output" "config-protected" "Config-protected branch should be protected"
  assert_not_contains "$output" "cli-protected" "CLI-protected branch should be protected"
}

run_test "CLI --protect adds to config protect list" test_cli_protect_adds_to_config

# ----------------------------------------------------------------------------
test_no_protect_overrides_config() {
  create_repo

  create_merged_branch "develop"

  # develop is protected by default
  # --no-protect should disable all protection
  output=$(run_chop --branch --merged --dry-run --no-protect)

  assert_contains "$output" "develop" "--no-protect should disable default protection"
}

run_test "--no-protect disables config protection" test_no_protect_overrides_config

# ----------------------------------------------------------------------------
test_config_fetch_false() {
  create_repo
  create_bare_remote origin

  create_branch "fetch-test" "origin"
  delete_remote_branch origin fetch-test

  # Config disables fetch
  echo '{"fetch": false}' > .lumberjackrc

  # This should work without fetching (branch is already marked gone locally)
  output=$(run_chop --branch --gone --dry-run 2>&1)

  # Just verify it runs without error
  assert_not_contains "$output" "fatal" "Should work with fetch disabled"
}

run_test "config fetch: false disables auto-fetch" test_config_fetch_false

# ----------------------------------------------------------------------------
test_cli_no_fetch_overrides_config() {
  create_repo
  create_bare_remote origin

  create_branch "no-fetch-test" "origin"
  delete_remote_branch origin no-fetch-test

  # Config enables fetch (default)
  echo '{"fetch": true}' > .lumberjackrc

  # --no-fetch should override config
  output=$(run_chop --branch --gone --dry-run --no-fetch 2>&1)

  assert_not_contains "$output" "fatal" "--no-fetch should work"
}

run_test "CLI --no-fetch overrides config fetch" test_cli_no_fetch_overrides_config

# ----------------------------------------------------------------------------
test_package_json_config() {
  create_repo

  create_merged_branch "pkg-protected"

  # Add lumberjack config to package.json
  echo '{"name": "test", "lumberjack": {"protect": ["main", "pkg-protected"]}}' > package.json

  output=$(run_chop --branch --merged --dry-run)

  assert_not_contains "$output" "pkg-protected" "package.json config should protect branch"
}

run_test "package.json lumberjack config is loaded" test_package_json_config

# ----------------------------------------------------------------------------
test_lumberjackrc_overrides_package_json() {
  create_repo

  create_merged_branch "only-in-pkg"
  create_merged_branch "only-in-rc"

  # package.json protects one branch
  echo '{"name": "test", "lumberjack": {"protect": ["main", "only-in-pkg"]}}' > package.json

  # .lumberjackrc protects different branch (should override)
  echo '{"protect": ["main", "only-in-rc"]}' > .lumberjackrc

  output=$(run_chop --branch --merged --dry-run)

  # .lumberjackrc should override package.json, so only-in-pkg is NOT protected
  assert_contains "$output" "only-in-pkg" ".lumberjackrc should override package.json"
  assert_not_contains "$output" "only-in-rc" ".lumberjackrc protection should apply"
}

run_test ".lumberjackrc overrides package.json config" test_lumberjackrc_overrides_package_json

# ----------------------------------------------------------------------------
test_invalid_config_ignored() {
  create_repo

  create_merged_branch "test-branch"

  # Invalid JSON should be ignored, defaults should apply
  echo 'this is not valid json' > .lumberjackrc

  output=$(run_chop --branch --merged --dry-run)

  # Should still work with defaults
  assert_contains "$output" "test-branch" "Invalid config should be ignored"
}

run_test "invalid config file is ignored" test_invalid_config_ignored

# ----------------------------------------------------------------------------
test_config_squashed_merge_base() {
  create_repo

  # Create a release branch
  git checkout -q -b release
  echo "release" > release.txt
  git add .
  git commit -q -m "Release commit"

  # Create and squash merge into release
  git checkout -q -b "squash-feature"
  echo "feature" > squash-feature.txt
  git add .
  git commit -q -m "Squash feature commit"
  git checkout -q release
  git merge -q --squash squash-feature
  git commit -q -m "Squash merge"
  git checkout -q main

  # Config sets mergeBase to release
  echo '{"mergeBase": "release"}' > .lumberjackrc

  # Without explicit base, should use config's release for squashed detection
  output=$(run_chop --branch --squashed --dry-run)

  assert_contains "$output" "squash-feature" "Config mergeBase should be used for --squashed"
}

run_test "config mergeBase is used for --squashed" test_config_squashed_merge_base

print_summary
