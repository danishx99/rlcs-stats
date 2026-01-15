import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { connectDb } from "./db";
import {
  createStatsTableSql,
  addIngestionColumnsSql,
  addRowHashColumnSql,
  createRowHashIndexSql
} from "./stats-schema";
import { extractColumnSpecs, loadCsvFile } from "./load-csv";
import type { FileReport } from "./util/types";

const DEFAULT_DIR = "./data";
const DEFAULT_PATTERN = "*.csv";

type CliOptions = {
  dir: string;
  pattern: string;
  limit?: number;
  dryRun: boolean;
  strict: boolean;
  truncate: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: DEFAULT_DIR,
    pattern: DEFAULT_PATTERN,
    dryRun: false,
    strict: false,
    truncate: false
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
    await client.query(createRowHashIndexSql);
    console.log("schema ensured");

    if (options.truncate && !options.dryRun) {
      await client.query("TRUNCATE stats RESTART IDENTITY;");
      console.log("stats truncated");
    }

    const specs = extractColumnSpecs(createStatsTableSql);
    const files = await listFiles(options.dir, options.pattern);
    if (files.length === 0) {
      console.log("no files matched");
      return;
    }

    const reports: FileReport[] = [];
    for (const filePath of files) {
      console.log(`processing file ${filePath}`);
      const report = await loadCsvFile(client, filePath, specs, {
        strict: options.strict,
        dryRun: options.dryRun,
        limit: options.limit
      });
      reports.push(report);
      console.log(
        `${report.fileName}: rows ${report.totalRows}, inserted ${report.inserted}, skipped ${report.skipped}, errored ${report.errored}`
      );
    }

    const totals = reports.reduce(
      (acc, report) => {
        acc.totalRows += report.totalRows;
        acc.inserted += report.inserted;
        acc.skipped += report.skipped;
        acc.errored += report.errored;
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
