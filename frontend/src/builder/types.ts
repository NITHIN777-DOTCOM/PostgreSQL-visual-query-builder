export type ColumnInfo = {
  name: string
  dataType: string
  isNullable: boolean
  isPrimaryKey: boolean
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
  where?: {
    boolean?: 'AND' | 'OR'
    nodeId: string
    column: string
    op: '=' | '>' | '<' | '>=' | '<=' | '!=' | 'LIKE'
    value: string | number | boolean | null
  }[]
  orderBy?: { nodeId: string; column: string; direction?: 'ASC' | 'DESC' }[]
  groupBy?: { nodeId: string; column: string }[]
  aggregations?: { fn: 'COUNT' | 'AVG' | 'SUM' | 'MIN' | 'MAX'; nodeId?: string; column?: string; as?: string }[]
  limit?: number
}

export type RunResult = {
  sql: string
  totalCount?: number
  limit?: number
  offset?: number
  rowCount: number
  fields: { name: string; dataTypeID: number }[]
  rows: Record<string, unknown>[]
}

export type SqlExecResult = RunResult & {
  kind: 'select' | 'insert' | 'update' | 'delete'
  shouldRefreshSchema: boolean
}

