# 개발 워크플로우 가드레일

## 1. Baseline 정의

### Baseline 브랜치 및 커밋 정보
- **브랜치**: `reset/phase4-2-safe`
- **커밋 해시**: `20a2ea3f04c5cb6c150681354fd71c7c7a0e4eb0`
- **태그**: (향후 필요 시 `v4.2.0` 등으로 태그 생성 가능)

### Baseline 상태
- Phase 4-2의 정상 동작 기준선으로 정의됨
- 로그인/로그아웃 UX 정상 동작
- 체험 1회 기능 정상 동작
- 결과 모자이크 기능 정상 동작
- 접근 제어 정상 동작
- Phase5(Evidence) 관련 코드 전부 제거됨

**상세 규칙은 [PHASE4_2_BASELINE.md](./PHASE4_2_BASELINE.md) 참조**

---

## 2. Baseline 브랜치 작업 규칙

### 2.1 절대 금지 사항

**Baseline 브랜치(`reset/phase4-2-safe`)에서 다음 작업은 절대 금지:**

- ❌ 기능 개발 (새로운 기능 추가)
- ❌ 리팩터링 (코드 구조 변경, 함수 분리/병합 등)
- ❌ 실험적 커밋 (테스트, 프로토타이핑 등)
- ❌ Phase5(Evidence) 관련 코드 추가
- ❌ 기존 분석/저장/복원/렌더링 파이프라인 변경
- ❌ localStorage 스키마 변경
- ❌ Gate 모듈의 기존 함수 시그니처 변경
- ❌ 권한 규칙 변경

**위 항목들은 모두 새 브랜치(`feat/*`, `fix/*` 등)에서만 수행해야 함**

### 2.2 허용되는 작업 (Hotfix만)

**Baseline 브랜치에서 허용되는 작업은 Hotfix로 제한됨**

**Hotfix 정의:**
- 프로덕션 환경에서 발생한 **치명적 버그** 수정
- Baseline의 정상 동작을 방해하는 **즉시 수정이 필요한 이슈**만 해당
- 예시:
  - ✅ 로그인 기능이 완전히 동작하지 않는 버그
  - ✅ 페이지가 로드되지 않는 크래시 버그
  - ✅ localStorage 저장이 실패하여 데이터 손실이 발생하는 버그
- 비예시 (Hotfix 아님):
  - ❌ UI 개선 (기능 개발)
  - ❌ 성능 최적화 (리팩터링)
  - ❌ 코드 스타일 정리 (chore)
  - ❌ 새로운 기능 추가 (기능 개발)

**Hotfix 작업 절차:**
1. Baseline 브랜치에서 `hotfix/` 브랜치 생성
2. 최소한의 변경으로 버그 수정
3. PHASE4_2_BASELINE.md의 회귀 방지 체크리스트 확인
4. Baseline 브랜치로 머지 (또는 PR 검토 후 머지)

---

## 3. 브랜치 전략

### 3.1 브랜치 네이밍 규칙

**기능 개발 브랜치**
- `feat/` 접두사 사용
- 예시: `feat/phase5-evidence`, `feat/user-profile`

**버그 수정 브랜치**
- `fix/` 접두사 사용 (Hotfix가 아닌 일반 버그 수정)
- 예시: `fix/login-modal-close`, `fix/credit-calculation`

**Hotfix 브랜치**
- `hotfix/` 접두사 사용 (Baseline 브랜치에서만 생성)
- 예시: `hotfix/auth-storage-crash`, `hotfix/render-loop`

**기타 작업 브랜치**
- `chore/` 접두사 사용 (문서, 설정 등)
- 예시: `chore/update-docs`, `chore/dependency-update`

### 3.2 브랜치 생성 규칙

**Baseline 브랜치에서 생성 가능한 브랜치**
- `hotfix/*` 브랜치만 허용
- 다른 모든 브랜치는 `main` 또는 `develop` 브랜치에서 생성

**기능 개발 브랜치 생성**
- Baseline 브랜치가 아닌 다른 브랜치에서 `feat/*` 생성
- Phase5 작업은 별도 브랜치(`feat/phase5-evidence` 등)에서 수행

### 3.3 브랜치 머지 규칙

**Baseline 브랜치로의 머지**
- `hotfix/*` 브랜치만 머지 가능
- 모든 머지 전에 PHASE4_2_BASELINE.md 체크리스트 필수 확인

**다른 브랜치로의 머지**
- `feat/*`, `fix/*`, `chore/*` 브랜치는 `main` 또는 `develop` 브랜치로 머지
- Baseline 브랜치로 직접 머지 금지

---

## 4. Phase5 개발 규칙

### 4.1 Phase5 브랜치 전략

**Phase5 작업은 별도 브랜치에서 수행**
- 브랜치명: `feat/phase5-evidence` 또는 유사한 네이밍
- Baseline 브랜치가 아닌 `main` 또는 `develop`에서 생성

### 4.2 기존 파이프라인 Read-only 규칙

**기존 분석/저장/복원/렌더링 경로는 Read-only로 취급**

**Read-only 의미:**
- 기존 코드를 읽기만 하고 수정하지 않음
- 기존 함수의 시그니처 변경 금지
- 기존 데이터 구조 변경 금지

