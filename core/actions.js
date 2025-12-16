import { setState, getState } from "./state.js";
import { requireLogin, requireCredit } from "./gate.js";
import { spendCredit } from "./credit.js";
import { computeContentStructureV2 } from "./analyzers/contentStructureV2.js";
import { buildReportPayload } from "./report.js";
import { buildImprovementsFromReport } from "./improvements.js";

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

      // ✅ [Phase 3-2B] Content Structure V2 계산
      const contentStructureV2Result = computeContentStructureV2(input);

      // ✅ [Phase 3-2B] 최소 검증 로그 (DEBUG 플래그 조건)
      if (globalThis.DEBUG && contentStructureV2Result) {
        console.log('[DEBUG] Content Structure V2 점수:', contentStructureV2Result.score, contentStructureV2Result.grade);
        console.log('[DEBUG] Evidence:', contentStructureV2Result.evidence);
      }

      // analysis.scores 초기화 (없으면 생성)
      const currentState = getState();
      const analysisScores = {
        ...(currentState.analysis?.scores || {}),
        contentStructureV2: contentStructureV2Result
      };

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
          urlStructureV1: {
            score: null,
            grade: null,
            checks: {},
            meta: {
              targetUrl: null,
              analyzedAt: null,
              version: "v1"
            }
          },
        },
        analysis: {
          scores: analysisScores
        }
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
  
  // ✅ 리포트 공유 보기 버튼 바인딩
  // 동적으로 생성되는 버튼이므로 이벤트 위임 사용
  document.addEventListener("click", (event) => {
    if (event.target && event.target.id === "btnShareReport") {
      event.preventDefault();
      window.location.href = "./share.html";
    }
    
    // ✅ [Phase 4-1A] 개선안 생성 버튼 바인딩
    if (event.target && event.target.id === "btnGenerateImprovements") {
      event.preventDefault();
      const report = buildReportPayload();
      const improvementsHtml = buildImprovementsFromReport(report);
      const panel = document.getElementById("improvementsPanel");
      if (panel) {
        panel.innerHTML = improvementsHtml;
        
        // URL 구조 CTA 클릭 차단 우회용 로컬 핸들러
        const urlCta = panel.querySelector('[data-cta="url-structure"]');
        if (urlCta && !urlCta.__localClickBound) {
          urlCta.__localClickBound = true;
          urlCta.addEventListener('click', () => {
            // intentionally empty
            // presence of local click handler is required to bypass analyze-level interception
          });
        }
      }
    }
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}
