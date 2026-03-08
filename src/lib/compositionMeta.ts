export function parseAccompanimentList(
  value: string | string[] | null | undefined,
) {
  const source = Array.isArray(value) ? value : [value ?? ""];

  return [...new Set(
    source
      .flatMap((item) => String(item || "").split(/[,;|]|•|â€¢/g))
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

export function stringifyAccompanimentList(
  value: string | string[] | null | undefined,
) {
  const parts = parseAccompanimentList(value);
  return parts.length > 0 ? parts.join(", ") : null;
}


