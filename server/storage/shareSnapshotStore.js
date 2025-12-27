/**
 * Share Snapshot 저장 인터페이스
 * 
 * MVP: in-memory 저장소 사용
 * 향후: 파일 기반 또는 DB로 교체 가능하도록 인터페이스 분리
 */

/**
 * Snapshot 저장소 인터페이스
 * @typedef {Object} ShareSnapshot
 * @property {number} version - 스키마 버전 (현재: 1)
 * @property {string} createdAt - 생성 시각 (ISO 8601)
 * @property {Object} reportModel - Share 렌더링에 필요한 리포트 모델
 * @property {Object} [meta] - 선택적 메타데이터
 */

class ShareSnapshotStore {
  constructor() {
    // MVP: in-memory 저장소
    // 향후: 파일 시스템 또는 DB로 교체 가능
    this.snapshots = new Map();
  }

  /**
   * Snapshot 저장
   * @param {Object} reportModel - Share 렌더링에 필요한 리포트 모델
   * @param {Object} [meta] - 선택적 메타데이터
   * @returns {string} 생성된 snapshot ID (UUID)
   */
  async save(reportModel, meta = {}) {
    const id = this.generateId();
    const snapshot = {
      version: 1,
      createdAt: new Date().toISOString(),
      reportModel: this.sanitizeReportModel(reportModel),
      meta: {
        ...meta,
        // TTL 옵션 (현재는 주석만, 실제 만료 스케줄러는 Phase 11-2에서 구현)
        // ttlDays: meta.ttlDays || 30,
        // expiresAt: new Date(Date.now() + (meta.ttlDays || 30) * 24 * 60 * 60 * 1000).toISOString()
      }
    };

    this.snapshots.set(id, snapshot);
    return id;
  }

  /**
   * Snapshot 조회
   * @param {string} id - Snapshot ID
   * @returns {ShareSnapshot|null} Snapshot 객체 또는 null
   */
  async get(id) {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      return null;
    }

    // TTL 검증 (현재는 주석만, 실제 검증은 Phase 11-2에서 구현)
    // if (snapshot.meta.expiresAt && new Date(snapshot.meta.expiresAt) < new Date()) {
    //   this.snapshots.delete(id);
    //   return null;
    // }

    return snapshot;
  }

  /**
   * Snapshot 삭제
   * @param {string} id - Snapshot ID
   * @returns {boolean} 삭제 성공 여부
   */
  async delete(id) {
    return this.snapshots.delete(id);
  }

  /**
   * UUID v4 생성
   * @returns {string} UUID
   */
  generateId() {
    // 간단한 UUID v4 생성 (프로덕션에서는 crypto.randomUUID() 사용 권장)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * ReportModel 정제 (민감정보/대량 텍스트 제거)
   * @param {Object} reportModel - 원본 리포트 모델
   * @returns {Object} 정제된 리포트 모델
   */
  sanitizeReportModel(reportModel) {
    const sanitized = { ...reportModel };

    // 원본 HTML 입력은 제거 (대량 텍스트)
    // Share 렌더링에는 필요 없음
    if (sanitized.input) {
      sanitized.input = null;
    }

    // 민감정보 제거 (사용자 개인정보 등)
    // 현재는 특별한 민감정보가 없지만, 향후 확장 대비

    return sanitized;
  }

  /**
   * 저장소 통계 (디버깅용)
   * @returns {Object} 통계 정보
   */
  getStats() {
    return {
      count: this.snapshots.size,
      ids: Array.from(this.snapshots.keys())
    };
  }
}

// 싱글톤 인스턴스 export
module.exports = new ShareSnapshotStore();

