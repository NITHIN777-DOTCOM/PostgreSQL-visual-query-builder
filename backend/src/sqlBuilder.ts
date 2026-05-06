import { z } from "zod";
import type { SchemaIndex } from "./schema.js";

const Ident = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

function quoteIdent(ident: string): string {
  // We only allow a safe identifier character set (via regex),
  // so quoting here is mostly for correctness vs reserved words / casing.
  return `"${ident.replaceAll('"', '""')}"`;
}

export const VisualQuerySchema = z.object({
  tables: z
    .array(
      z.object({
        nodeId: z.string().min(1),
        schema: Ident.default("public"),
        table: Ident,
        alias: Ident.optional(),
      }),
    )
    .min(1),
  joins: z.array(
    z.object({
      joinType: z.enum(["INNER", "LEFT", "RIGHT", "FULL"]).default("INNER"),
      from: z.object({
        nodeId: z.string().min(1),
        column: Ident,
      }),
      to: z.object({
        nodeId: z.string().min(1),
        column: Ident,
      }),
    }),
  ),
  select: z
    .array(
      z.object({
        nodeId: z.string().min(1),
        column: Ident,
        as: Ident.optional(),
      }),
    )
    .default([]),
  limit: z.coerce.number().int().positive().max(5000).optional(),
});

export type VisualQuery = z.infer<typeof VisualQuerySchema>;

export function generateSql(vq: VisualQuery, schemaIndex: SchemaIndex): string {
  const nodesById = new Map<string, { schema: string; table: string; alias: string }>();
  const usedAliases = new Set<string>();

  for (const t of vq.tables) {
    const fullKey = `${t.schema}.${t.table}`;
    if (!schemaIndex.tables.has(fullKey)) {
      throw new Error(`Unknown table: ${fullKey}`);
    }
    const alias = t.alias ?? t.table;
    if (usedAliases.has(alias)) {
      throw new Error(`Duplicate table alias: ${alias}`);
    }
    usedAliases.add(alias);
    nodesById.set(t.nodeId, { schema: t.schema, table: t.table, alias });
  }

  const resolveRef = (nodeId: string, column: string) => {
    const n = nodesById.get(nodeId);
    if (!n) throw new Error(`Unknown nodeId: ${nodeId}`);
    const tableKey = `${n.schema}.${n.table}`;
    const cols = schemaIndex.columns.get(tableKey);
    if (!cols || !cols.has(column)) throw new Error(`Unknown column: ${tableKey}.${column}`);
    return { ...n, column };
  };

  const base = vq.tables[0]!;
  const baseAlias = nodesById.get(base.nodeId)!.alias;

  const selectList =
    vq.select.length === 0
      ? [`${quoteIdent(baseAlias)}.*`]
      : vq.select.map((s) => {
          const r = resolveRef(s.nodeId, s.column);
          const expr = `${quoteIdent(r.alias)}.${quoteIdent(r.column)}`;
          return s.as ? `${expr} as ${quoteIdent(s.as)}` : expr;
        });

  const fromTable = nodesById.get(base.nodeId)!;
  const fromClause = `from ${quoteIdent(fromTable.schema)}.${quoteIdent(fromTable.table)} as ${quoteIdent(
    fromTable.alias,
  )}`;

  // naive join ordering: just emit joins as provided
  const joinClauses = vq.joins.map((j) => {
    const l = resolveRef(j.from.nodeId, j.from.column);
    const r = resolveRef(j.to.nodeId, j.to.column);
    const rightNode = nodesById.get(j.to.nodeId)!;
    return `${j.joinType} join ${quoteIdent(rightNode.schema)}.${quoteIdent(
      rightNode.table,
    )} as ${quoteIdent(rightNode.alias)} on ${quoteIdent(l.alias)}.${quoteIdent(
      l.column,
    )} = ${quoteIdent(r.alias)}.${quoteIdent(r.column)}`;
  });

  const limitClause = vq.limit ? `limit ${vq.limit}` : "";

  return `select\n  ${selectList.join(",\n  ")}\n${fromClause}\n${joinClauses.join("\n")}${limitClause ? `\n${limitClause}` : ""};`;
}

