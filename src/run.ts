import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
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
import { quoteIdent } from "./util/sql";
import type { ColumnSpec, ColumnType, FileReport } from "./util/types";

const DEFAULT_DIR = "./data";
const DEFAULT_PATTERN = "*.csv";
const INGEST_FINGERPRINT_SOURCES = [
  "src/run.ts",
  "src/load-csv.ts",
  "src/datasets.ts",
  "src/stats-schema.ts",
  "src/players-schema.ts",
  "src/teams-schema.ts",
  "src/standings-schema.ts",
  "src/brackets-schema.ts"
];

type CliOptions = {
  dir: string;
  pattern: string;
  limit?: number;
  dryRun: boolean;
  strict: boolean;
  enforceSeriesIds: boolean;
  truncate: boolean;
  sync: boolean;
  allowNewColumns: boolean;
  dataset?: string;
};

type StatsTrack = {
  mode: "1s" | "2s" | "3s";
  scope: "regional" | "international";
  tier: "none" | "major" | "worlds";
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: DEFAULT_DIR,
    pattern: DEFAULT_PATTERN,
    dryRun: false,
    strict: false,
    enforceSeriesIds: false,
    truncate: false,
    sync: false,
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
    } else if (arg === "--enforce-series-ids") {
      options.enforceSeriesIds = true;
    } else if (arg === "--truncate") {
      options.truncate = true;
    } else if (arg === "--sync") {
      options.sync = true;
    } else if (arg === "--allow-new-columns") {
      options.allowNewColumns = true;
    } else if (arg === "--dataset") {
      options.dataset = argv[i + 1] ?? options.dataset;
      i += 1;
    }
  }

  return options;
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
  fileName: string,
  fileHash: string,
  ingestVersion: string
): Promise<boolean> {
  const result = await client.query(
    "SELECT 1 FROM file_ingest WHERE table_name = $1 AND file_name = $2 AND file_hash = $3 AND ingest_version = $4 LIMIT 1;",
    [tableName, fileName, fileHash, ingestVersion]
  );
  return (result.rowCount ?? 0) > 0;
}

async function recordFileIngest(
  client: Client,
  tableName: string,
  fileName: string,
  report: FileReport,
  fileHash: string,
  fileSize: number,
  ingestVersion: string
): Promise<void> {
  await client.query(
    `
    INSERT INTO file_ingest (table_name, file_name, file_hash, ingest_version, file_size, row_count, inserted, skipped, errored)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (table_name, file_name) DO UPDATE
    SET
      file_hash = EXCLUDED.file_hash,
      ingest_version = EXCLUDED.ingest_version,
      file_size = EXCLUDED.file_size,
      row_count = EXCLUDED.row_count,
      inserted = EXCLUDED.inserted,
      skipped = EXCLUDED.skipped,
      errored = EXCLUDED.errored,
      ingested_at = now();
    `,
    [
      tableName,
      fileName,
      fileHash,
      ingestVersion,
      fileSize,
      report.totalRows,
      report.inserted,
      report.skipped,
      report.errored
    ]
  );
}

