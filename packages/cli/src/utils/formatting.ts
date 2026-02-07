/**
 * Formatting utilities for CLI output
 * @module utils/formatting
 */

/**
 * Unwraps data into an array of records for formatting
 * @param data - Raw data that may be an array, object with list property, or single value
 * @returns Array of records ready for formatting
 */
function unwrapData(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.list)) return obj.list as Record<string, unknown>[];
    return [obj];
  }
  return [{ value: data }];
}

/**
 * Escapes a field value for CSV output
 * @param value - The value to escape
 * @returns Escaped CSV field string
 */
function escapeCsvField(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats data as JSON string
 * @param data - Data to format
 * @param pretty - Whether to pretty-print with indentation
 * @returns JSON string
 * @example
 * ```typescript
 * formatJson({ name: "test" }, true);
 * // Returns: '{\n  "name": "test"\n}'
 * ```
 */
export function formatJson(data: unknown, pretty: boolean): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

/**
 * Formats data as CSV string
 * @param data - Data to format (array, object with list property, or single value)
 * @returns CSV string with headers and rows
 * @example
 * ```typescript
 * formatCsv([{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]);
 * // Returns: 'name,age\nAlice,30\nBob,25'
 * ```
 */
export function formatCsv(data: unknown): string {
  const rows = unwrapData(data);
  if (rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines: string[] = [keys.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => escapeCsvField(row[k])).join(","));
  }
  return lines.join("\n");
}

/**
 * Formats data as a table string
 * @param data - Data to format (array, object with list property, or single value)
 * @returns Formatted table string with borders and alignment
 * @example
 * ```typescript
 * formatTable([{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]);
 * // Returns:
 * // | name  | age |
 * // |-------|-----|
 * // | Alice | 30  |
 * // | Bob   | 25  |
 * ```
 */
export function formatTable(data: unknown): string {
  const rows = unwrapData(data);
  if (rows.length === 0) return "(empty)";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const MAX_WIDTH = 40;

  function truncate(str: string): string {
    return str.length > MAX_WIDTH ? str.slice(0, MAX_WIDTH - 3) + "..." : str;
  }

  const headerCells = keys.map(truncate);
  const dataCells = rows.map((row) => keys.map((k) => truncate(row[k] == null ? "" : String(row[k]))));

  const colWidths = keys.map((_, i) => {
    const vals = [headerCells[i], ...dataCells.map((r) => r[i])];
    return Math.max(...vals.map((v) => v.length));
  });

  function formatRow(cells: string[]): string {
    return "| " + cells.map((c, i) => c.padEnd(colWidths[i])).join(" | ") + " |";
  }

  const separator = "|-" + colWidths.map((w) => "-".repeat(w)).join("-|-") + "-|";
  const lines = [formatRow(headerCells), separator, ...dataCells.map(formatRow)];
  return lines.join("\n");
}
