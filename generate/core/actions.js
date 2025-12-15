import { getValueOrDefault } from "./state.js";
import { generateHTML } from "./template.js";
import { requireLogin, requireCredit } from "../../core/gate.js";
import { spendCredit } from "../../core/credit.js";

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

