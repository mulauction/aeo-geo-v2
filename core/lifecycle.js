import { getState } from "./state.js";
import { render } from "./view.js";
import { bindActions } from "./actions.js";
import { renderHeader } from "./header.js";
import { createLoginModal, createCreditModal } from "./modal.js";
import { setModals } from "./gate.js";

export function boot() {
  const root = {
    inputText: document.getElementById("inputText"),
    btnAnalyze: document.getElementById("btnAnalyze"),
    status: document.getElementById("status"),
    result: document.getElementById("result"),
  };

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

  // URL 구조 CTA: analyze 화면에서 항상 클릭되도록 document delegate 1회 바인딩
  if (!window.__urlStructureCtaBound) {
    window.__urlStructureCtaBound = true;

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-cta="url-structure"]');
      if (!el) return;
      location.assign('./generate/index.html#url');
    });
  }

  setInterval(() => {
    render(root, getState());
  }, 120);
}
