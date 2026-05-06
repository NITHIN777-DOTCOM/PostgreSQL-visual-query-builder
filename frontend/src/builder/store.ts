import { create } from 'zustand'
import type { Edge, Node } from 'reactflow'
import type { DatabaseSchema, RunResult, TableInfo, VisualQuery } from './types'

export type TableNodeData = {
  schema: string
  table: string
  columns: { name: string; dataType: string }[]
  selected: Record<string, boolean>
}

export type TableNode = Node<TableNodeData>

export type WhereOp = '=' | '>' | '<' | '>=' | '<=' | '!=' | 'LIKE'
export type WhereRow = {
  id: string
  boolean: 'AND' | 'OR'
  nodeId: string
  column: string
  op: WhereOp
  value: string
}

export type OrderRow = { id: string; nodeId: string; column: string; direction: 'ASC' | 'DESC' }

export type GroupRow = { id: string; nodeId: string; column: string }

export type AggFn = 'COUNT' | 'AVG' | 'SUM' | 'MIN' | 'MAX'
export type AggRow = { id: string; fn: AggFn; nodeId?: string; column?: string; as?: string }

type BuilderState = {
  schema: DatabaseSchema | null
  schemaError: string | null

  nodes: TableNode[]
  edges: Edge[]

  where: WhereRow[]
  orderBy: OrderRow[]
  groupBy: GroupRow[]
  aggregations: AggRow[]

  limit: number
  generatedSql: string
  sqlError: string | null

  runResult: RunResult | null
  runError: string | null

  setSchema: (s: DatabaseSchema) => void
  setSchemaError: (e: string | null) => void

  setNodes: (nodes: TableNode[]) => void
  setEdges: (edges: Edge[]) => void
  addTableNodeFromSchema: (t: TableInfo) => void
  toggleColumn: (nodeId: string, column: string) => void
  clearCanvas: () => void

  addWhere: () => void
  updateWhere: (id: string, patch: Partial<WhereRow>) => void
  deleteWhere: (id: string) => void

  addOrderBy: () => void
  updateOrderBy: (id: string, patch: Partial<OrderRow>) => void
  deleteOrderBy: (id: string) => void

  addGroupBy: () => void
  updateGroupBy: (id: string, patch: Partial<GroupRow>) => void
  deleteGroupBy: (id: string) => void

  addAgg: () => void
  updateAgg: (id: string, patch: Partial<AggRow>) => void
  deleteAgg: (id: string) => void

  setLimit: (n: number) => void
  setGeneratedSql: (sql: string) => void
  setSqlError: (e: string | null) => void

  setRunResult: (r: RunResult | null) => void
  setRunError: (e: string | null) => void

  toVisualQuery: () => VisualQuery | null
}

