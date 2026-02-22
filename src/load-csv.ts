import { basename } from "node:path";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { streamCsvRows } from "./util/csv";
import type { ColumnSpec, ColumnType, FileReport, RowError } from "./util/types";

const COMPUTE_SERIES_IDS_SQL = `
WITH match_agg AS (
  SELECT
    "Match ID" AS match_id,
    MIN("Team") AS team_a,
    MAX("Team") AS team_b,
    MIN("Season") AS season,
    MIN(NULLIF("Split", '')) AS split,
    MIN(NULLIF("Event", '')) AS event,
    MIN("Day")::text AS day,
    MIN(NULLIF("Stage", '')) AS stage,
    MIN(NULLIF("Round", '')) AS round,
    MAX("Best of ")::text AS best_of
  FROM stats
  WHERE series_id IS NULL
    AND "Team" IS NOT NULL
    AND "Team" <> ''
  GROUP BY "Match ID"
  HAVING COUNT(DISTINCT "Team") = 2
)
UPDATE stats s
SET series_id = md5(
  COALESCE(ma.season,'') || '|' ||
  COALESCE(ma.split,'') || '|' ||
  COALESCE(ma.event,'') || '|' ||
  COALESCE(ma.day,'') || '|' ||
  COALESCE(ma.stage,'') || '|' ||
  COALESCE(ma.round,'') || '|' ||
  COALESCE(ma.best_of,'') || '|' ||
  ma.team_a || '|' || ma.team_b
)
FROM match_agg ma
WHERE s."Match ID" = ma.match_id
  AND s.series_id IS NULL;
`;

export async function computeSeriesIds(client: Client): Promise<number> {
  const result = await client.query(COMPUTE_SERIES_IDS_SQL);
  return result.rowCount ?? 0;
}

const REFRESH_SERIES_ROSTER_SQL = `
INSERT INTO series_roster (series_id, team, roster_id, starters)
SELECT
  s.series_id,
  TRIM(s."Team") AS team,
  md5(array_to_string(ARRAY_AGG(DISTINCT NULLIF(TRIM(s."Unique ID"), '') ORDER BY NULLIF(TRIM(s."Unique ID"), '')), '|')) AS roster_id,
  ARRAY_AGG(DISTINCT NULLIF(TRIM(s."Unique ID"), '') ORDER BY NULLIF(TRIM(s."Unique ID"), '')) AS starters
FROM stats s
WHERE s.series_id IS NOT NULL
  AND s."Team" IS NOT NULL
  AND TRIM(s."Team") <> ''
  AND NULLIF(TRIM(s."Unique ID"), '') IS NOT NULL
GROUP BY s.series_id, TRIM(s."Team")
HAVING COUNT(DISTINCT NULLIF(TRIM(s."Unique ID"), '')) = 3;
`;

