import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import type { Client } from "pg";
import { connectDb } from "./db";
import {
  createStatsTableSql,
  addStatsTableCommentsSql,
  addIngestionColumnsSql,
  addRowHashColumnSql,
  createRowHashIndexSql,
  createFileIngestTableSql
} from "./stats-schema";
import { loadCsvFile } from "./load-csv";
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

const IGNORED_COLUMNS = new Set(["id", "source_file", "ingested_at", "row_hash"]);

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

async function getColumnSpecsFromDb(client: Client): Promise<ColumnSpec[]> {
  const result = await client.query(
    `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stats'
    ORDER BY ordinal_position;
    `
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

async function isFileIngested(client: Client, fileHash: string): Promise<boolean> {
  const result = await client.query(
    "SELECT 1 FROM file_ingest WHERE file_hash = $1 LIMIT 1;",
    [fileHash]
  );
  return (result.rowCount ?? 0) > 0;
}

async function recordFileIngest(
  client: Client,
  report: FileReport,
  fileHash: string,
  fileSize: number
): Promise<void> {
  await client.query(
    `
    INSERT INTO file_ingest (file_name, file_hash, file_size, row_count, inserted, skipped, errored)
    VALUES ($1, $2, $3, $4, $5, $6, $7);
    `,
    [
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
  const entries = await readdir(dir);
  const regex = patternToRegex(pattern);
  return entries.filter((name) => regex.test(name)).map((name) => join(dir, name));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const client = await connectDb();

  try {
    console.log("connected to db");
    await client.query(createStatsTableSql);
    await client.query(addIngestionColumnsSql);
    await client.query(addRowHashColumnSql);
    await client.query(addStatsTableCommentsSql);
    await client.query(createRowHashIndexSql);
    await client.query(createFileIngestTableSql);
    console.log("schema ensured");

    if (options.truncate && !options.dryRun) {
      await client.query("TRUNCATE stats RESTART IDENTITY;");
      await client.query("TRUNCATE file_ingest RESTART IDENTITY;");
      console.log("stats truncated");
    }

    const files = await listFiles(options.dir, options.pattern);
    if (files.length === 0) {
      console.log("no files matched");
      return;
    }

    const reports: FileReport[] = [];
    for (const filePath of files) {
      const fileStats = await stat(filePath);
      const fileHash = await computeFileHash(filePath);
      const fileName = basename(filePath);

      if (!options.limit && (await isFileIngested(client, fileHash))) {
        const skippedReport: FileReport = {
          fileName,
          status: "skipped",
          skipReason: "already ingested",
          fileHash,
          totalRows: 0,
          inserted: 0,
          skipped: 0,
          errored: 0,
          errors: []
        };
        reports.push(skippedReport);
        console.log(`skipping file ${filePath} (already ingested)`);
        continue;
      }

      const specs = await getColumnSpecsFromDb(client);
      console.log(`processing file ${filePath}`);
      const report = await loadCsvFile(client, filePath, specs, {
        strict: options.strict,
        dryRun: options.dryRun,
        limit: options.limit,
        allowNewColumns: options.allowNewColumns
      });
      report.fileHash = fileHash;
      reports.push(report);
      console.log(
        `${report.fileName}: rows ${report.totalRows}, inserted ${report.inserted}, skipped ${report.skipped}, errored ${report.errored}`
      );

      if (!options.dryRun && !options.limit) {
        await recordFileIngest(client, report, fileHash, fileStats.size);
      }
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
      `total rows ${totals.totalRows}, inserted ${totals.inserted}, skipped ${totals.skipped}, errored ${totals.errored}`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
