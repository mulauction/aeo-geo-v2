// core/funnelActions.js
// Pure rules for dev-only funnel debug recommendations.
// - No side effects
// - Never throws

export function buildFunnelRecommendedActions(input = {}) {
  try {
    const dominant_drop_case = String(input?.dominant_drop_case || '');
    const counts_by_case = (input?.counts_by_case && typeof input.counts_by_case === 'object')
      ? input.counts_by_case
      : null;
    const totalsSessionsRaw = input?.totals && typeof input.totals === 'object' ? input.totals.sessions : undefined;

    const safeNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const caseKeys = ['CASE_OK', 'CASE_A', 'CASE_B', 'CASE_C', 'CASE_D'];
    const sumCounts = (() => {
      if (!counts_by_case) return 0;
      let s = 0;
      for (const k of caseKeys) s += safeNumber(counts_by_case[k]);
      return s;
    })();

    const totalSessions = (() => {
      const n = safeNumber(totalsSessionsRaw);
      if (n > 0) return n;
      if (sumCounts > 0) return sumCounts;
      return 0;
    })();

    const dominantCount = (() => {
      if (!counts_by_case) return 0;
      return safeNumber(counts_by_case[dominant_drop_case]);
    })();

    const intensityLimit = (() => {
      // CASE_OK: always 1
      if (dominant_drop_case === 'CASE_OK') return 1;
      // Simple “strength” tuning: if dominant share is high, show 3; else 2.
      if (totalSessions > 0 && (dominantCount / totalSessions) >= 0.5) return 3;
      return 2;
    })();

    const RULES = {
      CASE_A: {
        actions: [
          'Analyze 실행 버튼(CTA) 시각적 강조(상단 고정/대비 강화)',
          '입력 예시/샘플 버튼 제공으로 첫 실행 마찰 제거',
          '첫 실행 유도 문구를 1줄로 단순화(‘한 번만 실행해보세요’)',
        ],
        reason: 'Analyze 진입 대비 실행 비율이 낮습니다.',
      },
      CASE_B: {
        actions: [
          'Analyze 완료 직후 Generate로 가는 1차 CTA를 더 크게/즉시 노출',
          'Analyze 결과 영역 하단에 ‘다음: Generate’ 단계 표시(1→2→3)',
          'Generate 이동을 1클릭으로(스크롤 없이) 만들기',
        ],
        reason: '분석 실행 후 생성 단계 전환이 끊깁니다.',
      },
      CASE_C: {
        actions: [
          'Generate 실행 버튼을 첫 화면 안에 배치(스크롤 제로)',
          '기본값 프리필 + ‘바로 생성’ 원클릭 제공',
          '실행 전 기대 결과(예: 샘플 출력 3줄) 미리보기',
        ],
        reason: '생성 화면 진입 대비 실행이 낮습니다.',
      },
      CASE_D: {
        actions: [
          'Generate 완료 후 ‘리포트 보기’ 자동 포커스/최상단 고정',
          '완료 토스트에 ‘Share로 이동’ 버튼 포함',
          'Share 복귀 링크를 새 탭이 아닌 같은 탭 기본으로',
        ],
        reason: '생성 완료 이후 리포트 확인 단계에서 이탈합니다.',
      },
      CASE_OK: {
        actions: ['현재 퍼널 유지, 병목 없음'],
        reason: '완주 비율이 우세합니다.',
      },
    };

    const fallback = {
      recommended_actions: [
        RULES.CASE_A.actions[0],
        RULES.CASE_A.actions[1],
      ],
      recommendation_reason: RULES.CASE_A.reason,
    };

    const rule = RULES[dominant_drop_case];
    if (!rule) return fallback;

    const takeN = dominant_drop_case === 'CASE_OK'
      ? 1
      : Math.max(1, Math.min(3, intensityLimit));

    const recommended_actions = (Array.isArray(rule.actions) ? rule.actions : []).slice(0, takeN);
    const recommendation_reason = String(rule.reason || '').trim() || fallback.recommendation_reason;

    if (!Array.isArray(recommended_actions) || recommended_actions.length === 0) return fallback;

    return { recommended_actions, recommendation_reason };
  } catch (_) {
    return {
      recommended_actions: [
        'Analyze 실행 버튼(CTA) 시각적 강조(상단 고정/대비 강화)',
        '입력 예시/샘플 버튼 제공으로 첫 실행 마찰 제거',
      ],
      recommendation_reason: 'Analyze 진입 대비 실행 비율이 낮습니다.',
    };
  }
}


