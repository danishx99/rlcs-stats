import type { Client } from "pg";
import { createStatsTableSql, addStatsTableCommentsSql } from "./stats-schema";
import {
  createPlayersTableSql,
  addPlayersTableCommentsSql,
  addPlayersColumnsSql
} from "./players-schema";
import {
  createTeamProfilesTableSql,
  addTeamProfilesCommentsSql,
  addTeamProfilesColumnsSql
} from "./teams-schema";
import { createStandingsTableSql } from "./standings-schema";
import { loadStandingsCsv } from "./load-standings";

export type DatasetKey = "matches" | "players" | "teams" | "standings";

export type DatasetConfig = {
  key: DatasetKey;
  label: string;
  dataSubdir: string;
  tableName: string;
  schemaFile: string;
  createTableSql: string;
  addColumnsSql?: string;
  addCommentsSql?: string;
  headerNormalizer?: (header: string) => string;
  ignoreCoercionErrors?: boolean;
  stopAfterHeader?: string;
  denormalize?: boolean;
  /** Custom loader for non-standard CSV formats. Skips the generic loadCsvFile pipeline. */
  customLoader?: (client: Client, filePaths: string[], dryRun: boolean) => Promise<void>;
};

const playerHeaderAliases = new Map<string, string>([
  ["playerid", "Player ID"],
  ["primaryhandle", "Primary Handle"],
  ["allaliases", "All Aliases"],
  ["realname", "Real Name"],
  ["pronounciation", "Pronounciation"],
  ["pronunciation", "Pronounciation"],
  ["dateofbirth", "Date of Birth"],
  ["country", "Country"],
  ["twitch", "Twitch"],
  ["twitch", "Twitch"],
  ["tiktok", "TikTok"],
  ["photourl", "Photo URL"]
]);

function normalizePlayerHeader(header: string): string {
  const cleaned = header.trim().replace(/\s+/g, " ");
  const key = cleaned.replace(/[\s_-]+/g, "").toLowerCase();
  return playerHeaderAliases.get(key) ?? cleaned;
}

export const DATASETS: DatasetConfig[] = [
  {
    key: "matches",
    label: "matches",
    dataSubdir: "matches",
    tableName: "stats",
    schemaFile: "src/stats-schema.ts",
    createTableSql: createStatsTableSql,
    addCommentsSql: addStatsTableCommentsSql,
    denormalize: true
  },
  {
    key: "players",
    label: "players",
    dataSubdir: "players",
    tableName: "players",
    schemaFile: "src/players-schema.ts",
    createTableSql: createPlayersTableSql,
    addColumnsSql: addPlayersColumnsSql,
    addCommentsSql: addPlayersTableCommentsSql,
    headerNormalizer: normalizePlayerHeader,
    ignoreCoercionErrors: true,
    stopAfterHeader: "Photo URL"
  },
  {
    key: "teams",
    label: "teams",
    dataSubdir: "rosters",
    tableName: "team_profiles",
    schemaFile: "src/teams-schema.ts",
    createTableSql: createTeamProfilesTableSql,
    addColumnsSql: addTeamProfilesColumnsSql,
    addCommentsSql: addTeamProfilesCommentsSql,
    ignoreCoercionErrors: true,
    stopAfterHeader: "Twitch"
  },
  {
    key: "standings",
    label: "standings",
    dataSubdir: "standings",
    tableName: "standings",
    schemaFile: "src/standings-schema.ts",
    createTableSql: createStandingsTableSql,
    customLoader: async (client, filePaths, dryRun) => {
      for (const filePath of filePaths) {
        await loadStandingsCsv(client, filePath, dryRun);
      }
    }
  }
];

export function resolveDatasets(selection?: string): DatasetConfig[] {
  if (!selection || selection === "all") {
    return DATASETS;
  }
  const match = DATASETS.find((dataset) => dataset.key === selection);
  if (!match) {
    const supported = DATASETS.map((dataset) => dataset.key).join(", ");
    throw new Error(`Unknown dataset "${selection}". Supported datasets: ${supported}.`);
  }
  return [match];
}
