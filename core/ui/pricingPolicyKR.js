// core/ui/pricingPolicyKR.js
// KR pricing/quota policy (UI-only)
// - This module must NOT access DOM.
// - This module must NOT implement billing/login/quota deduction logic.

export const PRICING_POLICY_KR = {
  FREE: { trial: 10, reset: 'none' },
  BASIC: { monthly: 100, price: 19900 },
  PRO: { monthly: 1000, price: 99000 },
  rules: { noUnlimited: true, noTokenWord: true },
};

export function buildQuotaBadgeCopyKR() {
  return {
    planText: `FREE · 체험 ${PRICING_POLICY_KR.FREE.trial}건 제공`,
    remainingText: '잔여 분석: —',
  };
}

export function buildProModalCopyKR() {
  return {
    title: 'PRO 기능은 준비 중입니다',
    desc: '대량 분석/자동 개선/브랜드 관리 등 PRO 기능을 곧 제공합니다.',
  };
}

export function buildProCtaCopyKR() {
  return {
    ctaText: 'PRO 기능 안내',
  };
}


