import { getValueOrDefault } from "./state.js";
import { generateHTML } from "./template.js";
import { requireLogin } from "../../core/gate.js";

try {
  const dbg = (() => {
    try {
      if (typeof location === "undefined") return "";
      return String(new URLSearchParams(location.search).get("debug") || "");
    } catch (_) {
      return "";
    }
  })();
  const isDebug = (dbg === "1" || dbg === "true");
  if (isDebug && typeof window !== "undefined") {
    window.__debugExportTelemetryJSON = async () => {
      try {
        let events = [];
        try {
          if (typeof sessionStorage !== "undefined") {
            const raw = sessionStorage.getItem("__shareTelemetryV1");
            const parsed = raw ? JSON.parse(raw) : [];
            events = Array.isArray(parsed) ? parsed : [];
          }
        } catch (_) {
          events = [];
        }

        const modExport = await import("../../core/telemetryExport.js");
        const buildTelemetryExportV1 = modExport && modExport.buildTelemetryExportV1;
        if (typeof buildTelemetryExportV1 !== "function") return;

        const ctx = { url: (typeof location !== "undefined" ? location.href : ""), sourcePage: "generate" };
        const payload = buildTelemetryExportV1(events, ctx);

        const modIngest = await import("../../core/telemetryIngestClient.js");
        const sendTelemetryToIngestOnce = modIngest && modIngest.sendTelemetryToIngestOnce;
        if (typeof sendTelemetryToIngestOnce !== "function") return;

        // Try same-origin first. If the current origin doesn't support POST (e.g., static server 501),
        // fall back once to the API server on localhost:3001.
        const body = JSON.stringify({ source: "export-json", payload });
        const fallbackUrl = "http://localhost:3001/api/telemetry/ingest";
        const primaryUrl = (() => {
          try {
            if (typeof location === "undefined") return "/api/telemetry/ingest";
            if (location.port === "5502" || String(location.origin || "").includes(":5502")) {
              return fallbackUrl; // skip same-origin entirely on the static server
            }
            return "/api/telemetry/ingest";
          } catch (_) {
            return "/api/telemetry/ingest";
          }
        })();
        const post = async (url) => {
          if (typeof fetch !== "function") return { ok: false, status: -1 };
          const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: true,
          });
          return { ok: !!res.ok, status: typeof res.status === "number" ? res.status : -1 };
        };

        try {
          const r1 = await post(primaryUrl);
          if (r1.ok) return;
          if (r1.status === 501 && primaryUrl !== fallbackUrl) {
            await post(fallbackUrl);
            return;
          }
          return;
        } catch (_) {
          if (primaryUrl === fallbackUrl) return;
          try { await post(fallbackUrl); } catch (_) {}
        }
      } catch (_) {
        // no-op (no throw, no log)
      }
    };
  }
} catch {
  // no-op
}

/**
 * ⚠️ [PRODUCT_PRINCIPLES] Generate 단계 - Score Mutation 금지
 * 
 * 이 모듈은 Generate 단계의 액션을 처리합니다.
 * 
 * 절대 금지 사항:
 * - ❌ 점수를 계산하거나 변경할 수 없습니다
 * - ❌ Analyze 단계의 점수를 읽거나 수정할 수 없습니다
 * - ❌ computeContentStructureV2, computeBrandingScore 등을 호출할 수 없습니다
 * 
 * 허용되는 것:
 * - ✅ 콘텐츠 생성만 수행합니다 (HTML, FAQ 등)
 * - ✅ 생성된 콘텐츠를 출력합니다
 * 
 * 참고: 생성된 콘텐츠는 점수에 영향을 주지 않습니다.
 * 점수는 Analyze 단계에서만 결정됩니다.
 */
export function bindActions(root) {
  root.btnGen.addEventListener("click", (event) => {
    if (!requireLogin({ reason: "HTML 생성 기능을 사용하려면 로그인이 필요합니다." })) {
      return;
    }

    const product = getValueOrDefault(root.product.value, "product");
    const brand = getValueOrDefault(root.brand.value, "brand");
    const usecase = getValueOrDefault(root.usecase.value, "usecase");

    const html = generateHTML(product, brand, usecase);
    root.output.value = html;
  });

  [root.product, root.brand, root.usecase].forEach(input => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        root.btnGen.click();
      }
    });
  });
}

