import { connectDb } from "../src/db";

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const client = await connectDb();
  try {
    const playersResult = await client.query<{
      players_total: string;
      players_with_unique_id: string;
    }>(`
      SELECT
        COUNT(*)::int::text AS players_total,
        COUNT(*) FILTER (WHERE NULLIF(TRIM("Unique ID"), '') IS NOT NULL)::int::text AS players_with_unique_id
      FROM players
    `);
    const playersTotal = Number(playersResult.rows[0]?.players_total ?? 0);
    const playersWithUniqueId = Number(playersResult.rows[0]?.players_with_unique_id ?? 0);
    if (playersTotal > 0 && playersWithUniqueId === 0) {
      fail("Integrity check failed: players table has rows but no populated Unique ID values.");
    }

    const trackResult = await client.query<{ invalid_track_rows: string }>(`
      SELECT COUNT(*)::int::text AS invalid_track_rows
      FROM stats s
      WHERE s."mode" NOT IN ('1s', '2s', '3s')
         OR s."scope" NOT IN ('regional', 'international')
         OR s."tier" NOT IN ('none', 'major', 'worlds')
         OR (s."scope" = 'regional' AND s."tier" <> 'none')
         OR (s."scope" = 'international' AND s."tier" NOT IN ('major', 'worlds'))
    `);
    const invalidTrackRows = Number(trackResult.rows[0]?.invalid_track_rows ?? 0);
    if (invalidTrackRows > 0) {
      fail(`Integrity check failed: found ${invalidTrackRows} stats rows with invalid mode/scope/tier values.`);
    }

    const joinResult = await client.query<{
      matched_ids: string;
      total_stats_ids: string;
    }>(`
      WITH keys AS (
        SELECT DISTINCT NULLIF(TRIM(s."Unique ID"), '') AS player_key
        FROM stats s
        WHERE NULLIF(TRIM(s."Unique ID"), '') IS NOT NULL
      )
      SELECT
        COUNT(*) FILTER (WHERE p.id IS NOT NULL)::int::text AS matched_ids,
        COUNT(*)::int::text AS total_stats_ids
      FROM keys k
      LEFT JOIN players p ON NULLIF(TRIM(p."Unique ID"), '') = k.player_key
    `);
    const matchedIds = Number(joinResult.rows[0]?.matched_ids ?? 0);
    const totalStatsIds = Number(joinResult.rows[0]?.total_stats_ids ?? 0);
    const coverage = totalStatsIds > 0 ? matchedIds / totalStatsIds : 1;
    if (totalStatsIds > 0 && coverage < 0.98) {
      fail(
        `Integrity check failed: stats->players join coverage too low (${matchedIds}/${totalStatsIds}, ${(coverage * 100).toFixed(2)}%).`
      );
    }

    console.log(
      `Integrity check passed: players_unique_id=${playersWithUniqueId}/${playersTotal}, invalid_track_rows=${invalidTrackRows}, join_coverage=${matchedIds}/${totalStatsIds}`
    );
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
