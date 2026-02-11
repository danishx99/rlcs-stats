import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { connectDb } from "./db";
import { DATASETS, resolveDatasets } from "./datasets";
import {
  addIngestionColumnsSql,
  addRowHashColumnSql,
  createRowHashIndexSql,
  createFileIngestTableSql
} from "./schema-utils";
import { loadCsvFile, computeSeriesIds, refreshSeriesRoster } from "./load-csv";
import type { ColumnSpec, ColumnType, FileReport } from "./util/types";

const DEFAULT_DIR = "./data";
const DEFAULT_PATTERN = "*.csv";

type CliOptions = {
  dir: string;
  pattern: string;
  limit?: number;
  dryRun: boolean;
  strict: boolean;
  truncate: boolean;
  allowNewColumns: boolean;
  dataset?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: DEFAULT_DIR,
    pattern: DEFAULT_PATTERN,
    dryRun: false,
    strict: false,
    truncate: false,
    allowNewColumns: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir") {
      options.dir = argv[i + 1] ?? options.dir;
      i += 1;
    } else if (arg === "--pattern") {
      options.pattern = argv[i + 1] ?? options.pattern;
      i += 1;
    } else if (arg === "--limit") {
      const raw = argv[i + 1];
      if (raw) {
        options.limit = Number.parseInt(raw, 10);
        i += 1;
      }
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--truncate") {
      options.truncate = true;
    } else if (arg === "--allow-new-columns") {
      options.allowNewColumns = true;
    } else if (arg === "--dataset") {
      options.dataset = argv[i + 1] ?? options.dataset;
      i += 1;
    }
  }

  return options;
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.split("*").map(escapeRegex).join(".*");
  return new RegExp(`^${escaped}$`);
}

const IGNORED_COLUMNS = new Set(["id", "source_file", "ingested_at", "row_hash", "series_id"]);

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

async function getColumnSpecsFromDb(client: Client, tableName: string): Promise<ColumnSpec[]> {
  const result = await client.query(
    `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
    `,
    [tableName]
  );
  return result.rows
    .map((row) => ({
      name: row.column_name as string,
      type: mapDbType(row.data_type as string)
    }))
    .filter((spec) => !IGNORED_COLUMNS.has(spec.name));
}

async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function isFileIngested(
  client: Client,
  tableName: string,
  fileHash: string
): Promise<boolean> {
  const result = await client.query(
    "SELECT 1 FROM file_ingest WHERE table_name = $1 AND file_hash = $2 LIMIT 1;",
    [tableName, fileHash]
  );
  return (result.rowCount ?? 0) > 0;
}

async function recordFileIngest(
  client: Client,
  tableName: string,
  report: FileReport,
  fileHash: string,
  fileSize: number
): Promise<void> {
  await client.query(
    `
    INSERT INTO file_ingest (table_name, file_name, file_hash, file_size, row_count, inserted, skipped, errored)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `,
    [
      tableName,
      report.fileName,
      fileHash,
      fileSize,
      report.totalRows,
      report.inserted,
      report.skipped,
      report.errored
    ]
  );
}

