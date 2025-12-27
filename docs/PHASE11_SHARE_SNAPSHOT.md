# Phase 11: 외부 공유 가능한 리포트 Snapshot 설계

## 1. 전제 조건

### 1.1 Baseline 준수
이 문서는 기존 Phase 3~10의 모든 규칙을 전제로 한다.

- 기존 `localStorage` 기반 복원 파이프라인 유지
- 기존 `?r=` 파라미터 처리 로직 유지
- 기존 리포트 렌더링 파이프라인 유지
- `analysis.scores` 스키마 변경 금지

### 1.2 핵심 원칙
**기존 localStorage 흐름을 깨지 않고, 서버 snapshot을 추가 레이어로 제공한다.**

---

## 2. 목적 및 비목적

### 2.1 목적

**Phase 11의 목적:**
- Pro 사용자가 리포트를 서버에 snapshot으로 저장
- `?r=<reportId>` 파라미터로 어떤 브라우저/기기에서도 리포트 로드 가능
- 데이터 최소화/보안/비용을 고려한 설계

### 2.2 비목적 (절대 금지)

**다음 항목들은 Phase 11의 목적이 아니며, 절대 수행하지 않는다:**

- ❌ 기존 localStorage 파이프라인 변경
  - `share.html`의 `loadReportModel()` 로직 변경 금지
  - `localStorage.__lastV2` 저장/복원 로직 변경 금지
  - 기존 `?r=` 파라미터 처리 로직 변경 금지

- ❌ 기존 분석/점수 계산 로직 변경
  - `core/actions.js`의 분석 실행 로직 변경 금지
  - `core/analyzers/*`의 점수 계산 로직 변경 금지

- ❌ 기존 렌더링 파이프라인 변경
  - `share.html`의 리포트 렌더링 로직 변경 금지
  - 기존 KPI/근거/신뢰도 UI 변경 금지

---

## 3. 저장 시점

### 3.1 트리거
- **Share 페이지에서 "외부 공유 링크 생성" 버튼 클릭 시**
- Pro 사용자만 가능 (Free 사용자는 버튼 비활성화 또는 Pro 업그레이드 안내)
- 로그인 상태 필수

### 3.2 저장 전 검증
1. 현재 리포트가 유효한지 확인 (`reportModel` 존재)
2. Pro 구독 상태 확인
3. 레이트 리밋 확인 (하루 최대 N개)

### 3.3 저장 실패 처리
- 네트워크 오류: 사용자에게 재시도 안내
- Pro 구독 없음: 업그레이드 안내 모달
- 레이트 리밋 초과: 다음 날 안내

---

## 4. 저장 Payload 스키마

### 4.1 기본 구조

```typescript
interface ReportSnapshot {
  // 메타데이터
  reportId: string;              // 서버 생성 UUID (예: "550e8400-e29b-41d4-a716-446655440000")
  userId: string;                 // 생성한 사용자 ID
  createdAt: number;              // 생성 시각 (Unix timestamp, 밀리초)
  expiresAt: number;              // 만료 시각 (Unix timestamp, 밀리초)
  version: string;                // 스키마 버전 (예: "v1")
  
  // 리포트 데이터 (기존 reportModel 구조 유지)
  inputs: {
    brand: string | null;
    product: string | null;
    url: string | null;
  };
  input: string | null;           // 원본 HTML 입력
  result: {
    score: number;
    grade: string;
    summary: string;
    evidence: string[];
    actions: string[];
    urlStructureV1?: {
      score: number | null;
      grade: string | null;
      checks: Record<string, any>;
      meta: {
        targetUrl: string | null;
        analyzedAt: number | null;
        version: string;
      };
    } | null;
  } | null;
  analysis: {
    scores: {
      branding: {
        score: number;
        grade: string;
      } | null;
      contentStructureV2: {
        score: number;
        grade: string;
        evidence: string[];
      } | null;
      urlStructureV1: {
        score: number;
        grade: string;
      } | null;
    };
  };
  
  // 선택적 필드
  generatedAt?: number;           // 리포트 생성 시각 (기존 필드)
}
```

