export function normalizeHandle(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function normalizeSocialLink(value: string | null | undefined, type: "twitch" | "tiktok") {
  const handle = normalizeHandle(value);
  if (!handle) return null;
  if (handle.startsWith("http://") || handle.startsWith("https://")) {
    return handle;
  }
  const cleaned = handle.replace(/^@/, "");
  if (type === "twitch") {
    return `https://twitch.tv/${cleaned}`;
  }
  return `https://tiktok.com/@${cleaned}`;
}

export function proxyImageUrl(value?: string | null) {
  const url = normalizeHandle(value);
  if (!url) return null;
  const base = (import.meta.env.VITE_API_URL ?? "").trim();
  const encoded = encodeURIComponent(url);

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
