import { setState } from "./state.js";
import { requireLogin, requireCredit } from "./gate.js";
import { spendCredit } from "./credit.js";

export function bindActions(root) {
  root.btnAnalyze.addEventListener("click", async () => {
    const input = root.inputText.value.trim();
    if (!input) return;

    if (!requireLogin({ reason: "분석 기능을 사용하려면 로그인이 필요합니다." })) {
      return;
    }

    if (!requireCredit(1, { reason: "분석 기능을 사용하려면 1 크레딧이 필요합니다." })) {
      return;
    }

    setState({ input, phase: "loading", result: null });
    root.btnAnalyze.disabled = true;
    root.inputText.disabled = true;

    try {
      await wait(2000);

      spendCredit(1);

      setState({
        phase: "done",
        result: {
          score: 62,
          grade: "B",
          summary: `입력 "${input}" 기준 더미 결과입니다.`,
          evidence: [
            "구조화 요약 블록 부재(더미)",
            "핵심 정보 분리 부족(더미)",
            "AI 인용 신호 약함(더미)",
          ],
          actions: [
            "상단 5~7줄 요약 추가",
            "스펙/USP 리스트화",
            "FAQ 3개 구성",
          ],
        },
      });
    } finally {
      root.btnAnalyze.disabled = false;
      root.inputText.disabled = false;
      root.inputText.focus();
    }
  });

  root.inputText.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      root.btnAnalyze.click();
    }
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}
