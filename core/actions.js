import { setState, getState } from "./state.js";
import { requireLogin, requireCredit, isLoggedIn, gateOrWarn } from "./gate.js";
import { spendCredit } from "./credit.js";
import { computeContentStructureV2 } from "./analyzers/contentStructureV2.js";
import { computeBrandingScore } from "./analyzers/branding.js";
import { buildReportPayload } from "./report.js";
import { buildImprovementsFromReport } from "./improvements.js";
import { buildImproveRequestV1, requestImproveV1 } from "./api/improveClient.js";


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

      // ✅ 브랜드 점수 계산 (inputs.brand가 있을 때만)
      const urlParams = new URLSearchParams(window.location.search);
      const brandFromUrl = urlParams.get("brand");
      const productFromUrl = urlParams.get("product");
      let brandingResult = null;
      if (brandFromUrl && brandFromUrl.trim().length > 0) {
        brandingResult = computeBrandingScore(brandFromUrl, input);
        if (globalThis.DEBUG && brandingResult) {
          console.log('[DEBUG] Branding 점수:', brandingResult.score, brandingResult.grade);
        }
      }

      // ✅ [brand/product 변경 감지] 이전 __lastV2와 비교하여 URL 데이터 초기화 여부 결정
      let shouldResetUrlData = false;
      let prevLastV2 = null;
      try {
        const prevLastV2Str = localStorage.getItem('__lastV2');
        if (prevLastV2Str) {
          prevLastV2 = JSON.parse(prevLastV2Str);
          if (prevLastV2 && prevLastV2.inputs) {
            const prevBrand = prevLastV2.inputs.brand || '';
            const prevProduct = prevLastV2.inputs.product || '';
            const currentBrand = brandFromUrl || '';
            const currentProduct = productFromUrl || '';
            
            // brand 또는 product가 변경되었으면 URL 데이터 초기화
            if (prevBrand !== currentBrand || prevProduct !== currentProduct) {
              shouldResetUrlData = true;
            }
          }
        }
      } catch (e) {
        // 이전 __lastV2 읽기 실패 시 조용히 무시 (새 분석으로 간주)
      }

      // ✅ analysis.scores 명시적으로 재구성 (merge하지 않음, brand/product 변경 시 URL 초기화)
      const currentState = getState();
      const analysisScores = {
        branding: brandingResult,
        contentStructureV2: contentStructureV2Result,
        urlStructureV1: shouldResetUrlData ? null : (currentState.analysis?.scores?.urlStructureV1 || null)
      };

      // ✅ [Phase 5-0 Commit C] Evidence 계산 (옵션 슬롯)
      let evidenceData = null;
      if (globalThis.FEATURE_EVIDENCE === true && input && input.trim().length > 0) {
        try {
          const evidenceResult = computeContentStructureV2Evidence({
            html: input,
            url: undefined,
            inputMeta: undefined
          });
          evidenceData = {
            contentStructureV2: evidenceResult
          };
        } catch (error) {
          console.warn('[Phase 5-0 Commit C] Evidence 계산 실패:', error);
        }
      }

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
          scores: analysisScores,
          ...(evidenceData ? { evidence: evidenceData } : {})
        }
      });
      
      // ✅ [inputs 복구] 분석 완료 시점에 __lastV2 스냅샷 생성 및 저장
      const finalState = getState();
      const reportPayload = buildReportPayload();
      
      // ✅ 이전 __lastV2에서 url 추출 (brand/product 변경되지 않았을 때만 유지)
      const prevUrl = (!shouldResetUrlData && prevLastV2 && prevLastV2.inputs) 
        ? (prevLastV2.inputs.url || null) 
        : null;
      
      // inputs 구성: URL 파라미터 우선, 없으면 빈 문자열 (위에서 이미 읽은 값 재사용)
      const inputs = {
        brand: brandFromUrl || '',
        product: productFromUrl || '',
        url: shouldResetUrlData ? null : prevUrl
      };
      
      // ✅ analysis.scores 명시적으로 재구성 (merge하지 않음, brand/product 변경 시 URL 초기화)
      // reportPayload는 이미 shouldResetUrlData에 따라 업데이트된 state를 기반으로 생성됨
      const v2SummaryAnalysisScores = {
        branding: reportPayload.analysis?.scores?.branding || null,
        contentStructureV2: reportPayload.analysis?.scores?.contentStructureV2 || null,
        urlStructureV1: shouldResetUrlData ? null : (reportPayload.analysis?.scores?.urlStructureV1 || null)
      };
      
      // v2Summary 리포트 모델 생성 (inputs 포함)
      const v2Summary = {
        inputs: inputs,
        input: finalState.input || null,
        result: reportPayload.result || null,
        analysis: {
          scores: v2SummaryAnalysisScores
        },
        generatedAt: reportPayload.generatedAt || Date.now(),
        createdAt: new Date().toISOString()
      };
      
      // window.__lastV2에 저장
      window.__lastV2 = v2Summary;
      
      // localStorage '__lastV2'에 저장
      try {
        localStorage.setItem('__lastV2', JSON.stringify(v2Summary));
      } catch (e) {
        console.warn('[actions] Failed to save __lastV2 to localStorage:', e);
      }
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
      if (!gateOrWarn("리포트 공유 보기")) return;
      
      // ✅ [inputs 복구] 리포트 공유 전에 __lastV2 생성 및 저장
      const state = getState();
      const reportPayload = buildReportPayload();
      
      // URL 파라미터에서 brand/product 추출
      const urlParams = new URLSearchParams(window.location.search);
      const brandFromUrl = urlParams.get("brand");
      const productFromUrl = urlParams.get("product");
      
      // inputs 구성: URL 파라미터 우선, 없으면 빈 문자열
      const inputs = {
        brand: brandFromUrl || '',
        product: productFromUrl || ''
      };
      
      // __lastV2 리포트 모델 생성 (inputs 포함)
      const lastV2 = {
        inputs: inputs,
        input: state.input || null,
        result: reportPayload.result || null,
        analysis: reportPayload.analysis || {
          scores: {
            branding: null,
            contentStructureV2: null,
            urlStructureV1: null
          }
        },
        generatedAt: reportPayload.generatedAt || Date.now(),
        createdAt: new Date().toISOString()
      };
      
      // window.__lastV2에 저장
      window.__lastV2 = lastV2;
      
      // localStorage '__lastV2'에 저장
      try {
        localStorage.setItem('__lastV2', JSON.stringify(lastV2));
      } catch (e) {
        console.warn('[actions] Failed to save __lastV2 to localStorage:', e);
      }
      
      window.location.href = "./share.html";
    }
    
    // ✅ [Phase 4-1A] 개선안 생성 버튼 바인딩
    if (event.target && event.target.id === "btnGenerateImprovements") {
      event.preventDefault();
      if (!gateOrWarn("개선안 생성")) return;
      
      const report = buildReportPayload();
      const improvementsHtml = buildImprovementsFromReport(report);
      const panel = document.getElementById("improvementsPanel");
      if (panel) {
        panel.innerHTML = improvementsHtml;
        
        // ✅ [Phase 4-2 Gate] 동적으로 생성된 버튼에 비활성화 적용
        const btnAiImprove = panel.querySelector('#btnAiImprove');
        if (btnAiImprove && !isLoggedIn()) {
          btnAiImprove.disabled = true;
          const hint = document.createElement('p');
          hint.style.cssText = 'margin: 4px 0 0 0; font-size: 12px; color: var(--muted); text-align: center;';
          hint.textContent = '로그인 후 사용 가능';
          btnAiImprove.parentNode.insertBefore(hint, btnAiImprove.nextSibling);
        }
        
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
    
    // ✅ [Phase 4-2 Gate] 공통 게이트: 개선안 관련 버튼들
    const protectedButtonIds = [
      "btnBuildImprovements",
      "btnCopyImprovementHtml",
      "btnDownloadImprovement"
    ];
    
    if (event.target && protectedButtonIds.includes(event.target.id)) {
      event.preventDefault();
      if (!gateOrWarn(event.target.id)) return;
      
      // 로그인 상태면 기존 로직 수행 (향후 구현)
      console.log(`[Phase 4-2 Gate] ${event.target.id} clicked (logged in)`);
    }
    
    // ✅ [Phase 4-2A] AI 개선 버튼 바인딩
    if (event.target && event.target.id === "btnAiImprove") {
      const btn = event.target;
      if (btn.disabled) return;

      // ✅ [Phase 4-2 Gate] 로그인 게이트 체크
      if (!requireLogin({ reason: "AI 개선 기능을 사용하려면 로그인이 필요합니다." })) {
        return;
      }

      // ✅ [Phase 4-2 Gate] 크레딧 게이트 체크
      if (!requireCredit(1, { reason: "AI 개선 기능을 사용하려면 1 크레딧이 필요합니다." })) {
        return;
      }

      btn.disabled = true;
      btn.setAttribute("data-loading", "1");

      // ✅ [Phase 4-3B] API 호출 연결
      (async () => {
        try {
          // 리포트와 룰 기반 개선안 생성
          const report = buildReportPayload();
          const ruleBased = buildImprovementsFromReport(report);
          
          // payload 생성
          const payload = buildImproveRequestV1(report, ruleBased);
          
          // ✅ [Phase 4-2 Gate] endpoint는 반드시 globalThis.IMPROVE_API_ENDPOINT 사용
          const apiEndpoint = globalThis.IMPROVE_API_ENDPOINT || '/api/improve';
          
          // API 호출
          const result = await requestImproveV1({
            endpoint: apiEndpoint,
            payload: payload,
            timeoutMs: 30000
          });

          // 성공 응답 처리
          if (result && result.ok === true && result.result) {
            console.log("[Phase 4-3B] improve ok");
            
            // ✅ [Phase 4-2 Gate] 성공 시 크레딧 차감
            spendCredit(1);
            
            // improvementsPanel 찾기
            const panel = document.getElementById("improvementsPanel");
            if (panel) {
              // AI 개선 결과 HTML 생성
              const aiResultHtml = `
                <div style="margin-top: 16px; padding: 16px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border);">
                  <h3 style="margin: 0 0 16px 0;">AI 개선 결과</h3>
                  ${result.result.checklist && result.result.checklist.length > 0 ? `
                    <h4 style="margin: 0 0 8px 0;">개선 체크리스트</h4>
                    <ul style="margin: 0 0 16px 0; padding-left: 24px;">
                      ${result.result.checklist.map(item => `<li style="margin-bottom: 8px;">${escapeHtml(item)}</li>`).join('')}
                    </ul>
                  ` : ''}
                  <h4 style="margin: 16px 0 8px 0;">개선된 HTML</h4>
                  <pre style="background: var(--background); padding: 12px; border-radius: var(--radius); border: 1px solid var(--border); overflow-x: auto; font-size: 12px; line-height: 1.5;"><code>${escapeHtml(result.result.html)}</code></pre>
                </div>
              `;
              
              // 기존 내용 아래에 append
              panel.insertAdjacentHTML("beforeend", aiResultHtml);
            }
          } else {
            // 실패 응답 처리 (throw 금지)
            const errorCode = result?.error?.code || "UNKNOWN";
            console.log("[Phase 4-3B] improve failed", errorCode);
            
            // improvementsPanel 찾기
            const panel = document.getElementById("improvementsPanel");
            if (panel) {
              // 실패 안내 문구 추가
              const errorHtml = `
                <div style="margin-top: 16px; padding: 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); color: var(--muted);">
                  AI 고도화 실패 — 룰 기반 결과 유지
                </div>
              `;
              panel.insertAdjacentHTML("beforeend", errorHtml);
            }
          }
        } catch (error) {
          // 예상치 못한 에러 처리 (throw 금지)
          console.error("[Phase 4-3B] unexpected error", error);
          
          // improvementsPanel 찾기
          const panel = document.getElementById("improvementsPanel");
          if (panel) {
            // 실패 안내 문구 추가
            const errorHtml = `
              <div style="margin-top: 16px; padding: 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); color: var(--muted);">
                AI 고도화 실패 — 룰 기반 결과 유지
              </div>
            `;
            panel.insertAdjacentHTML("beforeend", errorHtml);
          }
        } finally {
          // 기존 fake-loading 1.2초 유지
          setTimeout(() => {
            // DOM이 교체될 수 있으므로 최신 버튼을 다시 찾는다
            const latest = document.getElementById("btnAiImprove");
            if (latest) {
              latest.removeAttribute("data-loading");
              latest.disabled = false;
            }
            console.log("[Phase 4-2B] fake loading complete");
          }, 1200);
        }
      })();
    }
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * HTML 이스케이프 함수
 */
function escapeHtml(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
