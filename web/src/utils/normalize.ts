export function normalizeHandle(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function normalizeSocialLink(value: string | null | undefined, type: "twitch" | "tiktok" | "twitter" | "youtube") {
  const handle = normalizeHandle(value);
  if (!handle) return null;
  if (handle.startsWith("http://") || handle.startsWith("https://")) {
    return handle;
  }
  const cleaned = handle.replace(/^@/, "");
  if (type === "twitch") {
    return `https://twitch.tv/${cleaned}`;
  }
  if (type === "twitter") {
    return `https://x.com/${cleaned}`;
  }
  if (type === "youtube") {
    return `https://youtube.com/@${cleaned}`;
  }
  return `https://tiktok.com/@${cleaned}`;
}

export const DEFAULT_PLAYER_PHOTO = "https://rlesport.gg/downloads/player_pics/default_nologo.png";
export const DEFAULT_TEAM_LOGO = "https://rlesport.gg/downloads/org_logos/default_team.jpg";

type ProxyImageOptions = {
  size?: number;
};

export function proxyImageUrl(value?: string | null, options?: ProxyImageOptions) {
  const url = normalizeHandle(value);
  if (!url) return null;
  const optimized = optimizeLiquipediaImage(url, options?.size);
  const base = (import.meta.env.VITE_API_URL ?? "").trim();
  const encoded = encodeURIComponent(optimized);
  const sizeQuery = options?.size && Number.isFinite(options.size) ? `&size=${Math.round(options.size)}` : "";

  if (!base) {
    return `/api/image?url=${encoded}${sizeQuery}`;
  }

  if (base.startsWith("http://") || base.startsWith("https://")) {
    return new URL(`/api/image?url=${encoded}${sizeQuery}`, base).toString();
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  if (normalizedBase.endsWith("/api")) {
    return `${normalizedBase}/image?url=${encoded}${sizeQuery}`;
  }
  return `${normalizedBase}/api/image?url=${encoded}${sizeQuery}`;
}

const LIQUIPEDIA_THUMB_PX = 600;
const LIQUIPEDIA_MIN_THUMB_PX = 40;
const LIQUIPEDIA_MAX_THUMB_PX = 1200;

function normalizeThumbSize(size?: number) {
  if (!Number.isFinite(size)) return LIQUIPEDIA_THUMB_PX;
  const rounded = Math.round(size as number);
  return Math.max(LIQUIPEDIA_MIN_THUMB_PX, Math.min(LIQUIPEDIA_MAX_THUMB_PX, rounded));
}

function optimizeLiquipediaImage(input: string, size?: number) {
  try {
    const url = new URL(input);
    if (!url.hostname.endsWith("liquipedia.net") && !url.hostname.endsWith("liquipedia.org")) {
      return input;
    }
    const thumbSize = normalizeThumbSize(size);

    const path = url.pathname;
    const thumbMarker = "/images/thumb/";
    const rawMarker = "/images/";

    if (path.includes(thumbMarker)) {
      const idx = path.indexOf(thumbMarker);
      const after = path.slice(idx + thumbMarker.length);
      const parts = after.split("/").filter(Boolean);
      if (parts.length < 3) return input;
      const filename = parts[parts.length - 2];
      const pathParts = parts.slice(0, -1);
      return `${url.origin}${path.slice(0, idx)}${thumbMarker}${pathParts.join("/")}/${thumbSize}px-${filename}`;
    }

    if (path.includes(rawMarker)) {
      const idx = path.indexOf(rawMarker);
      const after = path.slice(idx + rawMarker.length);
      const parts = after.split("/").filter(Boolean);
      if (parts.length < 1) return input;
      const filename = parts[parts.length - 1];
      return `${url.origin}${path.slice(0, idx)}${thumbMarker}${parts.join("/")}/${thumbSize}px-${filename}`;
    }

    return input;
  } catch {
    return input;
  }
}
