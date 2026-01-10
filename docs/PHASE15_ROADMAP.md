# Phase 15 로드맵

이 문서는 Phase 15의 목표, 제약사항, 그리고 종료 조건을 정의합니다.

---

## 1. Phase 15 목표

Phase 15는 제품 원칙을 확립하고, Analyze/Generate/Amplify의 엄격한 분리를 보장하는 단계입니다.

**주요 목표**:
1. ✅ 제품 원칙 문서화 (PRODUCT_PRINCIPLES.md)
2. ✅ Score mutation 로직에 Guardrail 주석 추가
3. ✅ UI 카피를 통한 사용자 안내 명확화
4. ✅ Generate/Amplify가 점수에 영향을 주지 않음을 보장

---

## 2. DO (해야 할 것)

### 2.1 문서화
- ✅ [PRODUCT_PRINCIPLES.md](./PRODUCT_PRINCIPLES.md) 작성
- ✅ [PHASE15_ROADMAP.md](./PHASE15_ROADMAP.md) 작성
- ✅ Score mutation 로직 주변에 Guardrail 주석 추가

### 2.2 코드 가드레일
- ✅ Score를 변경할 수 있는 위치에 명시적 주석 추가
- ✅ Generate 코드에 "점수 변경 금지" 주석 추가
- ✅ Amplify 코드에 "점수 변경 금지" 주석 추가

### 2.3 UI 카피 개선
- ✅ Analyze = 관찰 및 점수 계산임을 명시
- ✅ Generate = 콘텐츠 생성만 수행함을 명시
- ✅ Amplify = 실행/로깅만 수행함을 명시
- ✅ "생성된 콘텐츠는 점수에 영향을 주지 않습니다" 문구 추가

---

## 3. DO NOT (하지 말아야 할 것)

### 3.1 기능 개발 금지
- ❌ 새로운 기능 추가 금지
- ❌ 기존 기능 확장 금지
- ❌ 새로운 분석 엔진 추가 금지

### 3.2 점수 로직 변경 금지
- ❌ Score 계산 로직 변경 금지
- ❌ Score 저장 방식 변경 금지
- ❌ Score 재계산 로직 추가 금지

### 3.3 단계 간 결합 금지
- ❌ Generate가 Analyze 점수를 읽는 로직 추가 금지
- ❌ Amplify가 점수를 재계산하는 로직 추가 금지
- ❌ 단계 간 직접적인 데이터 흐름 생성 금지

### 3.4 실시간/대량 처리 금지
- ❌ 실시간 점수 재계산 기능 추가 금지
- ❌ 대량 콘텐츠 배치 분석 기능 추가 금지
- ❌ 자동화된 주기적 점수 업데이트 기능 추가 금지

---

## 4. Phase 15 종료 조건

Phase 15는 다음 조건을 모두 만족할 때 종료됩니다:

### 4.1 문서화 완료
- [ ] [PRODUCT_PRINCIPLES.md](./PRODUCT_PRINCIPLES.md) 작성 완료
- [ ] [PHASE15_ROADMAP.md](./PHASE15_ROADMAP.md) 작성 완료
- [ ] 모든 문서가 최신 상태로 유지됨

### 4.2 Guardrail 주석 추가 완료
- [ ] Score mutation 로직 주변에 Guardrail 주석 추가됨
- [ ] Generate 코드에 "점수 변경 금지" 주석 추가됨
- [ ] Amplify 코드에 "점수 변경 금지" 주석 추가됨
- [ ] 모든 주석이 명확하고 이해하기 쉬움

### 4.3 UI 카피 개선 완료
- [ ] Analyze 화면에 "관찰 및 점수 계산" 문구 추가됨
- [ ] Generate 화면에 "콘텐츠 생성만 수행" 문구 추가됨
- [ ] Amplify 화면에 "실행/로깅만 수행" 문구 추가됨
- [ ] "생성된 콘텐츠는 점수에 영향을 주지 않습니다" 문구가 적절한 위치에 추가됨

### 4.4 코드 검증 완료
- [ ] Generate 코드에서 score mutation 로직이 없음을 확인
- [ ] Amplify 코드에서 score mutation 로직이 없음을 확인
- [ ] 모든 score mutation이 Analyze 단계에서만 발생함을 확인

---

## 5. Phase 15 이후 (Phase 16+)

Phase 15 종료 후에는 다음 단계로 진행할 수 있습니다:

- Phase 16: 새로운 기능 개발 (제품 원칙 준수)
- Phase 17: 성능 최적화
- Phase 18: 사용자 피드백 반영

**중요**: Phase 16 이후의 모든 개발은 [PRODUCT_PRINCIPLES.md](./PRODUCT_PRINCIPLES.md)의 원칙을 준수해야 합니다.

---

## 6. 관련 문서

- [PRODUCT_PRINCIPLES.md](./PRODUCT_PRINCIPLES.md): 제품 원칙
- [WORKFLOW_GUARDRAILS.md](./WORKFLOW_GUARDRAILS.md): 개발 워크플로우 가드레일

---

**문서 생성일**: 2024년
**최종 수정일**: 2024년
**버전**: 1.0

