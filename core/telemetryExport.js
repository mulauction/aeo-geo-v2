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
      kpis: {},
      events: arr,
    };
  } catch (_) {
    return {
      schemaVersion: 'telemetry-export/v1',
      generatedAt: new Date().toISOString(),
      app: { name: 'aeo-geo-v2' },
      context: { url: '' },
      kpis: {},
      events: Array.isArray(events) ? events : [],
    };
  }
}


