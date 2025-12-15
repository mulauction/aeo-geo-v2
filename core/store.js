const AUTH_KEY = "aeo_auth_v1";
const CREDIT_KEY = "aeo_credit_v1";

const defaultState = {
  auth: {
    isLoggedIn: false,
    userId: null,
  },
  credit: {
    balance: 0,
    grantedOnce: false,
  },
};

function loadFromStorage(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // ignore
  }
  return defaultValue;
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // ignore
  }
}

let state = {
  auth: loadFromStorage(AUTH_KEY, defaultState.auth),
  credit: loadFromStorage(CREDIT_KEY, defaultState.credit),
};

const listeners = [];

export function getStore() {
  return state;
}

export function setStore(patch) {
  state = { ...state, ...patch };
  
  if (patch.auth !== undefined) {
    saveToStorage(AUTH_KEY, state.auth);
  }
  if (patch.credit !== undefined) {
    saveToStorage(CREDIT_KEY, state.credit);
  }
  
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const index = listeners.indexOf(fn);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

