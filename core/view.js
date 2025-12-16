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
      
      const kpiSection = `
        <div style="margin-bottom: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
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
      `;
      
      // ✅ 리포트 공유 보기 버튼
      const shareReportButton = `
        <div style="margin-bottom: 16px;">
          <button id="btnShareReport" class="btn btn-primary" style="width: 100%;">리포트 공유 보기</button>
        </div>
      `;
  
      // CTA 변경 포인트: 부분점수 안내 + URL 구조 점수 측정 버튼 추가
      root.result.innerHTML = `
        ${kpiSection}
        ${shareReportButton}
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
    }
  }
  
export function esc(v) {
    return String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
  