import { pool } from "../db";
import { type FeaturedInsight, type StatCategory, type StatOption } from "../types";
import { playerKeyExpr } from "./roster";
import { formatSql, loadSql } from "./sql";

const statOptionsSql = loadSql("../../sql/stats/options.sql", import.meta.url);
const leastGroundedSql = loadSql("../../sql/featured/least_grounded.sql", import.meta.url);
const bestGrandFinalsSql = loadSql("../../sql/featured/best_grand_finals.sql", import.meta.url);
const bestDeciderSql = loadSql("../../sql/featured/best_decider.sql", import.meta.url);
const fastestPlayerSql = loadSql("../../sql/featured/fastest_player.sql", import.meta.url);
const bestOtSql = loadSql("../../sql/featured/best_ot.sql", import.meta.url);
const mostDemosSql = loadSql("../../sql/featured/most_demos.sql", import.meta.url);
const topRatedSql = loadSql("../../sql/featured/top_rated.sql", import.meta.url);

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
  { key: "series_played", label: "Series Played", kind: "series_played", format: "int" },
  { key: "rating", label: "Rating", kind: "rating", format: "float" }
];

export const DEFAULT_COMPARE_STATS = ["goals", "assists", "saves", "demos"];

const STAT_OPTION_CACHE_TTL_MS = 5 * 60 * 1000;
let statOptionsCache: { expiresAt: number; options: StatOption[] } = {
  expiresAt: 0,
  options: []
};

export const FEATURED_INSIGHTS: FeaturedInsight[] = [
  {
    key: "top_rated",
    label: "Top Rated",
    format: "float",
    columns: [
      { key: "games", label: "Games", format: "int" },
      { key: "goals_avg", label: "Goals/G", format: "float" },
      { key: "assists_avg", label: "Assists/G", format: "float" },
      { key: "shooting_pct", label: "Shot %", format: "pct" },
      { key: "demo_diff", label: "Demo +/-", format: "float" }
    ],
    sql: (where, limitIndex) =>
      formatSql(topRatedSql, {
        where,
        limitParam: `$${limitIndex}`,
        playerKeyExpr: playerKeyExpr("s")
      })
  },
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

// Composite rating: data-driven weights from win-correlation analysis (r=0.731)
// Goals & assists equally weighted (both ~0.38 Pearson r with victory)
// Shooting % as decimal (0-1), demo differential (demos - deaths)
function ratingExpression(alias: string) {
  const goals = `${alias}."Goals_All Zones"`;
  const assists = `${alias}."Assists_All Zones"`;
  const shots = `${alias}."Shots_All Zones"`;
  const kills = `${alias}."Kills_All Zones"`;
  const deaths = `${alias}."Deaths_All Zones"`;
  return `(
    AVG(${goals}) * 2.0 +
    AVG(${assists}) * 2.0 +
    COALESCE(SUM(${goals})::float / NULLIF(SUM(${shots}), 0), 0) * 0.5 +
    AVG(${shots}) * 0.5 +
    (AVG(${kills}) - AVG(${deaths})) * 0.2
  )`;
}

// gameCountExpr: when provided (roster/team queries), avg = SUM / game_count
// instead of AVG (which would give per-player averages for multi-player rows)
export function metricExpression(option: StatOption | null, mode: "avg" | "total", alias: string, gameCountExpr?: string) {
  if (!option) return "NULL";
  if (option.kind === "series_played") {
    return `COUNT(DISTINCT ${alias}.series_id)`;
  }
  if (option.kind === "rating") {
    return ratingExpression(alias);
  }
  if (!option.column) return "NULL";
  const column = `${alias}."${option.column}"`;
  if (mode === "total") {
    return `SUM(${column})`;
  }
  if (gameCountExpr) {
    return `SUM(${column})::float / NULLIF(${gameCountExpr}, 0)`;
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
