# Phase 4-2 Baseline 선언 문서

## 1. Phase 4-2 Baseline 선언

### 기준 정보
- **브랜치**: `reset/phase4-2-safe`
- **커밋 해시**: `20a2ea3f04c5cb6c150681354fd71c7c7a0e4eb0`
- **작업 트리 상태**: Clean

### Baseline 선언
**이 상태는 Phase 4-2의 정상 동작 기준선(Baseline)으로 정의된다.**

- 로그인/로그아웃 UX가 정상 동작한다
- 체험 1회 기능이 정상 동작한다
- 결과 모자이크 기능이 정상 동작한다
- 접근 제어가 정상 동작한다
- Phase5(Evidence) 관련 코드는 전부 제거된 상태이다

**이 기준선에서의 변경은 회귀로 간주하며, 모든 변경은 이 문서의 규칙을 준수해야 한다.**

---

## 2. 권한 상태 모델

### 2.1 Anonymous (로그아웃 상태)

**식별 조건**
- `store.auth.isLoggedIn === false`
- `localStorage['aeo_auth_v1']`에 `isLoggedIn: false` 저장 또는 미존재

**허용 행동**
- 홈 화면(`home.html`) 접근 및 조회
- Quick Analyze 입력 필드 조회
- 로그인 모달 열기
- 로그인 버튼 클릭

**제한 행동**
- 분석 기능 사용 (`analyze.html`의 Analyze 버튼 클릭)
- 리포트 공유 보기 (`share.html` 접근)
- PDF 내보내기
- AI 개선 기능 사용
- HTML 생성 기능 사용 (`generate/index.html`)
- URL 구조 점수 측정 기능 사용

**결과 표시 규칙**
- 분석 결과가 있어도 로그인하지 않으면 접근 불가
- Share 화면 접근 시 즉시 로그인 안내 화면으로 전환
- 리포트 렌더링 로직 실행 전 로그인 체크로 차단

### 2.2 Trial-used Anonymous (체험 사용 후 로그아웃 상태)

**식별 조건**
- `store.auth.isLoggedIn === false`
- `store.credit.grantedOnce === true` (이전에 로그인하여 체험 크레딧을 받은 이력 존재)

**허용 행동**
- Anonymous와 동일

**제한 행동**
- Anonymous와 동일

**결과 표시 규칙**
- Anonymous와 동일
- 체험 크레딧은 이미 지급되었으므로 재지급되지 않음

### 2.3 Authenticated (로그인 상태)

**식별 조건**
- `store.auth.isLoggedIn === true`
- `localStorage['aeo_auth_v1']`에 `isLoggedIn: true` 저장
- `store.auth.userId`에 UUID 값 존재

**허용 행동**
- 모든 기능 사용 가능
- 분석 기능 사용 (1 크레딧 소모)
- 리포트 공유 보기 (`share.html` 접근)
- PDF 내보내기
- AI 개선 기능 사용 (1 크레딧 소모)
- HTML 생성 기능 사용 (2 크레딧 소모)
- URL 구조 점수 측정 기능 사용

**제한 행동**
- 없음 (크레딧 부족 시에만 제한)

**결과 표시 규칙**
- 전체 결과 노출 (모자이크 없음)
- 모든 점수 및 근거 정보 표시
- 리포트 렌더링 정상 실행

**크레딧 지급 규칙**
- 첫 로그인 시: `grantedOnce === false`인 경우 10 크레딧 자동 지급
- 지급 후: `grantedOnce`를 `true`로 설정하여 중복 지급 방지
- 이후 로그인: 크레딧 재지급 없음

---

## 3. UX 동작 규칙

### 3.1 Analyze 화면 (`analyze.html`)

**접근 제어**
- Analyze 버튼 클릭 시: `requireLogin()` → `requireCredit(1)` 순차 체크
- 로그인 미완료 시: 로그인 모달 표시 (이유: "분석 기능을 사용하려면 로그인이 필요합니다.")
- 크레딧 부족 시: 크레딧 모달 표시 (이유: "분석 기능을 사용하려면 1 크레딧이 필요합니다.")
- 로그인 완료 후: 분석 실행, 크레딧 1 차감

**결과 표시**
- 로그인 상태: 전체 결과 표시 (KPI, 점수, 근거, 액션)
- 로그아웃 상태: 결과 접근 불가 (분석 자체가 실행되지 않음)

**버튼 상태**
- "개선안 생성" 버튼: 로그인 상태에 따라 활성/비활성
- 로그아웃 시: 버튼 비활성화 + "로그인 후 사용 가능" 안내 문구 표시

