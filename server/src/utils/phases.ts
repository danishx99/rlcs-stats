export type PhaseFilter = "all" | string;
export type DayFilter = "all" | string;

export function normalizePhase(raw: string | null): PhaseFilter {
  if (!raw) return "all";
  const value = raw.trim();
  if (!value || value.toLowerCase() === "all") return "all";
  return value;
}

export function normalizeDay(raw: string | null): DayFilter {
  if (!raw) return "all";
  const value = raw.trim();
  if (!value || value.toLowerCase() === "all") return "all";
  return value;
}
