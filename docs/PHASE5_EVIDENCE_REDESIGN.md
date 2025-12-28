# Phase5 Evidence 재설계 스펙

## 1. 전제 조건

### 1.1 Baseline 준수
이 문서는 **[PHASE4_2_BASELINE.md](./PHASE4_2_BASELINE.md)**의 모든 규칙을 전제로 한다.

- Baseline 브랜치: `reset/phase4-2-safe`
- Baseline 커밋: `20a2ea3f04c5cb6c150681354fd71c7c7a0e4eb0`
- Phase5 작업은 별도 브랜치(`feat/phase5-evidence` 등)에서만 수행

### 1.2 핵심 원칙
**기존 분석/저장/복원/렌더링 경로를 절대 건드리지 않는다.**

---

## 2. 목적 및 비목적 (Non-goals)

### 2.1 목적

**Phase5 Evidence의 목적:**
- 분석 결과에 대한 상세한 근거(Evidence) 정보를 제공
- 사용자가 점수 산정 근거를 더 명확히 이해할 수 있도록 지원
- 기존 점수 시스템과 독립적으로 Evidence 데이터를 관리

### 2.2 비목적 (절대 금지)

**다음 항목들은 Phase5의 목적이 아니며, 절대 수행하지 않는다:**

- ❌ 기존 분석 파이프라인 변경
  - `core/actions.js`의 분석 실행 로직 변경 금지
  - `core/analyzers/contentStructureV2.js`의 점수 계산 로직 변경 금지
  - 기존 점수 계산 함수의 시그니처 변경 금지

- ❌ 기존 저장 파이프라인 변경
  - `core/state.js`의 `setState()` 로직 변경 금지
  - `normalizeAnalysisScores()` 함수 변경 금지
  - 기존 localStorage 저장 로직 변경 금지

- ❌ 기존 복원 파이프라인 변경
  - `core/state.js`의 `loadFromStorage()` 로직 변경 금지
  - 페이지 로드 시 상태 복원 로직 변경 금지

- ❌ 기존 렌더링 파이프라인 변경
  - `core/view.js`의 `render()` 함수 구조 변경 금지
  - 기존 KPI 섹션 렌더링 로직 변경 금지
  - 기존 결과 섹션 렌더링 순서 변경 금지

- ❌ `analysis.scores` 스키마 변경
  - `branding`, `contentStructureV2`, `urlStructureV1` 슬롯 변경 금지
  - 기존 점수 객체 구조 변경 금지
  - 점수 정규화 로직 변경 금지

- ❌ `share.html` 기준 리포트 변경
  - Share 화면의 리포트 렌더링 구조 변경 금지
  - KPI 섹션 레이아웃 변경 금지
  - PDF 인쇄 스타일 변경 금지
  - 기존 리포트 섹션 순서 변경 금지

- ❌ 접근 제어 로직 변경
  - `core/gate.js`의 기존 함수 시그니처 변경 금지
  - 기존 권한 판단 로직 변경 금지

---

## 3. 아키텍처 원칙

### 3.1 Read-only 확장 원칙

**기존 코드는 읽기 전용으로 취급한다.**

- ✅ 기존 함수를 호출하여 데이터를 읽는 것은 허용
- ✅ 기존 함수의 반환값을 활용하는 것은 허용
- ❌ 기존 함수의 내부 로직을 수정하는 것은 금지
- ❌ 기존 함수의 시그니처를 변경하는 것은 금지
- ❌ 기존 함수를 삭제하거나 대체하는 것은 금지

**예시:**
- ✅ `getState()`를 호출하여 기존 상태를 읽기
- ✅ `buildReportPayload()`를 호출하여 리포트 데이터 가져오기
- ❌ `setState()` 내부 로직을 수정하여 Evidence 저장 로직 추가
- ❌ `render()` 함수를 수정하여 기존 섹션 구조 변경

### 3.2 별도 네임스페이스 저장 원칙

**Evidence 데이터는 기존 데이터와 완전히 분리된 네임스페이스에 저장한다.**

- Evidence 데이터는 `analysis.evidence` 네임스페이스에 저장
- 기존 `analysis.scores`와는 독립적으로 관리
- Evidence 데이터가 없어도 기존 기능은 정상 동작해야 함

**네임스페이스 구조:**
```javascript
{
  analysis: {
    scores: { ... },        // 기존 (변경 금지)
    evidence: { ... }       // 신규 (Evidence 전용)
  }
}
```

### 3.3 UI 부가 섹션 원칙

