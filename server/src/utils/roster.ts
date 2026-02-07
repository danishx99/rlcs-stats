import { formatSql, loadSql } from "./sql";

const rosterCtesTemplate = loadSql("../../sql/rosters/ctes.sql", import.meta.url);

export function seriesIdExpr(alias: string) {
  // Keep full match identity and only strip game suffix.
  // This prevents unrelated concurrent matches from collapsing into one series.
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
