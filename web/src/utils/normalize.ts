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
  return `http://localhost:8787/api/image?url=${encodeURIComponent(url)}`;
}
