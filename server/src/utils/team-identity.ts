export function normalizeTeamGroupId(rawId: string) {
  let decoded = rawId;
  try {
    decoded = decodeURIComponent(rawId);
  } catch {
    decoded = rawId;
  }

  decoded = decoded.trim();
  if (!decoded) return decoded;
  if (decoded.startsWith("org:") || decoded.startsWith("roster:")) return decoded;
  return `roster:${decoded}`;
}

export function normalizeTeamLabel(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}
