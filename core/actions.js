import { setState, getState } from "./state.js";
import { requireLogin, requireCredit, isLoggedIn, gateOrWarn } from "./gate.js";
import { spendCredit } from "./credit.js";
import { computeContentStructureV2 } from "./analyzers/contentStructureV2.js";
import { computeBrandingScore } from "./analyzers/branding.js";
import { buildReportPayload } from "./report.js";
import { buildImprovementsFromReport } from "./improvements.js";
import { buildImproveRequestV1, requestImproveV1 } from "./api/improveClient.js";
import { getCurrentReportIdSafe, markUsageWouldConsumeOnce } from "./usage/usageTriggerV1.js";

function getUsageApiBase() {
  return (location.hostname === 'localhost') ? 'http://localhost:3001' : '';
}

/**
 * [Phase 26-1] Snapshot API fetch with dev fallback
 * (1) same-origin 으로 먼저 시도
 * (2) dev static server(550x)에서 실패하면
 *     http://localhost:3001 으로 1회 fallback
 */

async function fetchSnapshotApi(path, options = {}) {
  const isDevStaticServer = 
    (location.hostname === "localhost" || location.hostname === "127.0.0.1") &&
    /^550[0-9]$/.test(location.port || "");

  // 정적 서버(5500~5509)면 무조건 localhost:3001로 바로 실행 (same-origin 시도 금지)
  if (isDevStaticServer) {
    const fallbackUrl = `http://localhost:3001${path}`;
    // ✅ [Phase C-1-6] Network error는 catch해서 조용히 처리
    try {
      return await fetch(fallbackUrl, options);
    } catch (e) {
      // ECONNREFUSED 등 network error는 조용히 throw하지 않음
      // 호출부에서 처리하도록 Promise.reject로 전달 (호출부에서 catch 필요)
      return Promise.reject(e);
    }
  }

  // 정적 서버가 아닐 때는 same-origin으로 시도
  // ✅ [Phase C-1-6] Network error는 catch해서 조용히 처리
  try {
    return await fetch(path, options);
  } catch (e) {
    // ECONNREFUSED 등 network error는 조용히 throw하지 않음
    return Promise.reject(e);
  }
}

/**
 * ✅ [Phase C-1-6] Snapshot API 호출 안전 래퍼 (backend 없을 때 에러 방지)
 * @param {Object} payload - Snapshot POST payload
 * @returns {Promise<{ok: true, id: string} | null>} 성공 시 {ok: true, id}, 실패 시 null
 */
async function trySnapshot(payload) {
  const urlParams = new URLSearchParams(window.location.search || '');
  const isDebug = urlParams.get('debug') === '1';
  const isLocalhost = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '0.0.0.0');
  
  // Backend not present 판단 (usage-events와 동일한 로직 재사용)
  const shouldSend = (!isLocalhost) || String(location.port || '') === '3001';
  if (!shouldSend) {
    if (!window.__shareSnapshotSkippedLogged) {
      window.__shareSnapshotSkippedLogged = true;
      if (isDebug) console.info('[snapshot] skipped (backend not present): /api/snapshot');
    }
    return null;
  }
  
  try {
    const res = await fetchSnapshotApi('/api/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res && res.ok) {
      const json = await res.json();
      if (json && json.id) {
        return { ok: true, id: json.id };
      }
    }
    
    // 실패 시 조용히 null 반환
    if (!window.__shareSnapshotFailedLogged) {
      window.__shareSnapshotFailedLogged = true;
      if (isDebug) console.info('[snapshot] failed: /api/snapshot');
    }
    return null;
  } catch (e) {
    // Network error (ECONNREFUSED 등)는 조용히 null 반환
    if (!window.__shareSnapshotFailedLogged) {
      window.__shareSnapshotFailedLogged = true;
      if (isDebug) console.info('[snapshot] failed (network error): /api/snapshot');
    }
    return null;
  }
}