### 3.2 Share 화면 (`share.html`)

**접근 제어**
- 페이지 로드 즉시: `isLoggedIn()` 체크
- 로그인 미완료 시:
  - `document.body`를 로그인 안내 화면으로 교체
  - 리포트 렌더링 로직 실행하지 않음
  - `window.print()` 오버라이드하여 인쇄 차단
  - Ctrl/Cmd+P 키보드 이벤트 차단
  - `beforeprint` 이벤트 차단

**결과 표시**
- 로그인 상태: 전체 리포트 표시 (KPI 섹션, 콘텐츠 구조 점수 근거, 결과 섹션)
- 로그아웃 상태: 리포트 렌더링 로직 자체가 실행되지 않음

**PDF 내보내기**
- 버튼 클릭 시: `gateOrWarn("PDF 내보내기")` 체크
- 로그인 미완료 시: alert("로그인 후 사용 가능합니다.")
- 로그인 완료 후: `window.print()` 실행

### 3.3 로그아웃 시 동작

**처리 위치**: `core/header.js`의 로그아웃 버튼 클릭 핸들러

**실행 내용**
1. `store.auth` 초기화: `{ isLoggedIn: false, userId: null }`
2. `store.credit` 초기화: `{ balance: 0, grantedOnce: false }`
3. 옵션 처리: `CLEAR_REPORT_ON_LOGOUT === true`인 경우 `localStorage.removeItem('__lastV2')` 실행
   - 기본값: `false` (리포트 결과는 유지)

**결과**
- 헤더가 "로그인 필요" 상태로 변경
- 모든 게이트가 로그인 요구로 전환
- Share 화면 접근 시 로그인 안내 화면 표시

### 3.4 로그인 시 동작

**처리 위치**: `core/modal.js`의 로그인 모달 "로그인" 버튼 클릭 핸들러

**실행 내용**
1. `store.auth` 설정: `{ isLoggedIn: true, userId: generateUUID() }`
2. 크레딧 지급 체크:
   - `store.credit.grantedOnce === false`인 경우
   - `balance`에 10 추가
   - `grantedOnce`를 `true`로 설정
3. 모달 닫기

**결과**
- 헤더가 크레딧 잔액 표시 상태로 변경
- 모든 게이트가 통과 가능 상태로 전환
- Share 화면 접근 시 리포트 정상 렌더링

### 3.5 새로고침 / 직접 URL 접근 시 불변 규칙

**localStorage 기반 상태 복원**
- `aeo_state_v2`: 분석 결과 상태 복원
- `aeo_auth_v1`: 로그인 상태 복원
- `aeo_credit_v1`: 크레딧 상태 복원

**접근 제어 적용**
- 새로고침 후에도 로그인 상태가 유지되면 모든 기능 사용 가능
- 로그아웃 상태로 복원되면 모든 게이트가 차단
- Share 화면 직접 접근 시에도 로그인 체크가 가장 먼저 실행됨

**결과 표시 일관성**
- 로그인 상태: 항상 전체 결과 표시
- 로그아웃 상태: 항상 접근 차단 또는 모자이크 적용

---

## 4. 기술적 불변 규칙 (절대 금지)

### 4.1 Gate 모듈 불변 규칙

**단일 진실 소스 원칙**
- `core/gate.js`의 `isLoggedIn()` 함수가 로그인 상태 판단의 유일한 진실 소스
- 다른 모듈에서 `localStorage`를 직접 읽어 로그인 상태를 판단하는 것은 금지
- `store.auth.isLoggedIn`을 직접 참조하는 것은 `gate.js`를 통해서만 허용

**Gate 외부 권한 판단 금지**
- `gate.js` 외부에서 권한 판단 로직을 추가하는 것은 금지
- 모든 권한 체크는 다음 함수를 통해서만 수행:
  - `isLoggedIn()`: 로그인 여부 확인
  - `requireLogin({ reason })`: 로그인 필요 시 모달 표시
  - `requireCredit(cost, { reason })`: 크레딧 필요 시 모달 표시
  - `gateOrWarn(actionName)`: 간단한 alert 기반 게이트

### 4.2 localStorage 키 및 스키마 불변 규칙

**키 이름 변경 금지**
- `aeo_state_v2`: 분석 결과 상태
- `aeo_auth_v1`: 인증 상태
- `aeo_credit_v1`: 크레딧 상태
- `__lastV2`: 리포트 복원용 (옵션)

**데이터 스키마 변경 금지**

