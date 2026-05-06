import { z } from "zod";

export const ManualSqlRequestSchema = z.object({
  sql: z.string().min(1).max(200_000),
  limit: z.coerce.number().int().positive().max(1000).default(200),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ManualSqlRequest = z.infer<typeof ManualSqlRequestSchema>;

function stripTrailingSemicolons(s: string) {
  return s.replace(/;+\s*$/g, "");
}

function isSelectLike(sql: string): boolean {
  const s = stripTrailingSemicolons(sql).trimStart().toLowerCase();
  // allow common read-only patterns
  return s.startsWith("select") || s.startsWith("with");
}

function hasMultipleStatements(sql: string): boolean {
  // Very conservative: forbid any semicolon except possibly trailing.
  const stripped = stripTrailingSemicolons(sql);
  return stripped.includes(";");
}

export function validateManualSql(sql: string): { baseSql: string } {
  if (hasMultipleStatements(sql)) {
    throw new Error("Only one SQL statement is allowed.");
  }
  if (!isSelectLike(sql)) {
    throw new Error("Only SELECT queries are allowed in the SQL editor. Use the table actions for schema changes.");
  }
  return { baseSql: stripTrailingSemicolons(sql).trim() };
}

export function wrapPaged(baseSql: string, limit: number, offset: number) {
  // Wrap to enforce pagination even if the query already has its own LIMIT.
  const pagedSql = `select * from (\n${baseSql}\n) as q limit $1 offset $2`;
  const countSql = `select count(*)::int as total from (\n${baseSql}\n) as q`;
  return { pagedSql, countSql, params: [limit, offset] as unknown[] };
}

