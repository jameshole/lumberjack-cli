#!/usr/bin/env bash
# Run all tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}Lumberjack Test Suite${NC}"
echo "======================="
echo ""

# Ensure we're built
echo "Building project..."
cd "$PROJECT_ROOT"
npm run build > /dev/null 2>&1

# Track overall results
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

run_suite() {
  local suite="$1"
  local name=$(basename "$suite" .sh | sed 's/test-//')

  echo ""
  echo -e "${BOLD}Running: $name${NC}"
  echo "---"

  TOTAL_SUITES=$((TOTAL_SUITES + 1))

  if bash "$suite"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
  else
    FAILED_SUITES=$((FAILED_SUITES + 1))
  fi
}

# Run all test files
for test_file in "$SCRIPT_DIR"/test-*.sh; do
  if [[ -f "$test_file" ]]; then
    run_suite "$test_file"
  fi
done

# Final summary
echo ""
echo "======================="
echo -e "${BOLD}Final Results${NC}"
echo "======================="
echo "Test suites: $TOTAL_SUITES"
echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
if [[ $FAILED_SUITES -gt 0 ]]; then
  echo -e "Failed: ${RED}$FAILED_SUITES${NC}"
  exit 1
else
  echo -e "Failed: $FAILED_SUITES"
  echo ""
  echo -e "${GREEN}All tests passed!${NC}"
fi