**Evidence UI는 기존 UI에 부가 섹션으로만 추가한다.**

- ✅ 기존 섹션 뒤에 새로운 Evidence 섹션 추가
- ✅ 기존 섹션과 독립적인 별도 섹션으로 구성
- ❌ 기존 섹션 내부에 Evidence 내용 삽입
- ❌ 기존 섹션의 순서나 구조 변경
- ❌ 기존 섹션의 스타일이나 레이아웃 변경

**렌더링 순서 (변경 금지):**
1. KPI 섹션 (기존)
2. 리포트 공유 보기 버튼 (기존)
3. 개선안 생성 버튼 (기존)
4. 점수/등급 표시 (기존)
5. 근거 목록 (기존)
6. 액션 목록 (기존)
7. **Evidence 섹션 (신규, 여기에만 추가)**

---

## 4. 데이터 모델

### 4.1 Evidence 데이터 구조 (초안)

**Evidence 객체의 최소 필드:**

```typescript
interface Evidence {
  id: string;                    // 고유 식별자 (UUID)
  createdAt: number;              // 생성 시각 (Unix timestamp)
  source: string;                 // Evidence 출처 ('contentStructureV2', 'urlStructureV1' 등)
  items: EvidenceItem[];         // Evidence 항목 배열
  summary?: string;               // Evidence 요약 (선택)
}

interface EvidenceItem {
  type: string;                   // 항목 타입 ('missing', 'found', 'warning' 등)
  description: string;            // 항목 설명
  location?: string;              // 위치 정보 (선택)
  severity?: 'low' | 'medium' | 'high';  // 심각도 (선택)
}
```

### 4.2 기존 analysis와의 분리 전략

**분리 원칙:**
- `analysis.scores`는 점수 데이터만 포함 (변경 금지)
- `analysis.evidence`는 Evidence 데이터만 포함 (신규)
- 두 네임스페이스는 독립적으로 저장/로드/렌더링

**저장 구조:**
```javascript
{
  analysis: {
    scores: {
      branding: { score: 85, grade: 'A', ... },
      contentStructureV2: { score: 72, grade: 'B', ... },
      urlStructureV1: { score: null, ... }
    },
    evidence: {
      contentStructureV2: {
        id: 'evt-xxx',
        createdAt: 1234567890,
        source: 'contentStructureV2',
        items: [ ... ],
        summary: '...'
      }
    }
  }
}
```

**독립성 보장:**
- Evidence가 없어도 `scores`는 정상 동작
- `scores`가 없어도 Evidence는 독립적으로 저장 가능
- Evidence 계산 실패 시 `scores` 계산에는 영향 없음

---

## 5. 저장 전략

### 5.1 localStorage 키 분리

**기존 키는 절대 변경하지 않는다.**

**기존 키 (변경 금지):**
- `aeo_state_v2`: 분석 결과 상태
- `aeo_auth_v1`: 인증 상태
- `aeo_credit_v1`: 크레딧 상태

**신규 키 (Evidence 전용):**
- `aeo_evidence_v1`: Evidence 데이터 전용 저장소

**키 분리 이유:**
- 기존 키의 스키마 변경을 완전히 방지
- Evidence 데이터가 없어도 기존 기능 정상 동작 보장
- Evidence 데이터만 독립적으로 관리 가능

### 5.2 저장 로직 원칙

**기존 저장 로직은 절대 수정하지 않는다.**

- ❌ `core/state.js`의 `setState()` 함수 수정 금지
- ❌ `core/state.js`의 `saveToStorage()` 함수 수정 금지
- ❌ 기존 localStorage 저장 로직 변경 금지

**Evidence 저장 방식:**
- 별도 함수로 Evidence만 저장 (`saveEvidence()` 등)
- 기존 `setState()` 호출과 독립적으로 실행
- Evidence 저장 실패 시 기존 분석 결과에는 영향 없음

**저장 시점:**
- 분석 완료 후 Evidence 계산
- Evidence 계산 성공 시에만 별도 저장
- 기존 분석 결과 저장과는 독립적으로 실행

### 5.3 복원 로직 원칙

**기존 복원 로직은 절대 수정하지 않는다.**

- ❌ `core/state.js`의 `loadFromStorage()` 함수 수정 금지
- ❌ 페이지 로드 시 상태 복원 로직 변경 금지

**Evidence 복원 방식:**
- 별도 함수로 Evidence만 복원 (`loadEvidence()` 등)
- 기존 상태 복원과 독립적으로 실행
- Evidence 복원 실패 시 기존 기능은 정상 동작

