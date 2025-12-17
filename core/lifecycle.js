import { getState } from "./state.js";
import { render } from "./view.js";
import { bindActions } from "./actions.js";
import { renderHeader } from "./header.js";
import { createLoginModal, createCreditModal } from "./modal.js";
import { setModals, gateOrWarn } from "./gate.js";

export function boot() {
  const root = {
    inputText: document.getElementById("inputText"),
    btnAnalyze: document.getElementById("btnAnalyze"),
    status: document.getElementById("status"),
    result: document.getElementById("result"),
  };

  // ✅ [1] 가장 먼저: URL 구조 CTA 선점 리스너 (캡처 + 즉시 전파 차단)
  if (!window.__urlStructureCtaBound) {
    window.__urlStructureCtaBound = true;

    document.addEventListener(
      'click',
      (e) => {
        const hit = e.target.closest('a[data-cta="url-structure"], [data-cta="url-structure"]');
        if (!hit) return;

        // ✅ [Phase 4-2 Gate] 로그인 게이트 체크
        if (!gateOrWarn("URL 구조 점수 측정")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }

        // 다른 핸들러가 이 클릭을 먹지 못하게 선점
        e.preventDefault();
        e.stopImmediatePropagation();

        // 네비게이션은 동기/비동기 모두 안전하게
        const url = './generate/index.html#url';
        queueMicrotask(() => { window.location.href = url; });
      },
      true // capture
    );
  }

  // ✅ 포인터 다운 동안 DOM 재렌더가 click을 깨는 문제 방지
  if (!window.__uiPointerDownGuardBound) {
    window.__uiPointerDownGuardBound = true;
    window.__uiPointerIsDown = false;

    document.addEventListener('pointerdown', () => { window.__uiPointerIsDown = true; }, true);
    document.addEventListener('pointerup',   () => { window.__uiPointerIsDown = false; }, true);
    document.addEventListener('pointercancel', () => { window.__uiPointerIsDown = false; }, true);
  }

  const headerEl = document.getElementById("header");
  if (headerEl) {
    renderHeader(headerEl);
  }

  const loginModal = createLoginModal();
  const creditModal = createCreditModal();
  setModals(loginModal, creditModal);
  window.loginModalInstance = loginModal;

  const params = new URLSearchParams(window.location.search);
  const product = params.get("product");
  const brand = params.get("brand");
  
  if (product) {
    root.inputText.value = product;
    if (brand) {
      root.inputText.value = `${brand} ${product}`;
    }
    // 채운 뒤 상품명 input에 focus
    root.inputText.focus();
  }

  bindActions(root);
  render(root, getState());

  setInterval(() => {
    // ✅ 클릭 중에는 렌더를 건너뛰어 click이 취소되지 않게 함
    if (window.__uiPointerIsDown) return;
    render(root, getState());
  }, 120);
}
