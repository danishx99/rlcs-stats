import { readFile } from "node:fs/promises";
import type { Client } from "pg";

type BracketRow = {
  season: string;
  split: string;
  regional: string;
  bracketImageUrl: string;
  liquipediaUrl: string;
};

function parseBracketRows(raw: string): BracketRow[] {
  const rows: BracketRow[] = [];
  const lines = raw.split("\n").map((line) => line.replace(/\r$/, ""));
  if (lines.length <= 1) {
    return rows;
  }

  // Row 0 is the header ("Bracket Links ,,,Bracket Image,Liqui Page link")
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || !line.trim()) continue;

    const cells = line.split(",");
    const season = cells[0]?.trim() ?? "";
    const split = cells[1]?.trim() ?? "";
    const regional = cells[2]?.trim() ?? "";
    const bracketImageUrl = cells[3]?.trim() ?? "";
    const liquipediaUrl = cells[4]?.trim() ?? "";

    // Separator rows appear as ",,,,"
    if (!season && !split && !regional && !bracketImageUrl && !liquipediaUrl) {
      continue;
    }

    if (!season || !split || !regional || !bracketImageUrl || !liquipediaUrl) {
      continue;
    }

    rows.push({
      season,
      split,
      regional,
      bracketImageUrl,
      liquipediaUrl
    });
  }

  return rows;
}

export async function loadBracketsCsv(client: Client, filePath: string, dryRun: boolean): Promise<number> {
  const raw = await readFile(filePath, "utf-8");
  const rows = parseBracketRows(raw);

  console.log(`Parsed ${rows.length} bracket rows from ${filePath}`);

  if (dryRun) {
    console.log("[dry-run] Would insert bracket rows:");
    for (const row of rows.slice(0, 5)) {
      console.log(`  ${row.season} / ${row.split} / ${row.regional}`);
    }
    if (rows.length > 5) {
      console.log(`  ... and ${rows.length - 5} more`);
    }
    return rows.length;
  }

  await client.query("TRUNCATE brackets RESTART IDENTITY;");
  if (rows.length === 0) {
    return 0;
  }

  const placeholders: string[] = [];
  const values: string[] = [];
  let parameter = 1;
  for (const row of rows) {
    placeholders.push(`($${parameter}, $${parameter + 1}, $${parameter + 2}, $${parameter + 3}, $${parameter + 4})`);
    values.push(row.season, row.split, row.regional, row.bracketImageUrl, row.liquipediaUrl);
    parameter += 5;
  }

  await client.query(
    `
    INSERT INTO brackets (season, split, regional, bracket_image_url, liquipedia_url)
    VALUES ${placeholders.join(", ")}
    ON CONFLICT (season, split, regional)
    DO UPDATE SET
      bracket_image_url = EXCLUDED.bracket_image_url,
      liquipedia_url = EXCLUDED.liquipedia_url;
    `,
    values
  );

  console.log(`Inserted ${rows.length} bracket rows`);
  return rows.length;
}
