import { z } from "zod";
import type { DbPool } from "./db.js";
import { indexSchema, loadDatabaseSchema } from "./schema.js";
import { quoteIdent } from "./sqlBuilder.js";

const Ident = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

const PgType = z.enum(["integer", "text", "boolean", "timestamp", "float"]);

function pgTypeToSql(t: z.infer<typeof PgType>): string {
  switch (t) {
    case "integer":
      return "integer";
    case "text":
      return "text";
    case "boolean":
      return "boolean";
    case "timestamp":
      return "timestamp";
    case "float":
      return "double precision";
  }
}

export const CreateTableSchema = z.object({
  schema: Ident.default("public"),
  table: Ident,
  columns: z
    .array(
      z.object({
        name: Ident,
        type: PgType,
        primaryKey: z.boolean().default(false),
        nullable: z.boolean().default(true),
        unique: z.boolean().default(false),
      }),
    )
    .min(1),
});
export type CreateTableRequest = z.infer<typeof CreateTableSchema>;

export const RenameTableSchema = z.object({
  schema: Ident.default("public"),
  from: Ident,
  to: Ident,
});

export const DeleteTableSchema = z.object({
  schema: Ident.default("public"),
  table: Ident,
});

export const AlterTableSchema = z.object({
  schema: Ident.default("public"),
  table: Ident,
  op: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("addColumn"),
      column: z.object({
        name: Ident,
        type: PgType,
        nullable: z.boolean().default(true),
        unique: z.boolean().default(false),
      }),
    }),
    z.object({
      type: z.literal("dropColumn"),
      columnName: Ident,
    }),
    z.object({
      type: z.literal("renameColumn"),
      from: Ident,
      to: Ident,
    }),
    z.object({
      type: z.literal("changeType"),
      columnName: Ident,
      newType: PgType,
    }),
    z.object({
      type: z.literal("setNullable"),
      columnName: Ident,
      nullable: z.boolean(),
    }),
    z.object({
      type: z.literal("setUnique"),
      columnName: Ident,
      unique: z.boolean(),
    }),
  ]),
});

function uqName(table: string, column: string) {
  // deterministic constraint name (short + safe)
  return `uq_${table}_${column}`.slice(0, 60);
}

async function assertTableExists(pool: DbPool, schema: string, table: string) {
  const s = await loadDatabaseSchema(pool);
  const idx = indexSchema(s);
  const k = `${schema}.${table}`;
  if (!idx.tables.has(k)) throw new Error(`Table not found: ${k}`);
  return idx;
}

async function assertColumnExists(pool: DbPool, schema: string, table: string, column: string) {
  const idx = await assertTableExists(pool, schema, table);
  const k = `${schema}.${table}`;
  const cols = idx.columns.get(k);
  if (!cols?.has(column)) throw new Error(`Column not found: ${k}.${column}`);
}

export async function createTable(pool: DbPool, req: CreateTableRequest) {
  const pkCols = req.columns.filter((c) => c.primaryKey);
  if (pkCols.length > 1) throw new Error("Only one primary key column is supported in the UI right now.");

  const colDefs = req.columns.map((c) => {
    const parts: string[] = [quoteIdent(c.name), pgTypeToSql(c.type)];
    if (!c.nullable || c.primaryKey) parts.push("not null");
    return parts.join(" ");
  });

  const constraints: string[] = [];
  if (pkCols.length === 1) {
    constraints.push(`constraint ${quoteIdent(`pk_${req.table}`)} primary key (${quoteIdent(pkCols[0]!.name)})`);
  }
  for (const c of req.columns.filter((x) => x.unique)) {
    constraints.push(`constraint ${quoteIdent(uqName(req.table, c.name))} unique (${quoteIdent(c.name)})`);
  }

  const sql = `create table ${quoteIdent(req.schema)}.${quoteIdent(req.table)} (\n  ${[...colDefs, ...constraints].join(
    ",\n  ",
  )}\n);`;

  await pool.query(sql);
  return { sql };
}

export async function renameTable(pool: DbPool, schema: string, from: string, to: string) {
  await assertTableExists(pool, schema, from);
  const sql = `alter table ${quoteIdent(schema)}.${quoteIdent(from)} rename to ${quoteIdent(to)};`;
  await pool.query(sql);
  return { sql };
}

export async function deleteTable(pool: DbPool, schema: string, table: string) {
  const sql = `drop table if exists ${quoteIdent(schema)}.${quoteIdent(table)} cascade;`;
  await pool.query(sql);
  return { sql };
}

export async function alterTable(pool: DbPool, req: z.infer<typeof AlterTableSchema>) {
  const schema = req.schema;
  const table = req.table;
  await assertTableExists(pool, schema, table);

  const full = `${quoteIdent(schema)}.${quoteIdent(table)}`;

  switch (req.op.type) {
    case "addColumn": {
      const c = req.op.column;
      const statements: string[] = [];
      statements.push(
        `alter table ${full} add column ${quoteIdent(c.name)} ${pgTypeToSql(c.type)}${c.nullable ? "" : " not null"};`,
      );
      if (c.unique) {
        statements.push(
          `alter table ${full} add constraint ${quoteIdent(uqName(table, c.name))} unique (${quoteIdent(c.name)});`,
        );
      }
      for (const s of statements) await pool.query(s);
      return { sql: statements.join("\n") };
    }
    case "dropColumn": {
      await assertColumnExists(pool, schema, table, req.op.columnName);
      const sql = `alter table ${full} drop column ${quoteIdent(req.op.columnName)} cascade;`;
      await pool.query(sql);
      return { sql };
    }
    case "renameColumn": {
      await assertColumnExists(pool, schema, table, req.op.from);
      const sql = `alter table ${full} rename column ${quoteIdent(req.op.from)} to ${quoteIdent(req.op.to)};`;
      await pool.query(sql);
      return { sql };
    }
    case "changeType": {
      await assertColumnExists(pool, schema, table, req.op.columnName);
      const sql = `alter table ${full} alter column ${quoteIdent(req.op.columnName)} type ${pgTypeToSql(req.op.newType)};`;
      await pool.query(sql);
      return { sql };
    }
    case "setNullable": {
      await assertColumnExists(pool, schema, table, req.op.columnName);
      const sql = `alter table ${full} alter column ${quoteIdent(req.op.columnName)} ${
        req.op.nullable ? "drop not null" : "set not null"
      };`;
      await pool.query(sql);
      return { sql };
    }
    case "setUnique": {
      await assertColumnExists(pool, schema, table, req.op.columnName);
      const cName = uqName(table, req.op.columnName);
      const sql = req.op.unique
        ? `alter table ${full} add constraint ${quoteIdent(cName)} unique (${quoteIdent(req.op.columnName)});`
        : `alter table ${full} drop constraint if exists ${quoteIdent(cName)};`;
      await pool.query(sql);
      return { sql };
    }
  }
}

