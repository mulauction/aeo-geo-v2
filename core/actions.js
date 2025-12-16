import { setState, getState } from "./state.js";
import { requireLogin, requireCredit } from "./gate.js";
import { spendCredit } from "./credit.js";
import { computeContentStructureV2 } from "./analyzers/contentStructureV2.js";
import { buildReportPayload } from "./report.js";
import { buildImprovementsFromReport, buildImprovementMarkdown, buildImprovePayload, validateImproveResponse, renderAiImprovements } from "./improvements.js";

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
        
        // ✅ [Phase 4-1B UX 버그 수정] 개선안 생성 후 버튼 활성화
        const copyBtn = document.getElementById("btnCopyImprovementHtml");
        const downloadBtn = document.getElementById("btnDownloadImprovement");
        if (copyBtn) copyBtn.disabled = false;
        if (downloadBtn) downloadBtn.disabled = false;
        
        // 안내 문구 제거
        const actionButtonsContainer = copyBtn?.parentElement?.parentElement;
        if (actionButtonsContainer) {
          const hintText = actionButtonsContainer.querySelector('p');
          if (hintText) hintText.remove();
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
    
    // ✅ [Phase 4-1B] HTML 복사 버튼 바인딩
    if (event.target && event.target.id === "btnCopyImprovementHtml") {
      event.preventDefault();
      
      // ✅ [Phase 4-1B UX 버그 수정] disabled 상태면 클릭 무시
      if (event.target.disabled) {
        return;
      }
      
      const skeletonEl = document.getElementById("improvementHtmlSkeleton");
      if (!skeletonEl) {
        alert("먼저 개선안 생성을 눌러주세요.");
        return;
      }
      
      const htmlText = skeletonEl.textContent || skeletonEl.innerText;
      if (!htmlText || htmlText.trim().length === 0) {
        alert("먼저 개선안 생성을 눌러주세요.");
        return;
      }
      
      const btn = event.target;
      
      // ✅ [Phase 4-1B UX 버그 수정] 타이머 중복 방지
      if (btn.__copyTimer) {
        clearTimeout(btn.__copyTimer);
      }
      
      // navigator.clipboard 사용, 실패 시 execCommand fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(htmlText).then(() => {
          const originalText = btn.textContent;
          btn.textContent = "복사됨";
          btn.__copyTimer = setTimeout(() => {
            btn.textContent = originalText;
            btn.__copyTimer = null;
          }, 1200);
        }).catch(() => {
          // fallback to execCommand
          copyToClipboardFallback(htmlText, btn);
        });
      } else {
        copyToClipboardFallback(htmlText, btn);
      }
    }
    
    // ✅ [Phase 4-1B] 개선안 다운로드 버튼 바인딩
    if (event.target && event.target.id === "btnDownloadImprovement") {
      event.preventDefault();
      
      // ✅ [Phase 4-1B UX 버그 수정] disabled 상태면 클릭 무시
      if (event.target.disabled) {
        return;
      }
      
      const improvementsContainer = document.querySelector('[data-improvements]');
      if (!improvementsContainer) {
        alert("먼저 개선안 생성을 눌러주세요.");
        return;
      }
      
      try {
        // HTML 엔티티 디코딩 후 JSON 파싱
        const rawData = improvementsContainer.getAttribute('data-improvements');
        const decodedData = rawData
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
        const improvementsData = JSON.parse(decodedData);
        const report = buildReportPayload();
        const markdown = buildImprovementMarkdown(improvementsData, { input: report.input });
        
        // 파일명 생성: aeo-improvements-YYYYMMDD-HHMM.md
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = date.toTimeString().slice(0, 5).replace(':', '');
        const filename = `aeo-improvements-${dateStr}-${timeStr}.md`;
        
        // Blob 생성 및 다운로드
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('다운로드 실패:', e);
        alert("다운로드 중 오류가 발생했습니다.");
      }
    }
    
    // ✅ [Phase 4-2A] AI로 개선안 고도화 버튼 바인딩
    if (event.target && event.target.id === "btnAiImprove") {
      event.preventDefault();
      
      // 호출 락 확인 (연타 방지)
      if (event.target.disabled || event.target.__aiImproveLocked) {
        return;
      }
      
      // async 함수로 실행
      (async () => {
        const btn = event.target;
        const panel = document.getElementById("improvementsPanel");
        if (!panel) {
          alert("개선안 패널을 찾을 수 없습니다.");
          return;
        }
        
        // ✅ [Phase 4-2A-1] 환경 체크: 정적 서버 환경에서는 API 호출 금지
        const isStaticServer = location.origin.includes(':5500') || 
                               (!globalThis.RUN_MODE && !globalThis.PROXY_BASE);
        
        if (isStaticServer) {
          // 안내 메시지 렌더링
          const noticeSection = document.createElement('div');
          noticeSection.style.cssText = 'margin-top: 16px; padding: 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); color: var(--muted);';
          noticeSection.innerHTML = '<p style="margin: 0; font-size: 13px;">AI 고도화 기능은 서버(API) 모드에서만 가능합니다. (현재 정적 서버 실행 중)</p>';
          panel.appendChild(noticeSection);
          return;
        }
        
        // 기존 AI 개선안이 있으면 제거하지 않고 추가만 함
        const existingAiSection = panel.querySelector('[data-ai-improvements]');
        if (existingAiSection) {
          // 이미 AI 개선안이 있으면 교체
          existingAiSection.remove();
        }
        
        // 락 설정 및 UI 업데이트
        btn.__aiImproveLocked = true;
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = "AI 생성중...";
        
        // 로딩 인디케이터 추가
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'aiImproveLoading';
        loadingIndicator.style.cssText = 'padding: 12px; text-align: center; color: var(--muted);';
        loadingIndicator.textContent = 'AI가 개선안을 생성하고 있습니다...';
        panel.appendChild(loadingIndicator);
        
        // 리포트 및 개선안 데이터 수집
        const report = buildReportPayload();
        const improvementsContainer = panel.querySelector('[data-improvements]');
        if (!improvementsContainer) {
          btn.__aiImproveLocked = false;
          btn.disabled = false;
          btn.textContent = originalText;
          loadingIndicator.remove();
          alert("루� 기반 개선안을 먼저 생성해주세요.");
          return;
        }
        
        try {
          // HTML 엔티티 디코딩 후 JSON 파싱
          const rawData = improvementsContainer.getAttribute('data-improvements');
          const decodedData = rawData
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
          const improvementsData = JSON.parse(decodedData);
          
          // LLM 요청 payload 구성
          const payload = buildImprovePayload(report, improvementsData.checklist, improvementsData.htmlSkeleton);
          
          // API 호출
          const apiEndpoint = globalThis.IMPROVE_API_ENDPOINT || '/api/improve';
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
            // ✅ [Phase 4-2A-1] API 실패 시 사용자 안내
            throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
          }
          
          const responseData = await response.json();
          
          // 응답 검증
          const validation = validateImproveResponse(responseData);
          if (!validation.valid) {
            throw new Error(`AI 결과 형식 오류: ${validation.error}`);
          }
          
          // AI 개선안 렌더링 및 추가
          loadingIndicator.remove();
          const aiHtml = renderAiImprovements(validation.data);
          const aiSection = document.createElement('div');
          aiSection.innerHTML = aiHtml;
          aiSection.setAttribute('data-ai-improvements', 'true');
          panel.appendChild(aiSection);
          
          // 버튼 상태 복원
          btn.__aiImproveLocked = false;
          btn.disabled = false;
          btn.textContent = originalText;
          
        } catch (e) {
          // ✅ [Phase 4-2A-1] 에러를 사용자 안내로 처리 (콘솔 에러만 찍지 않음)
          loadingIndicator.remove();
          
          // 안내 메시지 렌더링
          const errorSection = document.createElement('div');
          errorSection.style.cssText = 'margin-top: 16px; padding: 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); color: var(--muted);';
          
          let errorMsg = '';
          if (e.message && e.message.includes('형식 오류')) {
            errorMsg = 'AI 결과 형식 오류, 룰 기반 결과 유지';
          } else if (e.message && e.message.includes('API 요청 실패')) {
            errorMsg = 'AI 고도화 기능은 서버(API) 모드에서만 가능합니다. (현재 정적 서버 실행 중)';
          } else {
            errorMsg = 'AI 개선안 생성에 실패했습니다. 룰 기반 결과를 사용해주세요.';
          }
          
          errorSection.innerHTML = `<p style="margin: 0; font-size: 13px;">${errorMsg}</p>`;
          panel.appendChild(errorSection);
          
          // 버튼 상태 복원
          btn.__aiImproveLocked = false;
          btn.disabled = false;
          btn.textContent = originalText;
        }
      })();
    }
  });
}

/**
 * ✅ [Phase 4-1B] execCommand를 사용한 클립보드 복사 fallback
 */
function copyToClipboardFallback(text, button) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      // ✅ [Phase 4-1B UX 버그 수정] 타이머 중복 방지
      if (button.__copyTimer) {
        clearTimeout(button.__copyTimer);
      }
      const originalText = button.textContent;
      button.textContent = "복사됨";
      button.__copyTimer = setTimeout(() => {
        button.textContent = originalText;
        button.__copyTimer = null;
      }, 1200);
    } else {
      alert("복사에 실패했습니다. 브라우저를 확인해주세요.");
    }
  } catch (e) {
    console.error('복사 실패:', e);
    alert("복사에 실패했습니다.");
  } finally {
    document.body.removeChild(textarea);
  }
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}
