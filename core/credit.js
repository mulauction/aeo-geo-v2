import { getStore, setStore } from "./store.js";

export function spendCredit(amount) {
  const store = getStore();
  const newBalance = Math.max(0, store.credit.balance - amount);
  setStore({
    credit: {
      ...store.credit,
      balance: newBalance,
    },
  });
}



