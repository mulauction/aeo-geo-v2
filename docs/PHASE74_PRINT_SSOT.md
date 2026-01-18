# Phase 74 — Print SSOT (Share PDF/⌘P 안정화)

## 1) 문제 배경
Share 화면에서 PDF로 내보내기/⌘P(브라우저 인쇄) 시, **Non-OK 상태(NO_REPORT/OTHER_DEVICE/EXPIRED/FETCH_FAIL/INVALID_ID)** 에서도
이전에 생성된 **OK 리포트의 멀티페이지 레이아웃이 섞여 출력**되는 문제가 있었다.
원인은 “현재 화면 상태”가 아니라 **DOM 존재 여부/스타일 힌트** 같은 간접 신호(legacy inference)에 의해 인쇄 CSS가 흔들리는 경우가 있었기 때문이다.

## 2) 최종 규칙(SSOT)
인쇄 레이아웃 결정의 단일 기준(SSOT)은 아래 2가지다.

- **(A) Share 상태**: body[data-share-state]
- **(B) 인쇄 실행 여부**: html.is-printing (beforeprint로 on, afterprint로 off)

### 상태별 규칙
- **OK 상태**: 멀티페이지 유지
- **Non-OK 상태**(NO_REPORT / OTHER_DEVICE / EXPIRED / FETCH_FAIL / INVALID_ID): **무조건 1페이지(SSOT)**

## 3) 동작 매트릭스 (버튼 vs ⌘P)
| 구분 | OK(Analyze → Share) | Non-OK(에러/만료/다른기기/없음) |
|---|---|---|
| PDF로 내보내기 버튼 | 멀티페이지 유지 | 1페이지 SSOT |
| ⌘P / 브라우저 인쇄 | 멀티페이지 유지 | 1페이지 SSOT |

## 4) 기술 포인트
### 4.1 shouldForcePrintSSOT()
Non-OK 상태를 명시적으로 판정해 “1페이지 SSOT 강제” 여부를 결정한다.
- infer/heuristic 기반이 아니라 **명시적 상태 기반**이어야 한다.

### 4.2 html.is-printing
인쇄 모드 진입/종료를 SSOT로 고정하기 위한 토글 플래그.
- beforeprint에서 `document.documentElement.classList.add('is-printing')`
- afterprint(onafterprint)에서 `document.documentElement.classList.remove('is-printing')`

### 4.3 beforeprint / onafterprint
- beforeprint: 인쇄 진입 시점에 **is-printing ON**
- onafterprint: 인쇄 종료 시점에 **is-printing OFF**
- afterprint 이후 `html.is-printing`이 남아있지 않아야 한다(후속 렌더/상태 전환 오염 방지)

## 5) 회귀 방지 (Smoke Guard)
Phase 74-B에서 Non-OK 1페이지 SSOT를 구성하는 핵심 키워드가 share.html에서 제거/변형되면
다시 “Non-OK에 OK 멀티페이지가 섞이는” 회귀가 발생할 수 있다.

이를 방지하기 위해 `scripts/smoke.sh`에 정적 가드를 추가했다.

### 5.1 Print SSOT 키워드 가드
smoke에서 `rg`로 아래 키워드가 share.html에 존재하는지 검사한다.
- shouldForcePrintSSOT
- is-printing
- beforeprint
- onafterprint

하나라도 누락되면 즉시 FAIL 처리하여 회귀를 조기에 차단한다.

## 6) 변경/금지 규칙
- 태그 `phase74-b-print-ssot-nonok-cmdp-stable` 이후: Phase 74(print SSOT) 로직 변경 금지
- 태그 `phase74-guard-print-ssot-smoke-stable`: print SSOT 회귀 가드 기준선 (smoke.sh only)

