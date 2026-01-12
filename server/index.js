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
const path = require('path');
const fs = require('fs/promises');
const shareSnapshotStore = require('./storage/shareSnapshotStore');
const { saveSnapshot, getSnapshot } = require('./snapshotStore');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '1mb' })); // payload 크기 제한

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ✅ [Phase 26-0A] Snapshot API
// POST /api/snapshot
app.post('/api/snapshot', async (req, res) => {
  try {
    const { reportModel, source } = req.body;

    if (!reportModel || typeof reportModel !== 'object') {
      return res.status(400).json({
        error: 'INVALID_PAYLOAD',
        message: 'reportModel이 필요합니다.'
      });
    }

    const id = await saveSnapshot(reportModel, source || '');

    res.status(201).json({ id });
  } catch (error) {
    console.error('[POST /api/snapshot] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Snapshot 저장 중 오류가 발생했습니다.'
    });
  }
});

// GET /api/snapshot/:id
app.get('/api/snapshot/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'Snapshot ID가 필요합니다.'
      });
    }

    const snapshot = await getSnapshot(id);

    if (!snapshot) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Snapshot을 찾을 수 없습니다.'
      });
    }

    res.json(snapshot);
  } catch (error) {
    console.error('[GET /api/snapshot/:id] Error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Snapshot 조회 중 오류가 발생했습니다.'
    });
  }
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

// ✅ [Phase 30-7A-1] Append-only usage events (dev JSONL, log-only)
// Hard rules:
// - Only log (no quota enforcement / plan checks / deduction)
// - Append-only storage
// - Do not touch Share/Analyze scoring or __lastV2 schema
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getBestEffortIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim().length > 0) {
    // may contain multiple comma-separated IPs
    return xf.split(',')[0].trim() || null;
  }
  if (typeof req.ip === 'string' && req.ip.trim().length > 0) return req.ip;
  return null;
}

app.post('/api/usage-events', async (req, res) => {
  try {
    const body = req.body;
    if (!isPlainObject(body)) {
      return res.status(400).json({ ok: false, error: 'INVALID_JSON_BODY' });
    }

    const reportIdRaw = Object.prototype.hasOwnProperty.call(body, 'reportId') ? body.reportId : null;
    const reportId =
      reportIdRaw === null || typeof reportIdRaw === 'undefined'
        ? null
        : (typeof reportIdRaw === 'string' && reportIdRaw.trim().length > 0 ? reportIdRaw : '__INVALID__');

    const source = body.source;
    const action = body.action;
    const ts = body.ts;

    const metaRaw = Object.prototype.hasOwnProperty.call(body, 'meta') ? body.meta : null;
    const meta =
      metaRaw === null || typeof metaRaw === 'undefined'
        ? null
        : (isPlainObject(metaRaw) ? metaRaw : '__INVALID__');

    if (reportId === '__INVALID__') {
      return res.status(400).json({ ok: false, error: 'INVALID_REPORT_ID' });
    }
    if (!isNonEmptyString(source)) {
      return res.status(400).json({ ok: false, error: 'INVALID_SOURCE' });
    }
    if (!isNonEmptyString(action)) {
      return res.status(400).json({ ok: false, error: 'INVALID_ACTION' });
    }
    if (typeof ts !== 'number' || !Number.isFinite(ts)) {
      return res.status(400).json({ ok: false, error: 'INVALID_TS' });
    }
    if (meta === '__INVALID__') {
      return res.status(400).json({ ok: false, error: 'INVALID_META' });
    }

    const receivedAt = Date.now();
    const id = `${ts}_${Math.random().toString(16).slice(2, 10)}`;
    const ua = (typeof req.headers['user-agent'] === 'string' && req.headers['user-agent'].trim().length > 0)
      ? req.headers['user-agent']
      : null;
    const ip = getBestEffortIp(req);

    const event = {
      id,
      receivedAt,
      reportId,
      source,
      action,
      ts,
      meta,
      ua,
      ip
    };

    const dataDir = path.join(__dirname, 'data');
    const filePath = path.join(dataDir, 'usage-events.jsonl');
    await fs.mkdir(dataDir, { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf8');

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[POST /api/usage-events] Error:', error);
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' });
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

