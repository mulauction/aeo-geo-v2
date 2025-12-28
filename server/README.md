# Phase 11-1: Share Snapshot API 서버

## 개요

Share 리포트를 서버에 snapshot으로 저장하고 조회하는 최소 API 서버입니다.

## 설치 및 실행

### 필수 패키지 설치

```bash
npm install express cors
```

또는

```bash
yarn add express cors
```

### 서버 실행

```bash
node server/index.js
```

기본 포트: `3001` (환경변수 `PORT`로 변경 가능)

## API 엔드포인트

### 1. Snapshot 생성

**POST** `/api/share-snapshots`

**Request:**
```bash
curl -X POST http://localhost:3001/api/share-snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "reportModel": {
      "inputs": {
        "brand": "삼성",
        "product": "갤럭시 S24",
        "url": null
      },
      "result": {
        "score": 62,
        "grade": "B",
        "summary": "입력 기준 분석 결과입니다.",
        "evidence": [
          "구조화 요약 블록 부재",
          "핵심 정보 분리 부족"
        ],
        "actions": [
          "상단 5~7줄 요약 추가",
          "스펙/USP 리스트화"
        ]
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
              "문단 분리가 적절함"
            ]
          },
          "urlStructureV1": null
        }
      }
    },
    "meta": {
      "userId": "user-123"
    }
  }'
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "INVALID_PAYLOAD",
  "message": "reportModel이 필요합니다."
}
```

### 2. Snapshot 조회

**GET** `/api/share-snapshots/:id`

**Request:**
```bash
curl http://localhost:3001/api/share-snapshots/550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK):**
```json
{
  "version": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "reportModel": {
    "inputs": {
      "brand": "삼성",
      "product": "갤럭시 S24",
      "url": null
    },
    "result": {
      "score": 62,
      "grade": "B",
      "summary": "입력 기준 분석 결과입니다.",
      "evidence": [
        "구조화 요약 블록 부재",
        "핵심 정보 분리 부족"
      ],
      "actions": [
        "상단 5~7줄 요약 추가",
        "스펙/USP 리스트화"
      ]
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
            "문단 분리가 적절함"
          ]
        },
        "urlStructureV1": null
      }
    }
  },
  "meta": {
    "userId": "user-123"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "NOT_FOUND",
  "message": "Snapshot을 찾을 수 없습니다."
}
```

### 3. Snapshot 삭제 (선택적)

**DELETE** `/api/share-snapshots/:id`

**Request:**
```bash
curl -X DELETE http://localhost:3001/api/share-snapshots/550e8400-e29b-41d4-a716-446655440000
```

**Response (204 No Content):**
```
(본문 없음)
```

## 테스트 예시

### 전체 플로우 테스트

```bash
# 1. Snapshot 생성
RESPONSE=$(curl -s -X POST http://localhost:3001/api/share-snapshots \
  -H "Content-Type: application/json" \
  -d '{
    "reportModel": {
      "inputs": { "brand": "테스트", "product": "제품", "url": null },
      "result": { "score": 50, "grade": "C", "summary": "테스트", "evidence": [], "actions": [] },
      "analysis": { "scores": { "branding": null, "contentStructureV2": null, "urlStructureV1": null } }
    }
  }')

# 2. 생성된 ID 추출
ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "Created ID: $ID"

# 3. Snapshot 조회
curl http://localhost:3001/api/share-snapshots/$ID
```

### Health Check

```bash
curl http://localhost:3001/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 저장소 구조

현재는 **in-memory** 저장소를 사용합니다.

- `server/storage/shareSnapshotStore.js`: 저장 인터페이스
- 향후 파일 기반 또는 DB로 교체 가능하도록 인터페이스 분리

## 주의사항

1. **현재는 TTL/만료 기능이 없습니다**
   - 코드에 주석으로만 표시되어 있음
   - Phase 11-2에서 실제 만료 스케줄러 구현 예정

2. **서버 재시작 시 모든 데이터가 사라집니다**
   - MVP 단계이므로 in-memory 저장소 사용
   - 프로덕션에서는 DB 또는 파일 시스템 사용 필요

3. **인증/인가가 없습니다**
   - Phase 11-1에서는 최소 구현만
   - Phase 11-2에서 JWT 인증 추가 예정

4. **Rate limiting이 없습니다**
   - Phase 11-2에서 구현 예정

## 다음 단계 (Phase 11-2)

- [ ] TTL/만료 스케줄러 구현
- [ ] 파일 기반 저장소 옵션 추가
- [ ] JWT 인증 추가
- [ ] Rate limiting 구현
- [ ] Pro 구독 확인 로직 추가

