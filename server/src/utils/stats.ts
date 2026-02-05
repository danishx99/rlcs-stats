import { pool } from "../db";
import { type FeaturedInsight, type StatCategory, type StatOption } from "../types";
import { playerKeyExpr, seriesIdExpr } from "./roster";
import { formatSql, loadSql } from "./sql";

const statOptionsSql = loadSql("../../sql/stats/options.sql", import.meta.url);
const leastGroundedSql = loadSql("../../sql/featured/least_grounded.sql", import.meta.url);
const bestGrandFinalsSql = loadSql("../../sql/featured/best_grand_finals.sql", import.meta.url);
const bestDeciderSql = loadSql("../../sql/featured/best_decider.sql", import.meta.url);
const fastestPlayerSql = loadSql("../../sql/featured/fastest_player.sql", import.meta.url);
const bestOtSql = loadSql("../../sql/featured/best_ot.sql", import.meta.url);
const mostDemosSql = loadSql("../../sql/featured/most_demos.sql", import.meta.url);

export const STAT_OPTIONS: StatOption[] = [
  { key: "goals", label: "Goals", column: "Goals_All Zones", format: "float" },
  { key: "assists", label: "Assists", column: "Assists_All Zones", format: "float" },
  { key: "saves", label: "Saves", column: "Saves_All Zones", format: "float" },
  { key: "demos", label: "Demos", column: "Kills_All Zones", format: "float" },
  { key: "shots", label: "Shots", column: "Shots_All Zones", format: "float" },
  { key: "score", label: "Score", column: "Score_All Zones", format: "float" },
  { key: "avg_speed", label: "Avg Speed", column: "Average Speed_All Zones", format: "float" },
  { key: "on_ground", label: "On Ground %", column: "On Ground_All Zones", format: "pct" },
  { key: "in_air", label: "In Air", column: "In Air_All Zones", format: "float" },
  { key: "series_played", label: "Series Played", kind: "series_played", format: "int" }
];

export const DEFAULT_COMPARE_STATS = ["goals", "assists", "saves", "demos"];

const STAT_OPTION_CACHE_TTL_MS = 5 * 60 * 1000;
let statOptionsCache: { expiresAt: number; options: StatOption[] } = {
  expiresAt: 0,
  options: []
};

export const FEATURED_INSIGHTS: FeaturedInsight[] = [
  {
    key: "least_grounded",
    label: "Least Grounded",
    format: "pct",
    order: "asc",
    columns: [
      { key: "games", label: "Games", format: "int" },
      { key: "in_air", label: "In Air %", format: "pct" },
      { key: "avg_speed", label: "Avg Speed", format: "float" }
    ],
    sql: (where, limitIndex) =>
      formatSql(leastGroundedSql, {
        where,
        limitParam: `$${limitIndex}`,
        playerKeyExpr: playerKeyExpr("s")
      })
  },
  {
    key: "best_grand_finals",
    label: "Best in Grand Finals",
    format: "pct",
    columns: [
      { key: "games", label: "GF Games", format: "int" },
      { key: "avg_score", label: "Avg Score", format: "float" }
    ],
    sql: (where, limitIndex) =>
      formatSql(bestGrandFinalsSql, {
        where,
        limitParam: `$${limitIndex}`,
        playerKeyExpr: playerKeyExpr("s")
      })
  },
  {
    key: "best_decider",
    label: "Best in Deciders",
    format: "pct",
    columns: [
      { key: "games", label: "Deciders", format: "int" },
      { key: "avg_score", label: "Avg Score", format: "float" }
    ],
    sql: (where, limitIndex) =>
      formatSql(bestDeciderSql, {
        where,
        limitParam: `$${limitIndex}`,
        playerKeyExpr: playerKeyExpr("s")
      })
  },
  {
    key: "fastest_player",
    label: "Fastest Player",
    format: "float",
    columns: [
      { key: "games", label: "Games", format: "int" },
      { key: "supersonic", label: "Supersonic %", format: "pct" }
    ],
    sql: (where, limitIndex) =>
      formatSql(fastestPlayerSql, {
        where,
        limitParam: `$${limitIndex}`,
        playerKeyExpr: playerKeyExpr("s")
      })
  },
  {
    key: "best_ot",
    label: "Best in Overtime",
    format: "pct",
    columns: [
      { key: "games", label: "OT Games", format: "int" },
      { key: "avg_score", label: "Avg Score", format: "float" }
    ],
    sql: (where, limitIndex) =>
      formatSql(bestOtSql, {
        where,
        limitParam: `$${limitIndex}`,
        playerKeyExpr: playerKeyExpr("s")
      })
  },
  {
    key: "most_demos",
    label: "Most Demos per Game",
    format: "float",
    columns: [
      { key: "games", label: "Games", format: "int" },
      { key: "avg_score", label: "Avg Score", format: "float" }
    ],
    sql: (where, limitIndex) =>
      formatSql(mostDemosSql, {
        where,
        limitParam: `$${limitIndex}`,
        playerKeyExpr: playerKeyExpr("s")
      })
  }
];

