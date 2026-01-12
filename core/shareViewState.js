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

function normalizeForcedState(forceParam) {
  if (!forceParam || typeof forceParam !== 'string') return null;
  const normalizedForce = forceParam.toUpperCase().replace(/_/g, '');
  const validStates = ['OK', 'EXPIRED', 'OTHERDEVICE', 'FETCHFAIL'];
  const stateMap = {
    OK: 'OK',
    EXPIRED: 'EXPIRED',
    OTHERDEVICE: 'OTHER_DEVICE',
    FETCHFAIL: 'FETCH_FAIL',
  };
  if (!validStates.includes(normalizedForce)) return null;
  return stateMap[normalizedForce] || null;
}

/**
 * deriveShareViewState(input) returns a 2-phase derivation:
 * - pre: decide whether we should load reportModel
 * - finalize(loadResult): compute final state after load
 *
 * Hard rules:
 * - Pure: no DOM, no storage, no fetch
 * - Deterministic: based only on input + loadResult
 */
export function deriveShareViewState(input = {}) {
  const {
    rParam = null,
    idParam = null,
    hasId = false,
    forceParam = null,
    vsOverride = null,

    invalidFromHead = null,
    isValidIdParam = true,
    isValidRParam = true,
    isInlineJsonCandidate = false,

    hasLastV2 = false,
    hasCurrentReportId = false,
  } = input;

  const forcedState = normalizeForcedState(forceParam);
  const testStates = ['EXPIRED', 'OTHER_DEVICE', 'NO_REPORT'];

  // --- pre phase ---
  let preState = null;
  let preReason = null;
  let needsLoad = true;
  let reportIdToLoad = null;

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
      preState = 'EXPIRED'; // preserve legacy UX path
      preReason = 'INVALID_ID';
      needsLoad = false;
    }
  }

  if (needsLoad && forcedState && forcedState !== 'OK') {
    // FETCH_FAIL treated like NO_REPORT in legacy behavior
    preState = forcedState === 'FETCH_FAIL' ? 'NO_REPORT' : forcedState;
    preReason = 'FORCED';
    needsLoad = false;
  }

  if (needsLoad && rParam && testStates.includes(rParam)) {
    preState = rParam;
    preReason = 'TEST_STATE';
    needsLoad = false;
  }

  if (needsLoad && !rParam && !hasLastV2 && !hasCurrentReportId) {
    preState = 'NO_REPORT';
    preReason = 'NO_REPORT';
    needsLoad = false;
  }

  if (needsLoad) {
    // Allow load; keep preState null (matches legacy behavior where __shareViewState is unset)
    reportIdToLoad = rParam || null;
  }

  const pre = { state: preState, needsLoad, reportIdToLoad, reason: preReason };

  // --- finalize phase (after load) ---
  function finalize(loadResult = {}) {
    try {
      if (!needsLoad) {
        return { state: preState, reason: preReason, reportModel: null };
      }

      // If finalize is called without a real load result, do not throw—pick a safe fallback.
      const lr = (loadResult && typeof loadResult === 'object') ? loadResult : null;
      if (!lr) {
        return { state: 'FETCH_FAIL', reason: 'FINALIZE_NO_LOAD_RESULT', reportModel: null };
      }

      const reportModel = Object.prototype.hasOwnProperty.call(lr, 'reportModel') ? (lr.reportModel || null) : null;
      const hasParamR = Boolean(rParam);
      const hasLastV2ForCalc = typeof lr.hasLastV2 === 'boolean' ? lr.hasLastV2 : false;
      const isROnly = Boolean(rParam) && !hasId;

      const requestedLoaded = (typeof lr.requestedLoaded === 'boolean')
        ? lr.requestedLoaded
        : (
            reportModel != null &&
            typeof reportModel === 'object' &&
            Object.keys(reportModel).length > 0 &&
            reportModel.analysis &&
            reportModel.analysis.scores &&
            Object.keys(reportModel.analysis.scores).length > 0
          );

      let state = null;
      let reason = 'DERIVED';

      // If we have a model, keep OK alive deterministically (caller decided to load; model present means OK).
      if (reportModel != null) {
        state = 'OK';
        reason = 'MODEL_PRESENT';
      }

      // If we cannot determine anything (e.g. no model and no lastV2 hint), settle to a safe state.
      // Prefer legacy r-only behavior first.
      if (!state && isROnly && !reportModel) {
        state = 'EXPIRED';
        reason = 'R_ONLY_NO_MODEL';
      } else if (!state && reportModel == null && !hasLastV2ForCalc && !requestedLoaded) {
        state = 'FETCH_FAIL';
        reason = 'FINALIZE_INSUFFICIENT_INPUT';
      } else if (!state) {
        state = getShareViewState({ hasParamR, requestedLoaded, hasLastV2: hasLastV2ForCalc });
      }

      // Dev-only override via vs param (legacy)
      const allowedStates = ['OK', 'EXPIRED', 'OTHER_DEVICE', 'NO_REPORT', 'FETCH_FAIL'];
      if (vsOverride && allowedStates.includes(vsOverride)) {
        state = vsOverride;
        reason = 'OVERRIDE';
      }

      // force=OK final override (legacy)
      if (forcedState === 'OK' && state !== 'OK') {
        state = 'OK';
        reason = 'FORCED_OK';
      }

      // Final guard: never return null/undefined state
      if (!state) {
        return { state: 'FETCH_FAIL', reason: 'FINALIZE_EMPTY_STATE', reportModel };
      }

      return { state, reason, reportModel };
    } catch (_) {
      // Absolute last-resort safety: finalize must never throw.
      return { state: 'FETCH_FAIL', reason: 'FINALIZE_THROWN', reportModel: null };
    }
  }

  return { pre, finalize };
}


