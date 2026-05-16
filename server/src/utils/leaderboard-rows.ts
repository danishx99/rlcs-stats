import { toNumber } from "./response-mappers";

type LeaderboardRowInput = Record<string, unknown>;

type LeaderboardRowExtras = {
  teams: unknown[];
  photoUrl?: unknown;
  country?: unknown;
};

type LeaderboardRowOptions = {
  teamsFallback?: unknown[];
  normalizeNullables?: boolean;
  includePhotoCountry?: boolean;
};

function nullableField(value: unknown, normalizeNullables: boolean): unknown {
  return normalizeNullables ? value ?? null : value;
}

export function mapBaseLeaderboardRow(row: LeaderboardRowInput) {
  return {
    id: row.id,
    label: row.label,
    value: toNumber(row.value),
    avgValue: toNumber(row.avg_value),
    totalValue: toNumber(row.total_value)
  };
}

export function mapPlayerLeaderboardRow(row: LeaderboardRowInput, options: LeaderboardRowOptions = {}) {
  const teamsFallback = options.teamsFallback ?? [];
  const includePhotoCountry = options.includePhotoCountry ?? true;
  const normalizeNullables = options.normalizeNullables === true;

  const extras: LeaderboardRowExtras = {
    teams: Array.isArray(row.teams) ? row.teams : teamsFallback
  };

  if (includePhotoCountry) {
    extras.photoUrl = nullableField(row.photo_url, normalizeNullables);
    extras.country = nullableField(row.country, normalizeNullables);
  }

  return {
    ...mapBaseLeaderboardRow(row),
    ...extras
  };
}

export function mapTeamLeaderboardRow(row: LeaderboardRowInput, options: LeaderboardRowOptions = {}) {
  const teamsFallback = options.teamsFallback ?? [];
  return {
    ...mapBaseLeaderboardRow(row),
    teams: Array.isArray(row.teams) ? row.teams : teamsFallback
  };
}
