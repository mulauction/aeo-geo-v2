import { isLoggedIn } from "./gate.js";
import { loadEvidence, getCurrentEvidence, appendEvidence } from "./evidenceStore.js";
import { buildEvidenceFromViewContext } from "./evidenceBuilder.js";
import { getState } from "./state.js";

let __evidenceOpenV1 = false;
let __selectedEvidenceId = null;

// ✅ [Phase 5-8] Evidence history append 가드 (중복 방지)
let __lastEvidenceSavedId = null;

// ✅ [Phase 7-2] 히스토리 비교 토글 상태
let __evidenceCompareEnabled = false;

// ✅ [Phase 5-7 Fix] Evidence select 드롭다운 리렌더 프리즈 플래그
if (typeof window !== 'undefined' && !window.__freezeAnalyzeRerenderUntil) {
  window.__freezeAnalyzeRerenderUntil = 0;
}

/**
 * ✅ [Phase 3-2C] 공통 KPI 렌더 함수
 * @param {Object} param0 - { label, value }
 * @returns {string} HTML 문자열
 */
export function renderKpi({ label, value }) {
  if (value === null || value === undefined) {
    return `<div style="padding: 8px 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); font-size: 13px; color: var(--muted);">
      <span>${esc(label)} · 측정 필요</span>
    </div>`;
  }
  
  const score = value.score !== null && value.score !== undefined ? value.score : 'N/A';
  const grade = value.grade || 'N/A';
  
  return `<div style="padding: 8px 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); font-size: 13px;">
    <span>${esc(label)} ${esc(score)}/${esc(grade)}</span>
  </div>`;
}

