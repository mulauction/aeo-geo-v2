import { isLoggedIn } from "./gate.js";
import { loadEvidence, getCurrentEvidence } from "./evidenceStore.js";
import { buildEvidenceFromViewContext } from "./evidenceBuilder.js";
import { getState } from "./state.js";

let __evidenceOpenV1 = false;
let __selectedEvidenceId = null;

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
    }
  }
  
export function esc(v) {
    return String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
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
  
  if (!currentEvidence) {
    // Evidence 없음
    if (isAuthed) {
      return `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--muted);">Evidence 없음</p>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: var(--muted);">Evidence가 저장되지 않았습니다.</p>
        <button data-evidence-generate="1" class="btn btn-primary" style="width: 100%; margin-top: 8px;">근거 생성(테스트)</button>
      `;
    } else {
      return `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--muted);">Evidence 없음</p>
        <div style="margin-top: 12px; padding: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--muted);">Evidence를 보려면 로그인이 필요합니다.</p>
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
      
      return `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--text);">Evidence 있음</p>
        ${versionSelector}
        ${createdAtText ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: var(--muted);">생성 시간: ${esc(createdAtText)}</p>` : ''}
        ${itemsHtml ? `
          <div style="margin-top: 8px;">
            ${itemsHtml}
          </div>
        ` : ''}
        <button data-evidence-generate="1" class="btn btn-primary" style="width: 100%; margin-top: 12px;">근거 생성(테스트)</button>
      `;
    }
  }
}
  