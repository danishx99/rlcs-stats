export type ColumnType =
  | "TEXT"
  | "INTEGER"
  | "BOOLEAN"
  | "TIMESTAMPTZ"
  | "DOUBLE PRECISION";

export type ColumnSpec = {
  name: string;
  type: ColumnType;
};

export type RowError = {
  rowNumber: number;
  column: string;
  value: string;
  reason: string;
};

export type FileReport = {
  fileName: string;
  status: "processed" | "skipped";
  skipReason?: string;
  fileHash?: string;
  dataset?: string;
  totalRows: number;
  inserted: number;
  skipped: number;
  errored: number;
  errors: RowError[];
};
