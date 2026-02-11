import { Pool } from "pg";
import { DATABASE_URL, DB_LOCK_TIMEOUT_MS, DB_QUERY_TIMEOUT_MS, DB_STATEMENT_TIMEOUT_MS } from "./config";

export const pool = new Pool({
  connectionString: DATABASE_URL,
  query_timeout: DB_QUERY_TIMEOUT_MS,
  statement_timeout: DB_STATEMENT_TIMEOUT_MS,
  lock_timeout: DB_LOCK_TIMEOUT_MS
});
