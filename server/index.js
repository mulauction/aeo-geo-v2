/**
 * Phase 11-1: Share Snapshot API 서버
 * 
 * 최소 구현:
 * - POST /api/share-snapshots : payload 저장, { id } 반환
 * - GET /api/share-snapshots/:id : payload 반환, 없으면 404
 * 
 * 저장소: in-memory (MVP)
 * 향후: 파일 기반 또는 DB로 교체 가능
 */

const express = require('express');
const cors = require('cors');
const shareSnapshotStore = require('./storage/shareSnapshotStore');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '1mb' })); // payload 크기 제한

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/share-snapshots
 * Snapshot 생성
 * 
 * Request Body:
 * {
 *   "reportModel": { ... },  // Share 렌더링에 필요한 리포트 모델
 *   "meta": { ... }           // 선택적 메타데이터
 * }
 * 
 * Response:
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000"
 * }
 */
app.post('/api/share-snapshots', async (req, res) => {
  try {
    const { reportModel, meta } = req.body;

    // 유효성 검증
    if (!reportModel) {
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: 'reportModel이 필요합니다.'
      });
    }

    // reportModel 기본 구조 검증
    if (typeof reportModel !== 'object') {
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: 'reportModel은 객체여야 합니다.'
      });
    }

    // Snapshot 저장
    const id = await shareSnapshotStore.save(reportModel, meta || {});

    res.status(201).json({ id });
  } catch (error) {
    console.error('[POST /api/share-snapshots] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Snapshot 저장 중 오류가 발생했습니다.'
    });
  }
});

/**
 * GET /api/share-snapshots/:id
 * Snapshot 조회
 * 
 * Response:
 * {
 *   "version": 1,
 *   "createdAt": "2024-01-01T00:00:00.000Z",
 *   "reportModel": { ... },
 *   "meta": { ... }
 * }
 */
app.get('/api/share-snapshots/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'Snapshot ID가 필요합니다.'
      });
    }

    // Snapshot 조회
    const snapshot = await shareSnapshotStore.get(id);

    if (!snapshot) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Snapshot을 찾을 수 없습니다.'
      });
    }

    res.json(snapshot);
  } catch (error) {
    console.error('[GET /api/share-snapshots/:id] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Snapshot 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * DELETE /api/share-snapshots/:id
 * Snapshot 삭제 (선택적, Phase 11-1에서는 구현하지 않아도 됨)
 */
app.delete('/api/share-snapshots/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await shareSnapshotStore.delete(id);

    if (!deleted) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Snapshot을 찾을 수 없습니다.'
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('[DELETE /api/share-snapshots/:id] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Snapshot 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`[Phase 11-1] Share Snapshot API 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