### 4.2 데이터 최소화 원칙

**제외할 데이터:**
- ❌ 원본 HTML 입력 전체 (`input` 필드는 null 또는 요약만)
- ❌ 중간 계산 과정 데이터
- ❌ 사용자 개인정보 (이메일, 이름 등)
- ❌ 세션/쿠키 정보

**포함할 데이터:**
- ✅ 점수 및 등급 (`analysis.scores`)
- ✅ 근거 배열 (`contentStructureV2.evidence`)
- ✅ 액션 리스트 (`result.actions`)
- ✅ 입력 메타데이터 (`inputs.brand`, `inputs.product`)

---

## 5. API 엔드포인트 계약

### 5.1 Snapshot 생성

**POST** `/api/reports/snapshot`

**Request Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reportModel": {
    "inputs": { ... },
    "input": "...",
    "result": { ... },
    "analysis": { ... }
  },
  "ttlDays": 30  // Pro 기본값, Free는 사용 불가
}
```

**Response (201 Created):**
```json
{
  "reportId": "550e8400-e29b-41d4-a716-446655440000",
  "shareUrl": "https://app.example.com/share.html?r=550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": 1735689600000,
  "createdAt": 1704153600000
}
```

**Response (400 Bad Request):**
```json
{
  "error": "INVALID_PAYLOAD",
  "message": "리포트 데이터가 유효하지 않습니다."
}
```

**Response (402 Payment Required):**
```json
{
  "error": "PRO_REQUIRED",
  "message": "외부 공유 기능은 Pro 구독이 필요합니다."
}
```

**Response (429 Too Many Requests):**
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "하루 최대 생성 횟수를 초과했습니다.",
  "retryAfter": 86400
}
```

### 5.2 Snapshot 조회

**GET** `/api/reports/:reportId`

**Request Headers:**
```
(인증 불필요 - 공개 읽기)
```

**Response (200 OK):**
```json
{
  "reportId": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": 1704153600000,
  "expiresAt": 1735689600000,
  "reportModel": {
    "inputs": { ... },
    "result": { ... },
    "analysis": { ... }
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "REPORT_NOT_FOUND",
  "message": "리포트를 찾을 수 없습니다."
}
```

**Response (410 Gone):**
```json
{
  "error": "REPORT_EXPIRED",
  "message": "리포트가 만료되었습니다.",
  "expiredAt": 1735689600000
}
```

### 5.3 Snapshot 삭제

**DELETE** `/api/reports/:reportId`

**Request Headers:**
```
Authorization: Bearer <access_token>
```

**Response (204 No Content):**
```
(본문 없음)
```

**Response (403 Forbidden):**
```json
{
  "error": "FORBIDDEN",
  "message": "이 리포트를 삭제할 권한이 없습니다."
}
```

---

## 6. TTL/만료/삭제 정책

### 6.1 기본 TTL

| 사용자 등급 | 기본 TTL | 최대 TTL |
|-----------|---------|---------|
| Free      | 사용 불가 | - |
| Pro       | 30일    | 90일    |
| Enterprise| 90일    | 365일   |

### 6.2 만료 처리

**자동 삭제:**
- `expiresAt` 시각이 지난 리포트는 자동 삭제
- 배치 작업으로 매일 1회 실행 (UTC 00:00)
- 삭제 전 7일 전 이메일 알림 (Pro 사용자)

**수동 삭제:**
- 사용자가 Share 페이지에서 "링크 삭제" 버튼 클릭
- 리포트 생성자가 언제든지 삭제 가능

### 6.3 만료 후 동작

**Share 페이지 접근 시:**
- `?r=<expired_reportId>` 접근 시 410 Gone 응답
- 사용자에게 "리포트가 만료되었습니다" 안내
- 새 리포트 생성 안내

---

## 7. 보안 방안

### 7.1 토큰 기반 인증

**Snapshot 생성:**
- JWT access token 필수
- 토큰에 `userId`, `subscription` 정보 포함
- 토큰 만료 시 401 Unauthorized