async function resolveIngestVersion(): Promise<string> {
  const explicit = (process.env.INGEST_VERSION ?? "").trim();
  if (explicit) {
    return explicit;
  }

  const hash = createHash("sha256");
  for (const filePath of INGEST_FINGERPRINT_SOURCES) {
    try {
      const content = await readFile(filePath);
      hash.update(filePath);
      hash.update("\u0000");
      hash.update(content);
      hash.update("\u0000");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  return `auto-${hash.digest("hex").slice(0, 12)}`;
}

type SeriesIdCoverage = {
  totalRows: number;
  missingSeriesIds: number;
  affectedMatchIds: number;
  sampleMatchIds: string[];
};

async function getMatchIdsBySourceFile(
  client: Client,
  sourceFileName: string
): Promise<string[]> {
  const result = await client.query(
    `
    SELECT DISTINCT "Match ID" AS match_id
    FROM stats
    WHERE regexp_replace(source_file, ' \\([0-9]+\\)(\\.[^.]+)$', '\\1') = $1
      AND "Match ID" IS NOT NULL
      AND TRIM("Match ID") <> '';
    `,
    [sourceFileName]
  );
  return result.rows
    .map((row) => String(row.match_id ?? ""))
    .filter((value) => value.length > 0);
}

async function getStaleStatsMatchIds(
  client: Client,
  canonicalSourceFiles: string[]
): Promise<string[]> {
  if (canonicalSourceFiles.length === 0) {
    const result = await client.query(
      `
      SELECT DISTINCT "Match ID" AS match_id
      FROM stats
      WHERE source_file <> ''
        AND "Match ID" IS NOT NULL
        AND TRIM("Match ID") <> '';
      `
    );
    return result.rows
      .map((row) => String(row.match_id ?? ""))
      .filter((value) => value.length > 0);
  }

  const result = await client.query(
    `
    SELECT DISTINCT "Match ID" AS match_id
    FROM stats
    WHERE source_file <> ''
      AND regexp_replace(source_file, ' \\([0-9]+\\)(\\.[^.]+)$', '\\1') <> ALL($1::text[])
      AND "Match ID" IS NOT NULL
      AND TRIM("Match ID") <> '';
    `,
    [canonicalSourceFiles]
  );
  return result.rows
    .map((row) => String(row.match_id ?? ""))
    .filter((value) => value.length > 0);
}

async function getSeriesIdCoverage(client: Client): Promise<SeriesIdCoverage> {
  const result = await client.query(
    `
    SELECT
      COUNT(*)::INT AS total_rows,
      COUNT(*) FILTER (WHERE series_id IS NULL OR TRIM(series_id) = '')::INT AS missing_series_ids,
      COUNT(DISTINCT "Match ID") FILTER (WHERE series_id IS NULL OR TRIM(series_id) = '')::INT AS affected_match_ids
    FROM stats;
    `
  );
  const totalRows = Number(result.rows[0]?.total_rows ?? 0);
  const missingSeriesIds = Number(result.rows[0]?.missing_series_ids ?? 0);
  const affectedMatchIds = Number(result.rows[0]?.affected_match_ids ?? 0);

  const sampleResult = await client.query(
    `
    SELECT DISTINCT "Match ID" AS match_id
    FROM stats
    WHERE series_id IS NULL OR TRIM(series_id) = ''
    ORDER BY "Match ID"
    LIMIT 5;
    `
  );

  const sampleMatchIds = sampleResult.rows
    .map((row) => row.match_id as string)
    .filter((value) => value && value.length > 0);

  return { totalRows, missingSeriesIds, affectedMatchIds, sampleMatchIds };
}

async function hasMissingSeriesIds(client: Client): Promise<boolean> {
  const result = await client.query(
    `
    SELECT 1
    FROM stats
    WHERE series_id IS NULL OR TRIM(series_id) = ''
    LIMIT 1;
    `
  );
  return (result.rowCount ?? 0) > 0;
}

function normalizeSourceFileName(fileName: string): string {
  return fileName.replace(/ \(\d+\)(\.[^.]+)$/u, "$1").trim();
}

async function syncDatasetSources(
  client: Client,
  tableName: string,
  canonicalSourceFiles: string[]
): Promise<number> {
  if (canonicalSourceFiles.length === 0) {
    const deleted = await client.query(`DELETE FROM ${quoteIdent(tableName)} WHERE source_file <> ''`);
    await client.query("DELETE FROM file_ingest WHERE table_name = $1", [tableName]);
    return deleted.rowCount ?? 0;
  }

  const sqlNormalized =
    "regexp_replace(%s, ' \\([0-9]+\\)(\\.[^.]+)$', '\\1')";

  const deleted = await client.query(
    `
    DELETE FROM ${quoteIdent(tableName)}
    WHERE source_file <> ''
      AND ${sqlNormalized.replace("%s", "source_file")} <> ALL($1::text[]);
    `,
    [canonicalSourceFiles]
  );

  await client.query(
    `
    DELETE FROM file_ingest
    WHERE table_name = $1
      AND ${sqlNormalized.replace("%s", "file_name")} <> ALL($2::text[]);
    `,
    [tableName, canonicalSourceFiles]
  );
  return deleted.rowCount ?? 0;
}

async function listFiles(dir: string, pattern: string): Promise<string[]> {
  const regex = patternToRegex(pattern);
  async function walk(currentDir: string): Promise<string[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(currentDir, { encoding: "utf8" });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const entryStat = await stat(fullPath);
      if (entryStat.isDirectory()) {
        files.push(...(await walk(fullPath)));
        continue;
      }
      if (entryStat.isFile() && regex.test(entry)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const files = await walk(dir);
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

function normalizePathForDb(path: string): string {
  return path.replace(/\\/g, "/");
}

function getSourceFileName(datasetDir: string, filePath: string): string {
  const relPath = normalizePathForDb(relative(datasetDir, filePath));
  return normalizeSourceFileName(relPath);
}

function classifyInternationalTier(pathOrName: string): "major" | "worlds" | null {
  const lowered = pathOrName.toLowerCase();
  if (lowered.includes("worlds")) return "worlds";
  if (lowered.includes("major")) return "major";
  return null;
}

function getStatsTrack(datasetDir: string, filePath: string): StatsTrack {
  const relPath = normalizePathForDb(relative(datasetDir, filePath));
  const parts = relPath.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Unable to classify stats track for file: ${filePath}`);
  }

  const modePart = parts[0]?.toLowerCase();
  if (modePart === "1s") {
    return { mode: "1s", scope: "regional", tier: "none" };
  }
  if (modePart === "2s") {
    return { mode: "2s", scope: "regional", tier: "none" };
  }
  if (modePart !== "3s") {
    throw new Error(
      `Unrecognized mode folder "${parts[0]}" for stats file "${relPath}". Expected 1s, 2s, or 3s.`
    );
  }

  const scopePart = parts[1]?.toLowerCase();
  if (scopePart === "regional") {
    return { mode: "3s", scope: "regional", tier: "none" };
  }
  if (scopePart !== "international") {
    throw new Error(
      `Unrecognized 3s scope folder "${parts[1] ?? ""}" for stats file "${relPath}". Expected 3s/regional or 3s/international.`
    );
  }

  const tier = classifyInternationalTier(relPath);
  if (!tier) {
    throw new Error(
      `Could not classify international tier (major/worlds) for stats file "${relPath}". Include "major" or "worlds" in path or filename.`
    );
  }
  return { mode: "3s", scope: "international", tier };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const datasets = resolveDatasets(options.dataset);
  const hasStatsDataset = datasets.some((dataset) => dataset.tableName === "stats");
  const client = await connectDb();
  const ingestVersion = await resolveIngestVersion();

  try {
    console.log("Connected to DB");
    console.log(
      `Ingestion start: datasets=${datasets.map((dataset) => dataset.key).join(", ")}, dryRun=${options.dryRun}, truncate=${options.truncate}, sync=${options.sync}`
    );
    console.log(`Ingest version: ${ingestVersion}`);
    console.log("Ensuring schema...");
    await client.query(createFileIngestTableSql);
    for (const dataset of datasets) {
      await client.query(dataset.createTableSql);
      if (dataset.addColumnsSql) {
        await client.query(dataset.addColumnsSql);
      }
      if (dataset.customLoader) continue;
      await client.query(addIngestionColumnsSql(dataset.tableName));
      await client.query(addRowHashColumnSql(dataset.tableName));
      if (dataset.addCommentsSql) {
        await client.query(dataset.addCommentsSql);
      }
      await client.query(createRowHashIndexSql(dataset.tableName));
      if (dataset.tableName === "stats") {
        await client.query(`ALTER TABLE stats ADD COLUMN IF NOT EXISTS series_id TEXT`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_stats_series_id ON stats (series_id)`);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_stats_pending_series_match
          ON stats ("Match ID")
          WHERE series_id IS NULL
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_stats_track ON stats ("mode", "scope", "tier")`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_stats_track_event ON stats ("mode", "scope", "tier", "Season", "Split", "Event")`);
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
    let statsMutated = false;
    const changedStatsMatchIds = new Set<string>();
    for (const dataset of datasets) {
      const datasetDir = join(options.dir, dataset.dataSubdir);
      const files = await listFiles(datasetDir, options.pattern);
      const canonicalSourceFiles = Array.from(
        new Set(files.map((filePath) => getSourceFileName(datasetDir, filePath)))
      );
      console.log(`[${dataset.label}] scanning ${datasetDir}: ${files.length} files matched`);

      if (!dataset.customLoader && options.sync && !options.dryRun && !options.limit) {
        console.log(`[${dataset.label}] sync mode: removing stale source-file rows`);
        if (dataset.tableName === "stats") {
          const staleMatchIds = await getStaleStatsMatchIds(client, canonicalSourceFiles);
          for (const matchId of staleMatchIds) {
            changedStatsMatchIds.add(matchId);
          }
        }
        const deletedRows = await syncDatasetSources(client, dataset.tableName, canonicalSourceFiles);
        if (dataset.tableName === "stats" && deletedRows > 0) {
          statsMutated = true;
        }
      }

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
        const sourceFileName = getSourceFileName(datasetDir, filePath);
        const statsTrack = dataset.tableName === "stats"
          ? getStatsTrack(datasetDir, filePath)
          : undefined;

        if (!options.limit && (await isFileIngested(client, dataset.tableName, sourceFileName, fileHash, ingestVersion))) {
          const skippedReport: FileReport = {
            fileName,
            status: "skipped",
            skipReason: `already ingested (${ingestVersion})`,
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
        const shouldReplaceExisting = !options.dryRun && !options.limit;
        console.log(`[${dataset.label}] processing file ${filePath}`);
        if (shouldReplaceExisting) {
          await client.query("BEGIN");
        }
        try {
          if (shouldReplaceExisting) {
            if (dataset.tableName === "stats") {
              const existingMatchIds = await getMatchIdsBySourceFile(client, sourceFileName);
              for (const matchId of existingMatchIds) {
                changedStatsMatchIds.add(matchId);
              }
            }
            const deleteResult = await client.query(
              `DELETE FROM ${quoteIdent(dataset.tableName)}
               WHERE regexp_replace(source_file, ' \\([0-9]+\\)(\\.[^.]+)$', '\\1') = $1;`,
              [sourceFileName]
            );
            if (dataset.tableName === "stats" && (deleteResult.rowCount ?? 0) > 0) {
              statsMutated = true;
            }
          }

          const report = await loadCsvFile(client, filePath, specs, {
            strict: options.strict,
            dryRun: options.dryRun,
            limit: options.limit,
            allowNewColumns: options.allowNewColumns,
            ignoreUnknownColumns: dataset.ignoreUnknownColumns,
            tableName: dataset.tableName,
            schemaFile: dataset.schemaFile,
            sourceFile: sourceFileName,
            headerNormalizer: dataset.headerNormalizer,
            ignoreCoercionErrors: dataset.ignoreCoercionErrors,
            stopAfterHeader: dataset.stopAfterHeader,
            denormalize: dataset.denormalize,
            statsTrack
          });
          report.fileHash = fileHash;
          report.dataset = dataset.key;
          reports.push(report);
          console.log(
            `[${dataset.label}] ${report.fileName}: rows ${report.totalRows}, inserted ${report.inserted}, skipped ${report.skipped}, errored ${report.errored}`
          );

          if (shouldReplaceExisting) {
            await recordFileIngest(
              client,
              dataset.tableName,
              sourceFileName,
              report,
              fileHash,
              fileStats.size,
              ingestVersion
            );
            if (dataset.tableName === "stats") {
              statsMutated = true;
              const reloadedMatchIds = await getMatchIdsBySourceFile(client, sourceFileName);
              for (const matchId of reloadedMatchIds) {
                changedStatsMatchIds.add(matchId);
              }
            }
            await client.query("COMMIT");
          }
        } catch (error) {
          if (shouldReplaceExisting) {
            await client.query("ROLLBACK");
          }
          throw error;
        }
      }
    }

    const shouldBackfillSeriesIds =
      !options.dryRun &&
      hasStatsDataset &&
      (statsMutated || (await hasMissingSeriesIds(client)));

    if (shouldBackfillSeriesIds) {
      console.log("Generating series ids...");
      const scopedMatchIds = Array.from(changedStatsMatchIds);
      if (statsMutated && scopedMatchIds.length > 0) {
        console.log(`Series id backfill scope: ${scopedMatchIds.length} changed match IDs`);
      } else {
        console.log("Series id backfill scope: full stats table");
      }
      const updated = await computeSeriesIds(
        client,
        statsMutated && scopedMatchIds.length > 0 ? scopedMatchIds : undefined
      );
      console.log(`Series id backfill complete: ${updated} rows updated`);
      const seriesCoverage = await getSeriesIdCoverage(client);
      if (seriesCoverage.totalRows > 0 && seriesCoverage.missingSeriesIds > 0) {
        const message = `Series id validation: ${seriesCoverage.missingSeriesIds} of ${seriesCoverage.totalRows} stats rows are NULL/blank across ${seriesCoverage.affectedMatchIds} match IDs after backfill.`;
        if (options.enforceSeriesIds) {
          throw new Error(`${message} Re-run without --enforce-series-ids to continue ingestion.`);
        }
        console.warn(`WARNING: ${message}`);
        if (seriesCoverage.sampleMatchIds.length > 0) {
          console.warn(`WARNING: Sample affected match IDs: ${seriesCoverage.sampleMatchIds.join(", ")}`);
        }
      } else {
        console.log("Series id validation complete: all stats rows have series_id");
      }
      console.log("Refreshing series roster table...");
      const seriesRosterRows = await refreshSeriesRoster(client);
      console.log(`Series roster refresh complete: ${seriesRosterRows} rows`);
    } else if (!options.dryRun && hasStatsDataset) {
      console.log("Stats unchanged; skipping series id backfill and series roster refresh");
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
