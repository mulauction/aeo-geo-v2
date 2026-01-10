import { getValueOrDefault } from "./state.js";
import { generateHTML } from "./template.js";
import { requireLogin, requireCredit } from "../../core/gate.js";
import { spendCredit } from "../../core/credit.js";

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
  root.btnGen.addEventListener("click", () => {
    if (!requireLogin({ reason: "HTML 생성 기능을 사용하려면 로그인이 필요합니다." })) {
      return;
    }

    if (!requireCredit(2, { reason: "HTML 생성 기능을 사용하려면 2 크레딧이 필요합니다." })) {
      return;
    }

    const product = getValueOrDefault(root.product.value, "product");
    const brand = getValueOrDefault(root.brand.value, "brand");
    const usecase = getValueOrDefault(root.usecase.value, "usecase");

    spendCredit(2);

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

