import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function loadSql(relativePath: string, importMetaUrl: string) {
  const baseDir = dirname(fileURLToPath(importMetaUrl));
  const fullPath = resolve(baseDir, relativePath);
  return readFileSync(fullPath, "utf8");
}

export function columnRef(alias: string, column: string) {
  return alias ? `${alias}."${column}"` : `"${column}"`;
}

export function formatSql(template: string, replacements: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const replacement = replacements[key];
    if (replacement === undefined) {
      throw new Error(`Missing SQL replacement for ${key}`);
    }
    return replacement;
  });
}
