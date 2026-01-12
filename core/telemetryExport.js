// core/telemetryExport.js
// Telemetry export schema builder (V1).
// Hard rules:
// - Never throw
// - Do not mutate events

function safeStr(v) {
  try {
    if (v === null || typeof v === 'undefined') return '';
    return String(v);
  } catch (_) {
    return '';
  }
}

function safeObj(v) {
  return v && typeof v === 'object' ? v : null;
}

function safeNum(v) {
  try {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (_) {
    return null;
  }
}

function pickFirst(obj, keys) {
  try {
    if (!obj || typeof obj !== 'object') return '';
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const v = safeStr(obj[k]);
        if (v) return v;
      }
    }
    return '';
  } catch (_) {
    return '';
  }
}

function buildKpisV1(events, ctx) {
  try {
    const arr = Array.isArray(events) ? events : [];
    const sid = safeStr(ctx && ctx.sid);

    // Filtering rule (pick 1): B) current sid only
    const filtered = sid ? arr.filter((e) => safeStr(e && e.sid) === sid) : [];

    // Only use share_final_state for rates (stable denominator)
    const finals = filtered.filter((e) => safeStr(e && e.event) === 'share_final_state');
    const denom = finals.length;

    const rate = (num) => {
      if (!denom) return { value: null, measurable: false, numerator: 0, denominator: 0 };
      return { value: num / denom, measurable: true, numerator: num, denominator: denom };
    };

    // invalid_id_rate: final_state reason === INVALID_ID (avoid conflating with generic EXPIRED)
    const invalidCount = finals.filter((e) => safeStr(e && e.reason) === 'INVALID_ID').length;
    const expiredCount = finals.filter((e) => pickFirst(e, ['finalState', 'final_state', 'state']) === 'EXPIRED').length;

    return {
      filter: { type: 'sid', sid: sid || '' },
      invalid_id_rate: rate(invalidCount),
      expired_entry_rate: rate(expiredCount),
      snapshot_fetch_success_rate: { value: null, measurable: false },
    };
  } catch (_) {
    return {
      filter: { type: 'sid', sid: '' },
      invalid_id_rate: { value: null, measurable: false, numerator: 0, denominator: 0 },
      expired_entry_rate: { value: null, measurable: false, numerator: 0, denominator: 0 },
      snapshot_fetch_success_rate: { value: null, measurable: false },
    };
  }
}

/**
 * @param {Array<any>} events
 * @param {object} ctx
 * @returns {object} TelemetryExportV1 payload
 */
export function buildTelemetryExportV1(events, ctx = {}) {
  try {
    const arr = Array.isArray(events) ? events : [];
    const c = safeObj(ctx) || {};

    const url = safeStr(c.url || '');
    const reportId = safeStr(c.reportId || '');
    const finalState = safeStr(c.finalState || '');

    const app = { name: 'aeo-geo-v2' };
    const version = safeStr(c.appVersion || c.version || '');
    const environment = safeStr(c.environment || '');
    if (version) app.version = version;
    if (environment) app.environment = environment;

    const context = { url };
    if (reportId) context.reportId = reportId;
    if (finalState) context.finalState = finalState;

    return {
      schemaVersion: 'telemetry-export/v1',
      generatedAt: new Date().toISOString(),
      app,
      context,
      kpis: buildKpisV1(arr, c),
      events: arr,
    };
  } catch (_) {
    return {
      schemaVersion: 'telemetry-export/v1',
      generatedAt: new Date().toISOString(),
      app: { name: 'aeo-geo-v2' },
      context: { url: '' },
      kpis: {
        filter: { type: 'sid', sid: '' },
        invalid_id_rate: { value: null, measurable: false, numerator: 0, denominator: 0 },
        expired_entry_rate: { value: null, measurable: false, numerator: 0, denominator: 0 },
        snapshot_fetch_success_rate: { value: null, measurable: false },
      },
      events: Array.isArray(events) ? events : [],
    };
  }
}


