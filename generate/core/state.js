export const defaults = {
  product: "제품명",
  brand: "브랜드명",
  usecase: "일상에서",
};

export function getValue(value) {
  return value.trim() || "";
}

export function getValueOrDefault(value, key) {
  const trimmed = getValue(value);
  return trimmed || defaults[key];
}



