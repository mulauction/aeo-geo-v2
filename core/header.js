import { getStore, subscribe, setStore } from "./store.js";

export function renderHeader(headerEl) {
  function update() {
    const store = getStore();
    
    if (!store.auth.isLoggedIn) {
      headerEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #1f2937; margin-bottom: 24px;">
          <span style="color: #9ca3af; font-size: 14px;">로그인 필요</span>
          <button id="btnHeaderLogin" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #3b82f6; background: transparent; color: #3b82f6; font-size: 14px; cursor: pointer;">로그인</button>
        </div>
      `;
      
      const btnLogin = document.getElementById("btnHeaderLogin");
      if (btnLogin) {
        btnLogin.addEventListener("click", () => {
          const loginModal = window.loginModalInstance;
          if (loginModal) {
            loginModal.open();
          }
        });
      }
    } else {
      headerEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #1f2937; margin-bottom: 24px;">
          <span style="color: #e5e7eb; font-size: 14px;">크레딧: <strong style="color: #3b82f6;">${store.credit.balance}</strong></span>
          <button id="btnHeaderLogout" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #6b7280; background: transparent; color: #9ca3af; font-size: 14px; cursor: pointer;">로그아웃</button>
        </div>
      `;
      
      const btnLogout = document.getElementById("btnHeaderLogout");
      if (btnLogout) {
        btnLogout.addEventListener("click", () => {
          setStore({
            auth: {
              isLoggedIn: false,
              userId: null,
            },
          });
        });
      }
    }
  }

  update();
  subscribe(update);
}