export async function refreshSeriesRoster(client: Client): Promise<number> {
  await client.query("BEGIN");
  try {
    await client.query("TRUNCATE series_roster;");
    await client.query(REFRESH_SERIES_ROSTER_SQL);
    const countResult = await client.query("SELECT COUNT(*)::INT AS count FROM series_roster;");
    await client.query("COMMIT");
    return Number(countResult.rows[0]?.count ?? 0);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

const NULL_TOKEN = "<NULL>";
const HASH_SEPARATOR = "\u001f";
const MAX_PARAMS = 65000;

export type LoadOptions = {
  strict?: boolean;
  dryRun?: boolean;
  limit?: number;
  progressEvery?: number;
  allowNewColumns?: boolean;
  tableName: string;
  schemaFile?: string;
  headerNormalizer?: (header: string) => string;
  ignoreCoercionErrors?: boolean;
  stopAfterHeader?: string;
  denormalize?: boolean;
};

const DENORM_BASE_STATS = [
  "Goals", "Assists", "Saves", "Shots", "Score", "Kills", "Deaths",
  "Passes Given", "Passes Received", "50/50s", "Possession Losses",
  "Interceptions", "Self Touches", "Small Pads Collected",
  "Big Boosts Collected", "Ball Touches"
];

const ZONE_SUFFIXES = [
  "_All Zones", "_Defense Zone", "_Neutral Zone", "_Offense Zone"
];

const DENORM_COLUMNS = new Set(
  DENORM_BASE_STATS.flatMap((stat) => ZONE_SUFFIXES.map((zone) => stat + zone))
);

const STATS_TRIM_COLUMNS = new Set(["Split", "Event", "Stage", "Round"]);
const STATS_UPPERCASE_COLUMNS = new Set(["Team"]);

function normalizeStatsTextValue(column: string, value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (STATS_UPPERCASE_COLUMNS.has(column)) {
    return trimmed.toUpperCase();
  }

  if (STATS_TRIM_COLUMNS.has(column)) {
    return trimmed;
  }

  return value;
}

function denormalizeRow(
  headers: string[],
  values: any[]
): void {
  const otIndex = headers.indexOf("OT");
  const extraTimeIndex = headers.indexOf("Extra Time");
  if (otIndex < 0 || extraTimeIndex < 0) return;

  const isOt = values[otIndex];
  const extraTime = values[extraTimeIndex];
  if (!isOt || typeof extraTime !== "number" || extraTime <= 0) return;

  const gameDuration = 300 + extraTime;
  for (let i = 0; i < headers.length; i++) {
    if (DENORM_COLUMNS.has(headers[i]) && typeof values[i] === "number") {
      values[i] = Math.round(values[i] * gameDuration / 300);
    }
  }
}

export function extractColumnSpecs(sql: string): ColumnSpec[] {
  const specs: ColumnSpec[] = [];
  const regex = /"([^"]+)"\s+([A-Z ]+?)(?:,|\n)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sql)) !== null) {
    const name = match[1];
    const type = match[2].trim().toUpperCase() as ColumnType;
    if (
      type === "TEXT" ||
      type === "INTEGER" ||
      type === "BOOLEAN" ||
      type === "TIMESTAMPTZ" ||
      type === "DOUBLE PRECISION"
    ) {
      specs.push({ name, type });
    }
  }
  return specs;
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function hasTimezone(value: string): boolean {
  return /[zZ]|[+-]\d\d:?\d\d$/.test(value);
}

function parseDateString(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Normalize dot-separated time: 2021-10-22T17.00 → 2021-10-22T17:00
  const normalized = trimmed.replace(/T(\d{2})\.(\d{2})/, "T$1:$2");

  if (/\d{4}-\d{2}-\d{2}/.test(normalized) || normalized.includes("T")) {
    const adjusted = hasTimezone(normalized) ? normalized : `${normalized}Z`;
    const date = new Date(adjusted);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = normalized.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (match) {
    const first = Number.parseInt(match[1], 10);
    const second = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    if (Number.isNaN(first) || Number.isNaN(second) || Number.isNaN(year)) {
      return null;
    }
    let day = first;
    let month = second;
    if (first <= 12 && second > 12) {
      day = second;
      month = first;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const adjusted = hasTimezone(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(adjusted);
  return Number.isNaN(date.getTime()) ? null : date;
}

function coerceValue(raw: string, type: ColumnType): { value: any; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { value: null };
  }

  const normalizedNull = trimmed.toLowerCase();
  if (normalizedNull === "na" || normalizedNull === "n/a" || normalizedNull === "null") {
    return { value: null };
  }

  switch (type) {
    case "TEXT":
      return { value: raw };
    case "INTEGER": {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) {
        return { value: null, error: "invalid integer" };
      }
      return { value: parsed };
    }
    case "DOUBLE PRECISION": {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isNaN(parsed)) {
        return { value: null, error: "invalid float" };
      }
      return { value: parsed };
    }
    case "BOOLEAN": {
      const normalized = trimmed.toLowerCase();
      if (["true", "t", "1", "yes", "y"].includes(normalized)) {
        return { value: true };
      }
      if (["false", "f", "0", "no", "n", "ff"].includes(normalized)) {
        return { value: false };
      }
      return { value: null, error: "invalid boolean" };
    }
    case "TIMESTAMPTZ": {
      const date = parseDateString(trimmed);
      if (!date || Number.isNaN(date.getTime())) {
        return { value: null, error: "invalid timestamp" };
      }
      return { value: date };
    }
    default:
      return { value: raw };
  }
}

function normalizeForHash(value: any): string {
  if (value === null || value === undefined) {
    return NULL_TOKEN;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : NULL_TOKEN;
  }
  return String(value);
}

function buildInsertSql(tableName: string, columns: string[], rows: number): string {
  const allColumns = [...columns.map(quoteIdent), '"row_hash"', '"source_file"'];
  const colCount = allColumns.length;
  const valuesSql: string[] = [];
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const placeholders: string[] = [];
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      placeholders.push(`$${rowIndex * colCount + colIndex + 1}`);
    }
    valuesSql.push(`(${placeholders.join(", ")})`);
  }

  return `INSERT INTO ${quoteIdent(tableName)} (${allColumns.join(", ")}) VALUES ${valuesSql.join(", ")} ON CONFLICT (row_hash) DO NOTHING;`;
}

