import { z } from "zod";
import type { DbPool } from "./db.js";
import { quoteIdent } from "./sqlBuilder.js";
import { CreateTableSchema, createTable } from "./admin.js";
import { parse as parseCsv } from "csv-parse/sync";
import XLSX from "xlsx";

export type DetectedType = "integer" | "float" | "boolean" | "timestamp" | "text";

export const ImportPreviewResponseSchema = z.object({
  fileName: z.string(),
  suggestedTable: z.string(),
  columns: z.array(
    z.object({
      name: z.string(),
      detectedType: z.enum(["integer", "float", "boolean", "timestamp", "text"]),
      nullable: z.boolean(),
    }),
  ),
  previewRows: z.array(z.record(z.string(), z.unknown())),
  totalRows: z.number().int().nonnegative(),
});
export type ImportPreviewResponse = z.infer<typeof ImportPreviewResponseSchema>;

export function toSafeTableName(base: string) {
  const cleaned = base
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "")
    .toLowerCase();
  const fallback = cleaned.length ? cleaned : "imported_table";
  const startOk = /^[a-z_]/.test(fallback) ? fallback : `t_${fallback}`;
  return startOk.slice(0, 63);
}

function toSafeColumnName(name: string, idx: number) {
  const cleaned = name
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "")
    .toLowerCase();
  const fallback = cleaned.length ? cleaned : `col_${idx + 1}`;
  const startOk = /^[a-z_]/.test(fallback) ? fallback : `c_${fallback}`;
  return startOk.slice(0, 63);
}

function isInt(s: string) {
  return /^-?\d+$/.test(s);
}
function isFloat(s: string) {
  return /^-?\d+(\.\d+)?$/.test(s);
}
function isBool(s: string) {
  return /^(true|false|0|1)$/i.test(s);
}
function isTimestamp(s: string) {
  const d = new Date(s);
  return !Number.isNaN(d.valueOf()) && /\d{2,4}/.test(s);
}

function detectType(samples: string[]): DetectedType {
  const nonEmpty = samples.map((x) => x.trim()).filter((x) => x.length > 0);
  if (!nonEmpty.length) return "text";
  if (nonEmpty.every(isInt)) return "integer";
  if (nonEmpty.every(isFloat)) return "float";
  if (nonEmpty.every(isBool)) return "boolean";
  if (nonEmpty.every(isTimestamp)) return "timestamp";
  return "text";
}

export function parseFileToRows(fileName: string, buf: Buffer): { rows: Record<string, unknown>[]; columns: string[] } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) {
    const parsed = JSON.parse(buf.toString("utf-8"));
    if (!Array.isArray(parsed)) throw new Error("JSON must be an array of objects.");
    const rows = parsed as Record<string, unknown>[];
    const cols = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r ?? {})) cols.add(k);
    return { rows, columns: [...cols] };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("No sheets found in the Excel file.");
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const cols = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r ?? {})) cols.add(k);
    return { rows, columns: [...cols] };
  }
  if (lower.endsWith(".csv")) {
    const records = parseCsv(buf, { columns: true, skip_empty_lines: true, bom: true });
    const rows = records as Record<string, unknown>[];
    const cols = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r ?? {})) cols.add(k);
    return { rows, columns: [...cols] };
  }
  throw new Error("Unsupported file type. Upload CSV, XLSX, or JSON.");
}

export function buildPreview(fileName: string, rows: Record<string, unknown>[], rawColumns: string[]): ImportPreviewResponse {
  const previewRows = rows.slice(0, 20);
  const safeColumns = rawColumns.map((c, idx) => toSafeColumnName(c, idx));
  const colMap = new Map<string, string>();
  rawColumns.forEach((c, i) => colMap.set(c, safeColumns[i]!));

  const cols = rawColumns.map((raw, idx) => {
    const safe = safeColumns[idx]!;
    const samples = previewRows.map((r) => String(r?.[raw] ?? ""));
    const detectedType = detectType(samples);
    const nullable = rows.some((r) => r?.[raw] == null || String(r?.[raw] ?? "").trim() === "");
    return { name: safe, detectedType, nullable };
  });

  const normalizedPreview = previewRows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [raw, safe] of colMap.entries()) out[safe] = r?.[raw];
    return out;
  });

  return {
    fileName,
    suggestedTable: toSafeTableName(fileName),
    columns: cols,
    previewRows: normalizedPreview,
    totalRows: rows.length,
  };
}

export const ImportCommitSchema = z.object({
  schema: z.string().default("public"),
  table: z.string().min(1).max(63),
  columns: z.array(
    z.object({
      name: z.string().min(1).max(63),
      type: z.enum(["integer", "float", "boolean", "timestamp", "text"]),
      nullable: z.boolean().default(true),
    }),
  ),
  rows: z.array(z.record(z.string(), z.unknown())).max(200_000),
});

export async function importCreateAndInsert(pool: DbPool, req: z.infer<typeof ImportCommitSchema>) {
  // Create table using existing admin module (maps float -> float)
  const createReq = CreateTableSchema.parse({
    schema: req.schema,
    table: req.table,
    columns: req.columns.map((c) => ({
      name: c.name,
      type: c.type === "float" ? "float" : (c.type as any),
      primaryKey: false,
      nullable: c.nullable,
      unique: false,
    })),
  });
  await createTable(pool, createReq);

  // Bulk insert in chunks
  const colNames = req.columns.map((c) => c.name);
  const chunkSize = 500;
  for (let i = 0; i < req.rows.length; i += chunkSize) {
    const chunk = req.rows.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const values: unknown[] = [];
    const rowsSql: string[] = [];
    for (const r of chunk) {
      const placeholders: string[] = [];
      for (const c of colNames) {
        values.push((r as any)[c]);
        placeholders.push(`$${values.length}`);
      }
      rowsSql.push(`(${placeholders.join(", ")})`);
    }
    const sql = `insert into ${quoteIdent(req.schema)}.${quoteIdent(req.table)} (${colNames.map(quoteIdent).join(", ")}) values ${rowsSql.join(
      ", ",
    )};`;
    await pool.query(sql, values);
  }

  return { ok: true };
}

