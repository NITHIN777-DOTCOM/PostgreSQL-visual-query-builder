import type { DatabaseSchema, RunResult, VisualQuery } from './types'

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

