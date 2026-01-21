# Share 화면 액션 카드 스크롤 기능

## 개요

Share 화면의 액션 카드(QUICK ACTIONS / NEXT STEPS / ADVANCED) 클릭 시 해당 섹션으로 스크롤 이동하는 기능입니다. 사용자가 "지금 뭘 먼저 고치면 되는데?"를 즉시 이해할 수 있도록 안내합니다.

## 구현 이력

- **Phase 117**: Action Line 1줄 추가 (WHY Top3 + Improvements Top3 종합)
- **Phase 118**: Action Line에 출처 연결 추가 (툴팁)
- **Phase 119**: Action Line 톤 정규화 (Reliability 레벨 기반)
- **Phase 120**: Action Line 클릭 → 해당 섹션으로 스크롤 이동
- **Phase 121**: 모든 스크롤 점프를 정확한 위치로 통일 (scrollToElWithOffset)
- **Phase 123-124**: 액션 카드 클릭 시 스크롤 목적지 정확히 고정
- **Phase 125**: scrollIntoView로 통일 (offset 계산 문제 해결)
- **Phase 126**: 토스트 메시지 추가 (이동 체감 개선)

## 기능 상세

### 액션 카드 타입별 스크롤 매핑

| 카드 타입 | 이동 대상 | 앵커 ID |
|---------|---------|---------|
| QUICK ACTIONS | Generate 섹션 ("콘텐츠 생성으로 점수 개선하기") | `#anchor-generate` |
| NEXT STEPS | 신뢰도 판단 근거 섹션 | `#anchor-why-panel` (없으면 `#anchor-generate`로 폴백) |
| ADVANCED | Generate 섹션 ("콘텐츠 생성으로 점수 개선하기") | `#anchor-generate` |

### 스크롤 동작

- **방식**: `Element.scrollIntoView({ behavior: 'smooth', block: 'start' })`
- **정렬**: 헤더를 뷰포트 최상단에 정확히 정렬
- **접근성**: `prefers-reduced-motion` 감지 시 `behavior: 'auto'` 사용

### 사용자 피드백

1. **토스트 메시지** (0.9초 표시)
   - QUICK/ADVANCED: "Generate 섹션으로 이동"
   - NEXT: "신뢰도 판단 근거로 이동" (폴백 시 "Generate 섹션으로 이동")

2. **하이라이트 효과** (800ms)
   - 스크롤 완료 후 대상 헤더에 노란색 배경/왼쪽 테두리 적용
   - 인쇄 시 완전히 숨김 (`@media print`)

### 기술 구현

- **이벤트 바인딩**: Document delegation (캡처 단계, `addEventListener('click', ..., true)`)
- **Idempotent 가드**: `document.__actionCardsDelegatedBound` 플래그로 중복 바인딩 방지
- **타이밍 보강**: `resolveScrollTarget` 함수에서 `requestAnimationFrame`으로 DOM 렌더링 대기
- **앵커 고유성**: smoke 테스트로 `id="anchor-generate"`, `id="anchor-why-panel"` 각각 1개만 존재 보장

### 제약사항

- **파일 범위**: `share.html` only
- **변경 금지**: localStorage 스키마, 점수 계산, restore/open 파이프라인, CTA 정책, telemetry, print SSOT
- **인쇄 동작**: 토스트 및 하이라이트는 인쇄 시 완전히 숨김

## 수동 테스트 체크리스트

1. `/share.html?restore=1&debug=1` 열고 QUICK 클릭 → Generate 섹션 제목이 화면 최상단에 정확히 붙고 토스트 "Generate 섹션으로 이동" 표시
2. NEXT 클릭 → "신뢰도 판단 근거" 제목이 화면 최상단에 정확히 붙고 토스트 "신뢰도 판단 근거로 이동" 표시
3. ADVANCED 클릭 → Generate 섹션으로 이동하고 토스트 "Generate 섹션으로 이동" 표시
4. 각 클릭 시 하이라이트 효과가 정확한 헤더에만 적용되는지 확인 (엉뚱한 위치에서 반짝이지 않음)
5. 인쇄 미리보기에서 토스트와 하이라이트가 보이지 않는지 확인
6. 콘솔에 `[scroll]` 로그가 각 클릭마다 1회씩만 출력되는지 확인 (중복 바인딩 없음)
