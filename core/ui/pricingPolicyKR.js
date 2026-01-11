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

// ✅ [Phase A-2] Waitlist URL (KR, MVP, external form) — SSOT
// - UI/서버/DB 연동 금지: 새 탭 외부 폼으로 이동하는 URL만 관리
// - share.html에는 URL 하드코딩 금지
// - 운영 링크 확정 시 아래 한 줄만 교체
export const WAITLIST_URL_KR = 'https://example.com/waitlist';

// ✅ [Phase 30-5A] Usage unit definition (KR, UI-only) — SSOT
// - 금지: 결제/차감/로그인/usage 저장/스토리지/서버 로직 추가
export const usageUnitKR = {
  id: "usage-unit-v1",
  title: "1회 사용 정의",
  definition: "1회 사용 = 상품/URL 1개 전체 결과 세트(Analyze + Generate + 채널변환 1종 포함)",
  noteShort: "결과 1세트 생성 시 1회 사용"
};

export function getWaitlistUrlKR() {
  return WAITLIST_URL_KR;
}

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

// ✅ [Phase C] PRO copy switch layer (SSOT-only)
// - 목표: PRO 활성화 시에도 동일 모달 UI를 재사용할 수 있도록 "카피 선택" 레이어만 도입
// - 기본 동작(비활성)은 100% 동일: select 기본값은 buildProUpgradeNoticeCopyKR()와 동일해야 함
// - 금지: 결제/로그인/차감/잔여 계산/스토리지/서버 로직 추가
export function buildProActiveUpgradeNoticeCopyKR() {
  const base = buildProUpgradeNoticeCopyKR();
  return {
    ...base,
    // PRO 활성 카피는 추후 확정. 현재는 UI 스키마 유지 + 최소 문구만.
    desc: 'PRO 이용 중',
  };
}

export function selectProUpgradeNoticeCopyKR(args = {}) {
  const entitlement = args?.entitlement || { isProActive: false, reason: null };
  // default: existing behavior (must remain identical)
  if (!entitlement?.isProActive) return buildProUpgradeNoticeCopyKR();
  return buildProActiveUpgradeNoticeCopyKR();
}


