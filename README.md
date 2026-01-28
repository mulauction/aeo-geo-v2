개발 가드레일: [docs/WORKFLOW_GUARDRAILS.md](./docs/WORKFLOW_GUARDRAILS.md)

## 서버 실행

로컬 개발 서버 실행 (정적 파일 + API 서빙):
```bash
cd server
npm run dev
```

서버는 기본적으로 포트 8787에서 실행됩니다 (환경변수 PORT로 변경 가능).
- 정적 파일: http://localhost:8787/
- API: http://localhost:8787/api/fetch/evidence?url=...

## Dev diagnostics
- Telemetry(local) dev-only 진단: [docs/TELEMETRY_LOCAL_DEV_ONLY.md](./docs/TELEMETRY_LOCAL_DEV_ONLY.md)

## Docs
- Reliability/WHY vs Telemetry(local) 경계: [docs/RELIABILITY_VS_TELEMETRY_BOUNDARY.md](./docs/RELIABILITY_VS_TELEMETRY_BOUNDARY.md)
- 
- 

