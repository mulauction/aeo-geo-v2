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

function pickExportSchema(payload) {
  try {
    if (!isPlainObject(payload)) return "";
    // Accept schema hints from either wrapper or export object.
    const s1 = safeStr(payload.schemaVersion || payload.schema_version || "").trim();
    if (s1) return s1;
    const te = isPlainObject(payload.telemetryExport) ? payload.telemetryExport : null;
    const s2 = te ? safeStr(te.schemaVersion || te.schema_version || "").trim() : "";
    return s2 || "";
  } catch (_) {
    return "";
  }
}

function classifyTelemetryPayload(payload, exportSchema) {
  try {
    const reasons = [];
    const schemaHint = safeStr(exportSchema || "").trim();

    const normalized = {
      telemetryExport: {
        meta: {
          generatedAt: "",
          schemaVersion: "",
        },
        eventsCount: 0,
        hasEvents: false,
        sampleEventKeys: [],
      },
    };

    if (payload === null || typeof payload === "undefined") {
      reasons.push("unavailable_input");
      normalized.telemetryExport.meta.schemaVersion = "unknown_payload";
      return { kind: "unknown_payload", reasons, normalized };
    }

    if (!isPlainObject(payload)) {
      reasons.push("invalid_payload_type");
      normalized.telemetryExport.meta.schemaVersion = "unknown_payload";
      return { kind: "unknown_payload", reasons, normalized };
    }

    const te = isPlainObject(payload.telemetryExport) ? payload.telemetryExport : null;

    // Expand "event-like" candidate to payload.payload (common wrapper) OR payload
    const outerReceivedAt = safeIso(payload.receivedAt || payload.received_at || payload.received || "");
    const candidate = isPlainObject(payload.payload) ? payload.payload : payload;

    const schemaLooksLikeExport = schemaHint.startsWith("telemetry-export/");
    if (schemaLooksLikeExport) reasons.push("export_schema_match");

    const looksLikeTelemetryExportWrapper = (() => {
      try {
        if (!te) return false;
        if (isPlainObject(te.meta)) return true;
        if (typeof te.eventsCount !== "undefined" && te.eventsCount !== null) return true;
        if (Array.isArray(te.events)) return true;
        return false;
      } catch (_) {
        return false;
      }
    })();

    const looksLikeSingleEvent = (() => {
      try {
        if (te) return false; // wrapper present => not a single-event payload

        // candidate = payload.payload (most common) OR payload
        const name = pickFirst(candidate, ["eventName", "event", "type", "name"]);
        const ts = pickFirst(candidate, ["time", "ts", "createdAt", "created_at", "timestamp"]) || outerReceivedAt;

        // Special case: our sample is type:"export" without inner timestamp
        if (candidate.type === "export") return true;

        return Boolean(name) && Boolean(ts);
      } catch (_) {
        return false;
      }
    })();

    const looksLikeLegacyExport = (() => {
      try {
        if (te) return false;
        if (isPlainObject(payload.export)) return true;
        if (Array.isArray(payload.events)) return true;
        if (isPlainObject(payload.meta) && Array.isArray(payload.events)) return true;
        return false;
      } catch (_) {
        return false;
      }
    })();

    // A) telemetry_export_v1 (prefer schema hint, but do not require it)
    if (schemaLooksLikeExport || looksLikeTelemetryExportWrapper) {
      if (looksLikeTelemetryExportWrapper) reasons.push("has_payload_telemetryExport");
      const src = te || payload;

      const metaObj = (src && isPlainObject(src.meta)) ? src.meta : {};
      const generatedAt = safeIso(metaObj.generatedAt || src.generatedAt || "");

      const eventsArr = Array.isArray(src.events) ? src.events : null;
      const eventsCount = eventsArr
        ? eventsArr.length
        : (safeNumber(src.eventsCount) ?? 0);
      const hasEvents = eventsCount > 0;

      const sampleEventKeys = (() => {
        try {
          if (!eventsArr || eventsArr.length === 0) return [];
          const first = eventsArr[0];
          return isPlainObject(first) ? Object.keys(first).slice(0, 10) : [];
        } catch (_) {
          return [];
        }
      })();

      normalized.telemetryExport.meta.generatedAt = generatedAt || "";
      normalized.telemetryExport.meta.schemaVersion = "telemetry_export_v1";
      normalized.telemetryExport.eventsCount = Number.isFinite(eventsCount) ? eventsCount : 0;
      normalized.telemetryExport.hasEvents = Boolean(hasEvents);
      if (sampleEventKeys.length > 0) normalized.telemetryExport.sampleEventKeys = sampleEventKeys;

      if (!schemaLooksLikeExport && !looksLikeTelemetryExportWrapper) reasons.push("structure_match_export");
      return { kind: "telemetry_export_v1", reasons, normalized };
    }

    // B) telemetry_event_v1 (single event-like payload)
    if (looksLikeSingleEvent) {
      reasons.push("looks_like_single_event");
      reasons.push(isPlainObject(payload.payload) ? "event_wrapped_in_payload" : "event_at_root");
      normalized.telemetryExport.meta.generatedAt = safeIso(
        pickFirst(candidate, ["time", "ts", "createdAt", "created_at", "timestamp"]) || outerReceivedAt
      );
      normalized.telemetryExport.meta.schemaVersion = "telemetry_event_v1";
      normalized.telemetryExport.eventsCount = 1;
      normalized.telemetryExport.hasEvents = true;
      normalized.telemetryExport.sampleEventKeys = Object.keys(candidate).slice(0, 10);
      return { kind: "telemetry_event_v1", reasons, normalized };
    }

    // C) legacy_export (older export-ish shape without telemetryExport wrapper)
    if (looksLikeLegacyExport) {
      reasons.push("legacy_shape");
      const src = isPlainObject(payload.export) ? payload.export : payload;

      const metaObj = (src && isPlainObject(src.meta)) ? src.meta : {};
      const generatedAt = safeIso(metaObj.generatedAt || src.generatedAt || "");
      const eventsArr = Array.isArray(src.events) ? src.events : null;
      const eventsCount = eventsArr
        ? eventsArr.length
        : (safeNumber(src.eventsCount) ?? 0);
      const hasEvents = eventsCount > 0;

      const sampleEventKeys = (() => {
        try {
          if (!eventsArr || eventsArr.length === 0) return [];
          const first = eventsArr[0];
          return isPlainObject(first) ? Object.keys(first).slice(0, 10) : [];
        } catch (_) {
          return [];
        }
      })();

      normalized.telemetryExport.meta.generatedAt = generatedAt || "";
      normalized.telemetryExport.meta.schemaVersion = "legacy_export";
      normalized.telemetryExport.eventsCount = Number.isFinite(eventsCount) ? eventsCount : 0;
      normalized.telemetryExport.hasEvents = Boolean(hasEvents);
      if (sampleEventKeys.length > 0) normalized.telemetryExport.sampleEventKeys = sampleEventKeys;

      return { kind: "legacy_export", reasons, normalized };
    }

    // D) unknown_payload
    if (schemaHint) reasons.push("schema_hint_not_export");
    if (!te) reasons.push("missing_telemetryExport_wrapper");
    if (!Object.prototype.hasOwnProperty.call(payload, "events")) reasons.push("missing_events");
    normalized.telemetryExport.meta.schemaVersion = "unknown_payload";
    return { kind: "unknown_payload", reasons, normalized };
  } catch (_) {
    return {
      kind: "unknown_payload",
      reasons: ["classifier_error"],
      normalized: {
        telemetryExport: {
          meta: { generatedAt: "", schemaVersion: "unknown_payload" },
          eventsCount: 0,
          hasEvents: false,
          sampleEventKeys: [],
        },
      },
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
    const exportSchema = pickExportSchema(payload);
    const classified = classifyTelemetryPayload(payload, exportSchema);

    // Keep legacy top-level telemetryExport for compatibility (best-effort)
    const telemetryExport = (() => {
      try {
        if (classified.kind === "telemetry_export_v1") {
          const src = isPlainObject(payload) && isPlainObject(payload.telemetryExport) ? payload.telemetryExport : payload;
          return normalizeTelemetryExport(src);
        }
        if (classified.kind === "legacy_export") {
          const src = isPlainObject(payload) && isPlainObject(payload.export) ? payload.export : payload;
          return normalizeTelemetryExport(src);
        }
        return normalizeTelemetryExport(null);
      } catch (_) {
        return normalizeTelemetryExport(null);
      }
    })();

    const out = {
      schemaVersion: "telemetry-interpret/v1",
      kind: classified.kind,
      reasons: Array.isArray(classified.reasons) ? classified.reasons : [],
      receivedAt,
      source,
      request,
      telemetryExport,
      normalized: classified.normalized,
    };

    // Best-effort minimal metadata for debugging / aggregation scaffolding
    try {
      out.meta = {
        exportSchemaVersion: exportSchema,
        exportGeneratedAt: safeStr(classified.normalized && classified.normalized.telemetryExport && classified.normalized.telemetryExport.meta && classified.normalized.telemetryExport.meta.generatedAt).trim() || "",
        eventsCount: (classified.normalized && classified.normalized.telemetryExport && Number.isFinite(classified.normalized.telemetryExport.eventsCount))
          ? classified.normalized.telemetryExport.eventsCount
          : (Array.isArray(telemetryExport.events) ? telemetryExport.events.length : 0),
      };
    } catch (_) {
      // ignore
    }

    return out;
  } catch (_) {
    return {
      schemaVersion: "telemetry-interpret/v1",
      kind: "unknown_payload",
      reasons: ["error_fallback"],
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
      normalized: {
        telemetryExport: {
          meta: { generatedAt: "", schemaVersion: "unknown_payload" },
          eventsCount: 0,
          hasEvents: false,
          sampleEventKeys: [],
        },
      },
      meta: { exportSchemaVersion: "", exportGeneratedAt: "", eventsCount: 0 },
    };
  }
}

module.exports = { interpret };


