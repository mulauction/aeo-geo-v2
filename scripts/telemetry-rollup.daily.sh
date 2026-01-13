#!/usr/bin/env bash
set -euo pipefail

# Phase 34-5: Daily ops wrapper (intended to be invoked once per day via cron/CI).
# NOTE: summary JSON is a derived artifact; do NOT commit it to Git.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$ROOT_DIR/server/data/telemetry/raw"
SUMMARY_PATH="server/data/telemetry/summary/latest.json"

runAt="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
mode="dev"
if [[ "${NODE_ENV:-}" == "production" ]]; then
  mode="prod"
fi

pick_latest_raw() {
  if [[ ! -d "$RAW_DIR" ]]; then
    echo ""
    return 0
  fi
  # YYYY-MM-DD.jsonl sorts lexicographically; last is latest.
  ls -1 "$RAW_DIR"/*.jsonl 2>/dev/null | sort | tail -n 1 || true
}

rawFile="$(pick_latest_raw)"
rawRel=""
if [[ -n "$rawFile" ]]; then
  rawRel="${rawFile#"$ROOT_DIR"/}"
fi

echo "runAt=$runAt"
echo "mode=$mode"
echo "source=${rawRel:-"(none)"}"
echo "summary=$SUMMARY_PATH"

if [[ -z "$rawFile" ]]; then
  echo "NO_RAW_DATA"
  echo "result=NO_RAW_DATA"
  # Safety: do not fail cron; best-effort attempt is allowed to be a no-op.
  # Try rollup anyway (may fail due to no raw files); ignore and exit 0.
  bash "$ROOT_DIR/scripts/telemetry-rollup.sh" >/dev/null 2>&1 || true
  exit 0
fi

if ! bash "$ROOT_DIR/scripts/telemetry-rollup.sh" >/dev/null; then
  echo "ERROR: telemetry rollup failed" 1>&2
  exit 1
fi

echo "result=OK"
exit 0


