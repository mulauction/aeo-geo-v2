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

// ✅ [Phase 7-3A] WHY 시뮬레이터 상태 (view-only, no storage)
let __whySimulatorMode = 'OFF'; // 'OFF' | 'NONE' | 'A' | 'B'

// ✅ [Phase 7-3B] AB Compare 더미 개선안 상태 (view-only, no storage)
let __abDrafts = []; // [{id, label, evidenceLike}]
let __abSelectedId = null;

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
    // ✅ [Phase 7-3C] 전역 rerender 콜백 등록 (WHY 시뮬레이터용)
    if (typeof window !== 'undefined') {
      window.__rerenderEvidenceViewV1 = () => render(root, getState());
    }
    
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
      
      // ✅ [Phase 7-3D] WHY 시뮬레이터 select 바인딩 함수
      function bindWhySimulatorSelect(root) {
        const whySimulatorSelect = root.result.querySelector('#whySimulatorSelect');
        if (!whySimulatorSelect) return;

        // 값 유지
        whySimulatorSelect.value = __whySimulatorMode;

        // change 바인딩 (1회)
        if (!whySimulatorSelect.__boundWhySimulatorV1) {
          whySimulatorSelect.__boundWhySimulatorV1 = true;
          whySimulatorSelect.addEventListener('change', (e) => {
            e.preventDefault();
            e.stopPropagation();
            __whySimulatorMode = whySimulatorSelect.value || 'OFF';

            const evidenceBody = root.result.querySelector('.evidence-body');
            if (evidenceBody) {
              const currentState = getState();
              const evidenceRoot = loadEvidence();
              evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
            }

            window.__freezeAnalyzeRerenderUntil = 0;
          });
        }

        // ✅ 프리즈(10분) - 드롭다운이 리렌더로 닫히는 현상 방지
        if (!whySimulatorSelect.__boundWhySimulatorFreezeV1) {
          whySimulatorSelect.__boundWhySimulatorFreezeV1 = true;
          whySimulatorSelect.addEventListener('mousedown', () => {
            window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
          });
          whySimulatorSelect.addEventListener('pointerdown', () => {
            window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
          });
          whySimulatorSelect.addEventListener('focus', () => {
            window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
          });
          whySimulatorSelect.addEventListener('blur', () => {
            window.__freezeAnalyzeRerenderUntil = 0;
          });
        }
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
                  window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                });
                newSelect.addEventListener('pointerdown', () => {
                  window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                });
                newSelect.addEventListener('focus', () => {
                  window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                });
                newSelect.addEventListener('blur', () => {
                  window.__freezeAnalyzeRerenderUntil = 0;
                });
                newSelect.addEventListener('change', () => {
                  window.__freezeAnalyzeRerenderUntil = 0;
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
            // ✅ [Phase 7-5] 복사 버튼 핸들러 재바인딩
            const newCopyBtn = root.result.querySelector('#compareCopyBtn');
            if (newCopyBtn && !newCopyBtn.__boundCompareCopyV1) {
              newCopyBtn.__boundCompareCopyV1 = true;
              newCopyBtn.addEventListener('click', async () => {
                const copyText = newCopyBtn.getAttribute('data-copy-text') || '';
                if (copyText) {
                  const success = await copyToClipboard(copyText);
                  if (success) {
                    showToast('비교 요약이 클립보드에 복사되었습니다.', true);
                  } else {
                    showToast('복사에 실패했습니다. 다시 시도해주세요.', false);
                  }
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
                window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
              });
              newSelect.addEventListener('pointerdown', () => {
                window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
              });
              newSelect.addEventListener('focus', () => {
                window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
              });
              newSelect.addEventListener('blur', () => {
                window.__freezeAnalyzeRerenderUntil = 0;
              });
              newSelect.addEventListener('change', () => {
                window.__freezeAnalyzeRerenderUntil = 0;
              });
            }
          }
          // ✅ [Phase 7-3C] 비교보기 체크박스 핸들러 재바인딩 (재렌더 후에도 클릭 가능하도록)
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
                
                // ✅ [Phase 7-3C] 재렌더 후 모든 핸들러 재바인딩
                const newBtn = root.result.querySelector('[data-evidence-generate="1"]');
                if (newBtn && !newBtn.__boundEvidenceGenV1) {
                  newBtn.__boundEvidenceGenV1 = true;
                  newBtn.addEventListener('click', handleGenerateEvidence);
                }
                const newToggle2 = root.result.querySelector('#evidenceCompareToggle');
                if (newToggle2 && !newToggle2.__boundEvidenceCompareV1) {
                  newToggle2.__boundEvidenceCompareV1 = true;
                  newToggle2.addEventListener('change', (e) => {
                    __evidenceCompareEnabled = e.target.checked;
                    const evidenceBody = root.result.querySelector('.evidence-body');
                    if (evidenceBody) {
                      const currentState = getState();
                      const evidenceRoot = loadEvidence();
                      evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
                    }
                  });
                }
                const newSelect2 = root.result.querySelector('#evidenceVersionSelect');
                if (newSelect2 && !newSelect2.__boundEvidenceVersionV1) {
                  newSelect2.__boundEvidenceVersionV1 = true;
                  newSelect2.addEventListener('change', handleEvidenceVersionChange);
                }
                // ✅ [Phase 7-5] 복사 버튼 핸들러 재바인딩
                const newCopyBtn2 = root.result.querySelector('#compareCopyBtn');
                if (newCopyBtn2 && !newCopyBtn2.__boundCompareCopyV1) {
                  newCopyBtn2.__boundCompareCopyV1 = true;
                  newCopyBtn2.addEventListener('click', async () => {
                    const copyText = newCopyBtn2.getAttribute('data-copy-text') || '';
                    if (copyText) {
                      const success = await copyToClipboard(copyText);
                      if (success) {
                        showToast('비교 요약이 클립보드에 복사되었습니다.', true);
                      } else {
                        showToast('복사에 실패했습니다. 다시 시도해주세요.', false);
                      }
                    }
                  });
                }
                bindAbCompareControls(root);
                bindWhySimulatorSelect(root);
              }
            });
          }
          // ✅ [Phase 7-5] 복사 버튼 핸들러 재바인딩
          const newCopyBtn = root.result.querySelector('#compareCopyBtn');
          if (newCopyBtn && !newCopyBtn.__boundCompareCopyV1) {
            newCopyBtn.__boundCompareCopyV1 = true;
            newCopyBtn.addEventListener('click', async () => {
              const copyText = newCopyBtn.getAttribute('data-copy-text') || '';
              if (copyText) {
                const success = await copyToClipboard(copyText);
                if (success) {
                  showToast('비교 요약이 클립보드에 복사되었습니다.', true);
                } else {
                  showToast('복사에 실패했습니다. 다시 시도해주세요.', false);
                }
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
          // mousedown/pointerdown/focus 시 리렌더 프리즈 시작 (10분)
          evidenceVersionSelect.addEventListener('mousedown', () => {
            window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
          });
          evidenceVersionSelect.addEventListener('pointerdown', () => {
            window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
          });
          evidenceVersionSelect.addEventListener('focus', () => {
            window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
          });
          // blur 또는 change 시 리렌더 프리즈 해제
          evidenceVersionSelect.addEventListener('blur', () => {
            window.__freezeAnalyzeRerenderUntil = 0;
          });
          evidenceVersionSelect.addEventListener('change', () => {
            window.__freezeAnalyzeRerenderUntil = 0;
          });
        }
      }
      
      // ✅ [Phase 7-3D] WHY 시뮬레이터 select 바인딩
      bindWhySimulatorSelect(root);
      
      // ✅ [Phase 7-3B] AB Compare 더미 개선안 컨트롤 바인딩
      function bindAbCompareControls(root) {
        const abAddBtn = root.result.querySelector('#ab-add-dummy');
        const abSelect = root.result.querySelector('#ab-select-dummy');
        
        if (abAddBtn && !abAddBtn.__boundAbAddV1) {
          abAddBtn.__boundAbAddV1 = true;
          abAddBtn.addEventListener('click', () => {
            try {
              // 이미 2개가 있으면 재생성하지 않음
              if (__abDrafts.length >= 2) {
                return;
              }
              
              // currentEvidence 가져오기
              const evidenceRoot = loadEvidence();
              let currentEvidence = null;
              if (evidenceRoot) {
                if (evidenceRoot.history && Array.isArray(evidenceRoot.history)) {
                  const history = evidenceRoot.history;
                  const latest = history[history.length - 1];
                  const latestId = latest?.meta?.id || latest?.id || null;
                  const currentId = __selectedEvidenceId || evidenceRoot.currentId || latestId;
                  currentEvidence = history.find(e => (e?.meta?.id || e?.id) === currentId) || latest;
                } else {
                  currentEvidence = evidenceRoot;
                }
              }
              
              if (!currentEvidence) {
                return; // currentEvidence가 없으면 동작하지 않음
              }
              
              // 더미 개선안 생성
              __abDrafts = buildDummyImprovementDrafts(currentEvidence);
              if (__abDrafts.length > 0) {
                __abSelectedId = __abDrafts[0].id;
              }
              
              // 화면 갱신 (Evidence Compare 다시 렌더)
              const evidenceBody = root.result.querySelector('.evidence-body');
              if (evidenceBody) {
                const evidenceRoot = loadEvidence();
                const currentState = getState();
                evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
                
                // 재렌더링 후 모든 핸들러 재바인딩
                const newSelect = root.result.querySelector('#evidenceVersionSelect');
                if (newSelect && !newSelect.__boundEvidenceVersionV1) {
                  newSelect.__boundEvidenceVersionV1 = true;
                  newSelect.addEventListener('change', handleEvidenceVersionChange);
                  
                  if (!newSelect.__boundEvidenceFreezeV1) {
                    newSelect.__boundEvidenceFreezeV1 = true;
                    newSelect.addEventListener('mousedown', () => {
                      window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                    });
                    newSelect.addEventListener('pointerdown', () => {
                      window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                    });
                    newSelect.addEventListener('focus', () => {
                      window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                    });
                    newSelect.addEventListener('blur', () => {
                      window.__freezeAnalyzeRerenderUntil = 0;
                    });
                    newSelect.addEventListener('change', () => {
                      window.__freezeAnalyzeRerenderUntil = 0;
                    });
                  }
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
                
                // AB Compare 컨트롤 재바인딩
                bindAbCompareControls(root);
                
                // WHY 시뮬레이터 재바인딩
                bindWhySimulatorSelect(root);
                
                // ✅ [Phase 7-5] 복사 버튼 핸들러 재바인딩
                const newCopyBtn = root.result.querySelector('#compareCopyBtn');
                if (newCopyBtn && !newCopyBtn.__boundCompareCopyV1) {
                  newCopyBtn.__boundCompareCopyV1 = true;
                  newCopyBtn.addEventListener('click', async () => {
                    const copyText = newCopyBtn.getAttribute('data-copy-text') || '';
                    if (copyText) {
                      const success = await copyToClipboard(copyText);
                      if (success) {
                        showToast('비교 요약이 클립보드에 복사되었습니다.', true);
                      } else {
                        showToast('복사에 실패했습니다. 다시 시도해주세요.', false);
                      }
                    }
                  });
                }
              }
            } catch (error) {
              if (globalThis.DEBUG) {
                console.warn('[Phase 7-3B] AB Compare 더미 추가 실패:', error);
              }
            }
          });
        }
        
        if (abSelect && !abSelect.__boundAbSelectV1) {
          abSelect.__boundAbSelectV1 = true;
          abSelect.addEventListener('change', (e) => {
            try {
              __abSelectedId = e.target.value || null;
              
              // 화면 갱신 (Compare/Insight/WHY만 바뀌면 됨)
              const evidenceBody = root.result.querySelector('.evidence-body');
              if (evidenceBody) {
                const evidenceRoot = loadEvidence();
                const currentState = getState();
                evidenceBody.innerHTML = renderEvidenceContent(evidenceRoot, currentState);
                
                // 재렌더링 후 모든 핸들러 재바인딩
                const newSelect = root.result.querySelector('#evidenceVersionSelect');
                if (newSelect && !newSelect.__boundEvidenceVersionV1) {
                  newSelect.__boundEvidenceVersionV1 = true;
                  newSelect.addEventListener('change', handleEvidenceVersionChange);
                  
                  if (!newSelect.__boundEvidenceFreezeV1) {
                    newSelect.__boundEvidenceFreezeV1 = true;
                    newSelect.addEventListener('mousedown', () => {
                      window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                    });
                    newSelect.addEventListener('pointerdown', () => {
                      window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                    });
                    newSelect.addEventListener('focus', () => {
                      window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
                    });
                    newSelect.addEventListener('blur', () => {
                      window.__freezeAnalyzeRerenderUntil = 0;
                    });
                    newSelect.addEventListener('change', () => {
                      window.__freezeAnalyzeRerenderUntil = 0;
                    });
                  }
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
                
                // AB Compare 컨트롤 재바인딩
                bindAbCompareControls(root);
                
                // WHY 시뮬레이터 재바인딩
                bindWhySimulatorSelect(root);
                
                // ✅ [Phase 7-5] 복사 버튼 핸들러 재바인딩
                const newCopyBtn = root.result.querySelector('#compareCopyBtn');
                if (newCopyBtn && !newCopyBtn.__boundCompareCopyV1) {
                  newCopyBtn.__boundCompareCopyV1 = true;
                  newCopyBtn.addEventListener('click', async () => {
                    const copyText = newCopyBtn.getAttribute('data-copy-text') || '';
                    if (copyText) {
                      const success = await copyToClipboard(copyText);
                      if (success) {
                        showToast('비교 요약이 클립보드에 복사되었습니다.', true);
                      } else {
                        showToast('복사에 실패했습니다. 다시 시도해주세요.', false);
                      }
                    }
                  });
                }
              }
            } catch (error) {
              if (globalThis.DEBUG) {
                console.warn('[Phase 7-3B] AB Compare 선택 변경 실패:', error);
              }
            }
          });
          
          // 드롭다운 프리즈 (기존 패턴 따라)
          if (!abSelect.__boundAbFreezeV1) {
            abSelect.__boundAbFreezeV1 = true;
            abSelect.addEventListener('mousedown', () => {
              window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
            });
            abSelect.addEventListener('pointerdown', () => {
              window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
            });
            abSelect.addEventListener('focus', () => {
              window.__freezeAnalyzeRerenderUntil = Date.now() + 600000;
            });
            abSelect.addEventListener('blur', () => {
              window.__freezeAnalyzeRerenderUntil = 0;
            });
            abSelect.addEventListener('change', () => {
              window.__freezeAnalyzeRerenderUntil = 0;
            });
          }
        }
      }
      
      // AB Compare 컨트롤 바인딩 호출
      bindAbCompareControls(root);
      
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
            
            // ✅ [Phase 7-3D] WHY 시뮬레이터 select 바인딩
            bindWhySimulatorSelect(root);
            
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
            // ✅ [Phase 7-5] 복사 버튼 핸들러 재바인딩
            const newCopyBtn = root.result.querySelector('#compareCopyBtn');
            if (newCopyBtn && !newCopyBtn.__boundCompareCopyV1) {
              newCopyBtn.__boundCompareCopyV1 = true;
              newCopyBtn.addEventListener('click', async () => {
                const copyText = newCopyBtn.getAttribute('data-copy-text') || '';
                if (copyText) {
                  const success = await copyToClipboard(copyText);
                  if (success) {
                    showToast('비교 요약이 클립보드에 복사되었습니다.', true);
                  } else {
                    showToast('복사에 실패했습니다. 다시 시도해주세요.', false);
                  }
                }
              });
            }
          }
        });
      }
      
      // ✅ [Phase 7-5] 복사 버튼 핸들러 바인딩
      const compareCopyBtn = root.result.querySelector('#compareCopyBtn');
      if (compareCopyBtn && !compareCopyBtn.__boundCompareCopyV1) {
        compareCopyBtn.__boundCompareCopyV1 = true;
        compareCopyBtn.addEventListener('click', async () => {
          const copyText = compareCopyBtn.getAttribute('data-copy-text') || '';
          if (copyText) {
            const success = await copyToClipboard(copyText);
            if (success) {
              showToast('비교 요약이 클립보드에 복사되었습니다.', true);
            } else {
              showToast('복사에 실패했습니다. 다시 시도해주세요.', false);
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
 * ✅ [Phase 7-5] 클립보드 복사 함수 (fallback 포함)
 * @param {string} text - 복사할 텍스트
 * @returns {Promise<boolean>} 성공 여부
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // clipboard API 실패 시 fallback 시도
  }
  
  // Fallback: textarea 생성 → select → execCommand
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    return false;
  }
}

/**
 * ✅ [Phase 7-5] 토스트 메시지 표시 함수 (view-only, 2초 후 자동 제거)
 * @param {string} message - 표시할 메시지
 * @param {boolean} isSuccess - 성공(true) 또는 실패(false)
 */
function showToast(message, isSuccess = true) {
  // CSS 애니메이션 동적 추가 (1회만)
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes toastSlideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes toastSlideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    background: ${isSuccess ? '#4caf50' : '#f44336'};
    color: white;
    border-radius: var(--radius, 4px);
    font-size: 13px;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    animation: toastSlideIn 0.3s ease-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease-out';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2000);
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

/**
 * ✅ [Phase 7-3B] 더미 개선안 생성 함수
 * @param {Object} baseEvidence - 현재 evidence (currentEvidence)
 * @returns {Array} 더미 개선안 배열 [{id, label, evidenceLike}]
 */
function buildDummyImprovementDrafts(baseEvidence) {
  try {
    if (!baseEvidence) {
      return [];
    }
    
    // 깊은 복사
    const baseCopy = JSON.parse(JSON.stringify(baseEvidence));
    
    // v1: 점수 약간 증가
    const v1Copy = JSON.parse(JSON.stringify(baseCopy));
    if (!v1Copy.v2Summary) {
      v1Copy.v2Summary = {};
    }
    if (!v1Copy.v2Summary.analysis) {
      v1Copy.v2Summary.analysis = {};
    }
    if (!v1Copy.v2Summary.analysis.scores) {
      v1Copy.v2Summary.analysis.scores = {};
    }
    
    // 점수 조정 (기존 점수에서 소폭 증가, clamp 0~100)
    const adjustScore = (scoreObj, delta) => {
      const baseScore = scoreObj && scoreObj.score !== null && scoreObj.score !== undefined ? scoreObj.score : 50;
      return { ...(scoreObj || {}), score: Math.max(0, Math.min(100, baseScore + delta)) };
    };
    
    v1Copy.v2Summary.analysis.scores = {
      ...v1Copy.v2Summary.analysis.scores,
      branding: adjustScore(v1Copy.v2Summary.analysis.scores.branding, 6),
      contentStructureV2: adjustScore(v1Copy.v2Summary.analysis.scores.contentStructureV2, 10),
      urlStructureV1: adjustScore(v1Copy.v2Summary.analysis.scores.urlStructureV1, 4)
    };
    
    // v1: insight 수정
    v1Copy.v2Summary.insight = "개선안 v1: 콘텐츠 구조와 브랜딩 요소가 개선되었습니다.";
    
    // v1: evidence 배열 조작 (추가됨 1~2개)
    const v1EvidencePath = v1Copy.v2Summary?.analysis?.scores?.contentStructureV2;
    if (v1EvidencePath) {
      if (!v1EvidencePath.evidence || !Array.isArray(v1EvidencePath.evidence)) {
        v1EvidencePath.evidence = [];
      }
      // 추가: 1~2개 (기존 compare가 읽는 경로 그대로 사용)
      v1EvidencePath.evidence.push("H3 제목 부재: 서브섹션 구조 개선 필요");
      v1EvidencePath.evidence.push("UL 리스트 구조 부족: 항목 명확화 필요");
    }
    
    // v2: 점수 더 많이 증가
    const v2Copy = JSON.parse(JSON.stringify(baseCopy));
    if (!v2Copy.v2Summary) {
      v2Copy.v2Summary = {};
    }
    if (!v2Copy.v2Summary.analysis) {
      v2Copy.v2Summary.analysis = {};
    }
    if (!v2Copy.v2Summary.analysis.scores) {
      v2Copy.v2Summary.analysis.scores = {};
    }
    
    v2Copy.v2Summary.analysis.scores = {
      ...v2Copy.v2Summary.analysis.scores,
      branding: adjustScore(v2Copy.v2Summary.analysis.scores.branding, 12),
      contentStructureV2: adjustScore(v2Copy.v2Summary.analysis.scores.contentStructureV2, 18),
      urlStructureV1: adjustScore(v2Copy.v2Summary.analysis.scores.urlStructureV1, 8)
    };
    
    // v2: insight 수정
    v2Copy.v2Summary.insight = "개선안 v2: 대폭적인 구조 개선과 브랜딩 강화가 이루어졌습니다.";
    
    // v2: evidence 배열 조작 (추가됨 2~3개, 제거됨 1개)
    const v2EvidencePath = v2Copy.v2Summary?.analysis?.scores?.contentStructureV2;
    if (v2EvidencePath) {
      if (!v2EvidencePath.evidence || !Array.isArray(v2EvidencePath.evidence)) {
        v2EvidencePath.evidence = [];
      }
      // 추가: 2~3개
      v2EvidencePath.evidence.push("H2 제목 부재: 섹션 구조 명확화 필요");
      v2EvidencePath.evidence.push("H3 제목 부재: 서브섹션 구조 개선 필요");
      v2EvidencePath.evidence.push("핵심 문장 부족: 중요 정보 부각 필요");
      // 제거: 1개 (첫 번째 항목이 있으면 제거)
      if (v2EvidencePath.evidence.length > 3) {
        v2EvidencePath.evidence.splice(0, 1);
      }
    }
    
    return [
      { id: "ab_v1", label: "개선안 v1", evidenceLike: v1Copy },
      { id: "ab_v2", label: "개선안 v2", evidenceLike: v2Copy }
    ];
  } catch (error) {
    if (globalThis.DEBUG) {
      console.warn('[Phase 7-3B] buildDummyImprovementDrafts 실패:', error);
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
  
  // ✅ [Phase 7-3B] AB Compare: currentEvidenceForRender 선언 (함수 스코프)
  let currentEvidenceForRender = null;
  
  if (evidenceRoot) {
    if (evidenceRoot.history && Array.isArray(evidenceRoot.history)) {
      // 새로운 root 구조
      history = evidenceRoot.history;
      
      // ✅ [Phase 7-3B] latest id fallback
      const latest = history[history.length - 1];
      const latestId = latest?.meta?.id || latest?.id || null;
      
      // ✅ [Phase 7-3B] currentId normalize (must exist in history)
      currentId = __selectedEvidenceId || evidenceRoot.currentId || latestId;
      
      // ✅ [Phase 7-3B] find currentEvidence by (meta.id || id)
      currentEvidence =
        history.find(e => (e?.meta?.id || e?.id) === currentId) ||
        latest;
      
      // ✅ [Phase 7-3B] if still empty, bind to currentEvidence id
      if (!currentId) {
        currentId = currentEvidence?.meta?.id || currentEvidence?.id || latestId;
      }
      
      // ✅ [Phase 7-3B] if currentId is not found in history, fallback to currentEvidence/latest
      const exists = history.some(e => (e?.meta?.id || e?.id) === currentId);
      if (!exists) {
        currentId = currentEvidence?.meta?.id || currentEvidence?.id || latestId;
      }
    } else {
      // 레거시 단일 객체
      currentEvidence = evidenceRoot;
      history = [evidenceRoot];
      currentId = evidenceRoot.meta?.id || Date.now().toString();
    }
  }
  
  // ✅ [Phase 7-3B] AB Compare: 선택된 draft로 currentEvidence 교체 (함수 스코프에서 실행)
  try {
    currentEvidenceForRender = currentEvidence; // 기본값: currentEvidence
    if (__abDrafts.length > 0 && currentEvidence) {
      // __abSelectedId가 없으면 첫 draft를 기본 선택
      if (!__abSelectedId && __abDrafts.length > 0) {
        __abSelectedId = __abDrafts[0].id;
      }
      const selectedDraft = __abDrafts.find(d => d.id === __abSelectedId);
      if (selectedDraft && selectedDraft.evidenceLike) {
        currentEvidenceForRender = selectedDraft.evidenceLike;
      }
    }
  } catch (error) {
    // 에러 발생 시 currentEvidence로 fallback
    currentEvidenceForRender = currentEvidence;
    if (globalThis.DEBUG) {
      console.warn('[Phase 7-3B] currentEvidenceForRender 설정 실패:', error);
    }
  }
  
  // currentEvidenceForRender가 null이면 currentEvidence로 fallback
  if (!currentEvidenceForRender) {
    currentEvidenceForRender = currentEvidence;
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
      // ✅ [Phase 7-3B] AB Compare: currentEvidenceForRender 사용
      const createdAt = currentEvidenceForRender.meta?.createdAt || currentEvidenceForRender.createdAt || currentEvidenceForRender.timestamp || currentEvidenceForRender.created_at || null;
      const createdAtText = createdAt ? new Date(createdAt).toLocaleString('ko-KR') : '';
      
      // ✅ [Phase 5-7] Evidence entry의 items 구조 처리
      // items가 { id, label, title, detail } 형태인지 확인
      const evidenceItems = currentEvidenceForRender.items || [];
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
      // ✅ [Phase 7-3B] AB Compare: currentEvidenceForRender 사용
      const currBullets = getEvidenceBullets(currentEvidenceForRender, scores);
      const prevBullets = prevEvidence ? getEvidenceBullets(prevEvidence, scores) : [];
      
      // ✅ [Phase 7-2a] diff 계산: trim() 후 문자열 완전 일치 기반
      const currBulletsTrimmed = currBullets.map(item => String(item).trim());
      const prevBulletsTrimmed = prevBullets.map(item => String(item).trim());
      let addedItems = (currBulletsTrimmed || []).filter(item => !prevBulletsTrimmed.includes(item)).slice(0, 7);
      let removedItems = (prevBulletsTrimmed || []).filter(item => !currBulletsTrimmed.includes(item)).slice(0, 7);
      
      // ✅ [Phase 7-2B] WHY 시뮬레이터: 가짜 diff 주입 (렌더링 단계에서만 오버라이드)
      let simulatedAddedItems = null;
      let simulatedRemovedItems = null;
      let simulatedScoreDeltas = null;
      
      if (__whySimulatorMode !== 'OFF' && __evidenceCompareEnabled && prevEvidence) {
        if (__whySimulatorMode === 'NONE') {
          simulatedAddedItems = [];
          simulatedRemovedItems = [];
          simulatedScoreDeltas = { branding: 0, contentStructureV2: 0, urlStructureV1: 0 };
        } else if (__whySimulatorMode === 'A') {
          simulatedAddedItems = [
            'H3 제목 추가',
            'UL 리스트 구조 개선',
            '핵심 문장 강조 추가'
          ];
          simulatedRemovedItems = [];
          simulatedScoreDeltas = { branding: 0, contentStructureV2: 8, urlStructureV1: 0 };
        } else if (__whySimulatorMode === 'B') {
          simulatedAddedItems = [];
          simulatedRemovedItems = [
            'H2 제목 제거',
            '리스트 구조 제거',
            '핵심 문장 제거'
          ];
          simulatedScoreDeltas = { branding: 0, contentStructureV2: -8, urlStructureV1: 0 };
        }
        
        // 시뮬레이터 모드일 때 diff 오버라이드
        if (simulatedAddedItems !== null) {
          addedItems = simulatedAddedItems;
        }
        if (simulatedRemovedItems !== null) {
          removedItems = simulatedRemovedItems;
        }
      }
      
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
      
      // ✅ [Phase 7-4] 히스토리 비교 토글 UI (3단 분기)
      let compareToggleHtml = '';
      let compareDiffHtml = '';
      // ✅ [Phase 7-4] compareEnabled: 함수 스코프에서 선언 (렌더링 조건에서 사용)
      let compareEnabled = false;
      
      // ✅ [Phase 7-4] 상태 3단 분기: history.length 기준
      const historyLength = history && Array.isArray(history) ? history.length : 0;
      
      // ✅ [Phase 7-6] 비교보기 안내 문구 (view-only)
      const compareHintText = historyLength < 2
        ? "비교보기는 기록이 2개 이상일 때 활성화됩니다. 아래 '근거 생성(테스트)'를 한 번 더 실행해 주세요."
        : "비교보기는 '선택 버전 vs 이전 버전' 구조 변화를 요약합니다. 최종 리포트 공유/출력은 Share 화면을 사용하세요.";
      const compareHintHtml = `<div style="margin-top: 6px; margin-bottom: 8px; font-size: 12px; color: var(--muted);">${esc(compareHintText)}</div>`;
      
      // ✅ [Phase 7-7] 최종 리포트(Share) 열기 버튼 (history >= 2일 때만 표시)
      const shareButtonHtml = historyLength >= 2 ? `
        <div style="margin-top: 6px; margin-bottom: 8px; display: flex; justify-content: flex-end;">
          <button onclick="(() => { const r = new URLSearchParams(location.search).get('r'); location.href = r ? 'share.html?r=' + encodeURIComponent(r) : 'share.html'; })()" class="btn btn-primary" style="font-size: 12px; padding: 6px 12px;">최종 리포트(Share) 열기</button>
        </div>
      ` : '';
      
      if (historyLength < 2) {
        // 상태 1: history.length < 2 → 체크박스 없음, Phase7-6 안내 1줄만 표시 (박스형 안내 제거)
        compareToggleHtml = '';
        // compareDiffHtml은 빈 문자열 유지 (Compare 결과 숨김)
        compareDiffHtml = '';
      } else {
        // 상태 2 또는 3: history.length >= 2
        compareEnabled = __evidenceCompareEnabled;
        
        if (!compareEnabled) {
          // 상태 2: history.length >= 2 AND compareEnabled = false → 체크박스 표시(OFF), Compare 결과 숨김
          compareToggleHtml = `
            <div style="margin-top: 12px; margin-bottom: 8px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); cursor: pointer;">
                <input type="checkbox" id="evidenceCompareToggle" style="cursor: pointer; pointer-events: auto;">
                <span>비교 보기 (이전 vs 선택)</span>
              </label>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: var(--muted);">현재 기록 ${historyLength}개 이상 → 비교 보기 가능</p>
            </div>
          `;
          // compareDiffHtml은 빈 문자열 유지 (Compare 결과 숨김)
          compareDiffHtml = '';
        } else {
          // 상태 3: history.length >= 2 AND compareEnabled = true → 체크박스 표시(ON), Compare 결과 표시
          compareToggleHtml = `
            <div style="margin-top: 12px; margin-bottom: 8px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); cursor: pointer;">
                <input type="checkbox" id="evidenceCompareToggle" checked style="cursor: pointer; pointer-events: auto;">
                <span>비교 보기 (이전 vs 선택)</span>
              </label>
            </div>
            ${prevEvidence ? `
              <div style="margin-top: 8px; margin-bottom: 8px; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: var(--radius);">
                <label style="display: block; margin-bottom: 4px; font-size: 11px; color: var(--text); font-weight: 600;">WHY 시뮬레이터(DEV)</label>
                <select id="whySimulatorSelect" style="width: 100%; padding: 4px; font-size: 11px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text);">
                  <option value="OFF" ${__whySimulatorMode === 'OFF' ? 'selected' : ''}>OFF</option>
                  <option value="A" ${__whySimulatorMode === 'A' ? 'selected' : ''}>A (개선 예시)</option>
                  <option value="B" ${__whySimulatorMode === 'B' ? 'selected' : ''}>B (하락 예시)</option>
                  <option value="NONE" ${__whySimulatorMode === 'NONE' ? 'selected' : ''}>NONE (변경없음)</option>
                </select>
              </div>
            ` : ''}
          `;
          
          // ✅ [Phase 7-4] Compare 결과 렌더링 (prevEvidence 있을 때만)
          if (!prevEvidence || !currentEvidence) {
            // 이전 Evidence 없을 때: 안내 카드만 표시
            compareDiffHtml = `
              <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
                <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: var(--text);">비교할 이전 기록이 없습니다</p>
                <p style="margin: 0; font-size: 12px; color: var(--muted);">비교하려면 최소 2개의 Evidence 기록이 필요합니다. 아래 [근거 생성(테스트)]를 한 번 더 실행해 기록을 추가하세요.</p>
              </div>
            `;
          } else {
            // ✅ [Phase 7-4] 이전 Evidence 있을 때: Compare UI 표시
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
            
            // ✅ [Phase 7-2B] Insight 섹션
            const x = addedItems.length;
            const y = removedItems.length;
            
            // 요약 1줄
            const summaryLine = `추가 ${x} · 제거 ${y}`;
            
            // 해석 문장
            let interpretationText = '';
            if (x === 0 && y === 0) {
              interpretationText = '구조 변화 없음. 다음은 문장/키워드 품질 개선 또는 H1/H2/리스트 구성 등 구조 자체 추가를 권장.';
            } else if (x > 0 && y === 0) {
              interpretationText = '구조 요소가 추가되어 개선 방향이 보임. 새로 추가된 항목이 KPI에 반영될 수 있음.';
            } else if (x === 0 && y > 0) {
              interpretationText = '구조 요소가 사라져 품질 하락 가능. 제거된 항목을 복구 권장.';
            } else {
              interpretationText = '구조 재구성이 발생. 추가/제거 항목을 확인해 의도한 방향인지 점검 필요.';
            }
            
            // Top Changes 미니 리스트
            const topAdded = addedItems.slice(0, 3);
            const topRemoved = removedItems.slice(0, 3);
            
            const topAddedHtml = topAdded.length > 0 ? `
              <div style="flex: 1; min-width: 200px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: var(--text);">Added 상위</p>
                <ul style="margin: 0; padding-left: 18px; font-size: 11px; color: var(--text);">
                  ${topAdded.map(item => `<li style="margin-bottom: 3px; line-height: 1.3;">${esc(item)}</li>`).join('')}
                </ul>
              </div>
            ` : `
              <div style="flex: 1; min-width: 200px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: var(--text);">Added 상위</p>
                <p style="margin: 0; font-size: 11px; color: var(--muted);">없음</p>
              </div>
            `;
            
            const topRemovedHtml = topRemoved.length > 0 ? `
              <div style="flex: 1; min-width: 200px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: var(--text);">Removed 상위</p>
                <ul style="margin: 0; padding-left: 18px; font-size: 11px; color: var(--text);">
                  ${topRemoved.map(item => `<li style="margin-bottom: 3px; line-height: 1.3;">${esc(item)}</li>`).join('')}
                </ul>
              </div>
            ` : `
              <div style="flex: 1; min-width: 200px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: var(--text);">Removed 상위</p>
                <p style="margin: 0; font-size: 11px; color: var(--muted);">없음</p>
              </div>
            `;
            
            const insightHtml = `
              <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: var(--text);">Insight</p>
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: var(--text);">${esc(summaryLine)}</p>
                <p style="margin: 0 0 12px 0; font-size: 12px; color: var(--text); line-height: 1.5;">${esc(interpretationText)}</p>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                  ${topAddedHtml}
                  ${topRemovedHtml}
                </div>
              </div>
            `;
            
            // ✅ [Phase 7-2B] WHY 패널: KPI 점수 변화 설명 (실제 evidence 비교 기반)
            let whyPanelHtml = '';
            try {
              // selectedScores와 prevScores 추출
              // ✅ [Phase 7-3B] AB Compare: currentEvidenceForRender 사용
              let selectedScores = currentEvidenceForRender?.v2Summary?.analysis?.scores || scores || {};
              let prevScores = prevEvidence?.v2Summary?.analysis?.scores || {};
              
              // ✅ [Phase 7-2B] 시뮬레이터 모드일 때 가짜 점수 주입
              if (simulatedScoreDeltas !== null) {
                // 가짜 점수 생성: prevScores를 기준으로 delta를 더해서 selectedScores 생성
                // prevScores가 없으면 기본값(score: 0) 사용
                const getBaseScore = (scoreObj) => {
                  if (scoreObj && scoreObj.score !== null && scoreObj.score !== undefined) {
                    return scoreObj.score;
                  }
                  return 0; // 기본값
                };
                
                // prevScores 복사본 생성 (원본 변경 방지)
                const prevScoresCopy = {
                  branding: prevScores.branding ? { ...prevScores.branding } : { score: 0 },
                  contentStructureV2: prevScores.contentStructureV2 ? { ...prevScores.contentStructureV2 } : { score: 0 },
                  urlStructureV1: prevScores.urlStructureV1 ? { ...prevScores.urlStructureV1 } : { score: 0 }
                };
                
                selectedScores = {
                  branding: {
                    ...prevScoresCopy.branding,
                    score: getBaseScore(prevScoresCopy.branding) + (simulatedScoreDeltas.branding || 0)
                  },
                  contentStructureV2: {
                    ...prevScoresCopy.contentStructureV2,
                    score: getBaseScore(prevScoresCopy.contentStructureV2) + (simulatedScoreDeltas.contentStructureV2 || 0)
                  },
                  urlStructureV1: {
                    ...prevScoresCopy.urlStructureV1,
                    score: getBaseScore(prevScoresCopy.urlStructureV1) + (simulatedScoreDeltas.urlStructureV1 || 0)
                  }
                };
                
                // prevScores를 복사본으로 교체 (WHY 패널에서 사용)
                prevScores = prevScoresCopy;
              }
              
              // 점수 추출 및 포맷팅 함수
              const getScoreValue = (scoreObj) => {
                if (!scoreObj || scoreObj.score === null || scoreObj.score === undefined) {
                  return null;
                }
                return scoreObj.score;
              };
              
              const formatScore = (score) => {
                return score !== null && score !== undefined ? String(score) : '측정 필요';
              };
              
              // delta 계산 함수
              const calculateDelta = (selected, prev) => {
                const selectedScore = getScoreValue(selected);
                const prevScore = getScoreValue(prev);
                
                if (selectedScore !== null && prevScore !== null) {
                  return selectedScore - prevScore;
                }
                return null;
              };
              
              // delta 표시 형식
              const formatDelta = (delta) => {
                if (delta === null) {
                  return null;
                } else if (delta > 0) {
                  return `+${delta}`;
                } else if (delta < 0) {
                  return `${delta}`;
                } else {
                  return 0;
                }
              };
              
              // 각 KPI의 점수 및 delta 계산
              const brandingPrev = getScoreValue(prevScores.branding);
              const brandingCurr = getScoreValue(selectedScores.branding);
              const brandingDelta = calculateDelta(selectedScores.branding, prevScores.branding);
              
              const contentStructurePrev = getScoreValue(prevScores.contentStructureV2);
              const contentStructureCurr = getScoreValue(selectedScores.contentStructureV2);
              const contentStructureDelta = calculateDelta(selectedScores.contentStructureV2, prevScores.contentStructureV2);
              
              const urlStructurePrev = getScoreValue(prevScores.urlStructureV1);
              const urlStructureCurr = getScoreValue(selectedScores.urlStructureV1);
              const urlStructureDelta = calculateDelta(selectedScores.urlStructureV1, prevScores.urlStructureV1);
              
              // KPI 행 HTML 생성 함수
              const renderKpiRow = (label, prev, curr, delta) => {
                const prevText = formatScore(prev);
                const currText = formatScore(curr);
                const deltaText = formatDelta(delta);
                const deltaDisplay = deltaText !== null ? (deltaText === 0 ? '0' : (deltaText > 0 ? `+${deltaText}` : deltaText)) : '측정 필요';
                
                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border);">
                    <span style="font-size: 12px; color: var(--text); font-weight: 500;">${esc(label)}</span>
                    <div style="display: flex; gap: 12px; align-items: center; font-size: 12px;">
                      <span style="color: var(--muted);">이전: ${esc(prevText)}</span>
                      <span style="color: var(--text);">현재: ${esc(currText)}</span>
                      <span style="color: ${deltaText !== null && deltaText !== 0 ? (deltaText > 0 ? '#2e7d32' : '#c62828') : 'var(--muted)'}; font-weight: 600;">변화(Δ): ${esc(deltaDisplay)}</span>
                    </div>
                  </div>
                `;
              };
              
              // 설명 문장 생성
              const safeAddedItems = addedItems || [];
              const safeRemovedItems = removedItems || [];
              
              let explanationText = '';
              const hasAnyChange = (brandingDelta !== null && brandingDelta !== 0) || 
                                   (contentStructureDelta !== null && contentStructureDelta !== 0) || 
                                   (urlStructureDelta !== null && urlStructureDelta !== 0);
              
              if (!hasAnyChange) {
                explanationText = '점수는 동일합니다. 변경이 점수 기준(임계치/가중치)에 영향이 없었을 수 있습니다.';
              } else {
                explanationText = '점수가 변했습니다. 아래 변경사항이 영향 가능성이 큽니다.';
              }
              
              whyPanelHtml = `
                <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
                  <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: var(--text);">WHY (점수 변화 설명)</p>
                  ${renderKpiRow('브랜딩', brandingPrev, brandingCurr, brandingDelta)}
                  ${renderKpiRow('콘텐츠 구조', contentStructurePrev, contentStructureCurr, contentStructureDelta)}
                  ${renderKpiRow('URL 구조', urlStructurePrev, urlStructureCurr, urlStructureDelta)}
                  <p style="margin: 12px 0 0 0; font-size: 12px; color: var(--text); line-height: 1.5;">${esc(explanationText)}</p>
                </div>
              `;
            } catch (error) {
              // 실패를 삼키고 WHY 패널만 표시하지 않음
              if (globalThis.DEBUG) {
                console.warn('[Phase 7-2B] WHY 패널 렌더링 실패:', error);
              }
              whyPanelHtml = '';
            }
            
            // ✅ [Phase 7-2a] "변경사항이 없습니다."는 diff 섹션 하단에만 표시 (렌더 막지 않음)
            const noChangesMessageHtml = (addedItems.length === 0 && removedItems.length === 0) ? `
              <div style="margin-top: 8px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
                <p style="margin: 0; font-size: 12px; color: var(--muted);">변경사항이 없습니다.</p>
              </div>
            ` : '';
            
            // ✅ [Phase 7-3C] AB Compare 컨트롤 HTML (비교보기 ON + prevEvidence 있을 때만 표시)
            let abCompareControlsHtml = '';
            if (history.length >= 2 && prevEvidence) {
              const abSelectOptions = __abDrafts.length > 0
                ? __abDrafts.map(d => `<option value="${esc(d.id)}" ${d.id === __abSelectedId ? 'selected' : ''}>${esc(d.label)}</option>`).join('')
                : '<option value="" disabled>개선안(더미)이 없습니다. [개선안(더미) 추가]를 눌러주세요.</option>';
              
              abCompareControlsHtml = `
                <div style="margin-top: 12px; margin-bottom: 8px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);">
                  <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <button id="ab-add-dummy" class="btn btn-dark" style="flex: 0 0 auto; font-size: 12px; padding: 6px 12px;">개선안(더미) 추가</button>
                    <select id="ab-select-dummy" style="flex: 1 1 auto; min-width: 150px; padding: 6px; font-size: 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text);" ${__abDrafts.length === 0 ? 'disabled' : ''}>
                      ${abSelectOptions}
                    </select>
                  </div>
                </div>
              `;
            }
            
            // ✅ [Phase 7-5.1] 복사 텍스트 생성 함수 (표현 개선)
            const generateCopyText = () => {
              try {
                // 버전 정보 추출
                const currentEntryDate = currentEvidenceForRender?.meta?.createdAt || currentEvidenceForRender?.createdAt || currentEvidenceForRender?.timestamp || currentEvidenceForRender?.created_at;
                const currentDateText = currentEntryDate ? new Date(currentEntryDate).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                const currentLabel = currentIndex === history.length - 1 ? '최신 결과' : `이전 결과 #${history.length - currentIndex - 1}`;
                
                const prevEntryDate = prevEvidence?.meta?.createdAt || prevEvidence?.createdAt || prevEvidence?.timestamp || prevEvidence?.created_at;
                const prevDateText = prevEntryDate ? new Date(prevEntryDate).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                const prevLabel = prevIndex === history.length - 1 ? '최신 결과' : `이전 결과 #${history.length - prevIndex - 1}`;
                
                // 시간 정보 조합 (보조 1줄)
                let timeLine = '';
                if (currentDateText || prevDateText) {
                  if (currentDateText && prevDateText) {
                    timeLine = `생성 시각: 최신=${currentDateText}, 이전=${prevDateText}`;
                  } else if (currentDateText) {
                    timeLine = `생성 시각: 최신=${currentDateText}`;
                  } else if (prevDateText) {
                    timeLine = `생성 시각: 이전=${prevDateText}`;
                  }
                }
                
                // Added/Removed 요약 (0/0일 때 의미 보강)
                let changeSummary = '';
                if (addedItems.length === 0 && removedItems.length === 0) {
                  changeSummary = '구조 변경: 없음 (Added 0 / Removed 0)';
                } else {
                  changeSummary = `Added: ${addedItems.length}개 / Removed: ${removedItems.length}개`;
                }
                
                // 핵심 인사이트 (비어있을 때 처리)
                const insightText = interpretationText && interpretationText.trim() ? interpretationText : '(없음)';
                
                // WHY 시뮬레이터 요약
                let whySummary = 'OFF';
                if (__whySimulatorMode !== 'OFF' && simulatedScoreDeltas !== null) {
                  const deltas = simulatedScoreDeltas;
                  const deltaTexts = [];
                  if (deltas.branding !== 0) deltaTexts.push(`브랜딩 ${deltas.branding > 0 ? '+' : ''}${deltas.branding}`);
                  if (deltas.contentStructureV2 !== 0) deltaTexts.push(`콘텐츠 구조 ${deltas.contentStructureV2 > 0 ? '+' : ''}${deltas.contentStructureV2}`);
                  if (deltas.urlStructureV1 !== 0) deltaTexts.push(`URL 구조 ${deltas.urlStructureV1 > 0 ? '+' : ''}${deltas.urlStructureV1}`);
                  if (deltaTexts.length > 0) {
                    whySummary = `${__whySimulatorMode}: ${deltaTexts.join(', ')}`;
                  } else {
                    whySummary = __whySimulatorMode === 'NONE' ? 'NONE (변경없음)' : __whySimulatorMode;
                  }
                }
                
                // 개선안(더미) 정보
                const abDraftLabel = __abSelectedId && __abDrafts.length > 0 
                  ? (__abDrafts.find(d => d.id === __abSelectedId)?.label || '없음')
                  : '없음';
                
                // 복사 텍스트 조합 (각 줄을 '\n'로 명확히 분리)
                const lines = [
                  '[Compare 요약]',
                  `비교 대상: ${currentLabel} vs ${prevLabel}`,
                  timeLine ? timeLine : null,
                  changeSummary,
                  `핵심 인사이트: ${insightText}`,
                  `WHY: ${whySummary}`,
                  `개선안(더미): ${abDraftLabel}`
                ].filter(line => line !== null);
                
                return lines.join('\n');
              } catch (error) {
                return '';
              }
            };
            
            // ✅ [Phase 7-5] 복사 버튼 HTML (Compare 결과가 보일 때만 표시)
            const copyButtonHtml = `
              <div style="margin-top: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <p style="margin: 0; font-size: 12px; font-weight: 600; color: var(--text);">비교 결과</p>
                <button id="compareCopyBtn" data-copy-text="${esc(generateCopyText())}" class="btn btn-primary" style="font-size: 12px; padding: 6px 12px;">비교 요약 복사</button>
              </div>
            `;
            
            compareDiffHtml = `
              <div style="margin-top: 12px;">
                ${abCompareControlsHtml}
                ${copyButtonHtml}
                <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
                  ${currBulletsHtml}
                  ${prevBulletsHtml}
                </div>
                ${diffSectionHtml}
                ${noChangesMessageHtml}
                ${insightHtml}
                ${whyPanelHtml}
              </div>
            `;
          }
        }
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
      
      // ✅ [Phase 7-3C] WHY 시뮬레이터 단일 바인딩 (compareEnabled일 때만)
      if (history.length >= 2 && __evidenceCompareEnabled && prevEvidence) {
        queueMicrotask(() => {
          const sel = document.getElementById('whySimulatorSelect');
          if (!sel) return;
          
          sel.value = __whySimulatorMode;
          
          if (sel.__boundWhySimulatorV1) return;
          sel.__boundWhySimulatorV1 = true;
          
          sel.addEventListener('change', (e) => {
            e.preventDefault();
            e.stopPropagation();
            __whySimulatorMode = sel.value || 'OFF';
            if (typeof window !== 'undefined' && typeof window.__rerenderEvidenceViewV1 === 'function') {
              window.__rerenderEvidenceViewV1();
            }
          });
        });
      }
      
      return `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text);">Evidence 있음</p>
        ${versionSelector}
        ${compareToggleHtml}
        ${compareHintHtml}
        ${shareButtonHtml}
        ${createdAtText ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: var(--muted);">생성 시간: ${esc(createdAtText)}</p>` : ''}
        ${itemsHtml ? `
          <div style="margin-top: 8px;">
            ${itemsHtml}
          </div>
        ` : ''}
        ${compareEnabled ? '' : analysisResultHtml}
        ${compareDiffHtml}
        <button data-evidence-generate="1" class="btn btn-primary" style="width: 100%; margin-top: 12px;">근거 생성(테스트)</button>
      `;
    }
  }
}
  