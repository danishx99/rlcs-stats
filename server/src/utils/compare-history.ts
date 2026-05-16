import { buildFilterClauses } from "./filters";
import { formatSql } from "./sql";

type CompareHistoryRow = Record<string, unknown>;

type CompareHistoryQueryResult = {
  rows: CompareHistoryRow[];
  total: number;
};

type CompareHistoryExecutor = (sql: string, params: unknown[]) => Promise<{ rows: CompareHistoryRow[] }>;

type RunCompareHistoryQueryArgs = {
  searchParams: URLSearchParams;
  sqlTemplate: string;
  ids: string[];
  limit: number;
  offset: number;
  execute: CompareHistoryExecutor;
  extraSqlTokens?: Record<string, string>;
};

export async function runCompareHistoryQuery({
  searchParams,
  sqlTemplate,
  ids,
  limit,
  offset,
  execute,
  extraSqlTokens = {}
}: RunCompareHistoryQueryArgs): Promise<CompareHistoryQueryResult> {
  const { clauses, values } = buildFilterClauses(searchParams, "s");
  const idsIndex = values.length + 1;
  const limitIndex = idsIndex + 1;
  const offsetIndex = idsIndex + 2;

  const sql = formatSql(sqlTemplate, {
    filterClauses: clauses.length ? `AND ${clauses.join(" AND ")}` : "",
    idsParam: `$${idsIndex}`,
    limitParam: `$${limitIndex}`,
    offsetParam: `$${offsetIndex}`,
    ...extraSqlTokens
  });

  const result = await execute(sql, [...values, ids, limit, offset]);
  const total = Number(result.rows[0]?.total_count ?? 0);
  const rows = result.rows.filter((row) => row.series_id !== null).map((row) => {
    const { total_count, ...rest } = row;
    return rest;
  });

  return { rows, total };
}
