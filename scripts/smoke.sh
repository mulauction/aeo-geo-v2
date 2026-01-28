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

echo "== smoke: fetch evidence route presence guard =="
if ! rg -n "app\\.post\\('/api/fetch/evidence'|/api/fetch/evidence|fetchEvidence" server -S >/dev/null; then
  echo "ERROR: fetch evidence route reference not found under server/"
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

echo "== smoke: share CTA policy idempotency flag guard =="
if ! rg -n "window\\.__ctaPolicyAppliedV1" share.html -S >/dev/null; then
  echo "ERR: CTA policy idempotency flag missing"
  exit 1
fi

echo "== smoke: share CTA policy idempotency apply guard =="
if ! rg -n -U "window\\.__ctaPolicyAppliedV1\\s*===\\s*true[\\s\\S]{0,220}window\\.__applyCtaPolicyV1\\(__ctaPolicyFinalState\\)|window\\.__ctaPolicyAppliedV1\\s*=\\s*true[\\s\\S]{0,220}window\\.__applyCtaPolicyV1\\(__ctaPolicyFinalState\\)" share.html -S >/dev/null; then
  echo "ERR: CTA policy idempotency apply guard missing"
  exit 1
fi

echo "== smoke: share CTA policy applyCount guard =="
if ! rg -n -U "window\\.__ctaPolicyApplyCountV1|__applyCount\\s*=\\s*__applyCount\\s*\\+\\s*1[\\s\\S]{0,120}window\\.__ctaPolicyApplyCountV1\\s*=\\s*__applyCount[\\s\\S]{0,180}window\\.__applyCtaPolicyV1\\(__ctaPolicyFinalState\\)" share.html -S >/dev/null; then
  echo "ERR: CTA policy applyCount guard missing"
  exit 1
fi

echo "== smoke: share r param numeric parse guard =="
if ! rg -n -U "new URLSearchParams\\(window\\.location\\.search\\)[\\s\\S]{0,220}\\.get\\('r'\\)[\\s\\S]{0,220}/\\^\\\\d\\+\\$/" share.html -S >/dev/null; then
  echo "ERR: share r param numeric parse guard missing"
  exit 1
fi

echo "== smoke: share bootstrap cooldown guard =="
if ! rg -n "__shareBootstrapGuardV1" share.html -S >/dev/null || ! rg -n "skipped \\(cooldown\\)" share.html -S >/dev/null; then
  echo "ERR: share bootstrap cooldown guard missing"
  exit 1
fi

echo "== smoke: share debug log grouping guard =="
if ! rg -n "console\\.groupCollapsed" share.html -S >/dev/null || ! rg -n "\\[Share bootstrap\\]" share.html -S >/dev/null; then
  echo "ERR: share debug log grouping guard missing"
  exit 1
fi

echo "== smoke: share telemetry mount id duplication guard =="
telemetry_summary_mount_count="$(rg -n "mount\\.id = 'telemetrySummaryCard'" share.html -S | wc -l | tr -d ' ')"
telemetry_local_mount_count="$(rg -n "mountLocal\\.id = 'telemetryLocalSummary'" share.html -S | wc -l | tr -d ' ')"
if [ "${telemetry_summary_mount_count}" != "1" ] || [ "${telemetry_local_mount_count}" != "1" ]; then
  echo "FAIL: telemetry mount id duplication guard"
  echo "  telemetrySummaryCard mount.id count=${telemetry_summary_mount_count} (expected 1)"
  echo "  telemetryLocalSummary mountLocal.id count=${telemetry_local_mount_count} (expected 1)"
  exit 1
fi
echo "OK: telemetry mount id duplication guard"

echo "== smoke: share restore/open preserve guard =="
restore_open_set_count="$( (rg -n "q\\.set\\(\\s*('open'|\"open\")\\s*," share.html -S || true) | wc -l | tr -d ' ' )"
restore_open_delete_count="$( (rg -n "q\\.delete\\(\\s*('open'|\"open\")\\s*\\)" share.html -S || true) | wc -l | tr -d ' ' )"
if [ "${restore_open_set_count}" -lt "1" ]; then
  echo "FAIL: restore/open preserve guard (missing q.set('open', ...))"
  exit 1
fi
if [ "${restore_open_delete_count}" != "0" ]; then
  echo "FAIL: restore/open preserve guard (q.delete('open') found)"
  exit 1
fi
echo "OK: restore/open preserve guard"

echo "== smoke: print ssot keywords guard =="
if ! rg -n "shouldForcePrintSSOT" share.html -S >/dev/null; then
  echo "FAIL: shouldForcePrintSSOT missing"
  exit 1
fi
if ! rg -n "is-printing" share.html -S >/dev/null; then
  echo "FAIL: is-printing missing"
  exit 1
fi
if ! rg -n "beforeprint" share.html -S >/dev/null; then
  echo "FAIL: beforeprint missing"
  exit 1
fi
if ! rg -n "onafterprint" share.html -S >/dev/null; then
  echo "FAIL: onafterprint missing"
  exit 1
fi
echo "OK: print ssot keywords guard"

echo "== smoke: phase79 next-action guide guard =="
if ! rg -n "공유는 링크 복사, 보관은 PDF 저장이 편합니다\\." share.html -S >/dev/null; then
  echo "FAIL: phase79 next-action guide missing: 공유는 링크 복사, 보관은 PDF 저장이 편합니다."
  exit 1
fi
if ! rg -n "이 상태에서는 최근 리포트를 열거나 다시 분석할 수 있습니다\\." share.html -S >/dev/null; then
  echo "FAIL: phase79 next-action guide missing: 이 상태에서는 최근 리포트를 열거나 다시 분석할 수 있습니다."
  exit 1
fi
echo "OK: phase79 next-action guide guard"

echo "== smoke: share action-card anchor uniqueness guard =="
anchor_generate_count="$(rg -n 'id="anchor-generate"' share.html | wc -l | tr -d ' ')"
anchor_why_panel_count="$(rg -n 'id="anchor-why-panel"' share.html | wc -l | tr -d ' ')"
if [ "${anchor_generate_count}" != "1" ]; then
  echo "FAIL: anchor-generate id count=${anchor_generate_count} (expected 1)"
  exit 1
fi
if [ "${anchor_why_panel_count}" != "1" ]; then
  echo "FAIL: anchor-why-panel id count=${anchor_why_panel_count} (expected 1)"
  exit 1
fi
echo "OK: share action-card anchor uniqueness guard"

echo "OK: smoke passed"


echo "== smoke: share recent reports sort stabilization guard =="
if ! rg -n -U "createdAt\\s*\\?\\?\\s*.*generatedAt\\s*\\?\\?\\s*.*null" share.html -S >/dev/null; then
  echo "ERR: missing recent reports sort stabilization comparator (createdAt ?? generatedAt ?? null)"
  exit 1
fi

echo "== smoke: share recent reports normalize guard =="
if ! rg -n "normalizeRecentReports|\\[share\\] recent normalize" share.html -S >/dev/null; then
  echo "FAIL: recent reports normalize guard missing"
  exit 1
fi
echo "OK: recent reports normalize guard present"

echo "OK: smoke passed"
