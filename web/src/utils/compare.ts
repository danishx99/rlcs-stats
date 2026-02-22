import type { CompareHistoryRow, CompareHistoryTeam } from "../types/api";

export function seriesLabelParts(row: CompareHistoryRow) {
  return {
    prefix: [row.season, row.split].filter(Boolean).join(" · "),
    event: row.event,
    suffix: [row.stage, row.round].filter(Boolean).join(" · ")
  };
}

export function formatSeriesLabel(row: CompareHistoryRow) {
  const { prefix, event, suffix } = seriesLabelParts(row);
  const parts = [prefix, event, suffix].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Series";
}

export function teamLabel(team?: CompareHistoryTeam) {
  return team?.team ?? "Team";
}

export function entityLabel(team?: CompareHistoryTeam) {
  if (!team?.entities?.length) return "";
  return team.entities.map((entity) => entity.label ?? entity.id).join(" · ");
}

export function scoreParts(team?: CompareHistoryTeam, other?: CompareHistoryTeam) {
  if (!team) return "–";
  const teamWins = team.wins ?? 0;
  const otherWins = other?.wins ?? 0;
  return `${teamWins}-${otherWins}`;
}

export function scoreClass(team?: CompareHistoryTeam, other?: CompareHistoryTeam) {
  if (!team || !other) return "";
  if (team.wins > other.wins) return "score-win";
  if (team.wins < other.wins) return "score-loss";
  return "";
}
