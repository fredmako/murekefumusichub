const KES_FORMATTER = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatKesAmount(value: number | string | null | undefined) {
  const amount =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? "").trim());

  return KES_FORMATTER.format(Number.isFinite(amount) ? amount : 0);
}

