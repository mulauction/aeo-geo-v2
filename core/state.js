export const initialState = {
    input: "",
    phase: "idle", // idle | loading | done
    result: null,
  };
  
  let state = { ...initialState };
  
  export function getState() {
    return state;
  }
  
  export function setState(patch) {
    state = { ...state, ...patch };
  }
  