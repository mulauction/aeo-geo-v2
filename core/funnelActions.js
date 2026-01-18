// core/funnelActions.js
// Pure rules for dev-only funnel debug recommendations.
// - No side effects
// - Never throws

const CASE_KEYS = ['CASE_OK', 'CASE_A', 'CASE_B', 'CASE_C', 'CASE_D'];

const FUNNEL_RULES = {
  CASE_A: {
    ids: ['A1', 'A2', 'A3'],
    actions: [
      'Analyze 실행 버튼(CTA) 시각적 강조(상단 고정/대비 강화)',
      '입력 예시/샘플 버튼 제공으로 첫 실행 마찰 제거',
      '첫 실행 유도 문구를 1줄로 단순화(‘한 번만 실행해보세요’)',
    ],
    reason: 'Analyze 진입 대비 실행 비율이 낮습니다.',
    how_to_verify: '다음 배포 후 counts_by_case에서 CASE_A 비중 감소 확인',
    expected_impact: 'Analyze 진입→실행 전환 개선',
  },
  CASE_B: {
    ids: ['B1', 'B2', 'B3'],
    actions: [
      'Analyze 완료 직후 Generate로 가는 1차 CTA를 더 크게/즉시 노출',
      'Analyze 결과 영역 하단에 ‘다음: Generate’ 단계 표시(1→2→3)',
      'Generate 이동을 1클릭으로(스크롤 없이) 만들기',
    ],
    reason: '분석 실행 후 생성 단계 전환이 끊깁니다.',
    how_to_verify: '다음 배포 후 counts_by_case에서 CASE_B 비중 감소 확인',
    expected_impact: 'Analyze 실행→Generate 이동 전환 개선',
  },
  CASE_C: {
    ids: ['C1', 'C2', 'C3'],
    actions: [
      'Generate 실행 버튼을 첫 화면 안에 배치(스크롤 제로)',
      '기본값 프리필 + ‘바로 생성’ 원클릭 제공',
      '실행 전 기대 결과(예: 샘플 출력 3줄) 미리보기',
    ],
    reason: '생성 화면 진입 대비 실행이 낮습니다.',
    how_to_verify: '다음 배포 후 counts_by_case에서 CASE_C 비중 감소 확인',
    expected_impact: 'Generate 진입→실행 전환 개선',
  },
  CASE_D: {
    ids: ['D1', 'D2', 'D3'],
    actions: [
      'Generate 완료 후 ‘리포트 보기’ 자동 포커스/최상단 고정',
      '완료 토스트에 ‘Share로 이동’ 버튼 포함',
      'Share 복귀 링크를 새 탭이 아닌 같은 탭 기본으로',
    ],
    reason: '생성 완료 이후 리포트 확인 단계에서 이탈합니다.',
    how_to_verify: '다음 배포 후 counts_by_case에서 CASE_D 비중 감소 확인',
    expected_impact: 'Generate 완료→Share 복귀(리포트 확인) 전환 개선',
  },
  CASE_OK: {
    ids: ['OK1'],
    actions: ['현재 퍼널 유지(병목 없음).'],
    reason: '완주 비율이 우세합니다.',
    how_to_verify: '_debugTelemetryFunnel()에서 CASE_OK 비중 유지 확인',
    expected_impact: '완주 유지',
  },
};

function _safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function _getCountsByCase(input) {
  return (input?.counts_by_case && typeof input.counts_by_case === 'object')
    ? input.counts_by_case
    : null;
}

function _sumCounts(counts_by_case) {
  if (!counts_by_case) return 0;
  let s = 0;
  for (const k of CASE_KEYS) s += _safeNumber(counts_by_case[k]);
  return s;
}

function _getTotalSessions(input, counts_by_case) {
  const totalsSessionsRaw = input?.totals && typeof input.totals === 'object' ? input.totals.sessions : undefined;
  const n = _safeNumber(totalsSessionsRaw);
  if (n > 0) return n;
  const sumCounts = _sumCounts(counts_by_case);
  if (sumCounts > 0) return sumCounts;
  return 0;
}

