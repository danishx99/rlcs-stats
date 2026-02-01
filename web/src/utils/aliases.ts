export function formatAliases(value?: string | null) {
  if (!value) return "—";
  const seen = new Set<string>();
  const trimmed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((alias) => {
      const key = alias.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return trimmed.length ? trimmed.join(", ") : "—";
}
