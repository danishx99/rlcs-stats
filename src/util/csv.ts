import { createReadStream } from "node:fs";
import { parse } from "csv-parse";

export type CsvRow = Record<string, string>;

export type StreamCsvOptions = {
  onRow: (row: CsvRow, rowNumber: number) => Promise<boolean | void> | boolean | void;
};

export type StreamCsvResult = {
  headers: string[];
  rows: number;
};

export async function streamCsvRows(
  filePath: string,
  options: StreamCsvOptions
): Promise<StreamCsvResult> {
  let headers: string[] = [];
  let rowNumber = 0;

  const parser = parse({
    columns: (header: string[]) => {
      headers = header;
      return header;
    },
    relax_column_count: true,
    skip_empty_lines: true,
    trim: false
  });

  const stream = createReadStream(filePath);
  stream.pipe(parser);

  try {
    for await (const record of parser) {
      rowNumber += 1;
      const shouldContinue = await options.onRow(record as CsvRow, rowNumber);
      if (shouldContinue === false) {
        parser.destroy();
        stream.destroy();
        break;
      }
    }
  } catch (error) {
    parser.destroy();
    stream.destroy();
    throw error;
  }

  return { headers, rows: rowNumber };
}
