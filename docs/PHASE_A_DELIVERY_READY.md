# Phase A — Delivery-ready Share Report Packaging (Baseline)

This phase improves Share report delivery readiness (Agency handoff ready):
- Share EXPIRED messaging: avoids failure tone; explains local-only limitation clearly.
- Delivery notice block (print-safe): placed under report header.
- Report meta row (print-safe): date/version/target guidance.
- Disclaimer (print-safe): added near footer / before PDF export.

Guardrails:
- No scoring/state/storage changes.
- Share report SSOT and localStorage schema remain unchanged.
- Smoke tests must pass.

Verification checklist:
- bash scripts/smoke.sh => OK
- Browser: Analyze -> "리포트 공유 보기" (backend 3001 off) => neutral alert copy, Share EXPIRED banner copy OK
- Print/PDF: notice + meta on page 1, disclaimer visible, no awkward page splits
