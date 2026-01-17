# Share Restore/Open + Telemetry (Regression Notes)

## Background

Share has two related entry modes:

- `?restore=1`: **Recent Reports list mode** (user selects a report from the list)
- `?restore=1&open=<digits>`: **Open-one mode** (must open the specific report; showing only the list is a bug)

## Expected Behavior (Definition)

### `?restore=1`
- Shows the **Recent Reports list** UI.
- Each row’s **열기** must open the chosen report (report body renders).

### `?restore=1&open=<digits>`
- Must render **that one report body immediately**.
- If it shows only the list (or falls back to NO_REPORT), treat as regression.
- URL should remain stable across refresh / back-forward (restore/open params preserved as applicable).

## Manual Test Procedure (User View, ~5 lines)

1. Navigate to `share.html?restore=1&debug=1`.
2. Confirm **최근 리포트** list is visible.
3. Click **열기** on a row → URL becomes `share.html?restore=1&open=<digits>&debug=1` and report body renders.
4. Refresh / back / forward → the same report body should still render (not list-only).
5. Navigate to `share.html?restore=1` (no open) → list should render as usual.

## Telemetry (debug) Notes

### Remote fetch policy
- Default: **remote fetch disabled** (Share must not break even if endpoint 404s).
- Enable fetch only with `telemetry=1` (dev-only):
  - `share.html?restore=1&debug=1&telemetry=1`

### Duplicate render guard
- In `share.html?debug=1`, Telemetry(debug) + Telemetry(local) blocks must exist as **exactly 1 set**.
- If pageshow/visibilitychange re-init causes multiple sets to appear, that is a regression.

## Debug-only Observability (Expected Logs)

When `debug=1` and user clicks **열기** in Recent Reports:
- `[share][openRecent] picked ...`
- `[share][openRecent] wrote __lastV2 ...`
- `[share][openRecent] navigate ...`


