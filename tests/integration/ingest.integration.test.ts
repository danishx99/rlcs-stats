import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import {
  addIngestionColumnsSql,
  addRowHashColumnSql,
  createFileIngestTableSql,
  createRowHashIndexSql
} from "../../src/schema-utils";
import { buildConnectionString } from "../../src/db";
import { createStatsTableSql } from "../../src/stats-schema";
import { loadCsvFile } from "../../src/load-csv";
import { streamCsvRows } from "../../src/util/csv";
import type { ColumnSpec, ColumnType } from "../../src/util/types";

const DATA_DIR = "./data/matches";
const IGNORED_COLUMNS = new Set(["id", "source_file", "ingested_at", "row_hash"]);

type DbClient = Client;
let client: DbClient | null = null;

function resolveTestConnectionString() {
  const explicit = process.env.DATABASE_URL_TEST?.trim();
  if (explicit) {
    return explicit;
  }

  const base = buildConnectionString();
  const url = new URL(base);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("Could not determine database name from connection string.");
  }
  url.pathname = `/${dbName.endsWith("_test") ? dbName : `${dbName}_test`}`;
  return url.toString();
}

function assertSafeTestDatabase(connectionString: string) {
  const url = new URL(connectionString);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to run destructive ingestion test against non-test database "${dbName}". Set DATABASE_URL_TEST to a *_test database.`
    );
  }
}

function getDbName(connectionString: string) {
  return new URL(connectionString).pathname.replace(/^\//, "");
}

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
    const connectionString = resolveTestConnectionString();
    assertSafeTestDatabase(connectionString);
    const testDbName = getDbName(connectionString);
    client = new Client({ connectionString });
    try {
      await client.connect();
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "3D000") {
        throw new Error(`Test database "${testDbName}" does not exist. Run "bun run db:test:init" first.`);
      }
      throw error;
    }
    await client.query(createStatsTableSql);
    await client.query(addIngestionColumnsSql("stats"));
    await client.query(addRowHashColumnSql("stats"));
    await client.query(createRowHashIndexSql("stats"));
    await client.query(createFileIngestTableSql);
    await client.query("TRUNCATE stats RESTART IDENTITY;");
    await client.query("TRUNCATE file_ingest RESTART IDENTITY;");
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  test("loads CSVs with expected row counts and columns", async () => {
    if (!client) throw new Error("Database client was not initialized.");

    const files = await listCsvFiles();
    expect(files.length).toBeGreaterThan(0);

    const allHeaders = new Set<string>();
    let insertedTotal = 0;

    for (const filePath of files) {
      const { rows, headers } = await countNonBlankRows(filePath);
      headers.forEach((header) => allHeaders.add(header));

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