**Snapshot 조회:**
- 인증 불필요 (공개 읽기)
- `reportId`만으로 접근 가능

### 7.2 추측 방지

**ReportId 생성:**
- UUID v4 사용 (예: `550e8400-e29b-41d4-a716-446655440000`)
- 예측 불가능한 랜덤 값
- 순차적 ID 생성 금지

**Rate Limiting:**
- IP 기반: 초당 10회, 분당 60회
- 사용자 기반: 하루 최대 N개 (Pro: 50개, Free: 0개)
- 초과 시 429 Too Many Requests

### 7.3 데이터 보안

**저장 시:**
- 민감 정보 제거 (이메일, 개인정보)
- HTML 입력은 sanitize 처리 (XSS 방지)
- HTTPS 통신 필수

**조회 시:**
- CORS 정책: 허용된 도메인만 접근
- Content-Security-Policy 헤더 설정
- XSS 방지를 위한 데이터 검증

### 7.4 접근 제어

**소유자 확인:**
- Snapshot 생성 시 `userId` 저장
- 삭제/수정 시 소유자 확인
- 소유자가 아니면 403 Forbidden

---

## 8. Snapshot Payload 예시

### 8.1 최소 Payload (점수만)

```json
{
  "reportId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "createdAt": 1704153600000,
  "expiresAt": 1735689600000,
  "version": "v1",
  "inputs": {
    "brand": "삼성",
    "product": "갤럭시 S24",
    "url": null
  },
  "input": null,
  "result": null,
  "analysis": {
    "scores": {
      "branding": {
        "score": 75,
        "grade": "B"
      },
      "contentStructureV2": {
        "score": 68,
        "grade": "C",
        "evidence": []
      },
      "urlStructureV1": null
    }
  }
}
```

### 8.2 표준 Payload (전체 데이터)

```json
{
  "reportId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "createdAt": 1704153600000,
  "expiresAt": 1735689600000,
  "version": "v1",
  "inputs": {
    "brand": "삼성",
    "product": "갤럭시 S24",
    "url": "https://www.samsung.com/kr/smartphones/galaxy-s24/"
  },
  "input": "<html>...</html>",
  "result": {
    "score": 62,
    "grade": "B",
    "summary": "입력 \"갤럭시 S24\" 기준 분석 결과입니다.",
    "evidence": [
      "구조화 요약 블록 부재",
      "핵심 정보 분리 부족",
      "AI 인용 신호 약함"
    ],
    "actions": [
      "상단 5~7줄 요약 추가",
      "스펙/USP 리스트화",
      "FAQ 3개 구성"
    ],
    "urlStructureV1": {
      "score": 72,
      "grade": "B",
      "checks": {
        "hasSlug": true,
        "hasCategory": true,
        "depth": 3
      },
      "meta": {
        "targetUrl": "https://www.samsung.com/kr/smartphones/galaxy-s24/",
        "analyzedAt": 1704153600000,
        "version": "v1"
      }
    }
  },
  "analysis": {
    "scores": {
      "branding": {
        "score": 75,
        "grade": "B"
      },
      "contentStructureV2": {
        "score": 68,
        "grade": "C",
        "evidence": [
          "제목 구조가 명확함",
          "문단 분리가 적절함",
          "핵심 정보 배치가 개선 필요"
        ]
      },
      "urlStructureV1": {
        "score": 72,
        "grade": "B"
      }
    }
  },
  "generatedAt": 1704153600000
}
```

---

## 9. Free vs Pro 동작 분기

| 기능 | Free | Pro |
|------|------|-----|
| **로컬 저장 (localStorage)** | ✅ 사용 가능 | ✅ 사용 가능 |
| **동일 브라우저 재열람** | ✅ 사용 가능 | ✅ 사용 가능 |
| **외부 공유 링크 생성** | ❌ 사용 불가 | ✅ 사용 가능 |
| **다른 브라우저/기기 접근** | ❌ 불가능 | ✅ 가능 |
| **Snapshot TTL** | - | 30일 (기본) |
| **Snapshot 최대 TTL** | - | 90일 |
| **하루 최대 생성 수** | - | 50개 |
| **만료 전 알림** | - | ✅ 7일 전 이메일 |
| **수동 삭제** | - | ✅ 가능 |
| **Share 페이지 UI** | "재열람 링크 복사" 버튼만 표시 | "외부 공유 링크 생성" 버튼 추가 |
| **Share 페이지 접근** | `?r=` 없으면 localStorage만 사용 | `?r=` 있으면 서버 조회 시도 → 실패 시 localStorage fallback |

