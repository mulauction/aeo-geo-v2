import { getValueOrDefault } from "./state.js";
import { generateHTML } from "./template.js";

export function bindActions(root) {
  root.btnGen.addEventListener("click", () => {
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

