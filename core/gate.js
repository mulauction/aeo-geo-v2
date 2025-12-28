import { getStore, setStore } from "./store.js";

let loginModal = null;
let creditModal = null;

export function setModals(login, credit) {
  loginModal = login;
  creditModal = credit;
}

/**
 * ✅ [Phase 4-2 Gate] 로그인 상태 확인 단일 진실 함수
 * localStorage에 저장된 auth 토큰(또는 로그인 플래그)을 기준으로 true/false 리턴
 * @returns {boolean} 로그인 여부
 */
export function isLoggedIn() {
  const store = getStore();
  return store.auth.isLoggedIn === true;
}

/**
 * ✅ [Phase 4-2 Gate] 게이트 또는 경고 유틸
 * 로그인 true면 true 리턴, false면 alert 후 false 리턴
 * @param {string} actionName - 액션 이름 (로그용)
 * @returns {boolean} 로그인 여부
 */
export function gateOrWarn(actionName) {
  if (isLoggedIn()) {
    return true;
  }
  console.info(`[Gate] ${actionName} blocked: login required`);
  alert("로그인 후 사용 가능합니다.");
  return false;
}

export function requireLogin({ reason = "" } = {}) {
  if (!isLoggedIn()) {
    if (loginModal) {
      loginModal.open(reason);
    }
    return false;
  }
  return true;
}

export function requireCredit(cost, { reason = "" } = {}) {
  const store = getStore();
  if (store.credit.balance < cost) {
    if (creditModal) {
      creditModal.open(cost, reason);
    }
    return false;
  }
  return true;
}

