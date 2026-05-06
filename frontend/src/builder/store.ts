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

type BuilderState = {
  schema: DatabaseSchema | null
  schemaError: string | null

  nodes: TableNode[]
  edges: Edge[]

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
      generatedSql: '',
      sqlError: null,
      runResult: null,
      runError: null,
    }),

  setLimit: (n) => set({ limit: n }),
  setGeneratedSql: (sql) => set({ generatedSql: sql }),
  setSqlError: (e) => set({ sqlError: e }),

  setRunResult: (r) => set({ runResult: r }),
  setRunError: (e) => set({ runError: e }),

  toVisualQuery: () => {
    const { nodes, edges, limit } = get()
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

    return { tables, joins, select, limit }
  },
}))

