import {
  customerSchema,
  customerRecord,
  emptyCustomer,
  type Customer,
} from "./schema";
export const csvHeaders = Object.keys(
  emptyCustomer,
) as (keyof typeof emptyCustomer)[];
export function parseCsv(source: string): string[][] {
  if (new TextEncoder().encode(source).length > 262144)
    throw new Error("CSV must be 256 KB or smaller.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  source = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      if (cell || closed) throw new Error("Invalid CSV quotes.");
      quoted = true;
    } else if (ch === "," || ch === "\n" || ch === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (ch !== ",") {
        if (ch === "\r" && source[i + 1] === "\n") i++;
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
        if (rows.length > 201)
          throw new Error("Import up to 200 customers at a time.");
      }
    } else {
      if (closed) throw new Error("Unexpected text after CSV quote.");
      cell += ch;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  if (rows.length > 201)
    throw new Error("Import up to 200 customers at a time.");
  return rows;
}
export function importCsv(source: string) {
  const [header, ...rows] = parseCsv(source);
  if (!header || !rows.length)
    throw new Error("CSV needs a header and at least one customer.");
  const normalized = header.map((h) => h.trim());
  if (
    new Set(normalized).size !== normalized.length ||
    normalized.some(
      (h) => !csvHeaders.includes(h as (typeof csvHeaders)[number]),
    ) ||
    !normalized.includes("name")
  )
    throw new Error("Use the CSV template headers; name is required.");
  return rows.map((row, index) => {
    if (row.length !== header.length)
      throw new Error(`Row ${index + 2} has the wrong number of columns.`);
    const parsed = customerSchema.safeParse({
      ...emptyCustomer,
      ...Object.fromEntries(normalized.map((h, i) => [h, row[i]])),
    });
    if (!parsed.success)
      throw new Error(`Row ${index + 2}: ${parsed.error.issues[0].message}`);
    return customerRecord(parsed.data);
  });
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportCsv(rows: Customer[]) {
  return (
    "\uFEFF" +
    [
      csvHeaders.join(","),
      ...rows.map((row) =>
        csvHeaders
          .map((key) =>
            csvCell(key === "tags" ? row.tags.join(", ") : row[key]),
          )
          .join(","),
      ),
    ].join("\r\n")
  );
}
