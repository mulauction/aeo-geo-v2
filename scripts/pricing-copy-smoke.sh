#!/usr/bin/env bash
set -euo pipefail

# Smoke guardrail: pricing/quota/PRO copy must NOT be hardcoded in share.html
# Allowed sources:
# - core/ui/pricingPolicyKR.js
# - docs/PRICING_POLICY_KR.md
#
# NOTE: This script intentionally checks ONLY share.html to keep scope tight.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHARE_HTML="${ROOT_DIR}/share.html"

if [[ ! -f "${SHARE_HTML}" ]]; then
  echo "FAIL: share.html not found at ${SHARE_HTML}" >&2
  exit 1
fi

PATTERN='PRO 기능은 준비 중입니다|PRO 기능 안내|대량 분석/자동 개선/브랜드 관리|FREE · 체험|잔여 분석:|19,900|99,000|\b19900\b|\b99000\b|\b10건\b|\b100건\b|\b1,000건\b|\b1000건\b'

if rg -n "${PATTERN}" "${SHARE_HTML}" >/dev/null; then
  echo "FAIL: pricing/quota/PRO copy appears to be hardcoded in share.html" >&2
  echo "--- matches ---" >&2
  rg -n "${PATTERN}" "${SHARE_HTML}" >&2 || true
  exit 1
fi

echo "OK: share.html contains no hardcoded KR pricing/quota/PRO copy"