function buildAddColumnsSql(tableName: string, columns: string[]): string {
  const clauses = columns.map((col) => `ADD COLUMN IF NOT EXISTS ${quoteIdent(col)} TEXT`);
  return `ALTER TABLE ${quoteIdent(tableName)} ${clauses.join(", ")};`;
}

function maxBatchRows(columnCount: number): number {
  const colsWithExtras = columnCount + 2;
  return Math.max(1, Math.floor(MAX_PARAMS / colsWithExtras));
}

export async function loadCsvFile(
  client: Client,
  filePath: string,
  specs: ColumnSpec[],
  options: LoadOptions
): Promise<FileReport> {
  const fileName = basename(filePath);
  const typeMap = new Map(specs.map((spec) => [spec.name, spec.type]));
  const errors: RowError[] = [];
  const progressEvery = options.progressEvery ?? 10000;

  let totalRows = 0;
  let inserted = 0;
  let skipped = 0;
  let errored = 0;

  let sourceHeaders: string[] = [];
  let includedIndices: number[] = [];
  let headers: string[] = [];
  let columnTypes: ColumnType[] = [];
  let batchValues: any[] = [];
  let batchRows = 0;
  let batchLimit = 100;
  let victoryIndex = -1;
  let forfeitIndex = -1;

  async function flushBatch(): Promise<void> {
    if (batchRows === 0) {
      return;
    }
    if (!options.dryRun) {
      const sql = buildInsertSql(options.tableName, headers, batchRows);
      const result = await client.query(sql, batchValues);
      const rowCount = result.rowCount ?? 0;
      inserted += rowCount;
      skipped += batchRows - rowCount;
    }
    batchValues = [];
    batchRows = 0;
  }

  await streamCsvRows(filePath, {
    onRow: async (row: Record<string, string>, rowNumber: number) => {
      if (headers.length === 0) {
        sourceHeaders = Object.keys(row);
        let normalizedHeaders = options.headerNormalizer
          ? sourceHeaders.map((header) => options.headerNormalizer?.(header) ?? header)
          : sourceHeaders;
        if (options.stopAfterHeader) {
          const stopIndex = normalizedHeaders.findIndex(
            (header) => header === options.stopAfterHeader
          );
          if (stopIndex >= 0) {
            normalizedHeaders = normalizedHeaders.slice(0, stopIndex + 1);
          }
        }
        const filteredHeaders: string[] = [];
        includedIndices = [];
        normalizedHeaders.forEach((header, index) => {
          if (header.trim().length === 0) {
            return;
          }
          filteredHeaders.push(header);
          includedIndices.push(index);
        });
        headers = filteredHeaders;
        const headerCounts = new Map<string, number>();
        for (const header of headers) {
          headerCounts.set(header, (headerCounts.get(header) ?? 0) + 1);
        }
        const duplicates = [...headerCounts.entries()]
          .filter(([, count]) => count > 1)
          .map(([header]) => header);
        if (duplicates.length > 0) {
          throw new Error(`CSV header mapping produced duplicates: ${duplicates.join(", ")}`);
        }
        const extra = headers.filter((col) => !typeMap.has(col));
        if (extra.length > 0) {
          if (!options.allowNewColumns) {
            const schemaHint = options.schemaFile ?? `the schema for ${options.tableName}`;
            throw new Error(
              `CSV has ${extra.length} undefined columns in ${fileName}. Add them to ${schemaHint} or pass --allow-new-columns.`
            );
          }
          if (!options.dryRun) {
            await client.query(buildAddColumnsSql(options.tableName, extra));
          }
          for (const col of extra) {
            typeMap.set(col, "TEXT");
          }
          console.log(`${fileName}: added ${extra.length} new columns to ${options.tableName}`);
        }
        // Inject synthetic Forfeit column if Victory exists and Forfeit is not in the CSV
        victoryIndex = headers.indexOf("Victory");
        forfeitIndex = headers.indexOf("Forfeit");
        if (victoryIndex >= 0 && forfeitIndex < 0 && typeMap.has("Forfeit")) {
          headers.push("Forfeit");
          forfeitIndex = headers.length - 1;
        }
        columnTypes = headers.map((col) => typeMap.get(col) as ColumnType);
        batchLimit = maxBatchRows(headers.length);
      }

      const rawValues = includedIndices.map((index) => row[sourceHeaders[index]] ?? "");
      const isBlank = rawValues.every((value) => value.trim().length === 0);
      if (isBlank) {
        return true;
      }

      totalRows += 1;
      if (options.limit && totalRows > options.limit) {
        return false;
      }

      const coercedValues: any[] = [];
      const hashParts: string[] = [];
      let rowHasError = false;

      // Coerce CSV-sourced columns (rawValues has one entry per CSV column)
      for (let i = 0; i < rawValues.length; i += 1) {
        const raw = rawValues[i];
        const type = columnTypes[i];
        const { value, error } = coerceValue(raw, type);
        if (error && !options.ignoreCoercionErrors) {
          rowHasError = true;
          if (errors.length < 100) {
            errors.push({
              rowNumber,
              column: headers[i],
              value: raw,
              reason: error
            });
          }
          if (options.strict) {
            throw new Error(
              `Row ${rowNumber} column ${headers[i]} failed: ${error} (value: ${raw})`
            );
          }
        }
        coercedValues.push(value);
      }

      // Populate synthetic Forfeit column from raw Victory value
      if (forfeitIndex >= 0 && forfeitIndex >= rawValues.length && victoryIndex >= 0) {
        const rawVictory = rawValues[victoryIndex]?.trim().toLowerCase() ?? "";
        coercedValues.push(rawVictory === "ff");
      }

      if (options.tableName === "stats") {
        for (let i = 0; i < coercedValues.length; i += 1) {
          coercedValues[i] = normalizeStatsTextValue(headers[i], coercedValues[i]);
        }
      }

      if (options.denormalize) {
        denormalizeRow(headers, coercedValues);
      }

      for (let i = 0; i < coercedValues.length; i++) {
        hashParts.push(normalizeForHash(coercedValues[i]));
      }

      if (rowHasError) {
        errored += 1;
      }

      const rowHash = createHash("sha256").update(hashParts.join(HASH_SEPARATOR)).digest("hex");
      batchValues.push(...coercedValues, rowHash, fileName);
      batchRows += 1;

      if (batchRows >= batchLimit) {
        await flushBatch();
      }

      if (totalRows % progressEvery === 0) {
        console.log(`${fileName}: processed ${totalRows} rows`);
      }

      return true;
    }
  });

  await flushBatch();

  return {
    fileName,
    status: "processed",
    totalRows,
    inserted,
    skipped,
    errored,
    errors
  };
}
