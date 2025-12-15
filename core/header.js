import { getStore, subscribe, setStore } from "./store.js";

export function renderHeader(headerEl) {
  function update() {
    const store = getStore();
    
    if (!store.auth.isLoggedIn) {
      headerEl.innerHTML = `
        <div class="app-header">
          <span class="header-left">로그인 필요</span>
          <button id="btnHeaderLogin" class="btn-ghost header-right">로그인</button>
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
        <div class="app-header">
          <span class="header-left">크레딧: <span class="badge">${store.credit.balance}</span></span>
          <button id="btnHeaderLogout" class="btn-ghost header-right">로그아웃</button>
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

