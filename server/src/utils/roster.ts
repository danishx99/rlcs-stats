import { formatSql, loadSql } from "./sql";

const rosterCtesTemplate = loadSql("../../sql/rosters/ctes.sql", import.meta.url);

export function playerKeyExpr(alias: string) {
  return `NULLIF(TRIM(${alias}."Unique ID"), '')`;
}

export function rosterCtes(where: string) {
  return formatSql(rosterCtesTemplate, {
    where,
    playerKeyExpr: playerKeyExpr("s")
  });
}