**허용되는 확장 방식:**
- ✅ 새로운 함수 추가 (기존 함수 수정 없이)
- ✅ 새로운 데이터 필드 추가 (기존 필드 변경 없이)
- ✅ 새로운 네임스페이스 사용 (`analysis.evidence` 등)

**금지되는 행위:**
- ❌ 기존 `analysis.scores` 구조 변경
- ❌ 기존 `setState()` 로직 변경
- ❌ 기존 `render()` 함수 구조 변경
- ❌ 기존 localStorage 키 스키마 변경

**상세 규칙은 [PHASE4_2_BASELINE.md](./PHASE4_2_BASELINE.md)의 "5. Phase5 재개 시 Do / Don't" 섹션 참조**

---

## 5. PR 체크리스트

### 5.1 모든 PR에 대한 필수 체크리스트

**Baseline 준수 여부**
- [ ] [PHASE4_2_BASELINE.md](./PHASE4_2_BASELINE.md)의 모든 불변 규칙을 준수하는가?
- [ ] Gate 모듈의 단일 진실 소스 원칙을 위반하지 않는가?
- [ ] localStorage 스키마를 변경하지 않는가?
- [ ] 기존 분석/저장/복원/렌더링 파이프라인을 변경하지 않는가?

**권한 및 접근 제어**
- [ ] 로그아웃 상태에서 Analyze 버튼 클릭 시 로그인 모달이 표시되는가?
- [ ] 로그아웃 상태에서 Share 화면 접근 시 로그인 안내 화면이 표시되는가?
- [ ] 로그인 상태에서 모든 기능이 정상 동작하는가?

**체험 1회 기능**
- [ ] 첫 로그인 시 10 크레딧이 지급되는가?
- [ ] 두 번째 이후 로그인 시 크레딧이 재지급되지 않는가?

**결과 표시**
- [ ] 로그인 상태에서 전체 결과가 표시되는가?
- [ ] 로그아웃 상태에서 결과 접근이 차단되는가?

**Phase5 코드**
- [ ] Phase5(Evidence) 관련 코드가 Baseline 브랜치에 포함되지 않는가?
- [ ] `FEATURE_EVIDENCE` 플래그가 `true`로 설정되지 않았는가?

### 5.2 Hotfix PR 추가 체크리스트

**Hotfix 특화 체크리스트**
- [ ] 이 변경이 정말 Hotfix인가? (치명적 버그 수정인가?)
- [ ] 최소한의 변경으로 버그만 수정했는가?
- [ ] 기능 추가나 리팩터링이 포함되지 않았는가?
- [ ] Baseline의 정상 동작을 방해하는 이슈를 해결하는가?

### 5.3 Phase5 PR 추가 체크리스트

**Phase5 특화 체크리스트**
- [ ] 기존 `analysis.scores` 구조를 변경하지 않았는가?
- [ ] 기존 파이프라인을 Read-only로 취급했는가?
- [ ] 새로운 네임스페이스(`analysis.evidence` 등)를 사용했는가?
- [ ] 기존 함수의 시그니처를 변경하지 않았는가?

---

## 6. 커밋 메시지 규칙

### 6.1 커밋 메시지 형식

**기본 형식**
```
<type>: <subject>

<body>

<footer>
```

**Type 종류**
- `feat`: 기능 추가
- `fix`: 버그 수정
- `hotfix`: Hotfix (Baseline 브랜치에서만)
- `chore`: 기타 작업 (문서, 설정 등)
- `docs`: 문서 수정

**예시**
```
hotfix: 로그인 상태 저장 실패 버그 수정

localStorage 저장 시 JSON 파싱 에러가 발생하여
로그인 상태가 유지되지 않는 문제를 수정했습니다.

Fixes #123
```

### 6.2 Baseline 브랜치 커밋 메시지

**Baseline 브랜치의 커밋은 Hotfix만 허용**
- 모든 커밋 메시지는 `hotfix:` 접두사 사용
- Baseline 브랜치에서 다른 type의 커밋은 금지

---

## 7. 위반 시 조치

### 7.1 Baseline 브랜치 위반 시

**위반 사항 발견 시:**
1. 즉시 해당 커밋을 되돌림 (revert)
2. 위반 내용을 문서화
3. 올바른 브랜치에서 작업 재개

**예방 조치:**
- Baseline 브랜치에 대한 직접 push 권한 제한 고려
- PR 필수화 (직접 머지 금지)
- 자동화된 체크리스트 검증 도구 활용

### 7.2 PR 체크리스트 미준수 시

**체크리스트 미준수 PR:**
- PR 리뷰어가 체크리스트 확인 후 승인/거부 결정
- 미준수 항목이 있으면 수정 요청
- Baseline 브랜치로의 머지는 모든 체크리스트 통과 후에만 허용

---

## 8. 문서 참조

- **[PHASE4_2_BASELINE.md](./PHASE4_2_BASELINE.md)**: Phase 4-2 Baseline 상세 규칙
- 이 문서: 개발 워크플로우 가드레일

---

**문서 생성일**: 2024년 기준
**Baseline 커밋**: `20a2ea3f04c5cb6c150681354fd71c7c7a0e4eb0`
**Baseline 브랜치**: `reset/phase4-2-safe`

