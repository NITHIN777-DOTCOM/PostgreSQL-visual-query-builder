import { useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from 'reactflow'
import { fetchSchema, generateSql, runQuery } from './api'
import { TableNode } from './TableNode'
import { useBuilderStore, type TableNode as TableNodeT } from './store'

const nodeTypes = { tableNode: TableNode }

function useDebouncedEffect(fn: () => void, deps: unknown[], delayMs: number) {
  const timeoutRef = useRef<number | null>(null)
  useEffect(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => fn(), delayMs)
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export function VisualQueryBuilderPage() {
  const schema = useBuilderStore((s) => s.schema)
  const schemaError = useBuilderStore((s) => s.schemaError)
  const setSchema = useBuilderStore((s) => s.setSchema)
  const setSchemaError = useBuilderStore((s) => s.setSchemaError)

  const nodes = useBuilderStore((s) => s.nodes)
  const edges = useBuilderStore((s) => s.edges)
  const setNodes = useBuilderStore((s) => s.setNodes)
  const setEdges = useBuilderStore((s) => s.setEdges)
  const addTableNodeFromSchema = useBuilderStore((s) => s.addTableNodeFromSchema)
  const clearCanvas = useBuilderStore((s) => s.clearCanvas)

  const limit = useBuilderStore((s) => s.limit)
  const setLimit = useBuilderStore((s) => s.setLimit)

  const generatedSql = useBuilderStore((s) => s.generatedSql)
  const sqlError = useBuilderStore((s) => s.sqlError)
  const setGeneratedSql = useBuilderStore((s) => s.setGeneratedSql)
  const setSqlError = useBuilderStore((s) => s.setSqlError)

  const runResult = useBuilderStore((s) => s.runResult)
  const runError = useBuilderStore((s) => s.runError)
  const setRunResult = useBuilderStore((s) => s.setRunResult)
  const setRunError = useBuilderStore((s) => s.setRunError)

  const toVisualQuery = useBuilderStore((s) => s.toVisualQuery)

  const [tableFilter, setTableFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSchema()
      .then((s) => {
        if (cancelled) return
        setSchema(s)
        setSchemaError(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setSchemaError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [setSchema, setSchemaError])

  const filteredTables = useMemo(() => {
    const t = schema?.tables ?? []
    const q = tableFilter.trim().toLowerCase()
    if (!q) return t
    return t.filter((x) => `${x.schema}.${x.name}`.toLowerCase().includes(q))
  }, [schema, tableFilter])

  const onNodesChange = (changes: NodeChange[]) => {
    setNodes(applyNodeChanges(changes, nodes) as TableNodeT[])
  }

  const onEdgesChange = (changes: EdgeChange[]) => {
    setEdges(applyEdgeChanges(changes, edges))
  }

  const onConnect = (connection: Connection) => {
    setEdges(
      addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
          style: { stroke: 'rgba(124,58,237,0.95)', strokeWidth: 2 },
        },
        edges,
      ) as Edge[],
    )
  }

  useDebouncedEffect(
    () => {
      const vq = toVisualQuery()
      if (!vq) {
        setGeneratedSql('')
        setSqlError(null)
        return
      }
      generateSql(vq)
        .then((sql) => {
          setGeneratedSql(sql)
          setSqlError(null)
        })
        .catch((e: unknown) => {
          setSqlError(e instanceof Error ? e.message : String(e))
        })
    },
    // changes that impact SQL:
    [nodes, edges, limit],
    250,
  )

  const handleRun = async () => {
    const vq = toVisualQuery()
    if (!vq) return
    setRunError(null)
    setRunResult(null)
    try {
      const r = await runQuery(vq)
      setRunResult(r)
    } catch (e: unknown) {
      setRunError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="appShell">
      <aside className="panel">
        <div className="panelHeader">
          <h1>Schema</h1>
          <span className="muted">{schema ? `${schema.tables.length} tables` : '…'}</span>
        </div>
        <div className="panelBody" style={{ padding: 12 }}>
          <input
            className="input"
            placeholder="Search tables…"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
          />

          <div className="divider" />

          {schemaError ? (
            <div style={{ color: 'var(--danger)', fontSize: 12 }}>
              Failed to load schema: {schemaError}
              <div className="muted" style={{ marginTop: 6 }}>
                Make sure backend is running and CORS is set correctly.
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredTables.map((t) => (
              <button
                key={`${t.schema}.${t.name}`}
                className="btn"
                style={{ textAlign: 'left' }}
                onClick={() => addTableNodeFromSchema(t)}
                title="Add to canvas"
              >
                <div style={{ fontSize: 12, fontWeight: 650 }}>
                  {t.schema}.{t.name}
                </div>
                <div className="muted">{t.columns.length} columns</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 12,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.12)',
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.15)',
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background gap={18} size={1} color="rgba(255,255,255,0.08)" />
            <Controls />
            <MiniMap
              style={{ background: 'rgba(0,0,0,0.35)' }}
              nodeColor={() => 'rgba(124,58,237,0.65)'}
              maskColor="rgba(0,0,0,0.4)"
            />
          </ReactFlow>
        </div>

        <div style={{ position: 'absolute', left: 20, top: 20, display: 'flex', gap: 8 }}>
          <button className="btn btnDanger" onClick={clearCanvas}>
            Clear
          </button>
        </div>
      </main>

      <aside className="panelRight">
        <div className="panelHeader">
          <h2>SQL</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="muted">Limit</span>
            <input
              className="input"
              style={{ width: 110, padding: '8px 10px' }}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value || 200))}
              inputMode="numeric"
            />
            <button className="btn btnPrimary" onClick={handleRun} disabled={!generatedSql || !!sqlError}>
              Run
            </button>
          </div>
        </div>

        <div className="panelBody" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sqlError ? (
            <div style={{ color: 'var(--danger)', fontSize: 12 }}>SQL error: {sqlError}</div>
          ) : null}

          <div className="codeBox" style={{ flex: '0 0 auto', maxHeight: 260 }}>
            {generatedSql || '-- Drag tables and connect columns to generate SQL'}
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 650, fontSize: 12 }}>Results</div>
            <div className="muted">
              {runResult ? `${runResult.rowCount} rows` : runError ? 'error' : '—'}
            </div>
          </div>

          {runError ? <div style={{ color: 'var(--danger)', fontSize: 12 }}>Run error: {runError}</div> : null}

          {runResult ? (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                overflow: 'auto',
                background: 'rgba(0,0,0,0.25)',
                flex: 1,
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {runResult.fields.map((f) => (
                      <th
                        key={f.name}
                        style={{
                          textAlign: 'left',
                          padding: '10px 10px',
                          borderBottom: '1px solid var(--border)',
                          position: 'sticky',
                          top: 0,
                          background: 'rgba(0,0,0,0.45)',
                        }}
                      >
                        {f.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runResult.rows.map((r, idx) => (
                    <tr key={idx}>
                      {runResult.fields.map((f) => (
                        <td key={f.name} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontFamily: 'var(--mono)' }}>
                            {typeof r[f.name] === 'object' ? JSON.stringify(r[f.name]) : String(r[f.name] ?? '')}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>
              Run the generated SQL to see results here.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

