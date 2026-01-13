# CHANGE BUDGETS
# 영역별 변경 허용/금지 규칙

## Generate 영역
### 허용
- generate/*
### 금지
- core/analysis*
- share.html
- core/telemetry*

---

## Share 영역
### 허용
- share.html
- core/share*.js
### 조건
- 점수 계산 로직 접근 금지
- localStorage 구조 변경 금지
### 금지
- analysis.scores
- core/telemetry.js

---

## Telemetry 영역
### 허용
- core/telemetry.js
- server/data/*
### 조건
- UI 변경 금지
- Share 상태 분기 추가 금지

---

## 위반 처리
CHANGE BUDGET 위반 시:
- 즉시 git restore
- 새 브랜치에서 재시도
