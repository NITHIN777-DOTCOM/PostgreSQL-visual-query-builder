import { z } from "zod";
import type { DbPool } from "./db.js";
import { indexSchema, loadDatabaseSchema } from "./schema.js";
import { quoteIdent } from "./sqlBuilder.js";

const Ident = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const ListRowsSchema = z.object({
  schema: Ident.default("public"),
  table: Ident,
  limit: z.coerce.number().int().positive().max(500).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const InsertRowSchema = z.object({
  schema: Ident.default("public"),
  table: Ident,
  values: z.record(z.string(), z.unknown()),
});

export const UpdateRowSchema = z.object({
  schema: Ident.default("public"),
  table: Ident,
  pk: z.object({ column: Ident, value: z.unknown() }),
  values: z.record(z.string(), z.unknown()),
});

export const DeleteRowSchema = z.object({
  schema: Ident.default("public"),
  table: Ident,
  pk: z.object({ column: Ident, value: z.unknown() }),
});

function tableKey(schema: string, table: string) {
  return `${schema}.${table}`;
}

async function assertTableAndCols(pool: DbPool, schema: string, table: string) {
  const dbSchema = await loadDatabaseSchema(pool);
  const idx = indexSchema(dbSchema);
  const k = tableKey(schema, table);
  const t = idx.tables.get(k);
  if (!t) throw new Error(`Table not found: ${k}`);
  const cols = idx.columns.get(k) ?? new Set<string>();
  return { t, cols };
}

function pickPrimaryKeyColumn(t: Awaited<ReturnType<typeof assertTableAndCols>>["t"]) {
  return t.columns.find((c) => c.isPrimaryKey)?.name ?? null;
}

export async function listRows(pool: DbPool, req: z.infer<typeof ListRowsSchema>) {
  const { t } = await assertTableAndCols(pool, req.schema, req.table);
  const pk = pickPrimaryKeyColumn(t);
  const orderBy = pk ? `order by ${quoteIdent(pk)} asc` : "";
  const sql = `select * from ${quoteIdent(req.schema)}.${quoteIdent(req.table)} ${orderBy} limit $1 offset $2`;
  const countSql = `select count(*)::int as total from ${quoteIdent(req.schema)}.${quoteIdent(req.table)}`;
  const [paged, count] = await Promise.all([pool.query(sql, [req.limit, req.offset]), pool.query<{ total: number }>(countSql)]);
  return {
    sql: sql + ";",
    limit: req.limit,
    offset: req.offset,
    totalCount: count.rows[0]?.total ?? 0,
    rowCount: paged.rowCount ?? 0,
    fields: paged.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: paged.rows,
    primaryKey: pk,
  };
}

export async function insertRow(pool: DbPool, req: z.infer<typeof InsertRowSchema>) {
  const { cols } = await assertTableAndCols(pool, req.schema, req.table);
  const entries = Object.entries(req.values).filter(([k]) => cols.has(k));
  if (!entries.length) throw new Error("No valid columns to insert.");
  const names = entries.map(([k]) => quoteIdent(k));
  const params = entries.map(([, v]) => v);
  const placeholders = params.map((_, i) => `$${i + 1}`);
  const sql = `insert into ${quoteIdent(req.schema)}.${quoteIdent(req.table)} (${names.join(", ")}) values (${placeholders.join(
    ", ",
  )}) returning *`;
  const result = await pool.query(sql, params);
  return {
    sql: sql + ";",
    rowCount: result.rowCount ?? 0,
    fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: result.rows,
  };
}

export async function updateRow(pool: DbPool, req: z.infer<typeof UpdateRowSchema>) {
  const { cols, t } = await assertTableAndCols(pool, req.schema, req.table);
  const pkFallback = pickPrimaryKeyColumn(t);
  const pkCol = req.pk.column || pkFallback;
  if (!pkCol) throw new Error("No primary key found for this table. Add a primary key or choose a key column.");
  if (!cols.has(pkCol)) throw new Error(`Column not found: ${pkCol}`);

  const entries = Object.entries(req.values).filter(([k]) => cols.has(k) && k !== pkCol);
  if (!entries.length) throw new Error("No valid columns to update.");

  const setParts: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of entries) {
    params.push(v);
    setParts.push(`${quoteIdent(k)} = $${params.length}`);
  }
  params.push(req.pk.value);
  const sql = `update ${quoteIdent(req.schema)}.${quoteIdent(req.table)} set ${setParts.join(", ")} where ${quoteIdent(
    pkCol,
  )} = $${params.length} returning *`;
  const result = await pool.query(sql, params);
  return {
    sql: sql + ";",
    rowCount: result.rowCount ?? 0,
    fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: result.rows,
  };
}

export async function deleteRow(pool: DbPool, req: z.infer<typeof DeleteRowSchema>) {
  const { cols, t } = await assertTableAndCols(pool, req.schema, req.table);
  const pkFallback = pickPrimaryKeyColumn(t);
  const pkCol = req.pk.column || pkFallback;
  if (!pkCol) throw new Error("No primary key found for this table. Add a primary key or choose a key column.");
  if (!cols.has(pkCol)) throw new Error(`Column not found: ${pkCol}`);

  const sql = `delete from ${quoteIdent(req.schema)}.${quoteIdent(req.table)} where ${quoteIdent(pkCol)} = $1 returning *`;
  const result = await pool.query(sql, [req.pk.value]);
  return {
    sql: sql + ";",
    rowCount: result.rowCount ?? 0,
    fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: result.rows,
  };
}