---

## 6. 렌더링 전략

### 6.1 Analyze 화면 렌더링

**기존 렌더링 로직은 절대 수정하지 않는다.**

- ❌ `core/view.js`의 `render()` 함수 구조 변경 금지
- ❌ 기존 섹션 렌더링 로직 변경 금지
- ❌ 기존 섹션 순서 변경 금지

**Evidence 추가 렌더링:**
- 기존 `render()` 함수 호출 후 별도 함수로 Evidence 섹션 추가
- Evidence 섹션은 기존 결과 섹션 뒤에만 추가
- Evidence가 없으면 섹션 자체를 렌더링하지 않음

**렌더링 순서 (변경 금지):**
1. 기존 `render()` 함수 실행 (KPI, 점수, 근거, 액션 등)
2. Evidence 섹션 추가 렌더링 (별도 함수)

**구현 예시:**
```javascript
// 기존 렌더링 (변경 금지)
render(root, getState());

// Evidence 추가 렌더링 (신규)
if (hasEvidence()) {
  renderEvidenceSection(root, getEvidence());
}
```

### 6.2 Share 화면 렌더링

**기존 리포트 렌더링 구조는 절대 변경하지 않는다.**

- ❌ `share.html`의 리포트 렌더링 구조 변경 금지
- ❌ KPI 섹션 레이아웃 변경 금지
- ❌ PDF 인쇄 스타일 변경 금지

**Evidence 추가 렌더링:**
- 기존 리포트 렌더링 완료 후 Evidence 섹션 추가
- Evidence 섹션은 기존 리포트 내용 뒤에만 추가
- PDF 인쇄 시 Evidence 섹션도 포함되도록 스타일 적용 (기존 스타일 변경 없이)

**렌더링 순서 (변경 금지):**
1. KPI 섹션 렌더링 (기존)
2. 콘텐츠 구조 점수 근거 섹션 (기존)
3. 결과 섹션 (기존)
4. **Evidence 섹션 (신규, 여기에만 추가)**

### 6.3 기존 섹션 변경 금지

**다음 항목들은 절대 변경하지 않는다:**

- ❌ 기존 섹션의 HTML 구조 변경 금지
- ❌ 기존 섹션의 CSS 클래스명 변경 금지
- ❌ 기존 섹션의 DOM 순서 변경 금지
- ❌ 기존 섹션의 스타일 변경 금지
- ❌ 기존 섹션의 내용 포맷 변경 금지

**허용되는 변경:**
- ✅ 기존 섹션 뒤에 새로운 Evidence 섹션 추가
- ✅ Evidence 섹션에만 적용되는 새로운 CSS 클래스 추가
- ✅ Evidence 섹션에만 적용되는 새로운 스타일 추가

---

## 7. 접근 제어 연동

### 7.1 Gate 모듈 사용 원칙

**모든 권한 판단은 `core/gate.js`를 통해서만 수행한다.**

- ✅ `isLoggedIn()` 함수로 로그인 상태 확인
- ✅ `requireLogin()` 함수로 로그인 필요 시 모달 표시
- ✅ `gateOrWarn()` 함수로 간단한 권한 체크
- ❌ `gate.js` 외부에서 권한 판단 로직 추가 금지
- ❌ `localStorage`를 직접 읽어 권한 판단 금지
- ❌ 중복된 권한 체크 로직 추가 금지

### 7.2 Evidence 접근 제어

**Evidence는 로그인 사용자에게만 표시한다.**

- 로그인 상태: Evidence 섹션 표시
- 로그아웃 상태: Evidence 섹션 숨김 또는 렌더링하지 않음

**구현 방식:**
```javascript
// Gate 모듈 사용 (중복 분기 금지)
if (isLoggedIn() && hasEvidence()) {
  renderEvidenceSection(root, getEvidence());
}
```

**금지 사항:**
- ❌ Evidence 렌더링 함수 내부에서 별도 로그인 체크 추가 금지
- ❌ `gate.js`를 우회하여 권한 판단 금지
- ❌ Evidence 접근을 위한 새로운 권한 규칙 추가 금지 (기존 Gate 함수만 사용)

### 7.3 중복 분기 금지

**권한 체크는 Gate 모듈에서만 수행한다.**

- ❌ Evidence 렌더링 로직에 별도 로그인 체크 추가 금지
- ❌ Evidence 저장 로직에 별도 권한 체크 추가 금지
- ❌ Evidence 복원 로직에 별도 권한 체크 추가 금지