function _getDominantCount(dominant_drop_case, counts_by_case) {
  if (!counts_by_case) return 0;
  return _safeNumber(counts_by_case[dominant_drop_case]);
}

function _getTakeN(dominant_drop_case, dominantCount, totalSessions) {
  if (dominant_drop_case === 'CASE_OK') return 1;
  if (totalSessions > 0 && (dominantCount / totalSessions) >= 0.5) return 3;
  return 2;
}

export function buildFunnelRecommendedActions(input = {}) {
  try {
    const dominant_drop_case = String(input?.dominant_drop_case || '');
    const counts_by_case = _getCountsByCase(input);
    const totalSessions = _getTotalSessions(input, counts_by_case);
    const dominantCount = _getDominantCount(dominant_drop_case, counts_by_case);
    const takeN = Math.max(1, Math.min(3, _getTakeN(dominant_drop_case, dominantCount, totalSessions)));

    const fallback = {
      recommended_actions: [
        FUNNEL_RULES.CASE_A.actions[0],
        FUNNEL_RULES.CASE_A.actions[1],
      ],
      recommendation_reason: FUNNEL_RULES.CASE_A.reason,
    };

    const rule = FUNNEL_RULES[dominant_drop_case];
    if (!rule) return fallback;

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

export function buildFunnelActionChecklist(input = {}) {
  try {
    const dominant_drop_case = String(input?.dominant_drop_case || '');
    const counts_by_case = _getCountsByCase(input);
    const totalSessions = _getTotalSessions(input, counts_by_case);
    const dominantCount = _getDominantCount(dominant_drop_case, counts_by_case);

    const fallbackRule = FUNNEL_RULES.CASE_A;
    const fallback = {
      action_checklist: [
        {
          id: 'A1',
          action: fallbackRule.actions[0],
          how_to_verify: fallbackRule.how_to_verify,
          expected_impact: fallbackRule.expected_impact,
        },
        {
          id: 'A2',
          action: fallbackRule.actions[1],
          how_to_verify: fallbackRule.how_to_verify,
          expected_impact: fallbackRule.expected_impact,
        },
      ],
      checklist_note: '우선순위: 상단부터. 다음 배포 후 counts_by_case의 병목 케이스 비중이 줄면 개선입니다.',
    };

    const rule = FUNNEL_RULES[dominant_drop_case];
    if (!rule) return fallback;

    const takeN = dominant_drop_case === 'CASE_OK'
      ? 1
      : Math.max(1, Math.min(3, _getTakeN(dominant_drop_case, dominantCount, totalSessions)));

    const items = [];
    const ids = Array.isArray(rule.ids) ? rule.ids : [];
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    for (let i = 0; i < Math.min(takeN, ids.length, actions.length); i++) {
      items.push({
        id: String(ids[i]),
        action: String(actions[i]),
        how_to_verify: String(rule.how_to_verify || ''),
        expected_impact: String(rule.expected_impact || ''),
      });
    }

    const action_checklist = items.length > 0 ? items : fallback.action_checklist;
    const checklist_note = dominant_drop_case === 'CASE_OK'
      ? '우선순위: 유지. 다음 배포 후 CASE_OK 비중이 유지되면 정상입니다.'
      : '우선순위: 상단부터. 다음 배포 후 counts_by_case에서 해당 케이스 비중 감소를 확인하세요.';

    return { action_checklist, checklist_note };
  } catch (_) {
    return {
      action_checklist: [
        {
          id: 'A1',
          action: 'Analyze 실행 버튼(CTA) 시각적 강조(상단 고정/대비 강화)',
          how_to_verify: '다음 배포 후 counts_by_case에서 CASE_A 비중 감소 확인',
          expected_impact: 'Analyze 진입→실행 전환 개선',
        },
        {
          id: 'A2',
          action: '입력 예시/샘플 버튼 제공으로 첫 실행 마찰 제거',
          how_to_verify: '다음 배포 후 counts_by_case에서 CASE_A 비중 감소 확인',
          expected_impact: 'Analyze 진입→실행 전환 개선',
        },
      ],
      checklist_note: '우선순위: 상단부터. 다음 배포 후 counts_by_case의 병목 케이스 비중이 줄면 개선입니다.',
    };
  }
}