export function humanizeColumn(column: string) {
  return column.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function statKeyFromColumn(column: string) {
  return column
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function getAllStatOptions() {
  if (statOptionsCache.expiresAt > Date.now() && statOptionsCache.options.length) {
    return statOptionsCache.options;
  }

  const overrideByColumn = new Map(
    STAT_OPTIONS.filter((option) => option.column).map((option) => [option.column, option])
  );

  const result = await pool.query(statOptionsSql);

  const options = result.rows.map((row) => {
    const column = row.column_name as string;
    const override = overrideByColumn.get(column);
    if (override) {
      return override;
    }
    const key = statKeyFromColumn(column);
    const format = ["integer", "bigint"].includes(row.data_type as string) ? "int" : "float";
    return {
      key,
      label: humanizeColumn(column),
      column,
      format
    } satisfies StatOption;
  });

  const optionByKey = new Map(options.map((option) => [option.key, option]));
  STAT_OPTIONS.filter((option) => !option.column).forEach((option) => {
    if (!optionByKey.has(option.key)) {
      optionByKey.set(option.key, option);
      options.push(option);
    }
  });

  statOptionsCache = {
    expiresAt: Date.now() + STAT_OPTION_CACHE_TTL_MS,
    options
  };

  return options;
}

export async function resolveStatOptionAsync(key: string) {
  const options = await getAllStatOptions();
  return options.find((option) => option.key === key) ?? null;
}

export function resolveStatOption(key: string) {
  return STAT_OPTIONS.find((option) => option.key === key) ?? null;
}

export function metricExpression(option: StatOption | null, mode: "avg" | "total", alias: string) {
  if (!option) return "NULL";
  if (option.kind === "series_played") {
    return `COUNT(DISTINCT ${seriesIdExpr(alias)})`;
  }
  if (!option.column) return "NULL";
  const column = `${alias}."${option.column}"`;
  if (mode === "total") {
    return `SUM(${column})`;
  }
  return `AVG(${column})`;
}

const EXCLUDED_COLUMNS = new Set(["Day", "Best of ", "Game Number", "Game", "Extra Time"]);

// Order matters: more specific prefixes must come before less specific ones
const STAT_CATEGORY_RULES: { name: string; prefixes: string[] }[] = [
  { name: "Scoring", prefixes: ["Score_", "Goals_", "Shots_", "Assists_"] },
  { name: "Defense", prefixes: ["Saves_", "Kills_", "Deaths_"] },
  {
    name: "Positioning",
    prefixes: [
      "Closest to Ball_", "Furthest from Ball_", "First man_", "Last man_",
      "Left Side_", "Right Side_", "Behind Ball_", "Ahead of Ball_",
      "Average Ball Distance_"
    ]
  },
  {
    name: "Ball Control",
    prefixes: [
      "Ball Touches_", "Time on Ball_", "Passes Given_", "Passes Received_",
      "50/50s_", "Possession Losses_", "Interceptions_", "Self Touches_"
    ]
  },
  { name: "Movement", prefixes: ["Distance traveled"] },
  {
    name: "Speed",
    prefixes: [
      "Average Speed_", "Max Speed (", "SuperSonic (", "Boost Speed (",
      "Drive Speed (", "Stopped_"
    ]
  },
  {
    name: "Elevation",
    prefixes: ["On Ground_", "In Low Air_", "In High Air_", "In Air_"]
  },
  {
    name: "Boost Level",
    prefixes: ["Average Boost_", "Empty (", "Low (0-33)_", "Medium (", "High (67-100)_", "Full ("]
  },
  {
    name: "Demos",
    prefixes: [
      "Boost Lost When Demoed_", "Avg Speed When Demoed_",
      "Avg Speed After Killing_", "Avg Boost When Demoed_", "Avg Boost When Killing_"
    ]
  },
  {
    name: "Boost Collection",
    prefixes: ["Small Pads Collected_", "Big Boosts Collected_", "Overfill from ", "Boost Gained from "]
  },
  { name: "Boost Usage", prefixes: ["Boost Gained_", "Boost Lost"] }
];

export function categorizeStatOptions(options: StatOption[]): StatCategory[] {
  const coreKeys = new Set(STAT_OPTIONS.map((o) => o.key));
  const filtered = options.filter(
    (o) => o.column && !EXCLUDED_COLUMNS.has(o.column) && !coreKeys.has(o.key)
  );

  const categorized = new Set<string>();
  const categories: StatCategory[] = [];

  for (const rule of STAT_CATEGORY_RULES) {
    const stats: StatOption[] = [];
    for (const option of filtered) {
      if (categorized.has(option.key)) continue;
      if (rule.prefixes.some((prefix) => option.column!.startsWith(prefix))) {
        stats.push(option);
        categorized.add(option.key);
      }
    }
    if (stats.length) {
      categories.push({ name: rule.name, stats });
    }
  }

  return categories;
}