**올바른 방식:**
- Evidence 렌더링 전에 `isLoggedIn()` 체크 (Gate 모듈 사용)
- Evidence 저장/복원은 권한 체크 없이 실행 (기존 분석 결과와 동일하게)

---

## 8. Do / Don't 명시

### 8.1 Do (허용되는 작업)

**아키텍처:**
- ✅ 기존 함수를 호출하여 데이터 읽기
- ✅ 새로운 함수 추가 (기존 함수 수정 없이)
- ✅ 새로운 네임스페이스(`analysis.evidence`) 사용
- ✅ 새로운 localStorage 키(`aeo_evidence_v1`) 추가

**데이터:**
- ✅ Evidence 데이터를 별도 네임스페이스에 저장
- ✅ Evidence 데이터를 독립적으로 관리
- ✅ Evidence 계산 실패 시 기존 분석 결과는 정상 저장

**렌더링:**
- ✅ 기존 섹션 뒤에 Evidence 섹션 추가
- ✅ Evidence 섹션에만 적용되는 새로운 스타일 추가
- ✅ Evidence가 없으면 섹션을 렌더링하지 않음

**접근 제어:**
- ✅ `gate.js`의 기존 함수(`isLoggedIn()` 등) 사용
- ✅ 로그인 상태에서만 Evidence 표시

### 8.2 Don't (절대 금지)

**아키텍처:**
- ❌ 기존 함수의 내부 로직 수정
- ❌ 기존 함수의 시그니처 변경
- ❌ 기존 함수 삭제 또는 대체
- ❌ 기존 네임스페이스(`analysis.scores`) 변경

**데이터:**
- ❌ `analysis.scores` 스키마 변경
- ❌ 기존 점수 계산 로직 변경
- ❌ 기존 localStorage 키 스키마 변경
- ❌ 기존 저장/복원 로직 변경

**렌더링:**
- ❌ 기존 섹션의 HTML 구조 변경
- ❌ 기존 섹션의 순서 변경
- ❌ 기존 섹션의 스타일 변경
- ❌ 기존 섹션 내부에 Evidence 내용 삽입

**접근 제어:**
- ❌ `gate.js` 외부에서 권한 판단 로직 추가
- ❌ 중복된 권한 체크 로직 추가
- ❌ Evidence 전용 권한 규칙 추가 (기존 Gate 함수만 사용)

**파이프라인:**
- ❌ 분석 → 저장 → 복원 → 렌더링 파이프라인 변경
- ❌ `setState()` 로직 변경
- ❌ `render()` 함수 구조 변경

---

## 9. 테스트 및 회귀 체크리스트

### 9.1 Phase4-2 Baseline 체크리스트 (필수)

**모든 Phase4-2 Baseline 체크리스트 항목을 통과해야 한다.**

**[PHASE4_2_BASELINE.md](./PHASE4_2_BASELINE.md)의 "6. 회귀 방지 체크리스트" 섹션 참조**

**핵심 확인 항목:**
- [ ] 로그아웃 상태에서 Analyze 버튼 클릭 시 로그인 모달이 표시되는가?
- [ ] 로그아웃 상태에서 Share 화면 접근 시 로그인 안내 화면이 표시되는가?
- [ ] 로그인 상태에서 모든 기능이 정상 동작하는가?
- [ ] 첫 로그인 시 10 크레딧이 지급되는가?
- [ ] 새로고침 후에도 로그인 상태가 유지되는가?
- [ ] 기존 분석 결과가 정상적으로 저장/복원되는가?
- [ ] 기존 리포트 렌더링이 정상 동작하는가?

### 9.2 Evidence 추가 체크리스트

**Evidence 기능 자체에 대한 체크리스트:**

**데이터 저장/복원:**
- [ ] Evidence 데이터가 별도 키(`aeo_evidence_v1`)에 저장되는가?
- [ ] 기존 키(`aeo_state_v2`)의 스키마가 변경되지 않았는가?
- [ ] Evidence 저장 실패 시 기존 분석 결과는 정상 저장되는가?
- [ ] Evidence 복원 실패 시 기존 기능은 정상 동작하는가?

**렌더링:**
- [ ] Evidence 섹션이 기존 섹션 뒤에만 추가되는가?
- [ ] 기존 섹션의 순서나 구조가 변경되지 않았는가?
- [ ] Evidence가 없을 때 섹션이 렌더링되지 않는가?
- [ ] 로그아웃 상태에서 Evidence 섹션이 표시되지 않는가?
- [ ] 로그인 상태에서 Evidence 섹션이 정상 표시되는가?

