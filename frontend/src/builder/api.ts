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

