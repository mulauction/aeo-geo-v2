// core/shareEmptyStateCopy.js
// SSOT: Share empty-state copy (KR)
//
// Hard rule: This module is copy-only. No DOM access, no storage, no fetch.

export function getShareEmptyStateCopyKR(state, ctx = {}) {
  const HOME_LABEL = '홈으로 이동';
  const WHY_LABEL = '왜 리포트를 못 여나요? →';

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

export function getShareStatusCopyKR(kind) {
  const map = {
    LOADING: '리포트를 불러오는 중…',
    NOT_FOUND: '리포트 데이터를 찾을 수 없습니다.',
    LOAD_FAIL: '리포트를 불러오지 못했습니다.',
    SERVER_SAVING: '서버에 저장 중…',
    SERVER_SAVE_FAIL: '서버 저장 실패',
    CLEAR: '',
  };
  return Object.prototype.hasOwnProperty.call(map, kind) ? map[kind] : '';
}

export function getShareWarningBoxCopyKR(kind) {
  const map = {
    NO_REPORT: {
      title: '리포트 데이터를 찾을 수 없습니다',
      messageHtml:
        '현재 브라우저에 리포트 데이터가 없거나, 다른 브라우저/시크릿 모드에서 접근하셨습니다.<br>새로운 리포트를 생성하려면 홈 화면으로 이동해주세요.',
    },
  };
  return map[kind] || { title: '', messageHtml: '' };
}

export function getShareHelperCopyKR(kind) {
  const map = {
    WHY_LABEL: '왜 리포트를 못 여나요? →',
    OTHER_DEVICE_TOAST: '이 기기/브라우저에서는 리포트를 열 수 없어요. 홈에서 다시 분석해 주세요.',
    SHARE_POLICY_NO_ACCESS: '다른 기기·다른 브라우저·시크릿 모드에서는 리포트 데이터에 접근할 수 없습니다.',
  };
  return Object.prototype.hasOwnProperty.call(map, kind) ? map[kind] : '';
}