**`aeo_state_v2` 스키마**
```javascript
{
  input: string,
  phase: "idle" | "loading" | "done",
  result: {
    score: number,
    grade: string,
    summary: string,
    evidence: string[],
    actions: string[],
    urlStructureV1: object | null
  } | null,
  analysis: {
    scores: {
      branding: object | null,
      contentStructureV2: object | null,
      urlStructureV1: object | null
    }
  },
  updatedAt: number
}
```

**`aeo_auth_v1` 스키마**
```javascript
{
  isLoggedIn: boolean,
  userId: string | null
}
```

**`aeo_credit_v1` 스키마**
```javascript
{
  balance: number,
  grantedOnce: boolean
}
```

**스키마 변경 금지 사항**
- 기존 필드 타입 변경 금지
- 필수 필드 제거 금지
- `analysis.scores` 슬롯 변경 금지 (`branding`, `contentStructureV2`, `urlStructureV1`)

### 4.3 분석 → 저장 → 복원 → 렌더링 파이프라인 불변 규칙

**파이프라인 단계**
1. 분석 실행 (`core/actions.js`)
2. 상태 저장 (`core/state.js`의 `setState()`)
3. localStorage 저장 (`core/state.js`의 `saveToStorage()`)
4. 페이지 로드 시 복원 (`core/state.js`의 `loadFromStorage()`)
5. 렌더링 (`core/view.js`의 `render()`)

**변경 금지 사항**
- `setState()`에서 `result`가 있을 때 자동으로 localStorage에 저장하는 로직 변경 금지
- `analysis.scores` 정규화 로직 (`normalizeAnalysisScores()`) 변경 금지
- `render()` 함수의 KPI 렌더링 순서 및 구조 변경 금지
- 리포트 payload 생성 로직 (`core/report.js`의 `buildReportPayload()`) 변경 금지

### 4.4 Phase5(Evidence) 코드 존재 금지

**현재 상태**
- Phase5 관련 코드는 제거된 상태
- `core/actions.js`에 `computeContentStructureV2Evidence` import 및 사용 코드가 남아있으나 `FEATURE_EVIDENCE` 플래그로 비활성화됨

**금지 사항**
- `FEATURE_EVIDENCE === true`로 설정하는 것은 금지
- Evidence 관련 코드를 활성화하는 것은 금지
- Evidence 관련 localStorage 키를 추가하는 것은 금지
- `analysis.evidence` 필드를 추가하는 것은 금지

**허용 사항**
- Evidence 관련 코드는 주석 처리 또는 제거 가능 (단, 다른 기능에 영향 없어야 함)

---

## 5. Phase5 재개 시 Do / Don't

### 5.1 허용되는 확장 방식

**별도 브랜치 작업**
- Phase5 작업은 반드시 별도 브랜치에서 수행
- Baseline 브랜치(`reset/phase4-2-safe`)에 직접 머지 금지

**Read-only 확장**
- 기존 `analysis.scores` 스키마는 읽기 전용으로 유지
- 새로운 점수 슬롯 추가는 `analysis.scores` 외부에 별도 네임스페이스로 구성

**별도 네임스페이스 사용**
- Evidence 데이터는 `analysis.evidence` 네임스페이스로 분리
- 기존 `scores` 구조와 독립적으로 관리

**Gate 모듈 확장**
- 새로운 권한 규칙 추가 시 `gate.js` 내부에 함수 추가
- 기존 함수 시그니처 변경 금지

### 5.2 금지되는 행위

**기존 scores 변경 금지**
- `analysis.scores.branding`, `contentStructureV2`, `urlStructureV1`의 구조 변경 금지
- 기존 점수 계산 로직 변경 금지
- 점수 정규화 로직(`normalizeAnalysisScores()`) 변경 금지

**Share 화면 재구성 금지**
- `share.html`의 리포트 렌더링 구조 변경 금지
- KPI 섹션 레이아웃 변경 금지
- PDF 인쇄 스타일 변경 금지

**모자이크 로직 침범 금지**
- 로그아웃 상태에서 결과를 부분적으로 표시하는 로직 추가 금지
- 로그인하지 않은 사용자에게 점수 일부를 노출하는 행위 금지

**접근 제어 우회 금지**
- `gate.js`를 우회하여 기능에 접근하는 로직 추가 금지
- 클라이언트 측에서 권한 체크를 생략하는 행위 금지

**localStorage 키 충돌 금지**
- 기존 키(`aeo_state_v2`, `aeo_auth_v1`, `aeo_credit_v1`)와 충돌하는 새 키 추가 금지
- 기존 키의 스키마를 변경하는 행위 금지