function randPos() {
  return { x: 80 + Math.random() * 280, y: 80 + Math.random() * 220 }
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  schema: null,
  schemaError: null,

  nodes: [],
  edges: [],

  where: [],
  orderBy: [],
  groupBy: [],
  aggregations: [],

  limit: 200,
  generatedSql: '',
  sqlError: null,

  runResult: null,
  runError: null,

  setSchema: (s) => set({ schema: s }),
  setSchemaError: (e) => set({ schemaError: e }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addTableNodeFromSchema: (t) => {
    const id = `${t.schema}.${t.name}.${crypto.randomUUID().slice(0, 8)}`
    set((st) => ({
      nodes: [
        ...st.nodes,
        {
          id,
          type: 'tableNode',
          position: randPos(),
          data: {
            schema: t.schema,
            table: t.name,
            columns: t.columns.map((c) => ({ name: c.name, dataType: c.dataType })),
            selected: {},
          },
        },
      ],
    }))
  },

  toggleColumn: (nodeId, column) => {
    set((st) => ({
      nodes: st.nodes.map((n) =>
        n.id !== nodeId
          ? n
          : {
              ...n,
              data: {
                ...n.data,
                selected: { ...n.data.selected, [column]: !n.data.selected[column] },
              },
            },
      ),
    }))
  },

  clearCanvas: () =>
    set({
      nodes: [],
      edges: [],
      where: [],
      orderBy: [],
      groupBy: [],
      aggregations: [],
      generatedSql: '',
      sqlError: null,
      runResult: null,
      runError: null,
    }),

  addWhere: () => {
    const { nodes } = get()
    if (nodes.length === 0) return
    const n = nodes[0]!
    const col = n.data.columns[0]?.name ?? ''
    set((st) => ({
      where: [
        ...st.where,
        { id: crypto.randomUUID(), boolean: st.where.length ? 'AND' : 'AND', nodeId: n.id, column: col, op: '=', value: '' },
      ],
    }))
  },
  updateWhere: (id, patch) => set((st) => ({ where: st.where.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
  deleteWhere: (id) => set((st) => ({ where: st.where.filter((w) => w.id !== id) })),

  addOrderBy: () => {
    const { nodes } = get()
    if (nodes.length === 0) return
    const n = nodes[0]!
    const col = n.data.columns[0]?.name ?? ''
    set((st) => ({ orderBy: [...st.orderBy, { id: crypto.randomUUID(), nodeId: n.id, column: col, direction: 'ASC' }] }))
  },
  updateOrderBy: (id, patch) => set((st) => ({ orderBy: st.orderBy.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
  deleteOrderBy: (id) => set((st) => ({ orderBy: st.orderBy.filter((o) => o.id !== id) })),

  addGroupBy: () => {
    const { nodes } = get()
    if (nodes.length === 0) return
    const n = nodes[0]!
    const col = n.data.columns[0]?.name ?? ''
    set((st) => ({ groupBy: [...st.groupBy, { id: crypto.randomUUID(), nodeId: n.id, column: col }] }))
  },
  updateGroupBy: (id, patch) => set((st) => ({ groupBy: st.groupBy.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  deleteGroupBy: (id) => set((st) => ({ groupBy: st.groupBy.filter((g) => g.id !== id) })),

  addAgg: () =>
    set((st) => ({
      aggregations: [...st.aggregations, { id: crypto.randomUUID(), fn: 'COUNT', as: 'count' }],
    })),
  updateAgg: (id, patch) => set((st) => ({ aggregations: st.aggregations.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
  deleteAgg: (id) => set((st) => ({ aggregations: st.aggregations.filter((a) => a.id !== id) })),

  setLimit: (n) => set({ limit: n }),
  setGeneratedSql: (sql) => set({ generatedSql: sql }),
  setSqlError: (e) => set({ sqlError: e }),

  setRunResult: (r) => set({ runResult: r }),
  setRunError: (e) => set({ runError: e }),

  toVisualQuery: () => {
    const { nodes, edges, limit, where, orderBy, groupBy, aggregations } = get()
    if (nodes.length === 0) return null

    // deterministic aliases based on order
    const aliasByNodeId = new Map<string, string>()
    const used = new Set<string>()
    for (const n of nodes) {
      let base = n.data.table
      let alias = base
      let i = 2
      while (used.has(alias)) {
        alias = `${base}${i++}`
      }
      used.add(alias)
      aliasByNodeId.set(n.id, alias)
    }

    const tables = nodes.map((n) => ({
      nodeId: n.id,
      schema: n.data.schema,
      table: n.data.table,
      alias: aliasByNodeId.get(n.id),
    }))

    const joins = edges
      .filter((e) => e.sourceHandle && e.targetHandle)
      .map((e) => ({
        joinType: 'INNER' as const,
        from: { nodeId: e.source, column: e.sourceHandle! },
        to: { nodeId: e.target, column: e.targetHandle! },
      }))

    const select = nodes.flatMap((n) =>
      Object.entries(n.data.selected)
        .filter(([, v]) => v)
        .map(([col]) => ({ nodeId: n.id, column: col })),
    )

    const whereOut = where
      .filter((w) => w.nodeId && w.column && w.op)
      .map((w) => ({
        boolean: w.boolean,
        nodeId: w.nodeId,
        column: w.column,
        op: w.op,
        value: w.value,
      }))

    const orderOut = orderBy
      .filter((o) => o.nodeId && o.column)
      .map((o) => ({ nodeId: o.nodeId, column: o.column, direction: o.direction }))

    const groupOut = groupBy.filter((g) => g.nodeId && g.column).map((g) => ({ nodeId: g.nodeId, column: g.column }))

    const aggOut = aggregations.map((a) => ({
      fn: a.fn,
      nodeId: a.fn === 'COUNT' && !a.nodeId ? undefined : a.nodeId,
      column: a.fn === 'COUNT' && !a.column ? undefined : a.column,
      as: a.as,
    }))

    return { tables, joins, select, where: whereOut, orderBy: orderOut, groupBy: groupOut, aggregations: aggOut, limit }
  },
}))

