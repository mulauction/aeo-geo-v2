#!/usr/bin/env bash
set -euo pipefail

# Smoke guardrail for Phase C:
# (a) Default selector output must match the legacy builder output (SSOT-only change, no behavior change)
# (b) No new KR pricing/quota numbers should appear outside SSOT sources
#
# Allowed sources for numbers/copy:
# - core/ui/pricingPolicyKR.js
# - docs/PRICING_POLICY_KR.md

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node --input-type=module - <<'NODE'
import assert from 'node:assert/strict';
import { buildProUpgradeNoticeCopyKR, selectProUpgradeNoticeCopyKR } from './core/ui/pricingPolicyKR.js';

const legacy = buildProUpgradeNoticeCopyKR();
const selected = selectProUpgradeNoticeCopyKR();

for (const k of ['planName', 'priceText', 'quotaText', 'desc']) {
  assert.equal(selected?.[k], legacy?.[k], `default selector mismatch on "${k}"`);
}

console.log('OK: selectProUpgradeNoticeCopyKR() matches buildProUpgradeNoticeCopyKR() by default');
NODE

PATTERN='₩19,900|₩99,000|19,900|99,000|\b19900\b|\b99000\b|월\\s*100건|월\\s*1,000건|월\\s*1000건|\\b10건\\b|\\b100건\\b|\\b1,000건\\b|\\b1000건\\b'

if rg -n "${PATTERN}" "${ROOT_DIR}" \
  --glob '!server/node_modules/**' \
  --glob '!scripts/**' \
  --glob '!core/ui/pricingPolicyKR.js' \
  --glob '!docs/PRICING_POLICY_KR.md' >/dev/null; then
  echo "FAIL: pricing/quota numbers appear outside SSOT sources" >&2
  echo "--- matches ---" >&2
  rg -n "${PATTERN}" "${ROOT_DIR}" \
    --glob '!server/node_modules/**' \
    --glob '!scripts/**' \
    --glob '!core/ui/pricingPolicyKR.js' \
    --glob '!docs/PRICING_POLICY_KR.md' >&2 || true
  exit 1
fi

echo "OK: no KR pricing/quota numbers outside SSOT sources"