### 9.1 Share 페이지 로드 우선순위

**Free 사용자:**
1. `?r=` 파라미터 → 무시 (서버 조회 안 함)
2. `localStorage.__lastV2` → 사용
3. `localStorage.aeo_state_v2` → 사용
4. 없으면 "리포트 없음" 안내

**Pro 사용자:**
1. `?r=` 파라미터 → 서버 조회 시도
   - 성공: 서버 데이터 사용
   - 실패 (404/410): localStorage fallback
2. `localStorage.__lastV2` → 사용
3. `localStorage.aeo_state_v2` → 사용
4. 없으면 "리포트 없음" 안내

---

## 10. 구현 단계

### Phase 11-1: API 설계 및 계약 고정
- [ ] API 엔드포인트 스펙 확정
- [ ] 데이터베이스 스키마 설계
- [ ] 보안 정책 확정

### Phase 11-2: 백엔드 구현
- [ ] Snapshot 생성 API 구현
- [ ] Snapshot 조회 API 구현
- [ ] Snapshot 삭제 API 구현
- [ ] 만료 배치 작업 구현
- [ ] Rate limiting 구현

### Phase 11-3: 프론트엔드 통합
- [ ] Share 페이지에 "외부 공유 링크 생성" 버튼 추가
- [ ] API 클라이언트 모듈 추가 (`core/api/snapshotClient.js`)
- [ ] Free/Pro 분기 로직 추가
- [ ] 서버 조회 실패 시 localStorage fallback 로직 추가

### Phase 11-4: 테스트 및 배포
- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] 보안 테스트
- [ ] 성능 테스트

---

## 11. 비용 고려사항

### 11.1 저장 비용
- 리포트당 평균 크기: ~5KB (압축 시 ~2KB)
- 월 10,000개 리포트: ~20MB
- S3/Cloud Storage 비용: 월 $0.01 수준

### 11.2 트래픽 비용
- 리포트 조회당 평균 크기: ~5KB
- 월 100,000회 조회: ~500MB
- CDN 비용: 월 $0.05 수준

### 11.3 데이터베이스 비용
- 리포트 메타데이터: 리포트당 ~500 bytes
- 월 10,000개 리포트: ~5MB
- RDS/DynamoDB 비용: 월 $0.10 수준

**총 예상 비용: 월 $0.16 (10,000개 리포트 기준)**

---

## 12. 보안 체크리스트

- [ ] ReportId는 UUID v4 사용
- [ ] Rate limiting 구현 (IP/사용자 기반)
- [ ] HTTPS 통신 필수
- [ ] CORS 정책 설정
- [ ] XSS 방지 (HTML sanitize)
- [ ] 민감 정보 제거 (이메일, 개인정보)
- [ ] 토큰 기반 인증 (JWT)
- [ ] 만료 정책 구현
- [ ] 소유자 확인 로직
- [ ] Content-Security-Policy 헤더 설정

---

## 13. 참고사항

### 13.1 기존 파이프라인과의 호환성
- 기존 `localStorage` 기반 복원은 그대로 유지
- 서버 snapshot은 추가 레이어로 제공
- 실패 시 자동으로 localStorage fallback

### 13.2 마이그레이션 전략
- Phase 11 구현 시 기존 Free 사용자 영향 없음
- Pro 사용자만 새 기능 사용 가능
- 점진적 롤아웃 가능

### 13.3 확장 가능성
- 향후 버전에서 TTL 연장 기능 추가 가능
- 리포트 통계/분석 기능 추가 가능
- 리포트 공유 권한 설정 기능 추가 가능

