#!/usr/bin/env bash
set -euo pipefail

echo "== smoke: repo dirty check (informational) =="
git status --porcelain=v1 || true

echo "== smoke: conflict markers (project code only) =="
# Only check for real merge conflict markers.
# Do NOT search for "=======" because it's common in HISTORY/CHANGELOG markdown.
TARGETS=(core server share.html analyze.html generate docs)
EXCLUDES=(
  --glob '!**/node_modules/**'
  --glob '!**/dist/**'
  --glob '!**/.next/**'
  --glob '!**/build/**'
)

if rg -n "<<<<<<<|>>>>>>>" "${EXCLUDES[@]}" "${TARGETS[@]}"; then
  echo "ERROR: merge conflict markers found in project code"
  exit 1
fi

echo "== smoke: telemetry ingest route presence guard =="
if ! rg -n "app\\.post\\('/api/telemetry/ingest'|/api/telemetry/ingest|telemetryIngest" server -S >/dev/null; then
  echo "ERROR: telemetry ingest route reference not found under server/"
  exit 1
fi

echo "== smoke: telemetry raw path rule presence guard =="
# Accept common implementations:
# - path.resolve(__dirname, "..", "data", "telemetry", "raw")
# - path.join(..., "data", "telemetry", "raw")
# - string "data/telemetry/raw"
if ! rg -n "\"data\"\\s*,\\s*\"telemetry\"\\s*,\\s*\"raw\"|data/telemetry/raw|telemetry/raw" server -S >/dev/null; then
  echo "ERROR: raw path rule reference not found under server/ (expected data/telemetry/raw or path.resolve/join segments)"
  exit 1
fi

echo "== smoke: share debug CTA helper presence guard =="
if ! rg -n "window\\.__debugCtaPolicyCheckV1\\s*=\\s*function" share.html -S >/dev/null; then
  echo "ERR: debug CTA helper function definition missing"
  exit 1
fi

echo "== smoke: share CTA policy apply-after-finalize guard =="
if ! rg -n "window\\.__applyCtaPolicyV1\\(__ctaPolicyFinalState\\)" share.html -S >/dev/null; then
  echo "ERR: CTA policy apply-after-finalize guard missing"
  exit 1
fi

echo "== smoke: share CTA policy applies in OK state guard =="
if ! rg -n "__ctaPolicyFinalState\\s*=\\s*viewState" share.html -S >/dev/null; then
  echo "ERR: CTA policy OK-state guard missing"
  exit 1
fi

echo "OK: smoke passed"

