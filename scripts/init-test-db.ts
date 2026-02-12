import { Client } from "pg";
import { buildConnectionString } from "../src/db";

function resolveTestConnectionString() {
  const explicit = process.env.DATABASE_URL_TEST?.trim();
  if (explicit) {
    return explicit;
  }

  const base = buildConnectionString();
  const url = new URL(base);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("Could not determine base database name.");
  }
  url.pathname = `/${dbName.endsWith("_test") ? dbName : `${dbName}_test`}`;
  return url.toString();
}

function getDbName(connectionString: string) {
  return new URL(connectionString).pathname.replace(/^\//, "");
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

async function main() {
  const testConnectionString = resolveTestConnectionString();
  const testDbName = getDbName(testConnectionString);

  if (!testDbName.endsWith("_test")) {
    throw new Error(`Refusing to initialize non-test DB "${testDbName}".`);
  }

  const adminUrl = new URL(testConnectionString);
  adminUrl.pathname = "/postgres";

  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  try {
    const existsResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [testDbName]
    );
    if (existsResult.rowCount && existsResult.rowCount > 0) {
      console.log(`Test database already exists: ${testDbName}`);
      return;
    }

    await adminClient.query(`CREATE DATABASE ${quoteIdent(testDbName)}`);
    console.log(`Created test database: ${testDbName}`);
  } finally {
    await adminClient.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
