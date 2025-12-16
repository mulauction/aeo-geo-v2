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
      
      // ✅ [Phase 4-1B UX 버그 수정] 개선안 HTML skeleton 존재 여부 확인
      const hasImprovements = root.result.querySelector('#improvementHtmlSkeleton') && 
                              root.result.querySelector('#improvementHtmlSkeleton').textContent.trim().length > 0;
      
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
          <button id="btnGenerateImprovements" class="btn btn-dark" style="width: 100%; margin-top: 8px;">개선안 생성</button>
        </div>
      `;
      
      // ✅ [Phase 4-1B UX 버그 수정] 복사/다운로드 버튼 항상 렌더 (disabled 상태)
      // ✅ [Phase 4-2A] AI 고도화 버튼 상태 확인
      const aiImproveBtn = root.result.querySelector('#btnAiImprove');
      const isAiLoading = aiImproveBtn && aiImproveBtn.disabled && aiImproveBtn.textContent.includes('생성중');
      
      const improvementsActionButtons = `
        <div style="margin-top: 12px; margin-bottom: 12px;">
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <button id="btnCopyImprovementHtml" class="btn btn-secondary btn-stable" ${hasImprovements ? '' : 'disabled'} style="flex: 1;">HTML 복사</button>
            <button id="btnDownloadImprovement" class="btn btn-secondary btn-stable" ${hasImprovements ? '' : 'disabled'} style="flex: 1;">개선안 다운로드</button>
          </div>
          ${hasImprovements ? `
            <button id="btnAiImprove" class="btn btn-primary btn-stable" ${isAiLoading ? 'disabled' : ''} style="width: 100%;">${isAiLoading ? 'AI 생성중...' : 'AI로 개선안 고도화'}</button>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: var(--muted); text-align: center;">서버 모드에서 사용 가능</p>
          ` : ''}
          ${!hasImprovements ? '<p style="margin: 8px 0 0 0; font-size: 12px; color: var(--muted);">먼저 개선안 생성을 눌러주세요.</p>' : ''}
        </div>
      `;
  
      // CTA 변경 포인트: 부분점수 안내 + URL 구조 점수 측정 버튼 추가
      root.result.innerHTML = `
        ${kpiSection}
        ${improvementsActionButtons}
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
      `;
      
      // URL 구조 점수 CTA 클릭 차단 우회용 로컬 핸들러
      const urlCta = root.result.querySelector('[data-cta="url-structure"]');
      if (urlCta && !urlCta.__localClickBound) {
        urlCta.__localClickBound = true;
        urlCta.addEventListener('click', () => {
          // intentionally empty
          // presence of local click handler is required to bypass analyze-level interception
        });
      }
      
      // ✅ [Phase 4-1B UX 버그 수정] 버튼 상태 동기화
      const copyBtn = root.result.querySelector('#btnCopyImprovementHtml');
      const downloadBtn = root.result.querySelector('#btnDownloadImprovement');
      const aiBtn = root.result.querySelector('#btnAiImprove');
      const skeletonEl = root.result.querySelector('#improvementHtmlSkeleton');
      const hasSkeleton = skeletonEl && skeletonEl.textContent.trim().length > 0;
      
      if (copyBtn) {
        copyBtn.disabled = !hasSkeleton;
      }
      if (downloadBtn) {
        downloadBtn.disabled = !hasSkeleton;
      }
      
      // ✅ [Phase 4-2A] AI 버튼 상태 동기화 (로딩 중이 아닐 때만)
      if (aiBtn && hasSkeleton && !aiBtn.__aiImproveLocked) {
        aiBtn.disabled = false;
        if (aiBtn.textContent === 'AI 생성중...') {
          aiBtn.textContent = 'AI로 개선안 고도화';
        }
      }
      
      // 안내 문구 표시/숨김
      const actionButtonsContainer = copyBtn?.parentElement?.parentElement;
      if (actionButtonsContainer) {
        let hintText = actionButtonsContainer.querySelector('p');
        if (!hasSkeleton && !hintText) {
          hintText = document.createElement('p');
          hintText.style.cssText = 'margin: 8px 0 0 0; font-size: 12px; color: var(--muted);';
          hintText.textContent = '먼저 개선안 생성을 눌러주세요.';
          actionButtonsContainer.appendChild(hintText);
        } else if (hasSkeleton && hintText) {
          hintText.remove();
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
  