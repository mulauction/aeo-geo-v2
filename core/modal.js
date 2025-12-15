import { getStore, setStore } from "./store.js";

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function createLoginModal() {
  const modal = document.getElementById("loginModal");
  const overlay = document.getElementById("modalOverlay");
  const btnLogin = document.getElementById("btnModalLogin");
  const btnClose = document.getElementById("btnModalClose");
  const reasonText = document.getElementById("modalReason");

  function open(reason = "") {
    if (reason) {
      reasonText.textContent = reason;
      reasonText.style.display = "block";
    } else {
      reasonText.style.display = "none";
    }
    modal.style.display = "block";
    overlay.style.display = "block";
  }

  function close() {
    modal.style.display = "none";
    overlay.style.display = "none";
  }

  btnLogin.addEventListener("click", () => {
    const store = getStore();
    
    setStore({
      auth: {
        isLoggedIn: true,
        userId: generateUUID(),
      },
    });

    const updatedStore = getStore();
    if (!updatedStore.credit.grantedOnce) {
      setStore({
        credit: {
          balance: updatedStore.credit.balance + 10,
          grantedOnce: true,
        },
      });
    }

    close();
  });

  btnClose.addEventListener("click", close);
  overlay.addEventListener("click", close);

  return { open, close };
}

export function createCreditModal() {
  const modal = document.getElementById("creditModal");
  const overlay = document.getElementById("modalOverlay");
  const btnClose = document.getElementById("btnCreditModalClose");
  const reasonText = document.getElementById("creditModalReason");
  const costText = document.getElementById("creditModalCost");

  function open(cost, reason = "") {
    costText.textContent = `${cost} 크레딧`;
    if (reason) {
      reasonText.textContent = reason;
      reasonText.style.display = "block";
    } else {
      reasonText.style.display = "none";
    }
    modal.style.display = "block";
    overlay.style.display = "block";
  }

  function close() {
    modal.style.display = "none";
    overlay.style.display = "none";
  }

  btnClose.addEventListener("click", close);
  overlay.addEventListener("click", close);

  return { open, close };
}

