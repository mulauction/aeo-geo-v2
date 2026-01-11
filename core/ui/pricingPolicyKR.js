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
    title: 'PRO 기능 안내 (준비 중)',
    desc: '대량 분석, 자동 개선, 브랜드/상품 관리, 리포트 비교·공유 고도화 기능을 준비 중입니다. 출시 전까지는 대기자 등록으로 순차 안내드립니다.',
  };
}

export function buildProCtaCopyKR() {
  return {
    ctaText: 'PRO 기능 안내',
  };
}

export function buildProUpgradeNoticeCopyKR() {
  const nf = new Intl.NumberFormat('ko-KR');
  const priceText = `₩${nf.format(PRICING_POLICY_KR.PRO.price)}/월`;
  const quotaText = `월 ${nf.format(PRICING_POLICY_KR.PRO.monthly)}건`;
  return {
    // ✅ [Phase 29-0] PRO upgrade notice copy (KR, UI-only)
    planName: 'PRO',
    priceText,
    quotaText,
    desc: buildProModalCopyKR().desc, // 기존 설명 문구 유지(단일 소스)
  };
}


