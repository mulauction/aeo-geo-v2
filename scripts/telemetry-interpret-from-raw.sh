#!/usr/bin/env bash
set -euo pipefail

# scripts/telemetry-interpret-from-raw.sh
# Read-only validator: raw JSONL -> interpret (one JSON output line per input line)
#
# Usage:
#   bash scripts/telemetry-interpret-from-raw.sh <N>

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$ROOT_DIR/server/data/telemetry/raw"

N="${1:-}"
if [[ -z "${N:-}" ]]; then
  echo "usage: bash scripts/telemetry-interpret-from-raw.sh <N>" 1>&2
  exit 2
fi

pick_latest_file() {
  # Date filenames sort lexicographically (YYYY-MM-DD.jsonl) => last is latest.
  ls -1 "$RAW_DIR"/*.jsonl 2>/dev/null | sort | tail -n 1 || true
}

FILE="$(pick_latest_file)"
if [[ -z "${FILE:-}" || ! -f "$FILE" ]]; then
  echo "[telemetry-interpret-from-raw] raw file not found in: $RAW_DIR" 1>&2
  exit 1
fi

NODE_CODE="$(cat <<'NODE'
let interpret = null;
try {
  ({ interpret } = require(process.cwd() + '/server/telemetry/interpret'));
} catch (e) {
  console.error('[telemetry-interpret-from-raw] failed to load interpret module:', e && (e.message || e));
  process.exit(1);
}

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
  for (const line of lines) {
    const s = String(line || '').trim();
    if (!s) continue;
    let raw = null;
    try {
      raw = JSON.parse(s);
    } catch (_) {
      continue; // skip invalid JSONL line
    }
    let out = null;
    try {
      out = interpret(raw);
    } catch (_) {
      out = { schemaVersion: 'telemetry-interpret/v1', kind: 'script_error', receivedAt: new Date().toISOString() };
    }
    process.stdout.write(JSON.stringify(out) + '\n');
  }
})();
NODE
)"

tail -n "$N" "$FILE" | node -e "$NODE_CODE"


