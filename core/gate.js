import { getStore, setStore } from "./store.js";

let loginModal = null;
let creditModal = null;

export function setModals(login, credit) {
  loginModal = login;
  creditModal = credit;
}

export function requireLogin({ reason = "" } = {}) {
  const store = getStore();
  if (!store.auth.isLoggedIn) {
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