**접근 제어:**
- [ ] Evidence 접근 제어가 `gate.js`의 `isLoggedIn()`만 사용하는가?
- [ ] 중복된 권한 체크 로직이 추가되지 않았는가?
- [ ] `gate.js` 외부에서 권한 판단 로직이 추가되지 않았는가?

**독립성:**
- [ ] Evidence가 없어도 기존 기능이 정상 동작하는가?
- [ ] Evidence 계산 실패 시 기존 분석 결과에 영향이 없는가?
- [ ] Evidence 데이터와 기존 `scores` 데이터가 독립적으로 관리되는가?

### 9.3 회귀 테스트 시나리오

**시나리오 1: Evidence 없이 분석 실행**
1. 로그인 상태에서 분석 실행
2. Evidence 계산 비활성화 또는 실패
3. **예상 결과**: 기존 분석 결과 정상 표시, Evidence 섹션 없음

**시나리오 2: Evidence 포함 분석 실행**
1. 로그인 상태에서 분석 실행
2. Evidence 계산 성공
3. **예상 결과**: 기존 분석 결과 + Evidence 섹션 표시

**시나리오 3: 로그아웃 → Evidence 숨김**
1. 로그인 상태에서 Evidence 포함 분석 실행
2. 로그아웃
3. Analyze 화면 접근
4. **예상 결과**: 기존 분석 결과만 표시, Evidence 섹션 숨김

**시나리오 4: 새로고침 → Evidence 복원**
1. 로그인 상태에서 Evidence 포함 분석 실행
2. 새로고침
3. **예상 결과**: 기존 분석 결과 + Evidence 섹션 정상 복원

**시나리오 5: Share 화면 Evidence 표시**
1. 로그인 상태에서 Evidence 포함 분석 실행
2. Share 화면 접근
3. **예상 결과**: 기존 리포트 + Evidence 섹션 표시

**시나리오 6: 기존 리포트 구조 유지**
1. Evidence 포함 분석 실행
2. Share 화면 접근
3. **예상 결과**: 기존 리포트 구조(KPI, 근거, 액션) 정상 표시, Evidence는 추가 섹션으로만 표시

---

## 10. 구현 우선순위

### 10.1 Phase 1: 데이터 모델 및 저장

**목표:** Evidence 데이터를 독립적으로 저장/복원

**작업:**
1. Evidence 데이터 모델 정의
2. Evidence 저장 함수 구현 (`saveEvidence()`)
3. Evidence 복원 함수 구현 (`loadEvidence()`)
4. 기존 저장/복원 로직 변경 없이 독립적으로 동작 확인

### 10.2 Phase 2: Evidence 계산

**목표:** 분석 완료 후 Evidence 계산 및 저장

**작업:**
1. Evidence 계산 함수 구현 (기존 분석 로직 변경 없이)
2. 분석 완료 후 Evidence 계산 호출
3. Evidence 계산 실패 시 기존 분석 결과에 영향 없음 확인

### 10.3 Phase 3: 렌더링

**목표:** Analyze/Share 화면에 Evidence 섹션 추가

**작업:**
1. Evidence 렌더링 함수 구현
2. Analyze 화면에 Evidence 섹션 추가 (기존 렌더링 로직 변경 없이)
3. Share 화면에 Evidence 섹션 추가 (기존 리포트 구조 변경 없이)
4. 로그인 상태에서만 Evidence 표시 확인

### 10.4 Phase 4: 테스트 및 검증

**목표:** 모든 체크리스트 통과 및 회귀 없음 확인

**작업:**
1. Phase4-2 Baseline 체크리스트 전체 통과 확인
2. Evidence 추가 체크리스트 통과 확인
3. 회귀 테스트 시나리오 실행
4. 문서화 및 검토

---

## 11. 문서 참조

- **[PHASE4_2_BASELINE.md](./PHASE4_2_BASELINE.md)**: Phase 4-2 Baseline 상세 규칙
- **[WORKFLOW_GUARDRAILS.md](./WORKFLOW_GUARDRAILS.md)**: 개발 워크플로우 가드레일
- 이 문서: Phase5 Evidence 재설계 스펙

---

**문서 생성일**: 2024년 기준
**Baseline 커밋**: `20a2ea3f04c5cb6c150681354fd71c7c7a0e4eb0`
**Baseline 브랜치**: `reset/phase4-2-safe`
**적용 브랜치**: `feat/phase5-evidence` (예정)

