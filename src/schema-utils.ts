function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function addIngestionColumnsSql(tableName: string): string {
  return `
ALTER TABLE ${quoteIdent(tableName)}
  ADD COLUMN IF NOT EXISTS source_file TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ NOT NULL DEFAULT now();
`;
}

export function addRowHashColumnSql(tableName: string): string {
  return `
ALTER TABLE ${quoteIdent(tableName)}
  ADD COLUMN IF NOT EXISTS row_hash TEXT NOT NULL;
`;
}

export function createRowHashIndexSql(tableName: string): string {
  const indexName = `${tableName}_row_hash_uq`;
  return `
CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(indexName)} ON ${quoteIdent(tableName)}(row_hash);
`;
}

export const createFileIngestTableSql = `
CREATE TABLE IF NOT EXISTS file_ingest (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL DEFAULT 'stats',
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  row_count INTEGER NOT NULL,
  inserted INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  errored INTEGER NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE file_ingest
  ADD COLUMN IF NOT EXISTS table_name TEXT NOT NULL DEFAULT 'stats';

DROP INDEX IF EXISTS file_ingest_hash_uq;
DROP INDEX IF EXISTS file_ingest_table_hash_uq;
DELETE FROM file_ingest fi
USING file_ingest newer
WHERE fi.table_name = newer.table_name
  AND fi.file_name = newer.file_name
  AND (
    fi.ingested_at < newer.ingested_at
    OR (fi.ingested_at = newer.ingested_at AND fi.id < newer.id)
  );
CREATE UNIQUE INDEX IF NOT EXISTS file_ingest_table_file_uq ON file_ingest(table_name, file_name);
`;
