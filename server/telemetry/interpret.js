/**
 * Telemetry Interpret (Post-raw Step 1)
 *
 * Goal:
 * - Take a single raw telemetry JSONL record (append-only) and produce a normalized event object.
 *
 * Hard rules:
 * - Never throw (unknown-safe)
 * - Do NOT mutate the input record
 * - Do NOT assume payload schema (best-effort normalization)
 */

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeStr(v) {
  try {
    if (v === null || typeof v === "undefined") return "";
    return String(v);
  } catch (_) {
    return "";
  }
}

function safeIso(v) {
  try {
    const s = safeStr(v).trim();
    if (!s) return "";
    const t = Date.parse(s);
    if (!Number.isFinite(t)) return "";
    return new Date(t).toISOString();
  } catch (_) {
    return "";
  }
}

function safeNumber(v) {
  try {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (_) {
    return null;
  }
}

function pickFirst(obj, keys) {
  try {
    if (!isPlainObject(obj)) return "";
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const s = safeStr(obj[k]).trim();
        if (s) return s;
      }
    }
    return "";
  } catch (_) {
    return "";
  }
}

function normalizeRequest(request) {
  try {
    const r = isPlainObject(request) ? request : {};
    const ip = safeStr(r.ip || "").trim() || null;
    const ua = safeStr(r.ua || "").trim() || null;
    return { ip, ua };
  } catch (_) {
    return { ip: null, ua: null };
  }
}

function normalizeSource(source) {
  try {
    const s = isPlainObject(source) ? source : {};
    const app = safeStr(s.app || "").trim() || "";
    const environment = safeStr(s.environment || "").trim() || "";
    return { app, environment };
  } catch (_) {
    return { app: "", environment: "" };
  }
}

function normalizeExportEvent(e) {
  try {
    const o = isPlainObject(e) ? e : {};
    return {
      ts: safeNumber(o.ts),
      event: safeStr(o.event || "").trim(),
      sid: safeStr(o.sid || "").trim(),
      reportIdHash: safeStr(o.reportIdHash || "").trim(),
      preState: safeStr(o.preState || "").trim(),
      finalState: pickFirst(o, ["finalState", "final_state", "state"]),
      reason: safeStr(o.reason || "").trim(),
      hasLastV2: typeof o.hasLastV2 === "boolean" ? o.hasLastV2 : null,
      requestedLoaded: typeof o.requestedLoaded === "boolean" ? o.requestedLoaded : null,
    };
  } catch (_) {
    return {
      ts: null,
      event: "",
      sid: "",
      reportIdHash: "",
      preState: "",
      finalState: "",
      reason: "",
      hasLastV2: null,
      requestedLoaded: null,
    };
  }
}

function normalizeTelemetryExport(payload) {
  try {
    if (!isPlainObject(payload)) {
      return {
        schemaVersion: "",
        generatedAt: "",
        app: { name: "", version: "", environment: "" },
        context: { url: "", reportId: "", finalState: "" },
        kpis: null,
        events: [],
      };
    }

    const schemaVersion = safeStr(payload.schemaVersion || "").trim();
    const generatedAt = safeIso(payload.generatedAt);

    const appObj = isPlainObject(payload.app) ? payload.app : {};
    const app = {
      name: safeStr(appObj.name || "").trim(),
      version: safeStr(appObj.version || "").trim(),
      environment: safeStr(appObj.environment || "").trim(),
    };

    const ctxObj = isPlainObject(payload.context) ? payload.context : {};
    const context = {
      url: safeStr(ctxObj.url || "").trim(),
      reportId: safeStr(ctxObj.reportId || "").trim(),
      finalState: safeStr(ctxObj.finalState || "").trim(),
    };

    const kpis = isPlainObject(payload.kpis) ? payload.kpis : null;

    const rawEvents = Array.isArray(payload.events) ? payload.events : [];
    const events = rawEvents.map(normalizeExportEvent);

    return { schemaVersion, generatedAt, app, context, kpis, events };
  } catch (_) {
    return {
      schemaVersion: "",
      generatedAt: "",
      app: { name: "", version: "", environment: "" },
      context: { url: "", reportId: "", finalState: "" },
      kpis: null,
      events: [],
    };
  }
}

/**
 * @param {any} rawRecord - raw JSONL record (shape: receivedAt/source/request/payload)
 * @returns {object} normalized event (never throws)
 */
function interpret(rawRecord) {
  try {
    const r = isPlainObject(rawRecord) ? rawRecord : {};

    const receivedAt = safeIso(r.receivedAt) || new Date().toISOString();
    const source = normalizeSource(r.source);
    const request = normalizeRequest(r.request);

    const payload = Object.prototype.hasOwnProperty.call(r, "payload") ? r.payload : null;
    const telemetryExport = normalizeTelemetryExport(payload);

    const exportSchema = safeStr(telemetryExport.schemaVersion || "").trim();
    const kind = exportSchema.startsWith("telemetry-export/") ? "telemetry_export" : "unknown_payload";

    const out = {
      schemaVersion: "telemetry-interpret/v1",
      kind,
      receivedAt,
      source,
      request,
      telemetryExport,
    };

    // Best-effort minimal metadata for debugging / aggregation scaffolding
    try {
      out.meta = {
        exportSchemaVersion: exportSchema,
        exportGeneratedAt: telemetryExport.generatedAt || "",
        eventsCount: Array.isArray(telemetryExport.events) ? telemetryExport.events.length : 0,
      };
    } catch (_) {
      // ignore
    }

    return out;
  } catch (_) {
    return {
      schemaVersion: "telemetry-interpret/v1",
      kind: "error_fallback",
      receivedAt: new Date().toISOString(),
      source: { app: "", environment: "" },
      request: { ip: null, ua: null },
      telemetryExport: {
        schemaVersion: "",
        generatedAt: "",
        app: { name: "", version: "", environment: "" },
        context: { url: "", reportId: "", finalState: "" },
        kpis: null,
        events: [],
      },
      meta: { exportSchemaVersion: "", exportGeneratedAt: "", eventsCount: 0 },
    };
  }
}

module.exports = { interpret };


