# Baselines Index (SSOT)

이 문서는 aeo-geo-v2에서 “기준선(tag)”과 “불변 규칙”을 한 곳에서 관리하는 SSOT입니다.

## Recent Baseline Tags

| Tag | Commit | Scope | What it fixes / locks |
|---|---:|---|---|
| phase58-telemetry-debug-gate-stable | a456585 | share.html | Telemetry는 debug=1에서만 노출. EXPIRED 등 meta 없음 상태에서도 UNAVAILABLE fallback으로 섹션 유지 |
| phase59-share-analyze-boundary-ssot | 8d171be | docs | Share ↔ Analyze 경계/정책 문서 SSOT 고정 (진입 경로, viewState 의미, URL SSOT, Telemetry 정책) |
| phase60-share-focus-visible-ui-only | a9d3d76 | share.html (SSOT로 대체됨) | Share 전역 :focus-visible 포커스 링 추가(UI-only) — 이후 a11y.css SSOT로 대체 |
| phase61-share-aria-min-pass | e34669c | share.html | Share 토글에 aria-controls만 추가(aria-expanded는 동기화 불가로 금지) |
| phase62-analyze-focus-visible-ui-only | a48856b | analyze.html (SSOT로 대체됨) | Analyze 전역 :focus-visible 포커스 링 추가(UI-only) — 이후 a11y.css SSOT로 대체 |
| phase63-a11y-min-testcases | 6407c39 | docs | Share/Analyze 접근성 최소 수동 테스트 체크리스트 추가 |
| phase65-a11y-css-ssot-share | eb999ad | core/styles/a11y.css | a11y.css 추가(SSOT 생성) |
| phase65-a11y-css-ssot-share-fix | 7e82f29 | share.html | share.html이 a11y.css를 참조하도록 연결 + 로컬 focus-visible 제거 |
| phase66-a11y-css-ssot-analyze | c1b6bc8 | analyze.html | analyze.html이 a11y.css를 참조하도록 연결 + 로컬 focus-visible 제거 |
| phase67-a11y-css-ssot-complete | c1b6bc8 | share.html + analyze.html + core/styles/a11y.css | Share/Analyze 모두 a11y.css SSOT 사용 완료(통합 기준 태그) |

> Note: 커밋 해시는 “해당 태그가 가리키는 HEAD” 기준입니다.

## Immutable Rules (Do Not Break)

- 점수 계산/저장(localStorage `__lastV2`), `analysis.scores` 스키마, 복원/렌더 파이프라인은 기본적으로 변경 금지(필요 시 별도 Phase로 분리).
- Share URL 파라미터 SSOT: `restore/open`은 `replaceState` 이후에도 보존되어야 함. “현재 열람중” 표시는 SSOT=`reportModel.id` 기준 1개만.
- Telemetry 노출 정책: 기본/restore에서는 비노출, **debug=1에서만** 디버그 용도로 제한 노출.

## Before Starting Next Work (Checklist)

1. `git status --short` 가 clean 인지 확인
2. `bash scripts/smoke.sh` PASS 확인
3. 변경 범위를 “파일/Phase” 단위로 좁혀서 시작(한 번에 한 단계)
4. 완료 시: diff/stat + smoke 출력 포함한 보고서 확보
5. 기준 태그(tag)로 고정 후 다음 작업 진행

## Baseline Tag Hygiene (SSOT)

1) Primary baseline tag
- 항상 “현재 HEAD 기준 통합 태그 1개”만 Primary로 취급한다.
- fix 태그가 생기면, 최종 상태(HEAD)에 통합 태그를 새로 찍고 그걸 Primary로 표에 표시한다.

2) Fix / interim tags
- fix 태그는 삭제하지 않되, BASELINES_INDEX 표에는 “참고(secondary)”로만 남긴다.
- 임시/오타 태그(예: phaseXX)는 발견 즉시 “정식 태그 생성 → 임시 태그 삭제” 절차를 따른다.

3) Update discipline
- 통합 태그를 찍으면, 반드시 BASELINES_INDEX 표를 같은 날 업데이트한다.


