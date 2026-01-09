// server/snapshotStore.js
// Phase 26-0A: 파일 기반 immutable snapshot 저장소

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const SNAPSHOTS_DIR = path.resolve(process.cwd(), 'data', 'snapshots');

/**
 * 디렉토리 생성 (없으면)
 */
async function ensureDir() {
  try {
    await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
  } catch (e) {
    // 이미 존재하면 무시
  }
}

/**
 * 안전한 ID 생성 (UUID 기반)
 */
function generateId() {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * 안전한 ID 검증 (path traversal 방지)
 */
function safeId(inputId) {
  if (!inputId || typeof inputId !== 'string') return null;
  // 영숫자, 하이픈, 언더스코어만 허용, 길이 제한
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(inputId)) return null;
  return inputId;
}

/**
 * Snapshot 저장 (immutable)
 * @param {Object} reportModel - 리포트 모델
 * @param {string} source - 소스 정보 (선택적)
 * @returns {Promise<string>} 생성된 snapshot ID
 */
async function saveSnapshot(reportModel, source = '') {
  await ensureDir();
  
  const id = generateId();
  const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
  
  const snapshot = {
    id,
    reportModel,
    source: source || null,
    createdAt: new Date().toISOString()
  };
  
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  
  return id;
}

/**
 * Snapshot 조회
 * @param {string} id - Snapshot ID
 * @returns {Promise<Object|null>} Snapshot 객체 또는 null
 */
async function getSnapshot(id) {
  const safeIdValue = safeId(id);
  if (!safeIdValue) return null;
  
  const filePath = path.join(SNAPSHOTS_DIR, `${safeIdValue}.json`);
  
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const snapshot = JSON.parse(raw);
    return snapshot;
  } catch (e) {
    // 파일 없음 또는 파싱 오류
    return null;
  }
}

module.exports = {
  saveSnapshot,
  getSnapshot
};

