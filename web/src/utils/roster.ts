import type { RosterAlternate, RosterStarter } from "../types/api";

export function toOrgRosterId(teamName: string) {
  return `org:${teamName.trim().toUpperCase()}`;
}

export function formatRosterStarters(starters: RosterStarter[] | null | undefined) {
  if (!starters?.length) return "—";
  return starters.map((starter) => starter.handle ?? starter.id).join(" · ");
}

export function formatRosterAlternates(alternates: RosterAlternate[] | null | undefined) {
  if (!alternates?.length) return "—";
  return alternates
    .map((alternate) => {
      const label = alternate.handle ?? alternate.id;
      if (alternate.appearances === undefined || alternate.appearances === null) {
        return label;
      }
      return `${label} (${alternate.appearances})`;
    })
    .join(", ");
}
