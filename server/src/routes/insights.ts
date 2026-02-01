import { type IncomingMessage, type ServerResponse } from "node:http";
import { pool } from "../db";
import { json } from "../utils/http";
import { INSIGHTS } from "../insights-queries";

export async function handleInsights(_req: IncomingMessage, res: ServerResponse) {
  try {
    const results = [] as Array<{
      id: string;
      title: string;
      subtitle: string;
      columns: string[];
      rows: Record<string, unknown>[];
    }>;
    for (const insight of INSIGHTS) {
      const queryResult = await pool.query(insight.sql);
      results.push({
        id: insight.id,
        title: insight.title,
        subtitle: insight.subtitle,
        columns: queryResult.fields.map((field) => field.name),
        rows: queryResult.rows
      });
    }
    json(res, 200, { generatedAt: new Date().toISOString(), insights: results });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Failed to query insights" });
  }
}
