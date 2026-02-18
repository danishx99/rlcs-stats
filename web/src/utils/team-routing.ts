import { api } from "../api";

function normalizeTeamLabel(value: string) {
  return value.trim().toUpperCase();
}

export async function resolveTeamRosterId(teamName: string) {
  const normalized = normalizeTeamLabel(teamName);

  try {
    const response = await api.search({ q: teamName, limit: 25 });
    const candidates = [...(response.teams ?? []), ...(response.rosters ?? [])];

    const exact = candidates.find((item) => normalizeTeamLabel(item.label) === normalized);
    if (exact?.id) {
      return exact.id;
    }

    const loose = candidates.find((item) => normalizeTeamLabel(item.label).includes(normalized));
    if (loose?.id) {
      return loose.id;
    }
  } catch (error) {
    console.error("Failed to resolve team roster id", error);
  }

  return `org:${normalized}`;
}