export function render(root, state) {
    // ✅ [Phase 5-7 Fix] Evidence select 드롭다운이 열려있는 동안 리렌더 스킵
    if (Date.now() < (window.__freezeAnalyzeRerenderUntil || 0)) {
      return; // 이번 렌더 스킵 (UI만 스킵, 데이터 저장/파이프라인에는 영향 없음)
    }
    
    // status
    if (state.phase === "idle") {
      root.status.textContent = "";
      root.result.innerHTML = "";
      return;
    }
  
    if (state.phase === "loading") {
      root.status.textContent = "분석 중… (2초)";
      root.result.innerHTML = "";
      return;
    }
  
    if (state.phase === "done" && state.result) {
      const r = state.result;
      root.status.textContent = "완료";
      
      // ✅ [Phase 3-2C] KPI 영역 (상단 배치)
      const scores = state.analysis?.scores || {};
      const brandingScore = scores.branding;
      const contentStructureV2Score = scores.contentStructureV2;
      const urlStructureV1Score = scores.urlStructureV1;
      
      // ✅ [Phase 3-2C] 최소 검증 로그 (DEBUG 플래그 조건, 1회 출력)
      if (globalThis.DEBUG && !window.__kpiDebugLogged) {
        window.__kpiDebugLogged = true;
        console.log('[DEBUG] KPI 존재 여부:', {
          branding: brandingScore !== null && brandingScore !== undefined ? `값 있음 (${brandingScore.score}/${brandingScore.grade})` : 'null',
          contentStructureV2: contentStructureV2Score !== null && contentStructureV2Score !== undefined ? `값 있음 (${contentStructureV2Score.score}/${contentStructureV2Score.grade})` : 'null',
          urlStructureV1: urlStructureV1Score !== null && urlStructureV1Score !== undefined ? `값 있음 (${urlStructureV1Score.score}/${urlStructureV1Score.grade})` : 'null'
        });
      }
      
      // ✅ [Phase 4-1A] improvementsPanel 내용 보존
      const existingImprovementsPanel = root.result.querySelector('#improvementsPanel');
      const preservedImprovementsContent = existingImprovementsPanel ? existingImprovementsPanel.innerHTML : '';
      
      const kpiSection = `
        <div style="margin-bottom: 16px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px;">
            ${renderKpi({ label: '엔티티 점수', value: brandingScore })}
            ${renderKpi({ label: '콘텐츠 구조 점수', value: contentStructureV2Score })}
            ${(() => {
              const urlKpi = renderKpi({ label: 'URL 구조 점수', value: urlStructureV1Score });
              if (urlStructureV1Score && urlStructureV1Score.score !== null && urlStructureV1Score.score !== undefined) {
                return urlKpi.replace('</span>', ` · 연결됨</span>`);
              } else {
                return urlKpi.replace('</span>', ` · 측정 필요</span>`);
              }
            })()}
          </div>
          <button id="btnShareReport" class="btn btn-primary" style="width: 100%;">리포트 공유 보기</button>
          ${(() => {
            const loggedIn = isLoggedIn();
            return `
              <button id="btnGenerateImprovements" class="btn btn-dark" style="width: 100%; margin-top: 8px;" ${!loggedIn ? 'disabled' : ''}>개선안 생성</button>
              ${!loggedIn ? '<p style="margin: 4px 0 0 0; font-size: 12px; color: var(--muted); text-align: center;">로그인 후 사용 가능</p>' : ''}
            `;
          })()}
        </div>
      `;
  
      // ✅ [Phase 5-7 Fix] Evidence 버전 select 포커스 상태 확인
      // select가 포커스 상태면 Evidence body 업데이트를 스킵하여 드롭다운이 닫히지 않게 함
      const existingEvidenceBody = root.result.querySelector('.evidence-body');
      const existingEvidenceSelect = existingEvidenceBody?.querySelector('#evidenceVersionSelect');
      const isEvidenceSelectFocused = existingEvidenceSelect && document.activeElement === existingEvidenceSelect;
      const preservedEvidenceBodyContent = isEvidenceSelectFocused && existingEvidenceBody ? existingEvidenceBody.innerHTML : null;
      const preservedSelectValue = isEvidenceSelectFocused && existingEvidenceSelect ? existingEvidenceSelect.value : null;
      
      // CTA 변경 포인트: 부분점수 안내 + URL 구조 점수 측정 버튼 추가
      root.result.innerHTML = `
        ${kpiSection}
        <div id="improvementsPanel" style="margin-top: 12px;">${preservedImprovementsContent}</div>
        <div><strong>${esc(r.score)}점 / ${esc(r.grade)}</strong></div>
        <p>${esc(r.summary)}</p>
        
        <!-- ✅ [Phase 3-1 Commit B-2] URL 구조 점수 보조 섹션 (state.analysis.scores.urlStructureV1 사용) -->
        ${(() => {
          const urlScore = state.analysis?.scores?.urlStructureV1;
          if (urlScore && urlScore.score !== null && urlScore.score !== undefined) {
            return `<div style="margin-top: 12px; padding: 8px 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); font-size: 13px;">
              <span>URL 구조 점수 ${esc(urlScore.score)}/${esc(urlScore.grade)} · 연결됨</span>
            </div>`;
          } else {
            return `<div style="margin-top: 12px; padding: 8px 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); font-size: 13px; color: var(--muted);">
              <span>URL 구조 점수 · 측정 필요</span>
            </div>`;
          }
        })()}
        <h4>근거</h4>
        <ul>${r.evidence.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
        <h4>액션</h4>
        <ul>${r.actions.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
        <div style="margin-top: 16px; padding: 12px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border);">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--muted);">현재 점수는 엔티티(상품/브랜드) 기반 부분 결과입니다.</p>
          <a data-cta="url-structure" class="btn btn-primary" href="./generate/index.html#url" style="width: 100%; display: inline-block; text-align: center; text-decoration: none;">URL 구조 점수 측정하기</a>
        </div>
        
        <!-- ✅ [Phase 5] Evidence 섹션 (껍데기) -->
        <details data-evidence="1" ${__evidenceOpenV1 ? "open" : ""} class="evidence-section" style="margin-top: 24px;">
          <summary style="padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; font-size: 14px; font-weight: 500;">Evidence</summary>
          <div class="evidence-body" style="margin-top: 8px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
            ${preservedEvidenceBodyContent || renderEvidenceContent(null, state)}
          </div>
        </details>
      `;
      
      // ✅ [Phase 5-8] Evidence history append (렌더 직후 1회 실행)
      try {
        // id 추출: localStorage.__currentReportId 우선, 없으면 window.__lastV2 내부 id/메타 id
        let id = null;
        const currentReportId = localStorage.getItem('__currentReportId');
        if (currentReportId) {
          id = currentReportId;
        } else if (window.__lastV2) {
          // window.__lastV2 내부에서 id 찾기
          if (window.__lastV2.id) {
            id = window.__lastV2.id;
          } else if (window.__lastV2.meta && window.__lastV2.meta.id) {
            id = window.__lastV2.meta.id;
          } else if (window.__lastV2.reportId) {
            id = window.__lastV2.reportId;
          }
        }
        
        // id가 없으면 저장하지 않음
        if (!id) {
          // id 없음 - 저장 스킵 (조용히 실패)
        } else {
          // 중복 방지: 이미 저장된 id인지 확인
          if (__lastEvidenceSavedId === id) {
            // 이미 저장됨 - 스킵
          } else {
            // history에 이미 같은 id가 있는지 확인
            const existingEvidence = loadEvidence();
            let alreadyExists = false;
            if (existingEvidence && existingEvidence.history && Array.isArray(existingEvidence.history)) {
              alreadyExists = existingEvidence.history.some(entry => entry.meta && entry.meta.id === id);
            }
            
            if (!alreadyExists) {
              // v2Summary 추출: window.__lastV2에서 가져오기
              const v2Summary = window.__lastV2 || null;
              
              // entry 생성
              const entry = {
                meta: {
                  id: id,
                  ts: Date.now()
                },
                v2Summary: v2Summary
              };
              
              // append
              appendEvidence(entry);
              
              // 가드 업데이트
              __lastEvidenceSavedId = id;
            }
          }
        }
      } catch (error) {
        // 실패를 삼키고 console.warn만 남김
        console.warn('[Phase 5-8] Evidence history append 실패:', error);
      }
      
      // ✅ [Phase 5-7 Fix] select가 포커스 상태였으면 기존 내용을 복원하고 select 값 유지
      if (isEvidenceSelectFocused && preservedEvidenceBodyContent && preservedSelectValue !== null) {
        const newEvidenceBody = root.result.querySelector('.evidence-body');
        if (newEvidenceBody) {
          // 기존 내용을 그대로 복원
          newEvidenceBody.innerHTML = preservedEvidenceBodyContent;
          const restoredSelect = newEvidenceBody.querySelector('#evidenceVersionSelect');
          if (restoredSelect) {
            restoredSelect.value = preservedSelectValue;
            // 이벤트 핸들러는 나중에 재바인딩됨
          }
        }
      }
      
      // URL 구조 점수 CTA 클릭 차단 우회용 로컬 핸들러
      const urlCta = root.result.querySelector('[data-cta="url-structure"]');
      if (urlCta && !urlCta.__localClickBound) {
        urlCta.__localClickBound = true;
        urlCta.addEventListener('click', () => {
          // intentionally empty
          // presence of local click handler is required to bypass analyze-level interception
        });
      }
      
      // Evidence details 토글 상태 동기화
      const evidenceDetails = root.result.querySelector('details[data-evidence="1"]');
      if (evidenceDetails && !evidenceDetails.__boundEvidenceV1) {
        evidenceDetails.__boundEvidenceV1 = true;
        evidenceDetails.addEventListener("toggle", () => {
          __evidenceOpenV1 = evidenceDetails.open;
        });
      }
      
      // Evidence 버전 선택 핸들러 (먼저 정의)
      function handleEvidenceVersionChange(e) {
        __selectedEvidenceId = e.target.value;
        const evidenceBody = root.result.querySelector('.evidence-body');
        if (evidenceBody) {
          // ✅ [Phase 5-7 Fix] select가 포커스 상태면 리렌더 스킵
          const currentSelect = evidenceBody.querySelector('#evidenceVersionSelect');
          const isSelectFocused = currentSelect && document.activeElement === currentSelect;
          
          if (!isSelectFocused) {
            const currentState = getState();
            const evidenceRoot = loadEvidence();
            evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
            
            // 재렌더링 후 핸들러 재바인딩
            const newSelect = root.result.querySelector('#evidenceVersionSelect');
            if (newSelect && !newSelect.__boundEvidenceVersionV1) {
              newSelect.__boundEvidenceVersionV1 = true;
              newSelect.addEventListener('change', handleEvidenceVersionChange);
              
              // ✅ [Phase 5-7 Fix] select 드롭다운 열림 동안 리렌더 프리즈
              if (!newSelect.__boundEvidenceFreezeV1) {
                newSelect.__boundEvidenceFreezeV1 = true;
                newSelect.addEventListener('mousedown', () => {
                  window.__freezeAnalyzeRerenderUntil = Date.now() + 2000;
                });
                newSelect.addEventListener('pointerdown', () => {
                  window.__freezeAnalyzeRerenderUntil = Date.now() + 2000;
                });
                newSelect.addEventListener('blur', () => {
                  window.__freezeAnalyzeRerenderUntil = 0;
                });
                newSelect.addEventListener('change', () => {
                  setTimeout(() => {
                    window.__freezeAnalyzeRerenderUntil = 0;
                  }, 100);
                });
              }
            }
            const newBtn = root.result.querySelector('[data-evidence-generate="1"]');
            if (newBtn && !newBtn.__boundEvidenceGenV1) {
              newBtn.__boundEvidenceGenV1 = true;
              newBtn.addEventListener('click', handleGenerateEvidence);
            }
            const newLoginBtn = root.result.querySelector('#btnEvidenceLogin');
            if (newLoginBtn && !newLoginBtn.__boundEvidenceLoginV1) {
              newLoginBtn.__boundEvidenceLoginV1 = true;
              newLoginBtn.addEventListener('click', () => {
                const loginModal = window.loginModalInstance;
                if (loginModal) {
                  loginModal.open("Evidence를 보려면 로그인이 필요합니다.");
                }
              });
            }
            // ✅ [Phase 7-2] 비교 토글 핸들러 재바인딩
            const newToggle = root.result.querySelector('#evidenceCompareToggle');
            if (newToggle && !newToggle.__boundEvidenceCompareV1) {
              newToggle.__boundEvidenceCompareV1 = true;
              newToggle.addEventListener('change', (e) => {
                __evidenceCompareEnabled = e.target.checked;
                const evidenceBody = root.result.querySelector('.evidence-body');
                if (evidenceBody) {
                  const currentState = getState();
                  const evidenceRoot = loadEvidence();
                  evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
                }
              });
            }
          }
        }
      }
      
      // Evidence 생성 버튼 핸들러
      function handleGenerateEvidence() {
        buildEvidenceFromViewContext({ page: "analyze" });
        const latest = loadEvidence();
        __evidenceOpenV1 = true;
        __selectedEvidenceId = null;
        const evidenceBody = root.result.querySelector('.evidence-body');
        const evidenceDetails = root.result.querySelector('details[data-evidence="1"]');
        if (evidenceBody) {
          const currentState = getState();
          evidenceBody.innerHTML = renderEvidenceContent(latest, currentState);
          if (evidenceDetails) {
            evidenceDetails.open = true;
          }
          const newBtn = root.result.querySelector('[data-evidence-generate="1"]');
          if (newBtn && !newBtn.__boundEvidenceGenV1) {
            newBtn.__boundEvidenceGenV1 = true;
            newBtn.addEventListener('click', handleGenerateEvidence);
          }
          const newLoginBtn = root.result.querySelector('#btnEvidenceLogin');
          if (newLoginBtn && !newLoginBtn.__boundEvidenceLoginV1) {
            newLoginBtn.__boundEvidenceLoginV1 = true;
            newLoginBtn.addEventListener('click', () => {
              const loginModal = window.loginModalInstance;
              if (loginModal) {
                loginModal.open("Evidence를 보려면 로그인이 필요합니다.");
              }
            });
          }
          const newSelect = root.result.querySelector('#evidenceVersionSelect');
          if (newSelect && !newSelect.__boundEvidenceVersionV1) {
            newSelect.__boundEvidenceVersionV1 = true;
            newSelect.addEventListener('change', handleEvidenceVersionChange);
            
            // ✅ [Phase 5-7 Fix] select 드롭다운 열림 동안 리렌더 프리즈
            if (!newSelect.__boundEvidenceFreezeV1) {
              newSelect.__boundEvidenceFreezeV1 = true;
              newSelect.addEventListener('mousedown', () => {
                window.__freezeAnalyzeRerenderUntil = Date.now() + 2000;
              });
              newSelect.addEventListener('pointerdown', () => {
                window.__freezeAnalyzeRerenderUntil = Date.now() + 2000;
              });
              newSelect.addEventListener('blur', () => {
                window.__freezeAnalyzeRerenderUntil = 0;
              });
              newSelect.addEventListener('change', () => {
                setTimeout(() => {
                  window.__freezeAnalyzeRerenderUntil = 0;
                }, 100);
              });
            }
          }
          // ✅ [Phase 7-2] 비교 토글 핸들러 재바인딩
          const newToggle = root.result.querySelector('#evidenceCompareToggle');
          if (newToggle && !newToggle.__boundEvidenceCompareV1) {
            newToggle.__boundEvidenceCompareV1 = true;
            newToggle.addEventListener('change', (e) => {
              __evidenceCompareEnabled = e.target.checked;
              const evidenceBody = root.result.querySelector('.evidence-body');
              if (evidenceBody) {
                const currentState = getState();
                const evidenceRoot = loadEvidence();
                evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
              }
            });
          }
        }
      }
      
      const btnGenerateEvidence = root.result.querySelector('[data-evidence-generate="1"]');
      if (btnGenerateEvidence && !btnGenerateEvidence.__boundEvidenceGenV1) {
        btnGenerateEvidence.__boundEvidenceGenV1 = true;
        btnGenerateEvidence.addEventListener('click', handleGenerateEvidence);
      }
      
      // Evidence 로그인 버튼 핸들러
      const btnEvidenceLogin = root.result.querySelector('#btnEvidenceLogin');
      if (btnEvidenceLogin && !btnEvidenceLogin.__boundEvidenceLoginV1) {
        btnEvidenceLogin.__boundEvidenceLoginV1 = true;
        btnEvidenceLogin.addEventListener('click', () => {
          const loginModal = window.loginModalInstance;
          if (loginModal) {
            loginModal.open("Evidence를 보려면 로그인이 필요합니다.");
          }
        });
      }
      
      // Evidence 버전 선택 핸들러 바인딩
      const evidenceVersionSelect = root.result.querySelector('#evidenceVersionSelect');
      if (evidenceVersionSelect && !evidenceVersionSelect.__boundEvidenceVersionV1) {
        evidenceVersionSelect.__boundEvidenceVersionV1 = true;
        evidenceVersionSelect.addEventListener('change', handleEvidenceVersionChange);
        
        // ✅ [Phase 5-7 Fix] select 드롭다운 열림 동안 리렌더 프리즈
        if (!evidenceVersionSelect.__boundEvidenceFreezeV1) {
          evidenceVersionSelect.__boundEvidenceFreezeV1 = true;
          // mousedown 또는 pointerdown 시 리렌더 프리즈 시작 (2초)
          evidenceVersionSelect.addEventListener('mousedown', () => {
            window.__freezeAnalyzeRerenderUntil = Date.now() + 2000;
          });
          evidenceVersionSelect.addEventListener('pointerdown', () => {
            window.__freezeAnalyzeRerenderUntil = Date.now() + 2000;
          });
          // blur 또는 change 시 리렌더 프리즈 해제
          evidenceVersionSelect.addEventListener('blur', () => {
            window.__freezeAnalyzeRerenderUntil = 0;
          });
          evidenceVersionSelect.addEventListener('change', () => {
            // change 이벤트 후 약간의 지연을 두고 해제 (선택 완료 후 UI 업데이트 허용)
            setTimeout(() => {
              window.__freezeAnalyzeRerenderUntil = 0;
            }, 100);
          });
        }
      }
      
      // ✅ [Phase 7-2] 히스토리 비교 토글 핸들러 바인딩
      const evidenceCompareToggle = root.result.querySelector('#evidenceCompareToggle');
      if (evidenceCompareToggle && !evidenceCompareToggle.__boundEvidenceCompareV1) {
        evidenceCompareToggle.__boundEvidenceCompareV1 = true;
        evidenceCompareToggle.addEventListener('change', (e) => {
          __evidenceCompareEnabled = e.target.checked;
          const evidenceBody = root.result.querySelector('.evidence-body');
          if (evidenceBody) {
            const currentState = getState();
            const evidenceRoot = loadEvidence();
            evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
            
            // 재렌더링 후 모든 핸들러 재바인딩 (handleEvidenceVersionChange와 동일한 로직)
            const newSelect = root.result.querySelector('#evidenceVersionSelect');
            if (newSelect && !newSelect.__boundEvidenceVersionV1) {
              newSelect.__boundEvidenceVersionV1 = true;
              newSelect.addEventListener('change', handleEvidenceVersionChange);
            }
            const newToggle = root.result.querySelector('#evidenceCompareToggle');
            if (newToggle && !newToggle.__boundEvidenceCompareV1) {
              newToggle.__boundEvidenceCompareV1 = true;
              newToggle.addEventListener('change', (e) => {
                __evidenceCompareEnabled = e.target.checked;
                const evidenceBody = root.result.querySelector('.evidence-body');
                if (evidenceBody) {
                  const currentState = getState();
                  const evidenceRoot = loadEvidence();
                  evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
                }
              });
            }
            const newBtn = root.result.querySelector('[data-evidence-generate="1"]');
            if (newBtn && !newBtn.__boundEvidenceGenV1) {
              newBtn.__boundEvidenceGenV1 = true;
              newBtn.addEventListener('click', handleGenerateEvidence);
            }
            const newLoginBtn = root.result.querySelector('#btnEvidenceLogin');
            if (newLoginBtn && !newLoginBtn.__boundEvidenceLoginV1) {
              newLoginBtn.__boundEvidenceLoginV1 = true;
              newLoginBtn.addEventListener('click', () => {
                const loginModal = window.loginModalInstance;
                if (loginModal) {
                  loginModal.open("Evidence를 보려면 로그인이 필요합니다.");
                }
              });
            }
          }
        });
      }
    }
  }
  
