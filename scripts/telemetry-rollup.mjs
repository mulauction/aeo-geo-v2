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

    const events = Array.isArray(payload.events) ? payload.events : [];
    if (events.length > 0) recordsWithExportEvents += 1;

    for (const evt of events) {
      if (!isPlainObject(evt)) continue;
      totalEvents += 1;

      const st = pickFirstState(evt);
      countsByFinalState[st] = (countsByFinalState[st] || 0) + 1;

      const reasons = extractReasons(evt);
      for (const r of reasons) {
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
      recordsWithExportEvents,
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


