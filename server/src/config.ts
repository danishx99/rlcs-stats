import "dotenv/config";

export const PORT = Number.parseInt(process.env.API_PORT ?? "8787", 10);
export const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
