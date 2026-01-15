import { Client } from "pg";

export function buildConnectionString(): string {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.POSTGRES_HOST ?? "localhost";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const db = process.env.POSTGRES_DB ?? "statsdb";
  const user = process.env.POSTGRES_USER ?? "stats";
  const password = process.env.POSTGRES_PASSWORD ?? "stats_pw";

  return `postgres://${user}:${password}@${host}:${port}/${db}`;
}

export async function connectDb(): Promise<Client> {
  const connectionString = buildConnectionString();
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}