export function esc(v) {
    return String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

/**
 * ✅ [Phase 7-2] Evidence entry에서 bullet 리스트 추출
 * @param {Object} entry - Evidence entry 객체 (v2Summary 포함 가능)
 * @param {Object} scores - analysis.scores 객체 (현재 분석 결과)
 * @returns {string[]} Evidence bullet 리스트 (최대 7개)
 */
function getEvidenceBullets(entry, scores) {
  try {
    // entry에서 v2Summary 추출 시도
    let contentStructureV2 = null;
    
    if (entry && entry.v2Summary) {
      // v2Summary에서 analysis.scores.contentStructureV2 찾기
      contentStructureV2 = entry.v2Summary?.analysis?.scores?.contentStructureV2;
    }
    
    // entry에 직접 contentStructureV2가 있는 경우
    if (!contentStructureV2 && entry && entry.contentStructureV2) {
      contentStructureV2 = entry.contentStructureV2;
    }
    
    // scores에서 직접 가져오기 (현재 분석 결과)
    if (!contentStructureV2 && scores && scores.contentStructureV2) {
      contentStructureV2 = scores.contentStructureV2;
    }
    
    if (contentStructureV2 && contentStructureV2.evidence && Array.isArray(contentStructureV2.evidence)) {
      // 불충족 항목 추출
      const failedItems = contentStructureV2.evidence
        .filter(e => {
          const text = typeof e === 'string' ? e : String(e);
          return text.includes('부재') || text.includes('부족') || text.includes('없음') || 
                 text.includes('미흡') || text.includes('부족함') || text.includes('누락');
        })
        .map(e => {
          const text = typeof e === 'string' ? e : String(e);
          const parts = text.split(':');
          if (parts.length > 1) {
            return parts[1].trim();
          }
          return text;
        })
        .slice(0, 7); // 최대 7개
      
      return failedItems;
    }
    
    return [];
  } catch (error) {
    if (globalThis.DEBUG) {
      console.warn('[Phase 7-2] getEvidenceBullets 실패:', error);
    }
    return [];
  }
}

// ✅ [Phase 5-8] Share 화면에서도 사용할 수 있도록 export
export function renderEvidenceContent(evidenceParam = null, stateParam = null) {
  const evidenceRoot = evidenceParam !== null ? evidenceParam : loadEvidence();
  const isAuthed = isLoggedIn();
  const state = stateParam !== null ? stateParam : getState();
  const scores = state.analysis?.scores || {};
  
  // 히스토리 구조 처리
  let currentEvidence = null;
  let history = [];
  let currentId = null;
  
  if (evidenceRoot) {
    if (evidenceRoot.history && Array.isArray(evidenceRoot.history)) {
      // 새로운 root 구조
      history = evidenceRoot.history;
      currentId = __selectedEvidenceId || evidenceRoot.currentId;
      currentEvidence = history.find(e => e.meta?.id === currentId) || history[history.length - 1];
    } else {
      // 레거시 단일 객체
      currentEvidence = evidenceRoot;
      history = [evidenceRoot];
      currentId = evidenceRoot.meta?.id || Date.now().toString();
    }
  }
  
  // ✅ [Phase 7-2] 실제 분석 결과에서 Evidence 추출 (함수 재사용)
  const analysisEvidenceItems = getEvidenceBullets(null, scores);
  
  if (!currentEvidence) {
    // Evidence 없음 - 실제 분석 결과 표시
    if (isAuthed) {
      // 실제 분석 결과가 있으면 표시
      if (analysisEvidenceItems.length > 0) {
        const evidenceListHtml = analysisEvidenceItems
          .map(item => `<li style="margin-bottom: 6px; line-height: 1.5;">${esc(item)}</li>`)
          .join('');
        return `
          <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text);">분석 결과 요약</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text);">
            ${evidenceListHtml}
          </ul>
          <button data-evidence-generate="1" class="btn btn-primary" style="width: 100%; margin-top: 12px;">근거 생성(테스트)</button>
        `;
      } else {
        // 분석 결과가 있지만 불충족 항목이 없는 경우
        const contentStructureV2 = scores.contentStructureV2;
        if (contentStructureV2 && contentStructureV2.score !== null && contentStructureV2.score !== undefined) {
          return `
            <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text);">분석 결과 요약</p>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text);">핵심 구조 체크를 대부분 충족했습니다.</p>
            <button data-evidence-generate="1" class="btn btn-primary" style="width: 100%; margin-top: 8px;">근거 생성(테스트)</button>
          `;
        } else {
          // 측정 필요
          return `
            <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--muted);">이번 리포트에서는 Evidence를 생성할 데이터가 부족합니다(측정 필요).</p>
            <button data-evidence-generate="1" class="btn btn-primary" style="width: 100%; margin-top: 8px;">근거 생성(테스트)</button>
          `;
        }
      }
    } else {
      return `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--muted);">Evidence를 보려면 로그인이 필요합니다.</p>
        <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); text-align: center;">
          <button id="btnEvidenceLogin" class="btn btn-primary" style="width: 100%;">로그인</button>
        </div>
      `;
    }
  } else {
    // Evidence 있음
    if (!isAuthed) {
      // 로그아웃 상태: 상태만 표시, items는 숨김, 로그인 유도
      return `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text);">Evidence 있음</p>
        <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--muted);">Evidence를 보려면 로그인이 필요합니다.</p>
          <button id="btnEvidenceLogin" class="btn btn-primary" style="width: 100%;">로그인</button>
        </div>
      `;
    } else {
      // 로그인 상태: 저장된 Evidence entry의 items 표시
      const createdAt = currentEvidence.meta?.createdAt || currentEvidence.createdAt || currentEvidence.timestamp || currentEvidence.created_at || null;
      const createdAtText = createdAt ? new Date(createdAt).toLocaleString('ko-KR') : '';
      
      // ✅ [Phase 5-7] Evidence entry의 items 구조 처리
      // items가 { id, label, title, detail } 형태인지 확인
      const evidenceItems = currentEvidence.items || [];
      let itemsHtml = '';
      
      if (evidenceItems.length > 0) {
        // 새로운 구조 ({ id, label, title, detail })
        if (evidenceItems[0] && typeof evidenceItems[0] === 'object' && evidenceItems[0].id) {
          itemsHtml = evidenceItems.map(item => {
            const labelText = item.label ? `<span style="font-weight: 600; color: var(--muted);">[${esc(item.label)}]</span> ` : '';
            const titleText = item.title ? esc(item.title) : '';
            const detailText = item.detail ? ` <span style="color: var(--muted); font-size: 12px;">- ${esc(item.detail)}</span>` : '';
            return `<p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text);">${labelText}${titleText}${detailText}</p>`;
          }).join('');
        } else {
          // 레거시 구조 (문자열 배열 또는 기타)
          itemsHtml = evidenceItems.map(item => {
            const text = typeof item === 'string' ? item : (item.text || item.title || JSON.stringify(item));
            return `<p style="margin: 0 0 4px 0; font-size: 13px; color: var(--text);">${esc(text)}</p>`;
          }).join('');
        }
      }
      
      // ✅ [Phase 7-2] 현재 선택된 entry의 인덱스 찾기
      const currentIndex = history.findIndex(e => {
        const entryId = e.meta?.id || e.id;
        return entryId === currentId;
      });
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : -1;
      const prevEvidence = prevIndex >= 0 ? history[prevIndex] : null;
      
      // ✅ [Phase 7-2] 비교용 Evidence bullet 추출
      const currBullets = getEvidenceBullets(currentEvidence, scores);
      const prevBullets = prevEvidence ? getEvidenceBullets(prevEvidence, scores) : [];
      
      // ✅ [Phase 7-2a] diff 계산: trim() 후 문자열 완전 일치 기반
      const currBulletsTrimmed = currBullets.map(item => String(item).trim());
      const prevBulletsTrimmed = prevBullets.map(item => String(item).trim());
      const addedItems = currBulletsTrimmed.filter(item => !prevBulletsTrimmed.includes(item)).slice(0, 7);
      const removedItems = prevBulletsTrimmed.filter(item => !currBulletsTrimmed.includes(item)).slice(0, 7);
      
      // 히스토리 버전 선택 UI
      let versionSelector = '';
      if (history.length >= 2) {
        // ✅ [Phase 5-7 Fix] "최신" 라벨이 매 렌더마다 변하지 않도록 entry timestamp 기반으로만 생성
        // Date.now() 같은 현재시간을 사용하지 않고 latestEntry의 timestamp만 사용
        const latestEntry = history[history.length - 1];
        const latestEntryDate = latestEntry.meta?.createdAt || latestEntry.createdAt || latestEntry.timestamp || latestEntry.created_at;
        
        const versionOptions = history.map((entry, index) => {
          const entryId = entry.meta?.id || index.toString();
          const entryDate = entry.meta?.createdAt || entry.createdAt || entry.timestamp || entry.created_at;
          // ✅ [Phase 5-7 Fix] entry의 timestamp를 기반으로만 문자열 생성 (Date.now() 사용 안 함)
          const entryDateText = entryDate ? new Date(entryDate).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
          const isSelected = entryId === currentId;
          // 최신 항목은 항상 "최신"으로 표시 (시간 기반이 아닌 인덱스 기반)
          const label = index === history.length - 1 ? '최신' : `이전 ${history.length - index - 1}`;
          return `<option value="${esc(entryId)}" ${isSelected ? 'selected' : ''}>${label}${entryDateText ? ` (${esc(entryDateText)})` : ''}</option>`;
        }).join('');
        
        versionSelector = `
          <div style="margin-top: 8px; margin-bottom: 8px;">
            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--muted);">버전:</label>
            <select id="evidenceVersionSelect" data-evidence-version="1" style="width: 100%; padding: 6px; font-size: 13px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text);">
              ${versionOptions}
            </select>
          </div>
        `;
      }
      
      // ✅ [Phase 7-2] 히스토리 비교 토글 UI
      let compareToggleHtml = '';
      let compareDiffHtml = '';
      
      if (history.length >= 2) {
        const compareEnabled = __evidenceCompareEnabled && prevEvidence;
        compareToggleHtml = `
          <div style="margin-top: 12px; margin-bottom: 8px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); cursor: pointer;">
              <input type="checkbox" id="evidenceCompareToggle" ${compareEnabled ? 'checked' : ''} style="cursor: pointer;">
              <span>비교 보기 (이전 vs 선택)</span>
            </label>
          </div>
        `;
        
        if (compareEnabled) {
          if (!prevEvidence) {
            // i=0인 경우: 이전 기록이 없음
            compareDiffHtml = `
              <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
                <p style="margin: 0; font-size: 12px; color: var(--muted);">이전 기록이 없어 비교할 수 없습니다.</p>
              </div>
            `;
          } else {
            // ✅ [Phase 7-2] curr와 prev의 Evidence bullet 리스트 동시 출력
            const currBulletsHtml = currBullets.length > 0 ? `
              <div style="flex: 1; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); min-width: 200px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: var(--text);">선택된 버전</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: var(--text);">
                  ${currBullets.map(item => `<li style="margin-bottom: 4px; line-height: 1.4;">${esc(item)}</li>`).join('')}
                </ul>
              </div>
            ` : `
              <div style="flex: 1; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); min-width: 200px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: var(--text);">선택된 버전</p>
                <p style="margin: 0; font-size: 12px; color: var(--muted);">Evidence 데이터 부족(측정 필요)</p>
              </div>
            `;
            
            const prevBulletsHtml = prevBullets.length > 0 ? `
              <div style="flex: 1; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); min-width: 200px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: var(--text);">이전 버전</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: var(--text);">
                  ${prevBullets.map(item => `<li style="margin-bottom: 4px; line-height: 1.4;">${esc(item)}</li>`).join('')}
                </ul>
              </div>
            ` : `
              <div style="flex: 1; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); min-width: 200px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: var(--text);">이전 버전</p>
                <p style="margin: 0; font-size: 12px; color: var(--muted);">Evidence 데이터 부족(측정 필요)</p>
              </div>
            `;
            
            // ✅ [Phase 7-2a] diff 섹션: Added/Removed 박스 (항목이 없어도 표시)
            const addedHtml = `
              <div style="flex: 1; padding: 12px; background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: var(--radius); min-width: 200px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #2e7d32;">Added</p>
                ${addedItems.length > 0 ? `
                  <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: var(--text);">
                    ${addedItems.map(item => `<li style="margin-bottom: 4px; line-height: 1.4;">${esc(item)}</li>`).join('')}
                  </ul>
                ` : `
                  <p style="margin: 0; font-size: 12px; color: var(--muted);">추가된 항목 없음</p>
                `}
              </div>
            `;
            
            const removedHtml = `
              <div style="flex: 1; padding: 12px; background: #ffebee; border: 1px solid #ffcdd2; border-radius: var(--radius); min-width: 200px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #c62828;">Removed</p>
                ${removedItems.length > 0 ? `
                  <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: var(--text);">
                    ${removedItems.map(item => `<li style="margin-bottom: 4px; line-height: 1.4;">${esc(item)}</li>`).join('')}
                  </ul>
                ` : `
                  <p style="margin: 0; font-size: 12px; color: var(--muted);">사라진 항목 없음</p>
                `}
              </div>
            `;
            
            // ✅ [Phase 7-2a] diff 섹션은 항상 렌더링
            const diffSectionHtml = `
              <div style="margin-top: 12px;">
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                  ${addedHtml}
                  ${removedHtml}
                </div>
              </div>
            `;
            
            // ✅ [Phase 7-2a] "변경사항이 없습니다."는 diff 섹션 하단에만 표시 (렌더 막지 않음)
            const noChangesMessageHtml = (addedItems.length === 0 && removedItems.length === 0) ? `
              <div style="margin-top: 8px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
                <p style="margin: 0; font-size: 12px; color: var(--muted);">변경사항이 없습니다.</p>
              </div>
            ` : '';
            
            compareDiffHtml = `
              <div style="margin-top: 12px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: var(--text);">비교 결과</p>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                  ${currBulletsHtml}
                  ${prevBulletsHtml}
                </div>
                ${diffSectionHtml}
                ${noChangesMessageHtml}
              </div>
            `;
          }
        }
      } else {
        compareToggleHtml = `
          <div style="margin-top: 12px; margin-bottom: 8px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted);">
              <input type="checkbox" disabled style="cursor: not-allowed;">
              <span>비교 보기 (비교하려면 최소 2개 기록이 필요)</span>
            </label>
          </div>
        `;
      }
      
      // ✅ [Phase 5-8 v3] 히스토리가 있어도 실제 분석 결과를 우선 표시
      let analysisResultHtml = '';
      if (analysisEvidenceItems.length > 0) {
        const evidenceListHtml = analysisEvidenceItems
          .map(item => `<li style="margin-bottom: 6px; line-height: 1.5;">${esc(item)}</li>`)
          .join('');
        analysisResultHtml = `
          <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
            <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: var(--text);">현재 분석 결과 요약</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: var(--text);">
              ${evidenceListHtml}
            </ul>
          </div>
        `;
      } else {
        const contentStructureV2 = scores.contentStructureV2;
        if (contentStructureV2 && contentStructureV2.score !== null && contentStructureV2.score !== undefined) {
          analysisResultHtml = `
            <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
              <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: var(--text);">현재 분석 결과 요약</p>
              <p style="margin: 0; font-size: 13px; color: var(--text);">핵심 구조 체크를 대부분 충족했습니다.</p>
            </div>
          `;
        }
      }
      
      return `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text);">Evidence 있음</p>
        ${versionSelector}
        ${compareToggleHtml}
        ${createdAtText ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: var(--muted);">생성 시간: ${esc(createdAtText)}</p>` : ''}
        ${itemsHtml ? `
          <div style="margin-top: 8px;">
            ${itemsHtml}
          </div>
        ` : ''}
        ${analysisResultHtml}
        ${compareDiffHtml}
        <button data-evidence-generate="1" class="btn btn-primary" style="width: 100%; margin-top: 12px;">근거 생성(테스트)</button>
      `;
    }
  }
}
  