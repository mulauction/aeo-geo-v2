#!/usr/bin/env bash
set -euo pipefail

# Phase 34-3: Local-only sample raw(JSONL) generator for telemetry rollup validation.
#
# How to verify:
# 1) bash scripts/telemetry-rollup.sample.sh
# 2) bash scripts/telemetry-rollup.sh
# 3) sed -n '1,80p' server/data/telemetry/summary/latest.json
#
# Expected (from latest.json):
# - meta.hasAnyExportRecords: true
# - meta.exportRecordsSeen > 0
# - totalEvents > 0
# - countsByFinalState has OK/EXPIRED/OTHER_DEVICE
# - topReasons has >= 1 entry

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$ROOT_DIR/server/data/telemetry/raw"
OUT_FILE="$RAW_DIR/sample-export.jsonl"

mkdir -p "$RAW_DIR"

cat > "$OUT_FILE" <<'JSONL'
{"receivedAt":"2026-01-13T00:00:00.000Z","source":{"app":"aeo-geo-v2","environment":"localhost"},"request":{"ip":"127.0.0.1","ua":"sample"},"payload":{"type":"export","tags":["export"],"finalState":"OK","reason":"R_NO_REPORT"}}
{"receivedAt":"2026-01-13T00:00:01.000Z","source":{"app":"aeo-geo-v2","environment":"localhost"},"request":{"ip":"127.0.0.1","ua":"sample"},"payload":{"type":"export","tags":["export"],"finalState":"EXPIRED","reasons":["R_A","R_B"]}}
{"receivedAt":"2026-01-13T00:00:02.000Z","source":{"app":"aeo-geo-v2","environment":"localhost"},"request":{"ip":"127.0.0.1","ua":"sample"},"payload":{"type":"export","name":"telemetry-export-sample","finalState":"OTHER_DEVICE","reliability":{"reasons":["R_REL_1"]}}}
JSONL

echo "server/data/telemetry/raw/sample-export.jsonl"


