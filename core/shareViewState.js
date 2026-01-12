// core/shareViewState.js
//
// ShareViewState derivation (pure helper).
// Hard rules:
// - No DOM access
// - No localStorage access
// - No fetch
// - Deterministic based only on input
//
// NOTE: This module is intentionally small and side-effect free.

import { getShareViewState } from './reliability.js';

/**
 * @param {object} input
 * @returns {{ state: string|null, reason?: string|null, reportIdToUse?: string|null }}
 */
export function deriveShareViewState(input = {}) {
  const {
    forcedState = null,
    rParam = null,
    idParam = null,
    hasId = false,

    // invalid id detection (precomputed in caller; keep this module pure)
    invalidFromHead = null,
    isValidIdParam = true,
    isValidRParam = true,
    isInlineJsonCandidate = false,
    testStates = ['EXPIRED', 'OTHER_DEVICE', 'NO_REPORT'],

    // localStorage presence flags (precomputed in caller)
    hasLastV2 = false,
    hasCurrentReportId = false,

    // post-load signals (optional)
    requestedLoaded = false,
  } = input;

  // Phase: forced/test/no-report/invalid (pre-load)
  let state = null;
  let reason = null;

  // invalid id/r param (skip fetch)
  if (!forcedState || forcedState === 'OK') {
    let invalid = null;
    if (invalidFromHead && invalidFromHead.source === 'id') {
      invalid = invalidFromHead;
    } else if (idParam && !isValidIdParam) {
      invalid = { source: 'id', value: String(idParam) };
    } else if (rParam && !testStates.includes(rParam) && !isInlineJsonCandidate && !isValidRParam) {
      invalid = { source: 'r', value: String(rParam) };
    }
    if (invalid) {
      state = 'EXPIRED'; // preserve existing UX path (invalid id treated as expired)
      reason = 'INVALID_ID';
      return { state, reason, reportIdToUse: null };
    }
  }

  if (forcedState && forcedState !== 'OK') {
    state = forcedState === 'FETCH_FAIL' ? 'NO_REPORT' : forcedState;
    reason = 'FORCED';
    return { state, reason, reportIdToUse: null };
  }

  if (rParam && testStates.includes(rParam)) {
    state = rParam;
    reason = 'TEST_STATE';
    return { state, reason, reportIdToUse: null };
  }

  if (!rParam && !hasLastV2 && !hasCurrentReportId) {
    state = 'NO_REPORT';
    reason = 'NO_REPORT';
    return { state, reason, reportIdToUse: null };
  }

  // Phase: fallback to existing SSOT (post-load signal)
  // Keep behavior: if requestedLoaded is true -> OK, else EXPIRED/OTHER_DEVICE depends on hasLastV2/hasParamR.
  const hasParamR = Boolean(rParam);
  state = getShareViewState({ hasParamR, requestedLoaded, hasLastV2 });
  reason = 'DERIVED';
  return { state, reason, reportIdToUse: null };
}


