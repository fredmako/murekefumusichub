export type ProfileImageResizeMode = "cover" | "contain";

export interface ProfileImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: ProfileImageResizeMode;
}

const DEFAULT_QUALITY = 72;
const DEFAULT_RESIZE: ProfileImageResizeMode = "cover";
const urlCache = new Map<string, string>();

function toFiniteInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function parseImageUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    if (typeof window === "undefined") return null;
    try {
      return new URL(rawUrl, window.location.origin);
    } catch {
      return null;
    }
  }
}

function isSupabaseAvatarStorageUrl(url: URL): boolean {
  const path = String(url.pathname || "").toLowerCase();
  return path.includes("/storage/v1/") && path.includes("/avatars/");
}

function toRenderImagePath(pathname: string): string {
  return pathname.replace("/storage/v1/object/", "/storage/v1/render/image/");
}

export function getOptimizedProfileImageUrl(
  sourceUrl: string | null | undefined,
  options: ProfileImageOptions = {},
): string | null {
  const raw = String(sourceUrl || "").trim();
  if (!raw) return null;

  if (raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }

  const width = toFiniteInt(options.width);
  const height = toFiniteInt(options.height);
  const quality = toFiniteInt(options.quality) || DEFAULT_QUALITY;
  const resize = options.resize || DEFAULT_RESIZE;

  const cacheKey = `${raw}|w:${width || ""}|h:${height || ""}|q:${quality}|r:${resize}`;
  const cached = urlCache.get(cacheKey);
  if (cached) return cached;

  const parsed = parseImageUrl(raw);
  if (!parsed || !isSupabaseAvatarStorageUrl(parsed)) {
    urlCache.set(cacheKey, raw);
    return raw;
  }

  if (parsed.pathname.includes("/storage/v1/object/")) {
    parsed.pathname = toRenderImagePath(parsed.pathname);
  }

  if (width) parsed.searchParams.set("width", String(width));
  if (height) parsed.searchParams.set("height", String(height));
  parsed.searchParams.set("resize", resize);
  parsed.searchParams.set("quality", String(quality));

  const optimized = parsed.toString();
  urlCache.set(cacheKey, optimized);
  return optimized;
}

export function buildProfileImageSrcSet(
  sourceUrl: string | null | undefined,
  widths: number[] = [40, 64, 96],
  options: Omit<ProfileImageOptions, "width" | "height"> = {},
): string {
  const raw = String(sourceUrl || "").trim();
  if (!raw) return "";

  const uniqueWidths = [...new Set(widths.map((w) => toFiniteInt(w)).filter(Boolean))] as number[];
  if (uniqueWidths.length === 0) return "";

  return uniqueWidths
    .map((width) => {
      const url = getOptimizedProfileImageUrl(raw, {
        ...options,
        width,
        height: width,
      });
      return url ? `${url} ${width}w` : "";
    })
    .filter(Boolean)
    .join(", ");
}

export default {
  getOptimizedProfileImageUrl,
  buildProfileImageSrcSet,
};
