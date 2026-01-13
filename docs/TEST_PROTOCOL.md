# TEST PROTOCOL
# 테스트 표준 절차

## 1. Smoke Test (필수)
```bash
bash scripts/smoke.sh
```

## Telemetry rollup 일일 루틴 (Daily)

### 목적
- Telemetry raw(JSONL)를 기반으로 read-only 요약(summary)을 생성한다.
- 이 요약은 운영/관리/리포트에 사용되며 Git에 커밋되지 않는다.

### 실행 주기
- 하루 1회 (cron / CI / 수동 실행 모두 가능)

### 실행 명령
```bash
bash scripts/telemetry-rollup.daily.sh
```
