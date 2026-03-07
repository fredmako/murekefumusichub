export function normalizeAvatarUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }

  const signMarker = "/storage/v1/object/sign/";
  if (parsed.pathname.includes(signMarker)) {
    const bucketAndPath = parsed.pathname.split(signMarker)[1] || "";
    let decodedBucketAndPath = bucketAndPath;
    try {
      decodedBucketAndPath = decodeURIComponent(bucketAndPath);
    } catch {
      decodedBucketAndPath = bucketAndPath;
    }

    // Keep signed avatar URLs intact. Converting to /public breaks when bucket is private.
    if (decodedBucketAndPath.startsWith("avatars/")) return raw;
  }

  if (parsed.pathname.includes("/storage/v1/object/public/avatars/")) {
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  }

  return raw;
}

export function normalizeAvatarInRecord<T extends { avatar_url?: string | null }>(
  record: T,
): T {
  if (!record) return record;

  return {
    ...record,
    avatar_url: normalizeAvatarUrl(record.avatar_url),
  };
}
