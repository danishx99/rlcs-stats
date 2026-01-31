import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  addIngestionColumnsSql,
  addRowHashColumnSql,
  createFileIngestTableSql,
  createRowHashIndexSql
} from "../src/schema-utils";
import { createStatsTableSql } from "../src/stats-schema";
import { loadCsvFile } from "../src/load-csv";
import { streamCsvRows } from "../src/util/csv";
import type { ColumnSpec, ColumnType } from "../src/util/types";

const DATA_DIR = "./data/matches";
const IGNORED_COLUMNS = new Set(["id", "source_file", "ingested_at", "row_hash"]);

type DbClient = { query: (sql: string, params?: any[]) => Promise<any>; end: () => Promise<void> };

let client: DbClient | null = null;
let dbAvailable = true;

function mapDbType(dataType: string): ColumnType {
  const normalized = dataType.toLowerCase();
  if (normalized === "text" || normalized === "character varying") {
    return "TEXT";
  }
  if (normalized === "integer") {
    return "INTEGER";
  }
  if (normalized === "boolean") {
    return "BOOLEAN";
  }
  if (normalized === "timestamp with time zone") {
    return "TIMESTAMPTZ";
  }
  if (normalized === "double precision") {
    return "DOUBLE PRECISION";
  }
  return "TEXT";
}

async function getColumnSpecsFromDb(db: DbClient): Promise<ColumnSpec[]> {
  const result = await db.query(
    `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
    `,
    ["stats"]
  );
  return result.rows
    .map((row) => ({
      name: row.column_name as string,
      type: mapDbType(row.data_type as string)
    }))
    .filter((spec) => !IGNORED_COLUMNS.has(spec.name));
}

async function listCsvFiles(): Promise<string[]> {
  const entries = await readdir(DATA_DIR);
  return entries
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .map((name) => join(DATA_DIR, name));
}

async function countNonBlankRows(filePath: string): Promise<{ rows: number; headers: string[] }> {
  let rows = 0;
  const { headers } = await streamCsvRows(filePath, {
    onRow: (row) => {
      const values = Object.values(row).map((value) => (value ?? "").trim());
      const isBlank = values.every((value) => value.length === 0);
      if (!isBlank) {
        rows += 1;
      }
    }
  });
  return { rows, headers };
}

describe("CSV ingestion", () => {
  beforeAll(async () => {
    try {
      const { connectDb } = await import("../src/db");
      client = await connectDb();
      await client.query(createStatsTableSql);
      await client.query(addIngestionColumnsSql("stats"));
      await client.query(addRowHashColumnSql("stats"));
      await client.query(createRowHashIndexSql("stats"));
      await client.query(createFileIngestTableSql);
      await client.query("TRUNCATE stats RESTART IDENTITY;");
      await client.query("TRUNCATE file_ingest RESTART IDENTITY;");
    } catch (error) {
      dbAvailable = false;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Skipping ingestion tests: ${message}`);
      if (client) {
        await client.end();
        client = null;
      }
    }
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  test("loads CSVs with expected row counts and columns", async () => {
    if (!dbAvailable || !client) {
      return;
    }

    const files = await listCsvFiles();
    expect(files.length).toBeGreaterThan(0);

    const allHeaders = new Set<string>();
    let expectedRows = 0;
    let insertedTotal = 0;

    for (const filePath of files) {
      const { rows, headers } = await countNonBlankRows(filePath);
      headers.forEach((header) => allHeaders.add(header));
      expectedRows += rows;

      const specs = await getColumnSpecsFromDb(client);
      const report = await loadCsvFile(client, filePath, specs, {
        strict: false,
        dryRun: false,
        tableName: "stats",
        schemaFile: "src/stats-schema.ts"
      });

      expect(report.totalRows).toBe(rows);
      expect(report.inserted + report.skipped).toBe(report.totalRows);
      insertedTotal += report.inserted;
    }

    const countResult = await client.query("SELECT COUNT(*)::int AS count FROM stats;");
    const dbCount = countResult.rows[0]?.count ?? 0;
    expect(dbCount).toBe(insertedTotal);

    const columnResult = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stats';
      `
    );
    const dbColumns = new Set(columnResult.rows.map((row) => row.column_name as string));
    for (const header of allHeaders) {
      expect(dbColumns.has(header)).toBe(true);
    }
  });
});