export function bindActions(root) {
  root.btnAnalyze.addEventListener("click", async (event) => {
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

      // ⚠️ [PRODUCT_PRINCIPLES] SCORE MUTATION 허용 영역 시작
      // Analyze 단계는 유일하게 점수를 생성/변경할 수 있는 경로입니다.
      // 이 영역에서만 computeContentStructureV2, computeBrandingScore 등을 호출하여 점수를 계산합니다.
      // 다른 단계(Generate, Amplify)에서는 절대 점수를 변경할 수 없습니다.

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
      
      // ✅ [Phase 111] Debug log for evidence verification (debug=1 only)
      const isDebug = urlParams.get('debug') === '1';
      if (isDebug && contentStructureV2Result) {
        console.info('[csV2] computed', {
          score: contentStructureV2Result.score,
          grade: contentStructureV2Result.grade,
          evidenceCount: contentStructureV2Result.evidence?.length || 0
        });
      }
      let brandingResult = null;
      if (brandFromUrl && brandFromUrl.trim().length > 0) {
        brandingResult = computeBrandingScore(brandFromUrl, input);
        if (globalThis.DEBUG && brandingResult) {
          console.log('[DEBUG] Branding 점수:', brandingResult.score, brandingResult.grade);
        }
      }

      // ✅ [brand/product 변경 감지] 이전 __lastV2와 비교하여 URL 관측 데이터 초기화 여부 결정
      // ⚠️ [PRODUCT_PRINCIPLES] 이것은 점수 변경이 아니라 관측 데이터 삭제입니다.
      // brand/product가 변경되면 이전 URL 관측 데이터는 더 이상 유효하지 않으므로 null로 설정합니다.
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
            
            // brand 또는 product가 변경되었으면 URL 관측 데이터 초기화 (관측 데이터 삭제)
            if (prevBrand !== currentBrand || prevProduct !== currentProduct) {
              shouldResetUrlData = true;
            }
          }
        }
      } catch (e) {
        // 이전 __lastV2 읽기 실패 시 조용히 무시 (새 분석으로 간주)
      }

      // ✅ analysis.scores 명시적으로 재구성 (merge하지 않음, brand/product 변경 시 URL 관측 데이터 초기화)
      // ⚠️ [PRODUCT_PRINCIPLES] 이 부분에서 analysisScores 객체를 생성합니다.
      // 이는 Analyze 단계에서만 허용되는 점수 생성/변경 작업입니다.
      // urlStructureV1 = null은 점수 변경이 아니라 관측 데이터 삭제입니다.
      const currentState = getState();
      const analysisScores = {
        branding: brandingResult,
        contentStructureV2: contentStructureV2Result,
        urlStructureV1: shouldResetUrlData ? null : (currentState.analysis?.scores?.urlStructureV1 || null)
      };
      // ⚠️ [PRODUCT_PRINCIPLES] SCORE MUTATION 허용 영역 종료

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

      // ✅ [Phase C-1-5] Recent Reports 저장 (Share가 읽는 __recentReportsV1 갱신)
      try {
        const reportId = String(v2Summary.generatedAt || Date.now());
        // __currentReportId 동기화 (Share가 기대하는 값)
        try {
          localStorage.setItem('__currentReportId', reportId);
        } catch (_) {}
        
        // analysisTarget 추출 (input에서 HTML 제거, 최대 80자)
        let analysisTarget = '분석 대상 없음';
        if (finalState.input) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = finalState.input;
          let textContent = tempDiv.textContent || tempDiv.innerText || '';
          textContent = textContent.trim();
          if (textContent.length > 80) {
            analysisTarget = textContent.substring(0, 80) + '...';
          } else {
            analysisTarget = textContent || 'HTML 콘텐츠';
          }
        }
        
        // Best KPI score 계산
        const getBestKpiScore = () => {
          const candidates = [
            analysisScores.branding?.score,
            analysisScores.contentStructureV2?.score,
            analysisScores.urlStructureV1?.score
          ].filter(v => typeof v === 'number' && Number.isFinite(v));
          if (!candidates.length) return null;
          return Math.max(...candidates);
        };
        
        const entry = {
          id: reportId,
          reportId: reportId,
          target: analysisTarget,
          createdAt: v2Summary.generatedAt || Date.now(),
          score: getBestKpiScore(),
          url: location.origin + location.pathname,
          v2: v2Summary
        };
        
        // 기존 목록 로드 및 중복 제거 후 맨 앞에 추가 (최대 10개)
        const RECENT_KEY = '__recentReportsV1';
        const loadRecentReports = () => {
          try {
            const raw = localStorage.getItem(RECENT_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
          } catch {
            return [];
          }
        };
        const existing = loadRecentReports();
        const deduped = existing.filter(it => it && typeof it === 'object' && it.id !== entry.id);
        const next = [entry, ...deduped].slice(0, 10);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch (e) {
        // 실패 안전: recent reports 저장 실패는 조용히 무시
        console.warn('[actions] Failed to save recent reports:', e);
      }

      // ✅ [Phase 30-5C] Log-only usage trigger (no deduction, no server)
      // - Must NOT fire for programmatic .click()
      if (event && event.isTrusted) {
        const didMark = markUsageWouldConsumeOnce({ source: "analyze", action: "result_generated" });
        if (didMark) {
          const reportId = getCurrentReportIdSafe();
          try {
            const p = new URLSearchParams(location.search || '');
            const isDebug = p.get('debug') === '1';
            const isLocalhost = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '0.0.0.0');
            // Avoid noisy ERR_CONNECTION_REFUSED when backend(3001) isn't running:
            // - On localhost: only send if the page is served by the backend itself (port 3001).
            // - On non-localhost: keep same-origin best-effort.
            const shouldSend = (!isLocalhost) || String(location.port || '') === '3001';
            if (!shouldSend) {
              if (isDebug) console.info('[usage-events] skipped (backend not present): /api/usage-events');
              return null;
            }
            fetch('/api/usage-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reportId,
                source: 'analyze',
                action: 'result_generated',
                ts: Date.now(),
                meta: null
              })
            }).catch(() => {
              if (isDebug) console.info('[usage-events] failed: /api/usage-events');
            });
          } catch (_) {
            // never throw
          }
        }
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
      if (!gateOrWarn("최근 리포트 보기")) return;
      
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
      
      // ✅ [Hotfix] __currentReportId 생성 및 저장 (reportId 기반)
      // reportId는 lastV2의 reportId 또는 generatedAt 기반으로 생성
      const reportId = lastV2.reportId || 
        lastV2.meta?.reportId || 
        lastV2.meta?.id || 
        lastV2.id || 
        String(lastV2.generatedAt || Date.now());
      
      try {
        localStorage.setItem('__currentReportId', reportId);
        console.log('[actions] __currentReportId set:', reportId);
      } catch (e) {
        console.warn('[actions] Failed to save __currentReportId to localStorage:', e);
      }
      
      // ✅ [Phase C-1-3] 로컬 복원 기반 네비게이션 (restore=1 단일 경로)
      Promise.resolve().then(async () => {
        // debug=1 유지
        const urlParams = new URLSearchParams(window.location.search);
        const isDebug = urlParams.get('debug') === '1';
        const debugParam = isDebug ? '&debug=1' : '';
        
        // restore=1 단일 경로로 통일 (최근 리포트 목록)
        const targetUrl = `./share.html?restore=1${debugParam}`;
        
        if (isDebug) {
          console.info('[analyze] share nav', { target: targetUrl });
        }
        
        window.location.href = targetUrl;
      });
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
