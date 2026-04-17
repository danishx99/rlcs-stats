export function normalizeMode(raw: string | null) {
  return raw === "total" ? "total" : "avg";
}

export function normalizeFilter(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return null;
  return trimmed;
}

export function parseListParam(value: string | null) {
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type FilterKey = "season" | "split" | "event" | "gameMode" | "scope" | "tier";

const FILTER_COLUMNS: Record<FilterKey, string> = {
  season: "Season",
  split: "Split",
  event: "Event",
  gameMode: "mode",
  scope: "scope",
  tier: "tier"
};

const LOWERCASE_FILTER_KEYS = new Set<FilterKey>(["gameMode", "scope", "tier"]);

function columnRef(alias: string, column: string) {
  return alias ? `${alias}."${column}"` : `"${column}"`;
}

export function buildFilterClauses(
  params: URLSearchParams,
  alias = "s",
  keys: FilterKey[] = ["season", "split", "event", "gameMode", "scope", "tier"]
) {
  const clauses: string[] = [];
  const values: string[] = [];

  for (const key of keys) {
    const value = normalizeFilter(params.get(key));
    if (!value) continue;
    clauses.push(`${columnRef(alias, FILTER_COLUMNS[key])} = $${values.length + 1}`);
    values.push(LOWERCASE_FILTER_KEYS.has(key) ? value.toLowerCase() : value);
  }

  return { clauses, values };
}
