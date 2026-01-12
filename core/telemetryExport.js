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

function getFinalState(evt) {
  return pickFirst(evt, ['finalState', 'final_state', 'state']);
}

function formatRateForCsv(v) {
  try {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    // stable, human-readable rounding
    return String(Math.round(n * 1e6) / 1e6);
  } catch (_) {
    return '';
  }
}

function csvEscape(v) {
  const s = (v === null || typeof v === 'undefined') ? '' : String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
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
    const expiredCount = finals.filter((e) => getFinalState(e) === 'EXPIRED').length;
    const otherDeviceCount = finals.filter((e) => getFinalState(e) === 'OTHER_DEVICE').length;
    const okCount = finals.filter((e) => getFinalState(e) === 'OK').length;

    return {
      filter: { type: 'sid', sid: sid || '' },
      ok_rate: rate(okCount),
      invalid_id_rate: rate(invalidCount),
      expired_entry_rate: rate(expiredCount),
      other_device_rate: rate(otherDeviceCount),
      snapshot_fetch_success_rate: { value: null, measurable: false },
    };
  } catch (_) {
    return {
      filter: { type: 'sid', sid: '' },
      ok_rate: { value: null, measurable: false, numerator: 0, denominator: 0 },
      invalid_id_rate: { value: null, measurable: false, numerator: 0, denominator: 0 },
      expired_entry_rate: { value: null, measurable: false, numerator: 0, denominator: 0 },
      other_device_rate: { value: null, measurable: false, numerator: 0, denominator: 0 },
      snapshot_fetch_success_rate: { value: null, measurable: false },
    };
  }
}

export function buildTelemetryExportCsvV1(events, ctx = {}) {
  try {
    const payload = buildTelemetryExportV1(events, ctx);
    const k = (payload && payload.kpis && typeof payload.kpis === 'object') ? payload.kpis : {};
    const context = (payload && payload.context && typeof payload.context === 'object') ? payload.context : {};

    const schemaVersion = safeStr(payload && payload.schemaVersion);
    const generatedAt = safeStr(payload && payload.generatedAt);
    const totalEvents = Array.isArray(payload && payload.events) ? payload.events.length : 0;

    const okRate = (k.ok_rate && typeof k.ok_rate === 'object') ? k.ok_rate.value : null;
    const invalidIdRate = (k.invalid_id_rate && typeof k.invalid_id_rate === 'object') ? k.invalid_id_rate.value : null;
    const expiredEntryRate = (k.expired_entry_rate && typeof k.expired_entry_rate === 'object') ? k.expired_entry_rate.value : null;
    const otherDeviceRate = (k.other_device_rate && typeof k.other_device_rate === 'object') ? k.other_device_rate.value : null;
    const snapshotFetchSuccessRate = (k.snapshot_fetch_success_rate && typeof k.snapshot_fetch_success_rate === 'object')
      ? k.snapshot_fetch_success_rate.value
      : null;
    const snapshotFetchMeasurable = !!(k.snapshot_fetch_success_rate && typeof k.snapshot_fetch_success_rate === 'object' && k.snapshot_fetch_success_rate.measurable);

    const sid = safeStr(ctx && ctx.sid);
    const reportId = safeStr(context.reportId || '');
    const finalState = safeStr(context.finalState || '');
    const url = safeStr(context.url || '');

    const header = [
      'schemaVersion',
      'generatedAt',
      'totalEvents',
      'okRate',
      'invalidIdRate',
      'expiredEntryRate',
      'otherDeviceRate',
      'snapshotFetchSuccessRate',
      'snapshotFetchMeasurable',
      'sid',
      'reportId',
      'finalState',
      'url',
    ].join(',');

    const row = [
      schemaVersion,
      generatedAt,
      String(totalEvents),
      formatRateForCsv(okRate),
      formatRateForCsv(invalidIdRate),
      formatRateForCsv(expiredEntryRate),
      formatRateForCsv(otherDeviceRate),
      snapshotFetchMeasurable ? formatRateForCsv(snapshotFetchSuccessRate) : '',
      snapshotFetchMeasurable ? 'true' : 'false',
      sid,
      reportId,
      finalState,
      url,
    ].map(csvEscape).join(',');

    return header + '\n' + row + '\n';
  } catch (_) {
    return 'schemaVersion,generatedAt,totalEvents,okRate,invalidIdRate,expiredEntryRate,otherDeviceRate,snapshotFetchSuccessRate,snapshotFetchMeasurable,sid,reportId,finalState,url\n';
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


