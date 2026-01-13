import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeStr(v) {
  try {
    if (v === null || typeof v === "undefined") return "";
    return String(v);
  } catch {
    return "";
  }
}

/**
 * Rollup 대상(=export 레코드) 판정 기준 (Phase 34-2)
 * Conservative rule: record-level signal only.
 *
 * - record.type === 'export' OR record.event === 'export' OR record.kind === 'export'
 * - OR record.name includes 'export' (case-insensitive)
 * - OR record.tags[] includes 'export'
 */
function isExportEvent(record) {
  try {
    if (!isPlainObject(record)) return false;
    const eqExport = (v) => safeStr(v).trim().toLowerCase() === "export";

    if (eqExport(record.type) || eqExport(record.event) || eqExport(record.kind)) return true;

    const name = safeStr(record.name).toLowerCase();
    if (name.includes("export")) return true;

    if (Array.isArray(record.tags)) {
      for (const t of record.tags) {
        if (safeStr(t).trim().toLowerCase() === "export") return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function pickFirstState(evt) {
  try {
    if (!isPlainObject(evt)) return "UNKNOWN";
    const v =
      (Object.prototype.hasOwnProperty.call(evt, "finalState") ? evt.finalState : undefined) ??
      (Object.prototype.hasOwnProperty.call(evt, "state") ? evt.state : undefined) ??
      (Object.prototype.hasOwnProperty.call(evt, "resultState") ? evt.resultState : undefined);
    const s = safeStr(v).trim();
    return s || "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

function extractReasons(evt) {
  const out = [];
  try {
    if (!isPlainObject(evt)) return ["NO_REASON"];

    const pushReason = (v) => {
      const s = safeStr(v).trim();
      if (s) out.push(s);
    };

    // A) direct reason
    if (Object.prototype.hasOwnProperty.call(evt, "reason")) {
      const v = evt.reason;
      if (Array.isArray(v)) {
        for (const x of v) pushReason(x);
      } else {
        pushReason(v);
      }
    }

    // B) reasons[]
    if (Object.prototype.hasOwnProperty.call(evt, "reasons")) {
      const v = evt.reasons;
      if (Array.isArray(v)) {
        for (const x of v) pushReason(x);
      }
    }

    // C) reliability.reasons[]
    if (isPlainObject(evt.reliability) && Array.isArray(evt.reliability.reasons)) {
      for (const x of evt.reliability.reasons) pushReason(x);
    }
  } catch {
    // ignore
  }

  if (out.length === 0) return ["NO_REASON"];
  return out;
}

async function pickLatestRawFile(rawDir) {
  const entries = await fs.readdir(rawDir);
  const files = entries.filter((f) => typeof f === "string" && f.endsWith(".jsonl")).sort();
  return files.length > 0 ? path.join(rawDir, files[files.length - 1]) : null;
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, "..");

  const rawDir = path.join(root, "server", "data", "telemetry", "raw");
  const summaryDir = path.join(root, "server", "data", "telemetry", "summary");

  const rawFile = await pickLatestRawFile(rawDir);
  if (!rawFile) {
    throw new Error(`No raw JSONL files found in: ${rawDir}`);
  }

  const txt = await fs.readFile(rawFile, "utf8");
  const lines = txt.split("\n");

  const countsByFinalState = {};
  const reasonCounts = {};

  let totalEvents = 0;
  let linesSeen = 0;
  let linesParsed = 0;
  let recordsWithExportEvents = 0;
  let exportRecordsSeen = 0;

  for (const line of lines) {
    const s = safeStr(line).trim();
    if (!s) continue;
    linesSeen += 1;

    let rec = null;
    try {
      rec = JSON.parse(s);
    } catch {
      continue; // skip broken JSON
    }
    if (!isPlainObject(rec)) continue;
    linesParsed += 1;

    const payload = Object.prototype.hasOwnProperty.call(rec, "payload") ? rec.payload : null;
    if (!isPlainObject(payload)) continue;

    // Candidate records extraction (best-effort):
    // - payload.events[] (direct export payload)
    // - payload.payload.events[] (wrapper: { source, payload: exportPayload })
    // - payload itself (single record)
    const directEvents = Array.isArray(payload.events) ? payload.events : null;
    const wrapped = isPlainObject(payload.payload) ? payload.payload : null;
    const wrappedEvents = wrapped && Array.isArray(wrapped.events) ? wrapped.events : null;

    const candidates = Array.isArray(directEvents)
      ? directEvents
      : (Array.isArray(wrappedEvents) ? wrappedEvents : [payload]);

    if (Array.isArray(directEvents) || Array.isArray(wrappedEvents)) {
      const arr = Array.isArray(directEvents) ? directEvents : wrappedEvents;
      if (Array.isArray(arr) && arr.length > 0) recordsWithExportEvents += 1;
    }

    for (const evt of candidates) {
      if (!isPlainObject(evt)) continue;
      if (!isExportEvent(evt)) continue;

      exportRecordsSeen += 1;
      totalEvents += 1;

      const st = pickFirstState(evt);
      countsByFinalState[st] = (countsByFinalState[st] || 0) + 1;

      const reasons = extractReasons(evt);
      for (const r of reasons) {
        // "NO_REASON" is only meaningful when we have export records at all.
        // (This loop only runs for export records, so it naturally satisfies that condition.)
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }
  }

  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceFile: path.basename(rawFile),
      sourcePath: path.relative(root, rawFile),
      linesSeen,
      linesParsed,
      // "data 없음" vs "집계 0" 구분용
      hasAnyRawRecords: linesParsed > 0,
      hasAnyExportRecords: exportRecordsSeen > 0,
      exportRecordsSeen,
      // legacy meta (kept)
      recordsWithExportEvents,
      exportRecordRule: "type|event|kind==='export' OR name includes 'export' OR tags includes 'export'",
    },
    countsByFinalState,
    topReasons,
    totalEvents,
  };

  await fs.mkdir(summaryDir, { recursive: true });
  const latestPath = path.join(summaryDir, "latest.json");
  await fs.writeFile(latestPath, JSON.stringify(out, null, 2) + "\n", "utf8");
}

main().catch((err) => {
  const msg = err && err.message ? err.message : String(err);
  process.stderr.write(`[telemetry-rollup] ${msg}\n`);
  process.exitCode = 1;
});


