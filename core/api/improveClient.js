/**
 * ✅ [Phase 4-3A] LLM 개선 생성 API 클라이언트 모듈
 * API 계약(Contract) + 클라이언트 모듈
 * 실제 서버 호출은 Phase 4-3B에서 연결 예정
 */

/**
 * 개선 요청 payload 생성
 * @param {Object} report - 리포트 객체 (buildReportPayload() 결과)
 * @param {string} ruleBased - 룰 기반 개선안 HTML 문자열
 * @returns {Object} API 요청 payload 객체
 */
export function buildImproveRequestV1(report, ruleBased) {
  if (!report) {
    throw new Error("report is required");
  }
  if (typeof ruleBased !== "string") {
    throw new Error("ruleBased must be a string");
  }

  return {
    version: "v1",
    report: {
      input: report.input || null,
      result: report.result || null,
      analysis: report.analysis || {
        scores: {
          branding: null,
          contentStructureV2: null,
          urlStructureV1: null
        }
      },
      generatedAt: report.generatedAt || Date.now()
    },
    ruleBased: ruleBased,
    timestamp: Date.now()
  };
}

/**
 * 개선 응답 검증
 * @param {any} json - API 응답 JSON 객체
 * @returns {boolean} 검증 통과 여부
 * @throws {Error} 검증 실패 시 에러 메시지
 */
export function validateImproveResponseV1(json) {
  if (!json || typeof json !== "object") {
    throw new Error("Response must be an object");
  }

  // ok 필드 검증
  if (json.ok !== true && json.ok !== false) {
    throw new Error("Response must have 'ok' field (boolean)");
  }

  // ok가 false인 경우 error 필드 검증
  if (json.ok === false) {
    if (!json.error || typeof json.error !== "object") {
      throw new Error("Response with ok=false must have 'error' object");
    }
    if (typeof json.error.code !== "string" && typeof json.error.code !== "number") {
      throw new Error("Response error must have 'code' field (string or number)");
    }
    if (typeof json.error.message !== "string") {
      throw new Error("Response error must have 'message' field (string)");
    }
    return true; // 에러 응답도 유효한 응답
  }

  // ok가 true인 경우 result 필드 검증
  if (!json.result || typeof json.result !== "object") {
    throw new Error("Response with ok=true must have 'result' object");
  }

  // result.html 검증
  if (typeof json.result.html !== "string") {
    throw new Error("Response result must have 'html' field (string)");
  }

  // result.checklist 검증 (배열이어야 함)
  if (!Array.isArray(json.result.checklist)) {
    throw new Error("Response result must have 'checklist' field (array)");
  }

  // checklist 항목 검증 (모두 문자열이어야 함)
  for (let i = 0; i < json.result.checklist.length; i++) {
    if (typeof json.result.checklist[i] !== "string") {
      throw new Error(`Response result.checklist[${i}] must be a string`);
    }
  }

  return true;
}

/**
 * 개선 API 요청
 * @param {Object} options - 요청 옵션
 * @param {string} options.endpoint - API 엔드포인트 URL
 * @param {Object} options.payload - 요청 payload 객체
 * @param {number} options.timeoutMs - 타임아웃 시간 (밀리초)
 * @returns {Promise<Object>} 응답 객체 { ok: boolean, result?: { html: string, checklist: string[] }, error?: { code: string|number, message: string } }
 */
export async function requestImproveV1({ endpoint, payload, timeoutMs }) {
  if (!endpoint || typeof endpoint !== "string") {
    return {
      ok: false,
      error: {
        code: "INVALID_ENDPOINT",
        message: "endpoint must be a non-empty string"
      }
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "payload must be an object"
      }
    };
  }

  if (typeof timeoutMs !== "number" || timeoutMs <= 0) {
    return {
      ok: false,
      error: {
        code: "INVALID_TIMEOUT",
        message: "timeoutMs must be a positive number"
      }
    };
  }

  // AbortController로 timeout 처리
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // HTTP 에러 처리
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      } catch (e) {
        // ignore
      }

      return {
        ok: false,
        error: {
          code: response.status,
          message: errorMessage
        }
      };
    }

    // JSON 파싱
    let json;
    try {
      json = await response.json();
    } catch (e) {
      return {
        ok: false,
        error: {
          code: "INVALID_JSON",
          message: `Failed to parse response as JSON: ${e.message}`
        }
      };
    }

    // 응답 검증
    try {
      validateImproveResponseV1(json);
    } catch (validationError) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Response validation failed: ${validationError.message}`
        }
      };
    }

    // 검증 통과한 응답 반환
    return json;

  } catch (error) {
    clearTimeout(timeoutId);

    // AbortError는 timeout으로 처리
    if (error.name === "AbortError") {
      return {
        ok: false,
        error: {
          code: "TIMEOUT",
          message: `Request timed out after ${timeoutMs}ms`
        }
      };
    }

    // 네트워크 에러 등 기타 에러
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: error.message || "Network request failed"
      }
    };
  }
}