async function listFiles(dir: string, pattern: string): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const regex = patternToRegex(pattern);
  return entries.filter((name) => regex.test(name)).map((name) => join(dir, name));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const datasets = resolveDatasets(options.dataset);
  const hasStatsDataset = datasets.some((dataset) => dataset.tableName === "stats");
  const client = await connectDb();

  try {
    console.log("Connected to DB");
    console.log(
      `Ingestion start: datasets=${datasets.map((dataset) => dataset.key).join(", ")}, dryRun=${options.dryRun}, truncate=${options.truncate}`
    );
    console.log("Ensuring schema...");
    await client.query(createFileIngestTableSql);
    for (const dataset of datasets) {
      await client.query(dataset.createTableSql);
      if (dataset.customLoader) continue;
      if (dataset.addColumnsSql) {
        await client.query(dataset.addColumnsSql);
      }
      await client.query(addIngestionColumnsSql(dataset.tableName));
      await client.query(addRowHashColumnSql(dataset.tableName));
      if (dataset.addCommentsSql) {
        await client.query(dataset.addCommentsSql);
      }
      await client.query(createRowHashIndexSql(dataset.tableName));
      if (dataset.tableName === "stats") {
        await client.query(`ALTER TABLE stats ADD COLUMN IF NOT EXISTS series_id TEXT`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_stats_series_id ON stats (series_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_stats_match_team ON stats ("Match ID", "Team")`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_stats_unique_id ON stats ("Unique ID")`);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_stats_series_team_game
          ON stats (series_id, "Team", "Game Number")
          WHERE series_id IS NOT NULL
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS series_roster (
            series_id TEXT NOT NULL,
            team TEXT NOT NULL,
            roster_id TEXT NOT NULL,
            starters TEXT[] NOT NULL
          )
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS series_roster_series_team_uq
          ON series_roster (series_id, team)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_series_roster_roster_series_team
          ON series_roster (roster_id, series_id, team)
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_series_roster_series_team
          ON series_roster (series_id, team)
        `);
      }
    }
    console.log("Schema ensured");

    if (options.truncate && !options.dryRun) {
      console.log("Truncating selected dataset tables...");
      for (const dataset of datasets) {
        await client.query(`TRUNCATE ${quoteIdent(dataset.tableName)} RESTART IDENTITY;`);
      }
      if (datasets.length === DATASETS.length) {
        await client.query("TRUNCATE file_ingest RESTART IDENTITY;");
      } else {
        for (const dataset of datasets) {
          await client.query("DELETE FROM file_ingest WHERE table_name = $1;", [
            dataset.tableName
          ]);
        }
      }
      console.log("Data truncated");
    }

    const reports: FileReport[] = [];
    for (const dataset of datasets) {
      const datasetDir = join(options.dir, dataset.dataSubdir);
      const files = await listFiles(datasetDir, options.pattern);
      console.log(`[${dataset.label}] scanning ${datasetDir}: ${files.length} files matched`);
      if (files.length === 0) {
        console.log(`${dataset.label}: no files matched`);
        continue;
      }

      if (dataset.customLoader) {
        console.log(`[${dataset.label}] using custom loader for ${files.length} file(s)`);
        await dataset.customLoader(client, files, options.dryRun);
        continue;
      }

      for (const filePath of files) {
        const fileStats = await stat(filePath);
        const fileHash = await computeFileHash(filePath);
        const fileName = basename(filePath);

        if (!options.limit && (await isFileIngested(client, dataset.tableName, fileHash))) {
          const skippedReport: FileReport = {
            fileName,
            status: "skipped",
            skipReason: "already ingested",
            fileHash,
            totalRows: 0,
            inserted: 0,
            skipped: 0,
            errored: 0,
            errors: [],
            dataset: dataset.key
          };
          reports.push(skippedReport);
          console.log(`[${dataset.label}] skipping file ${filePath} (already ingested)`);
          continue;
        }

        const specs = await getColumnSpecsFromDb(client, dataset.tableName);
        console.log(`[${dataset.label}] processing file ${filePath}`);
        const report = await loadCsvFile(client, filePath, specs, {
          strict: options.strict,
          dryRun: options.dryRun,
          limit: options.limit,
          allowNewColumns: options.allowNewColumns,
          tableName: dataset.tableName,
          schemaFile: dataset.schemaFile,
          headerNormalizer: dataset.headerNormalizer,
          ignoreCoercionErrors: dataset.ignoreCoercionErrors,
          stopAfterHeader: dataset.stopAfterHeader,
          denormalize: dataset.denormalize
        });
        report.fileHash = fileHash;
        report.dataset = dataset.key;
        reports.push(report);
        console.log(
          `[${dataset.label}] ${report.fileName}: rows ${report.totalRows}, inserted ${report.inserted}, skipped ${report.skipped}, errored ${report.errored}`
        );

        if (!options.dryRun && !options.limit) {
          await recordFileIngest(client, dataset.tableName, report, fileHash, fileStats.size);
        }
      }
    }

    if (!options.dryRun && hasStatsDataset) {
      console.log("Generating series ids...");
      const updated = await computeSeriesIds(client);
      console.log(`Series id backfill complete: ${updated} rows updated`);
      console.log("Refreshing series roster table...");
      const seriesRosterRows = await refreshSeriesRoster(client);
      console.log(`Series roster refresh complete: ${seriesRosterRows} rows`);
    }

    const totals = reports.reduce(
      (acc, report) => {
        if (report.status === "processed") {
          acc.totalRows += report.totalRows;
          acc.inserted += report.inserted;
          acc.skipped += report.skipped;
          acc.errored += report.errored;
        }
        return acc;
      },
      { totalRows: 0, inserted: 0, skipped: 0, errored: 0 }
    );

    await mkdir("./out", { recursive: true });
    await writeFile("./out/import-report.json", JSON.stringify({ reports, totals }, null, 2));

    console.log(
      `Ingestion totals: rows ${totals.totalRows}, inserted ${totals.inserted}, skipped ${totals.skipped}, errored ${totals.errored}`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
