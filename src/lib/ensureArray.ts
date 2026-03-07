export function ensureArray<T = any>(
  payload: any,
  preferredKeys: string[] = [],
): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const candidateKeys = [...preferredKeys, "items", "data", "rows", "results"];
  for (const key of candidateKeys) {
    const value = (payload as any)[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
}

