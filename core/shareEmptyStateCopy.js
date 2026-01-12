// core/shareEmptyStateCopy.js
// SSOT: Share empty-state copy (KR)
//
// Hard rule: This module is copy-only. No DOM access, no storage, no fetch.

export function getShareEmptyStateCopyKR(state, ctx = {}) {
  const HOME_LABEL = '홈으로 이동';

  const map = {
    NO_REPORT: {
      title: '리포트 데이터를 찾을 수 없습니다',
      message: '현재 브라우저에서 리포트 데이터를 찾을 수 없습니다.',
      actions: { primaryLabel: HOME_LABEL, secondaryLabel: '' },
    },
    EXPIRED: {
      title: '이 링크로는 리포트를 열 수 없습니다',
      message: '이 링크에 연결된 리포트 데이터가 현재 브라우저에 없습니다.',
      actions: { primaryLabel: '다시 분석하러 가기', secondaryLabel: '이 브라우저에 저장된 최신 리포트 열기' },
    },
    OTHER_DEVICE: {
      title: '다른 기기에서 생성된 최신 리포트가 있습니다',
      message: '현재 브라우저에서 생성된 최신 리포트를 보거나 홈으로 이동할 수 있습니다.',
      actions: { primaryLabel: '최신 리포트 보기', secondaryLabel: '홈으로' },
    },
    INVALID_ID: {
      title: '이 링크로는 리포트를 열 수 없습니다',
      message: '이 링크에 연결된 리포트 데이터가 현재 브라우저에 없습니다.',
      actions: { primaryLabel: HOME_LABEL, secondaryLabel: '' },
    },
    FETCH_FAIL: {
      // current UX treats FETCH_FAIL like NO_REPORT (safe fallback)
      title: '리포트 데이터를 찾을 수 없습니다',
      message: '현재 브라우저에서 리포트 데이터를 찾을 수 없습니다.',
      actions: { primaryLabel: HOME_LABEL, secondaryLabel: '' },
    },
  };

  const s = map && map[state];
  if (s) return s;
  return { title: '', message: '', actions: { primaryLabel: '', secondaryLabel: '' } };
}


