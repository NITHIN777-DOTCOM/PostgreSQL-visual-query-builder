export type ColumnInfo = {
  name: string
  dataType: string
  isNullable: boolean
}

export type TableInfo = {
  schema: string
  name: string
  columns: ColumnInfo[]
}

export type DatabaseSchema = {
  tables: TableInfo[]
}

export type VqTable = {
  nodeId: string
  schema: string
  table: string
  alias?: string
}

export type VqJoin = {
  joinType?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  from: { nodeId: string; column: string }
  to: { nodeId: string; column: string }
}

export type VqSelect = { nodeId: string; column: string; as?: string }

export type VisualQuery = {
  tables: VqTable[]
  joins: VqJoin[]
  select?: VqSelect[]
  limit?: number
}

export type RunResult = {
  sql: string
  rowCount: number
  fields: { name: string; dataTypeID: number }[]
  rows: Record<string, unknown>[]
}

