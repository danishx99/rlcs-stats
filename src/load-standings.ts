import { readFile } from "node:fs/promises";
import type { Client } from "pg";

type StandingsRow = {
  season: string;
  rank: number;
  team_name: string;
  points: number;
};

export async function loadStandingsCsv(
  client: Client,
  filePath: string,
  dryRun: boolean
): Promise<number> {
  const raw = await readFile(filePath, "utf-8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 3) {
    console.log("Standings CSV has too few rows, skipping");
    return 0;
  }

  // Row 0: season names at stride-4 positions
  const headerCells = lines[0].split(",");
  const seasons: { name: string; base: number }[] = [];
  for (let i = 0; i < headerCells.length; i += 4) {
    const name = headerCells[i].trim();
    if (name) {
      seasons.push({ name, base: i });
    }
  }

  if (seasons.length === 0) {
    console.log("No seasons detected in standings header");
    return 0;
  }

  // Row 1 is blank; data starts at row 2
  const rows: StandingsRow[] = [];
  for (let r = 2; r < lines.length; r++) {
    const cells = lines[r].split(",");
    for (const { name, base } of seasons) {
      const rankStr = cells[base]?.trim();
      const teamName = cells[base + 1]?.trim();
      const pointsStr = cells[base + 2]?.trim();
      if (!rankStr || !teamName || !pointsStr) continue;
      const rank = Number.parseInt(rankStr, 10);
      const points = Number.parseInt(pointsStr, 10);
      if (Number.isNaN(rank) || Number.isNaN(points)) continue;
      rows.push({ season: name, rank, team_name: teamName, points });
    }
  }

  console.log(`Parsed ${rows.length} standings rows across ${seasons.length} seasons`);

  if (dryRun) {
    console.log("[dry-run] Would insert standings rows:");
    for (const row of rows.slice(0, 5)) {
      console.log(`  ${row.season} #${row.rank} ${row.team_name} (${row.points} pts)`);
    }
    if (rows.length > 5) console.log(`  ... and ${rows.length - 5} more`);
    return rows.length;
  }

  await client.query("TRUNCATE standings RESTART IDENTITY;");

  const placeholders: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;
  for (const row of rows) {
    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
    values.push(row.season, row.rank, row.team_name, row.points);
    idx += 4;
  }

  await client.query(
    `INSERT INTO standings (season, rank, team_name, points) VALUES ${placeholders.join(", ")}`,
    values
  );

  console.log(`Inserted ${rows.length} standings rows`);
  return rows.length;
}
