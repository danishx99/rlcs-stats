import "dotenv/config";

export const PORT = Number.parseInt(process.env.API_PORT ?? "8787", 10);
export const DATABASE_URL = process.env.DATABASE_URL;
export const DB_QUERY_TIMEOUT_MS = Number.parseInt(process.env.DB_QUERY_TIMEOUT_MS ?? "15000", 10);
export const DB_STATEMENT_TIMEOUT_MS = Number.parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? "15000", 10);
export const DB_LOCK_TIMEOUT_MS = Number.parseInt(process.env.DB_LOCK_TIMEOUT_MS ?? "5000", 10);

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