**파이프라인 중단 금지**
- 분석 → 저장 → 복원 → 렌더링 파이프라인을 중단시키는 변경 금지
- `setState()` 호출 없이 상태를 변경하는 행위 금지

---

## 6. 회귀 방지 체크리스트

### 6.1 PR 또는 작업 전 필수 확인 항목

**권한 및 접근 제어**
- [ ] 로그아웃 상태에서 Analyze 버튼 클릭 시 로그인 모달이 표시되는가?
- [ ] 로그아웃 상태에서 Share 화면 접근 시 로그인 안내 화면이 표시되는가?
- [ ] 로그아웃 상태에서 PDF 내보내기 시도 시 alert가 표시되는가?
- [ ] 로그인 상태에서 모든 기능이 정상 동작하는가?

**체험 1회 기능**
- [ ] 첫 로그인 시 10 크레딧이 지급되는가?
- [ ] 두 번째 이후 로그인 시 크레딧이 재지급되지 않는가?
- [ ] `grantedOnce` 플래그가 정상적으로 관리되는가?

**결과 표시**
- [ ] 로그인 상태에서 전체 결과가 표시되는가?
- [ ] 로그아웃 상태에서 결과 접근이 차단되는가?
- [ ] 새로고침 후에도 로그인 상태가 유지되는가?

**localStorage 스키마**
- [ ] `aeo_state_v2` 스키마가 변경되지 않았는가?
- [ ] `aeo_auth_v1` 스키마가 변경되지 않았는가?
- [ ] `aeo_credit_v1` 스키마가 변경되지 않았는가?
- [ ] 기존 localStorage 키 이름이 변경되지 않았는가?

**Gate 모듈**
- [ ] `gate.js` 외부에서 권한 판단 로직이 추가되지 않았는가?
- [ ] `isLoggedIn()` 함수가 단일 진실 소스로 유지되는가?
- [ ] 모든 권한 체크가 `gate.js` 함수를 통해 수행되는가?

**파이프라인**
- [ ] 분석 → 저장 → 복원 → 렌더링 파이프라인이 정상 동작하는가?
- [ ] `setState()` 호출 없이 상태가 변경되지 않는가?
- [ ] 리포트 렌더링 로직이 정상 동작하는가?

**Phase5 코드**
- [ ] Phase5(Evidence) 관련 코드가 활성화되지 않았는가?
- [ ] `FEATURE_EVIDENCE` 플래그가 `true`로 설정되지 않았는가?
- [ ] Evidence 관련 localStorage 키가 추가되지 않았는가?

### 6.2 회귀 테스트 시나리오

**시나리오 1: 로그아웃 → Analyze 시도**
1. 로그아웃 상태에서 `analyze.html` 접근
2. Analyze 버튼 클릭
3. **예상 결과**: 로그인 모달 표시

**시나리오 2: 로그아웃 → Share 접근**
1. 로그아웃 상태에서 `share.html` 직접 접근
2. **예상 결과**: 로그인 안내 화면 표시, 리포트 렌더링 없음

**시나리오 3: 첫 로그인 → 크레딧 지급**
1. 신규 사용자로 로그인
2. **예상 결과**: 10 크레딧 지급, `grantedOnce: true` 설정

**시나리오 4: 재로그인 → 크레딧 미지급**
1. 이전에 로그인한 사용자로 재로그인
2. **예상 결과**: 크레딧 재지급 없음

**시나리오 5: 로그인 → 분석 → 새로고침**
1. 로그인 상태에서 분석 실행
2. 결과 확인
3. 새로고침
4. **예상 결과**: 로그인 상태 유지, 결과 정상 복원

**시나리오 6: 로그인 → 분석 → 로그아웃 → Share 접근**
1. 로그인 상태에서 분석 실행
2. 로그아웃
3. `share.html` 접근
4. **예상 결과**: 로그인 안내 화면 표시

---

## 7. 문서 유지보수 규칙

### 7.1 문서 업데이트 조건
- Baseline 브랜치에 변경사항이 머지될 때
- 권한 규칙이 변경될 때
- localStorage 스키마가 변경될 때
- 새로운 불변 규칙이 추가될 때

### 7.2 문서 변경 금지 조건
- Baseline 브랜치의 실제 동작과 불일치하는 내용으로 변경 금지
- 추측이나 계획 사항을 현재 상태로 기술하는 것 금지
- Phase5 구현 제안을 Baseline 문서에 포함하는 것 금지

---

**문서 생성일**: 2024년 기준
**Baseline 커밋**: `20a2ea3f04c5cb6c150681354fd71c7c7a0e4eb0`
**Baseline 브랜치**: `reset/phase4-2-safe`

