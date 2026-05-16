export function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
