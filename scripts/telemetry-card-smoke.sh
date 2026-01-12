#!/usr/bin/env bash
set -euo pipefail

echo "Telemetry Card Smoke Test Helper"
echo "================================"
echo

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "OK: $1"; }

# 1) debug=1 가드 존재 (Share 쪽)
rg -n "Telemetry 요약 카드.*debug=1" share.html >/dev/null \
  || fail "share.html에 debug=1 전용 Telemetry 카드 주석/블록이 없음"

rg -n "new URLSearchParams\\(location\\.search\\)\\.get\\('debug'\\) === '1'" share.html >/dev/null \
  || fail "share.html에 debug=1 감지 로직이 없음(기존 방식 유지 필요)"

ok "debug=1 가드 존재"

# 2) 키 사용 확인
rg -n "__telemetry_meta_v1" core/telemetry.js share.html core/shareTelemetryUI.js >/dev/null \
  || fail "__telemetry_meta_v1 키 사용이 누락됨"

ok "__telemetry_meta_v1 키 사용 확인"

# 3) 금지 키(회귀 위험) 이번 변경에서 만지지 않았는지 정적 확인
if git diff | rg -n "__lastV2|__currentReportId|aeo_state_v2" >/dev/null; then
  fail "이번 diff에서 금지 키(__lastV2/__currentReportId/aeo_state_v2)를 건드린 흔적이 있음"
fi

ok "금지 키 미변경(문자열 기준)"

# 4) debug=0에서 DOM 생성 방지(정적 방어)
if rg -n "telemetrySummaryCard|telemetry-summary-card" share.html >/dev/null; then
  echo "NOTE: 카드 식별자 문자열 존재 → debug=1 블록 내부 생성인지 육안 확인"
else
  echo "NOTE: 카드 식별자 없음 → id/class 하나 고정 추천"
fi

echo
echo "Done!"
