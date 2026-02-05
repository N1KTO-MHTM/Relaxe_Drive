/** Download array of objects as CSV file. */
export function downloadCsv<T extends object>(
  rows: T[],
  filename: string,
  columns: { key: keyof T; label: string }[]
) {
  const csv = buildCsvString(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function escapeCsvCell(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build CSV string (for testing and download). */
export function buildCsvString<T extends object>(
  rows: T[],
  columns: { key: keyof T; label: string }[]
): string {
  const BOM = '\uFEFF';
  const header = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(String((row as Record<string, unknown>)[c.key as string] ?? ''))).join(',')
  );
  return BOM + [header, ...lines].join('\r\n');
}
