import { basename } from "node:path";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { streamCsvRows } from "./util/csv";
import type { ColumnSpec, ColumnType, FileReport, RowError } from "./util/types";

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

  if (/\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.includes("T")) {
    const adjusted = hasTimezone(trimmed) ? trimmed : `${trimmed}Z`;
    const date = new Date(adjusted);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
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

  const adjusted = hasTimezone(trimmed) ? trimmed : `${trimmed}Z`;
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
      if (["false", "f", "0", "no", "n"].includes(normalized)) {
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

      for (let i = 0; i < headers.length; i += 1) {
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
