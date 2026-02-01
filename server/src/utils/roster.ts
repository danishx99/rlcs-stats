import { formatSql, loadSql } from "./sql";

const rosterCtesTemplate = loadSql("../../sql/rosters/ctes.sql", import.meta.url);

export function seriesIdExpr(alias: string) {
  // Keep timestamp to identify unique matches
  // Only strip game number (-G#) so all games in a best-of series share same ID
  // Games in different matches will have different timestamps
  return `regexp_replace(${alias}."Match ID", '-G[0-9]+$', '')`;
}

export function playerKeyExpr(alias: string) {
  return `NULLIF(TRIM(${alias}."Unique ID"), '')`;
}

export function rosterCtes(where: string) {
  return formatSql(rosterCtesTemplate, {
    where,
    playerKeyExpr: playerKeyExpr("s"),
    seriesIdExpr: seriesIdExpr("s")
  });
}
