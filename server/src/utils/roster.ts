import { formatSql, loadSql } from "./sql";

const rosterCtesTemplate = loadSql("../../sql/rosters/ctes.sql", import.meta.url);

export function seriesIdExpr(alias: string) {
  return `regexp_replace(regexp_replace(${alias}."Match ID", '^[0-9]{8}-[0-9]{6}-', ''), '-G[0-9]+$', '')`;
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
