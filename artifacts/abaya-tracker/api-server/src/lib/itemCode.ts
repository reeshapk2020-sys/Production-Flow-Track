export function computeItemCode(
  productCode: string | null | undefined,
  colorCode: string | null | undefined,
  materialCode: string | null | undefined,
  material2Code: string | null | undefined
): string {
  return [productCode, colorCode, materialCode, material2Code]
    .filter((p) => p && String(p).trim().length > 0)
    .map((p) => String(p!).trim())
    .join("-");
}
