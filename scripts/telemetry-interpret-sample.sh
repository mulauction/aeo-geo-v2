#!/usr/bin/env bash
set -euo pipefail

# Sample: interpret recent raw telemetry JSONL lines and print normalized events to stdout.
#
# Usage:
#   bash scripts/telemetry-interpret-sample.sh            # prints last 5 lines from latest raw file
#   bash scripts/telemetry-interpret-sample.sh 20         # prints last 20 lines
#   bash scripts/telemetry-interpret-sample.sh 10 2026-01-13  # prints last 10 lines from a specific date file

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$ROOT_DIR/server/data/telemetry/raw"

N="${1:-5}"
DATE="${2:-}"

pick_latest_file() {
  # Date filenames sort lexicographically (YYYY-MM-DD.jsonl) => last is latest.
  ls -1 "$RAW_DIR"/*.jsonl 2>/dev/null | sort | tail -n 1 || true
}

if [[ -n "$DATE" ]]; then
  FILE="$RAW_DIR/$DATE.jsonl"
else
  FILE="$(pick_latest_file)"
fi

if [[ -z "${FILE:-}" || ! -f "$FILE" ]]; then
  echo "[telemetry-interpret-sample] raw file not found in: $RAW_DIR" 1>&2
  echo "[telemetry-interpret-sample] hint: pass a date: bash scripts/telemetry-interpret-sample.sh 5 2026-01-13" 1>&2
  exit 1
fi

# Read last N JSONL lines and interpret each line via node.
NODE_CODE="$(cat <<'NODE'
let interpret = null;
try {
  ({ interpret } = require(process.cwd() + '/server/telemetry/interpret'));
} catch (e) {
  console.error('[telemetry-interpret-sample] failed to load interpret module:', e && (e.message || e));
  process.exit(1);
}

// If stdout is closed early (e.g. piped to `head -n 1`), exit cleanly.
process.stdout.on('error', (err) => {
  try {
    if (err && err.code === 'EPIPE') process.exit(0);
  } catch (_) {}
});

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

(async () => {
  const input = await readStdin();
  const lines = String(input || '').split('\n');
  const kindCounts = Object.create(null);
  for (const line of lines) {
    const s = String(line || '').trim();
    if (!s) continue;
    let raw = null;
    try {
      raw = JSON.parse(s);
    } catch (_) {
      const out = {
        schemaVersion: 'telemetry-interpret/v1',
        kind: 'unknown_payload',
        reasons: ['invalid_json'],
        normalized: { telemetryExport: { meta: { generatedAt: '', schemaVersion: 'unknown_payload' }, eventsCount: 0, hasEvents: false, sampleEventKeys: [] } },
        meta: { exportSchemaVersion: '' },
      };
      const kind = String(out.kind || 'unknown_payload');
      kindCounts[kind] = (kindCounts[kind] || 0) + 1;
      process.stdout.write(
        `kind=${kind} reasons=${JSON.stringify(out.reasons || [])} eventsCount=0 hasEvents=false exportSchema=\n`
      );
      continue;
    }
    let out = null;
    try {
      out = interpret(raw);
    } catch (_) {
      out = {
        schemaVersion: 'telemetry-interpret/v1',
        kind: 'unknown_payload',
        reasons: ['script_error'],
        normalized: { telemetryExport: { meta: { generatedAt: '', schemaVersion: 'unknown_payload' }, eventsCount: 0, hasEvents: false, sampleEventKeys: [] } },
        meta: { exportSchemaVersion: '' },
      };
    }

    const kind = String(out && out.kind ? out.kind : 'unknown_payload');
    kindCounts[kind] = (kindCounts[kind] || 0) + 1;

    const reasons = Array.isArray(out && out.reasons) ? out.reasons : [];
    const te = out && out.normalized && out.normalized.telemetryExport ? out.normalized.telemetryExport : null;
    const eventsCount = te && Number.isFinite(Number(te.eventsCount)) ? Number(te.eventsCount) : 0;
    const hasEvents = te ? Boolean(te.hasEvents) : false;
    const exportSchema = out && out.meta && typeof out.meta.exportSchemaVersion === 'string' ? out.meta.exportSchemaVersion : '';

    process.stdout.write(
      `kind=${kind} reasons=${JSON.stringify(reasons)} eventsCount=${eventsCount} hasEvents=${hasEvents} exportSchema=${exportSchema}\n`
    );
  }

  const order = ['telemetry_export_v1', 'telemetry_event_v1', 'legacy_export', 'unknown_payload'];
  const parts = [];
  for (const k of order) {
    parts.push(`${k}=${Number(kindCounts[k] || 0)}`);
  }
  // include any other kinds defensively (should be none)
  for (const k of Object.keys(kindCounts)) {
    if (!order.includes(k)) parts.push(`${k}=${Number(kindCounts[k] || 0)}`);
  }
  process.stdout.write(`kind_counts ${parts.join(' ')}\n`);
})();
NODE
)"

tail -n "$N" "$FILE" | node -e "$NODE_CODE"


