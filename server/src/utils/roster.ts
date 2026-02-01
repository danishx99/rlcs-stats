import { formatSql, loadSql } from "./sql";

const rosterCtesTemplate = loadSql("../../sql/rosters/ctes.sql", import.meta.url);

export function seriesIdExpr(alias: string) {
  // Group games by date + event info to identify series
  // Strip timestamp (HHMMSS) and game number so all games in a series share same ID
  // Format: YYYYMMDD-HHMMSS-Season-Split-Event-Stage-Round-G#
  // Result: YYYYMMDD-Season-Split-Event-Stage-Round
  return `regexp_replace(regexp_replace(${alias}."Match ID", '-[0-9]{6}-', '-'), '-G[0-9]+$', '')`;
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
