#!/bin/bash

# Share Page Smoke Test Helper Script
# macOS compatible bash script for Share page A/B/C tests

# ============================================================================
# Configuration Variables
# ============================================================================

BASE_URL="http://localhost:5502"
VALID_R="(user paste here)"

# ============================================================================
# Test URLs
# ============================================================================

TEST_A_URL="${BASE_URL}/share.html?r=${VALID_R}"
TEST_B_URL="${BASE_URL}/share.html?r=does-not-exist"
TEST_C_URL="${BASE_URL}/share.html"

# ============================================================================
# Functions
# ============================================================================

print_separator() {
    echo ""
    echo "=========================================="
    echo ""
}

print_test_header() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# ============================================================================
# Main Script
# ============================================================================

echo "Share Page Smoke Test Helper"
echo "=============================="
echo ""
echo "Base URL: ${BASE_URL}"
echo "Valid R: ${VALID_R}"
echo ""

# Test A: Valid Report ID
print_test_header "Test A: Valid Report ID"
echo "URL: ${TEST_A_URL}"
echo ""
echo "Expected:"
echo "  - Page loads with report content"
echo "  - WHY panel renders below Reliability section"
echo "  - Action line displays recommendation"
echo ""
read -p "Open in browser? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "${TEST_A_URL}"
fi

print_separator

# Test B: Non-existent Report ID
print_test_header "Test B: Non-existent Report ID"
echo "URL: ${TEST_B_URL}"
echo ""
echo "Expected:"
echo "  - Page shows fallback/error message"
echo "  - WHY panel still renders"
echo "  - No console errors"
echo ""
read -p "Open in browser? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "${TEST_B_URL}"
fi

print_separator

# Test C: Cleared localStorage
print_test_header "Test C: Cleared localStorage"
echo "URL: ${TEST_C_URL}"
echo ""
echo "Console Commands (copy and paste into browser console):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "localStorage.removeItem('__lastV2');"
echo "localStorage.removeItem('__currentReportId');"
echo "localStorage.removeItem('aeo_state_v2');"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Then navigate to: ${TEST_C_URL}"
echo ""
echo "Expected:"
echo "  - Page shows fallback message"
echo "  - WHY panel still renders"
echo "  - No console errors"
echo ""
read -p "Open in browser? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "${TEST_C_URL}"
fi

print_separator

echo "Test URLs Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test A: ${TEST_A_URL}"
echo "Test B: ${TEST_B_URL}"
echo "Test C: ${TEST_C_URL}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Pass Criteria:"
echo "  ✓ No console errors"
echo "  ✓ Page not blank"
echo "  ✓ WHY block + action line renders correctly"
echo "  ✓ No rendering breaks"
echo ""
echo "Done!"

