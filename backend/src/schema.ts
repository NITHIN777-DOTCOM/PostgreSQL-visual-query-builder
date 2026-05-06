import type { DbPool } from "./db.js";

export type ColumnInfo = {
  name: string;
  dataType: string;
  isNullable: boolean;
};

export type TableInfo = {
  schema: string;
  name: string;
  columns: ColumnInfo[];
};

export type DatabaseSchema = {
  tables: TableInfo[];
};

export async function loadDatabaseSchema(pool: DbPool): Promise<DatabaseSchema> {
  const { rows } = await pool.query<{
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    ordinal_position: number;
  }>(
    `
    select
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable,
      c.ordinal_position
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where t.table_type = 'BASE TABLE'
      and c.table_schema not in ('pg_catalog', 'information_schema')
    order by c.table_schema, c.table_name, c.ordinal_position;
    `.trim(),
  );

  const key = (schema: string, table: string) => `${schema}.${table}`;
  const byTable = new Map<string, TableInfo>();

  for (const r of rows) {
    const k = key(r.table_schema, r.table_name);
    const existing = byTable.get(k);
    if (!existing) {
      byTable.set(k, {
        schema: r.table_schema,
        name: r.table_name,
        columns: [],
      });
    }
    byTable.get(k)!.columns.push({
      name: r.column_name,
      dataType: r.data_type,
      isNullable: r.is_nullable === "YES",
    });
  }

  return { tables: [...byTable.values()] };
}

export type SchemaIndex = {
  tables: Map<string, TableInfo>;
  columns: Map<string, Set<string>>; // key: schema.table -> columns
};

export function indexSchema(schema: DatabaseSchema): SchemaIndex {
  const tables = new Map<string, TableInfo>();
  const columns = new Map<string, Set<string>>();

  for (const t of schema.tables) {
    const k = `${t.schema}.${t.name}`;
    tables.set(k, t);
    columns.set(
      k,
      new Set(t.columns.map((c) => c.name)),
    );
  }

  return { tables, columns };
}

