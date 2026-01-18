# Phase 98 — Release Judgement (dev-only)

Dev-only funnel tooling: before/after snapshot compare + repeated-run release judgement + machine-friendly outputs.
No UI output; designed for console and CI/scripts to read a stable PASS/FAIL/INSUFFICIENT signal.

## Keys
- BEFORE_KEY="__funnel_snapshot_before_v1"
- JUDGE_KEY="__funnel_judgement_runs_v1"

## Console entrypoints (copy/paste)
- `__debugTelemetryFunnel()` (or `_debugTelemetryFunnel()`)
- `__debugTelemetryReleaseLine()` → returns `PASS|FAIL|INSUFFICIENT`
- `__debugTelemetryReleaseJSON()` → returns `{status, summary, stats}`

## Reset helpers
- `__resetFunnelSnapshotBeforeV1()`
- `__resetFunnelJudgementRunsV1()`

## Default judgement thresholds
- `minComparable=5`, `passRate=0.6`
- Comparable requires `sessions>=30` in `compareFunnelSnapshots()`

## Suggested operational loop (3 steps)
1) Reset runs + reset baseline: `__resetFunnelJudgementRunsV1(); __resetFunnelSnapshotBeforeV1();`
2) Run once to capture baseline (before): `__debugTelemetryFunnel()` (summary shows baseline saved)
3) Deploy/change, then accumulate runs via repeated `__debugTelemetryFunnel()`, and gate on `__debugTelemetryReleaseLine()`

