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
};

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

function coerceValue(raw: string, type: ColumnType): { value: any; error?: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
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
      const adjusted = hasTimezone(trimmed) ? trimmed : `${trimmed}Z`;
      const date = new Date(adjusted);
      if (Number.isNaN(date.getTime())) {
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

function buildInsertSql(columns: string[], rows: number): string {
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

  return `INSERT INTO stats (${allColumns.join(", ")}) VALUES ${valuesSql.join(", ")} ON CONFLICT (row_hash) DO NOTHING;`;
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
      const sql = buildInsertSql(headers, batchRows);
      const result = await client.query(sql, batchValues);
      inserted += result.rowCount;
      skipped += batchRows - result.rowCount;
    }
    batchValues = [];
    batchRows = 0;
  }

  await streamCsvRows(filePath, {
    onRow: async (row, rowNumber) => {
      if (headers.length === 0) {
        headers = Object.keys(row);
        const extra = headers.filter((col) => !typeMap.has(col));
        const missing = specs.map((spec) => spec.name).filter((col) => !headers.includes(col));
        if (extra.length > 0 || missing.length > 0) {
          throw new Error(
            `CSV header mismatch for ${fileName}. Missing: ${missing.length}, Extra: ${extra.length}`
          );
        }
        columnTypes = headers.map((col) => typeMap.get(col) as ColumnType);
        batchLimit = maxBatchRows(headers.length);
      }

      const rawValues = headers.map((col) => row[col] ?? "");
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
        if (error) {
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
        hashParts.push(normalizeForHash(value));
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
    totalRows,
    inserted,
    skipped,
    errored,
    errors
  };
}
