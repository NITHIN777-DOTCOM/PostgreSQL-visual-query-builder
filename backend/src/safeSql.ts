import { z } from "zod";

export const ManualSqlRequestSchema = z.object({
  sql: z.string().min(1).max(200_000),
  limit: z.coerce.number().int().positive().max(1000).default(200),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type ManualSqlRequest = z.infer<typeof ManualSqlRequestSchema>;

export const ManualSqlExecRequestSchema = z.object({
  sql: z.string().min(1).max(200_000),
  // Only applies to SELECT-like statements (pagination)
  limit: z.coerce.number().int().positive().max(1000).default(200),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type ManualSqlExecRequest = z.infer<typeof ManualSqlExecRequestSchema>;

function stripTrailingSemicolons(s: string) {
  return s.replace(/;+\s*$/g, "");
}

function isSelectLike(sql: string): boolean {
  const s = stripTrailingSemicolons(sql).trimStart().toLowerCase();
  // allow common read-only patterns
  return s.startsWith("select") || s.startsWith("with");
}

function getStatementKind(sql: string): "select" | "insert" | "update" | "delete" | "other" {
  const s = stripTrailingSemicolons(sql).trimStart().toLowerCase();
  if (s.startsWith("select") || s.startsWith("with")) return "select";
  if (s.startsWith("insert")) return "insert";
  if (s.startsWith("update")) return "update";
  if (s.startsWith("delete")) return "delete";
  return "other";
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

function isDangerousKeyword(sql: string): boolean {
  // A simple, conservative keyword gate. This does not parse SQL; it just blocks
  // obvious DDL/admin statements. Manual SQL editor is intended for data CRUD.
  const s = stripTrailingSemicolons(sql).trimStart().toLowerCase();
  // Note: we intentionally block COPY to prevent file exfiltration risks.
  return /\b(drop|alter|create|truncate|grant|revoke|copy|vacuum|analyze|cluster|reindex|refresh|comment|security|set\s+role)\b/.test(
    s,
  );
}

export function validateManualSqlExec(sql: string): { baseSql: string; kind: "select" | "insert" | "update" | "delete" } {
  if (hasMultipleStatements(sql)) throw new Error("Only one SQL statement is allowed.");
  if (isDangerousKeyword(sql)) {
    throw new Error("This statement type is blocked for safety. Only SELECT/INSERT/UPDATE/DELETE are allowed in the SQL editor.");
  }
  const kind = getStatementKind(sql);
  if (kind === "other") {
    throw new Error("Only SELECT/INSERT/UPDATE/DELETE are allowed in the SQL editor.");
  }
  return { baseSql: stripTrailingSemicolons(sql).trim(), kind };
}

export function wrapPaged(baseSql: string, limit: number, offset: number) {
  // Wrap to enforce pagination even if the query already has its own LIMIT.
  const pagedSql = `select * from (\n${baseSql}\n) as q limit $1 offset $2`;
  const countSql = `select count(*)::int as total from (\n${baseSql}\n) as q`;
  return { pagedSql, countSql, params: [limit, offset] as unknown[] };
}

