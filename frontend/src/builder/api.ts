import type { DatabaseSchema, RunResult, SqlExecResult, VisualQuery } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5174'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function importPreview(file: File): Promise<{
  fileName: string
  suggestedTable: string
  columns: { name: string; detectedType: ColumnType | 'text'; nullable: boolean }[]
  previewRows: Record<string, unknown>[]
  totalRows: number
}> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API_URL}/api/import/preview`, { method: 'POST', body: fd })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const msg = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json()
}

export async function importCommit(req: {
  schema?: string
  table: string
  columns: { name: string; type: ColumnType | 'text'; nullable: boolean }[]
  rows: Record<string, unknown>[]
}): Promise<{ ok: true }> {
  return apiFetch('/api/import/commit', { method: 'POST', body: JSON.stringify(req) })
}

export function fetchSchema(): Promise<DatabaseSchema> {
  return apiFetch('/api/schema')
}

export async function generateSql(query: VisualQuery): Promise<string> {
  const data = await apiFetch<{ sql: string }>('/api/query/generate', {
    method: 'POST',
    body: JSON.stringify(query),
  })
  return data.sql
}

export function runQuery(query: VisualQuery): Promise<RunResult> {
  return apiFetch('/api/query/run', {
    method: 'POST',
    body: JSON.stringify(query),
  })
}

export function runSql(sql: string, limit = 200, offset = 0): Promise<RunResult> {
  return apiFetch('/api/sql/run', {
    method: 'POST',
    body: JSON.stringify({ sql, limit, offset }),
  })
}

export function execSql(sql: string, limit = 200, offset = 0): Promise<SqlExecResult> {
  return apiFetch('/api/sql/exec', {
    method: 'POST',
    body: JSON.stringify({ sql, limit, offset }),
  })
}

export type ColumnType = 'integer' | 'text' | 'boolean' | 'timestamp' | 'float'

export type CreateTableRequest = {
  schema?: string
  table: string
  columns: {
    name: string
    type: ColumnType
    primaryKey?: boolean
    nullable?: boolean
    unique?: boolean
  }[]
}

export function createTable(req: CreateTableRequest): Promise<{ ok: true; sql: string }> {
  return apiFetch('/api/admin/table/create', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function renameTable(req: { schema?: string; from: string; to: string }): Promise<{ ok: true; sql: string }> {
  return apiFetch('/api/admin/table/rename', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function deleteTable(req: { schema?: string; table: string }): Promise<{ ok: true; sql: string }> {
  return apiFetch('/api/admin/table/delete', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export type AlterOp =
  | {
      type: 'addColumn'
      column: { name: string; type: ColumnType; nullable?: boolean; unique?: boolean }
    }
  | { type: 'dropColumn'; columnName: string }
  | { type: 'renameColumn'; from: string; to: string }
  | { type: 'changeType'; columnName: string; newType: ColumnType }
  | { type: 'setNullable'; columnName: string; nullable: boolean }
  | { type: 'setUnique'; columnName: string; unique: boolean }

export function alterTable(req: { schema?: string; table: string; op: AlterOp }): Promise<{ ok: true; sql: string }> {
  return apiFetch('/api/admin/table/alter', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export type ListRowsResponse = RunResult & { totalCount: number; limit: number; offset: number; primaryKey: string | null }

export function listTableRows(req: { schema?: string; table: string; limit?: number; offset?: number }): Promise<ListRowsResponse> {
  const schema = req.schema ?? 'public'
  const limit = req.limit ?? 50
  const offset = req.offset ?? 0
  const qs = new URLSearchParams({ schema, table: req.table, limit: String(limit), offset: String(offset) })
  return apiFetch(`/api/table/rows?${qs.toString()}`)
}

export function insertTableRow(req: { schema?: string; table: string; values: Record<string, unknown> }): Promise<{ ok: true } & RunResult> {
  return apiFetch('/api/table/rows/insert', { method: 'POST', body: JSON.stringify(req) })
}

export function updateTableRow(req: {
  schema?: string
  table: string
  pk: { column: string; value: unknown }
  values: Record<string, unknown>
}): Promise<{ ok: true } & RunResult> {
  return apiFetch('/api/table/rows/update', { method: 'POST', body: JSON.stringify(req) })
}

export function deleteTableRow(req: { schema?: string; table: string; pk: { column: string; value: unknown } }): Promise<{ ok: true } & RunResult> {
  return apiFetch('/api/table/rows/delete', { method: 'POST', body: JSON.stringify(req) })
}

