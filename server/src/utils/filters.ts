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

export function buildFilterClauses(params: URLSearchParams, alias = "s") {
  const clauses: string[] = [];
  const values: string[] = [];
  const season = normalizeFilter(params.get("season"));
  const split = normalizeFilter(params.get("split"));
  const event = normalizeFilter(params.get("event"));

  if (season) {
    clauses.push(`LOWER(TRIM(${alias}."Season")) = LOWER($${values.length + 1})`);
    values.push(season);
  }
  if (split) {
    clauses.push(`LOWER(TRIM(${alias}."Split")) = LOWER($${values.length + 1})`);
    values.push(split);
  }
  if (event) {
    clauses.push(`LOWER(TRIM(${alias}."Event")) = LOWER($${values.length + 1})`);
    values.push(event);
  }

  return { clauses, values };
}
