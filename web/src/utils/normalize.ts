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

export function proxyImageUrl(value?: string | null) {
  const url = normalizeHandle(value);
  if (!url) return null;
  const upgraded = upgradeLiquipediaThumb(url);
  const base = (import.meta.env.VITE_API_URL ?? "").trim();
  const encoded = encodeURIComponent(upgraded);

  if (!base) {
    return `/api/image?url=${encoded}`;
  }

  if (base.startsWith("http://") || base.startsWith("https://")) {
    return new URL(`/api/image?url=${encoded}`, base).toString();
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  if (normalizedBase.endsWith("/api")) {
    return `${normalizedBase}/image?url=${encoded}`;
  }
  return `${normalizedBase}/api/image?url=${encoded}`;
}

function upgradeLiquipediaThumb(input: string) {
  // Liquipedia thumbs often look like:
  // /commons/images/thumb/<path>/<file.ext>/<size>-<file.ext>
  // Use original image path to avoid low-res thumbnails.
  try {
    const url = new URL(input);
    if (!url.hostname.endsWith("liquipedia.net") && !url.hostname.endsWith("liquipedia.org")) {
      return input;
    }
    const path = url.pathname;
    if (!path.includes("/images/thumb/")) {
      return input;
    }
    const marker = "/images/thumb/";
    const idx = path.indexOf(marker);
    if (idx < 0) return input;
    const after = path.slice(idx + marker.length);
    const parts = after.split("/").filter(Boolean);
    if (parts.length < 2) return input;
    const originalParts = parts.slice(0, -1);
    const originalPath = `${path.slice(0, idx)}${marker.replace("/thumb", "")}${originalParts.join("/")}`;
    return `${url.origin}${originalPath}`;
  } catch {
    return input;
  }
}
