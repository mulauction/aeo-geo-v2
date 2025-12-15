import { getState } from "./state.js";
import { render } from "./view.js";
import { bindActions } from "./actions.js";

export function boot() {
  const root = {
    inputText: document.getElementById("inputText"),
    btnAnalyze: document.getElementById("btnAnalyze"),
    status: document.getElementById("status"),
    result: document.getElementById("result"),
  };

  bindActions(root);
  render(root, getState());

  setInterval(() => {
    render(root, getState());
  }, 120);
}
