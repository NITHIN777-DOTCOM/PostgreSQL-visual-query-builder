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
import { execSql, fetchSchema, generateSql } from './api'
import { TableNode } from './TableNode'
import { useBuilderStore, type TableNode as TableNodeT } from './store'
import { CreateTableModal } from './schema/CreateTableModal'
import { ConfirmDeleteTableModal, EditColumnsModal, RenameTableModal } from './schema/TableActionsModals'
import { Menu, MenuItem } from './ui/Menu'
import { useToast } from './ui/toast'
import { Modal } from './ui/Modal'
import { RowEditorModal } from './rows/RowEditorModal'

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
  const toast = useToast()
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
  const where = useBuilderStore((s) => s.where)
  const orderBy = useBuilderStore((s) => s.orderBy)
  const groupBy = useBuilderStore((s) => s.groupBy)
  const aggregations = useBuilderStore((s) => s.aggregations)
  const addWhere = useBuilderStore((s) => s.addWhere)
  const updateWhere = useBuilderStore((s) => s.updateWhere)
  const deleteWhere = useBuilderStore((s) => s.deleteWhere)
  const addOrderBy = useBuilderStore((s) => s.addOrderBy)
  const updateOrderBy = useBuilderStore((s) => s.updateOrderBy)
  const deleteOrderBy = useBuilderStore((s) => s.deleteOrderBy)
  const addGroupBy = useBuilderStore((s) => s.addGroupBy)
  const updateGroupBy = useBuilderStore((s) => s.updateGroupBy)
  const deleteGroupBy = useBuilderStore((s) => s.deleteGroupBy)
  const addAgg = useBuilderStore((s) => s.addAgg)
  const updateAgg = useBuilderStore((s) => s.updateAgg)
  const deleteAgg = useBuilderStore((s) => s.deleteAgg)

  const [tableFilter, setTableFilter] = useState('')
  const [editorSql, setEditorSql] = useState('')
  const [editorDirty, setEditorDirty] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [menuTableKey, setMenuTableKey] = useState<string | null>(null)
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null)
  const [renameTarget, setRenameTarget] = useState<(typeof filteredTables)[number] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<(typeof filteredTables)[number] | null>(null)
  const [editColsTarget, setEditColsTarget] = useState<(typeof filteredTables)[number] | null>(null)
  const [rowsTarget, setRowsTarget] = useState<(typeof filteredTables)[number] | null>(null)

  const [queryOptionsOpen, setQueryOptionsOpen] = useState(false)
  const [runLoading, setRunLoading] = useState(false)
  const [pageOffset, setPageOffset] = useState(0)
  const [sqlExpanded, setSqlExpanded] = useState(false)
  const [resultsExpanded, setResultsExpanded] = useState(false)

  const reloadSchema = () => {
    fetchSchema()
      .then((s) => {
        setSchema(s)
        setSchemaError(null)
      })
      .catch((e: unknown) => {
        setSchemaError(e instanceof Error ? e.message : String(e))
      })
  }

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

  const columnOptions = useMemo(() => {
    return nodes.flatMap((n) =>
      n.data.columns.map((c) => ({
        key: `${n.id}:${c.name}`,
        nodeId: n.id,
        column: c.name,
        label: `${n.data.table}.${c.name}`,
      })),
    )
  }, [nodes])

  const firstCol = columnOptions[0]

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
        if (!editorDirty) setEditorSql('')
        return
      }
      generateSql(vq)
        .then((sql) => {
          setGeneratedSql(sql)
          setSqlError(null)
          if (!editorDirty) setEditorSql(sql)
        })
        .catch((e: unknown) => {
          setSqlError(e instanceof Error ? e.message : String(e))
        })
    },
    // changes that impact SQL:
    [nodes, edges, where, orderBy, groupBy, aggregations, limit],
    250,
  )

  const execRun = async (offset: number, resetResult: boolean) => {
    setRunError(null)
    if (resetResult) setRunResult(null)
    setRunLoading(true)
    try {
      const sqlToRun = editorSql || generatedSql
      const r = await execSql(sqlToRun, limit, offset)
      setRunResult(r)
      if (r.kind === 'select') {
        toast.push({ kind: 'success', title: 'Query executed', message: `${r.totalCount ?? r.rowCount} rows` })
      } else {
        toast.push({ kind: 'success', title: 'SQL executed', message: `${r.rowCount} row(s) affected` })
        if (r.shouldRefreshSchema) reloadSchema()
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setRunError(msg)
      toast.push({ kind: 'error', title: 'Execution failed', message: msg })
    } finally {
      setRunLoading(false)
    }
  }
  const handleRun = async () => {
    setPageOffset(0)
    await execRun(0, true)
  }

  const ResultsTable = (props: { compact?: boolean }) => {
    const compact = props.compact ?? false
    if (runLoading) {
      return (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.25)',
            padding: 14,
            fontSize: 12,
          }}
          className="muted"
        >
          Running query…
        </div>
      )
    }
    if (!runResult) {
      return (
        <div className="muted" style={{ fontSize: 12 }}>
          Run the generated SQL to see results here.
        </div>
      )
    }

    return (
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'auto',
          background: 'rgba(0,0,0,0.25)',
          flex: 1,
          maxHeight: compact ? 420 : undefined,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            padding: '10px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.10)',
            position: 'sticky',
            top: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1,
          }}
        >
          <div className="muted" style={{ fontSize: 12 }}>
            Showing {runResult.rows.length} rows
            {typeof runResult.totalCount === 'number' ? ` (of ${runResult.totalCount})` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn"
              disabled={pageOffset <= 0}
              onClick={() => {
                const next = Math.max(0, pageOffset - limit)
                setPageOffset(next)
                void execRun(next, false)
              }}
            >
              Prev
            </button>
            <button
              className="btn"
              disabled={
                typeof runResult.totalCount === 'number'
                  ? pageOffset + limit >= runResult.totalCount
                  : runResult.rows.length < limit
              }
              onClick={() => {
                const next = pageOffset + limit
                setPageOffset(next)
                void execRun(next, false)
              }}
            >
              Next
            </button>
          </div>
        </div>
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
                    top: 44,
                    background: 'rgba(0,0,0,0.55)',
                  }}
                >
                  {f.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runResult.rows.map((r, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                {runResult.fields.map((f) => (
                  <td key={f.name} style={{ padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
    )
  }

  return (
    <div className="appShell">
      <aside className="panel">
        <div className="panelHeader">
          <div className="brand" title="PostgreSQL Query Visualizer">
            <img className="brandLogo" src="/ps-logo.svg" alt="PS" />
            <div className="brandTitle">
              <strong>PostgreSQL Query Visualizer</strong>
              <span>Schema</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btnPrimary" onClick={() => setCreateOpen(true)}>
              + Create Table
            </button>
            <span className="muted">{schema ? `${schema.tables.length} tables` : '…'}</span>
          </div>
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
              <div
                key={`${t.schema}.${t.name}`}
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(0,0,0,0.20)',
                  borderRadius: 12,
                  padding: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <button
                  className="btn"
                  style={{ textAlign: 'left', flex: 1, padding: 0, background: 'transparent', border: '1px solid transparent' }}
                  onClick={() => addTableNodeFromSchema(t)}
                  title="Add to canvas"
                >
                  <div style={{ fontSize: 12, fontWeight: 650 }}>
                    {t.schema}.{t.name}
                  </div>
                  <div className="muted">{t.columns.length} columns</div>
                </button>

                <button
                  className="btn"
                  ref={menuTableKey === `${t.schema}.${t.name}` ? menuAnchorRef : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    const key = `${t.schema}.${t.name}`
                    if (menuTableKey === key) setMenuTableKey(null)
                    else {
                      menuAnchorRef.current = e.currentTarget
                      setMenuTableKey(key)
                    }
                  }}
                  title="Table actions"
                  style={{ width: 40, padding: 8, display: 'grid', placeItems: 'center' }}
                >
                  ⋯
                </button>

                <Menu
                  open={menuTableKey === `${t.schema}.${t.name}`}
                  onClose={() => setMenuTableKey(null)}
                  anchorRef={menuAnchorRef as unknown as React.RefObject<HTMLElement>}
                >
                  <MenuItem
                    label="View rows"
                    onClick={() => {
                      setMenuTableKey(null)
                      setRowsTarget(t)
                    }}
                  />
                  <MenuItem
                    label="Rename table"
                    onClick={() => {
                      setMenuTableKey(null)
                      setRenameTarget(t)
                    }}
                  />
                  <MenuItem
                    label="Edit columns"
                    onClick={() => {
                      setMenuTableKey(null)
                      setEditColsTarget(t)
                    }}
                  />
                  <MenuItem
                    danger
                    label="Delete table…"
                    onClick={() => {
                      setMenuTableKey(null)
                      setDeleteTarget(t)
                    }}
                  />
                </Menu>
              </div>
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
            <button className="btn" onClick={() => setSqlExpanded(true)} title="Expand SQL editor">
              Expand
            </button>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              className="codeBox"
              style={{ flex: '0 0 auto', maxHeight: 260, resize: 'vertical' }}
              value={editorSql}
              onChange={(e) => {
                setEditorSql(e.target.value)
                setEditorDirty(true)
              }}
              placeholder="Write SQL manually or generate visually..."
            />

            {editorDirty ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="muted">Running uses the SQL editor content.</span>
                <button
                  className="btn"
                  onClick={() => {
                    setEditorSql(generatedSql)
                    setEditorDirty(false)
                  }}
                  disabled={!generatedSql}
                  title="Replace editor with generated SQL"
                >
                  Reset to generated
                </button>
              </div>
            ) : (
              <span className="muted">Auto-filled from the visual builder (until you edit).</span>
            )}
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.22)',
              overflow: 'hidden',
            }}
          >
            <button
              className="btn"
              onClick={() => setQueryOptionsOpen((v) => !v)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: '1px solid transparent',
                background: 'transparent',
                borderRadius: 0,
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
              title="Filters, sorting, and aggregations"
            >
              <span style={{ fontWeight: 700 }}>Query options</span>
              <span className="muted">{queryOptionsOpen ? 'Hide' : 'Show'}</span>
            </button>

            {queryOptionsOpen ? (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* WHERE */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>Filters (WHERE)</div>
                  <button
                    className="btn"
                    onClick={() => {
                      if (!firstCol) return
                      addWhere()
                    }}
                    disabled={!firstCol}
                  >
                    + Add
                  </button>
                </div>
                {where.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {where.map((w, idx) => (
                      <div
                        key={w.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '70px 1fr 90px 1fr auto',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <select
                          className="input"
                          value={w.boolean}
                          disabled={idx === 0}
                          onChange={(e) => updateWhere(w.id, { boolean: e.target.value as 'AND' | 'OR' })}
                          style={{ padding: '8px 10px' }}
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>

                        <select
                          className="input"
                          value={`${w.nodeId}:${w.column}`}
                          onChange={(e) => {
                            const [nodeId, column] = e.target.value.split(':')
                            updateWhere(w.id, { nodeId, column })
                          }}
                          style={{ padding: '8px 10px' }}
                        >
                          {columnOptions.map((o) => (
                            <option key={o.key} value={`${o.nodeId}:${o.column}`}>
                              {o.label}
                            </option>
                          ))}
                        </select>

                        <select
                          className="input"
                          value={w.op}
                          onChange={(e) => updateWhere(w.id, { op: e.target.value as any })}
                          style={{ padding: '8px 10px' }}
                        >
                          <option value="=">=</option>
                          <option value=">">&gt;</option>
                          <option value="<">&lt;</option>
                          <option value=">=">&gt;=</option>
                          <option value="<=">&lt;=</option>
                          <option value="!=">!=</option>
                          <option value="LIKE">LIKE</option>
                        </select>

                        <input
                          className="input"
                          value={w.value}
                          onChange={(e) => updateWhere(w.id, { value: e.target.value })}
                          placeholder="value"
                        />

                        <button className="btn btnDanger" onClick={() => deleteWhere(w.id)} title="Remove filter">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    No filters.
                  </div>
                )}

                {/* ORDER BY */}
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>Sorting (ORDER BY)</div>
                  <button className="btn" onClick={addOrderBy} disabled={!firstCol}>
                    + Add
                  </button>
                </div>
                {orderBy.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {orderBy.map((o) => (
                      <div
                        key={o.id}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8, alignItems: 'center' }}
                      >
                        <select
                          className="input"
                          value={`${o.nodeId}:${o.column}`}
                          onChange={(e) => {
                            const [nodeId, column] = e.target.value.split(':')
                            updateOrderBy(o.id, { nodeId, column })
                          }}
                          style={{ padding: '8px 10px' }}
                        >
                          {columnOptions.map((opt) => (
                            <option key={opt.key} value={`${opt.nodeId}:${opt.column}`}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="input"
                          value={o.direction}
                          onChange={(e) => updateOrderBy(o.id, { direction: e.target.value as 'ASC' | 'DESC' })}
                          style={{ padding: '8px 10px' }}
                        >
                          <option value="ASC">ASC</option>
                          <option value="DESC">DESC</option>
                        </select>
                        <button className="btn btnDanger" onClick={() => deleteOrderBy(o.id)} title="Remove sort">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    No sorting.
                  </div>
                )}

                {/* GROUP BY + AGG */}
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>Group & Aggregations</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={addGroupBy} disabled={!firstCol}>
                      + Group
                    </button>
                    <button className="btn" onClick={addAgg}>
                      + Agg
                    </button>
                  </div>
                </div>

                {groupBy.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {groupBy.map((g) => (
                      <div
                        key={g.id}
                        style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}
                      >
                        <select
                          className="input"
                          value={`${g.nodeId}:${g.column}`}
                          onChange={(e) => {
                            const [nodeId, column] = e.target.value.split(':')
                            updateGroupBy(g.id, { nodeId, column })
                          }}
                          style={{ padding: '8px 10px' }}
                        >
                          {columnOptions.map((opt) => (
                            <option key={opt.key} value={`${opt.nodeId}:${opt.column}`}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button className="btn btnDanger" onClick={() => deleteGroupBy(g.id)} title="Remove group">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    No grouping.
                  </div>
                )}

                {aggregations.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {aggregations.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '110px 1fr 1fr auto',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <select
                          className="input"
                          value={a.fn}
                          onChange={(e) => updateAgg(a.id, { fn: e.target.value as any, ...(e.target.value === 'COUNT' ? {} : {}) })}
                          style={{ padding: '8px 10px' }}
                        >
                          <option value="COUNT">COUNT</option>
                          <option value="AVG">AVG</option>
                          <option value="SUM">SUM</option>
                          <option value="MIN">MIN</option>
                          <option value="MAX">MAX</option>
                        </select>

                        <select
                          className="input"
                          value={a.fn === 'COUNT' && !a.nodeId ? '*' : `${a.nodeId ?? firstCol?.nodeId}:${a.column ?? firstCol?.column}`}
                          onChange={(e) => {
                            if (e.target.value === '*') {
                              updateAgg(a.id, { nodeId: undefined, column: undefined })
                              return
                            }
                            const [nodeId, column] = e.target.value.split(':')
                            updateAgg(a.id, { nodeId, column })
                          }}
                          style={{ padding: '8px 10px' }}
                        >
                          {a.fn === 'COUNT' ? <option value="*">COUNT(*)</option> : null}
                          {columnOptions.map((opt) => (
                            <option key={opt.key} value={`${opt.nodeId}:${opt.column}`}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <input
                          className="input"
                          value={a.as ?? ''}
                          onChange={(e) => updateAgg(a.id, { as: e.target.value })}
                          placeholder="alias (optional)"
                        />

                        <button className="btn btnDanger" onClick={() => deleteAgg(a.id)} title="Remove aggregation">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>
                    No aggregations.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 650, fontSize: 12 }}>Results</div>
            <div className="muted">
              {runLoading
                ? 'loading…'
                : runResult
                  ? `${runResult.totalCount ?? runResult.rowCount} rows`
                  : runError
                    ? 'error'
                    : '—'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div />
            <button className="btn" onClick={() => setResultsExpanded(true)} disabled={!runResult && !runLoading} title="Expand results">
              Expand
            </button>
          </div>

          {runError ? <div style={{ color: 'var(--danger)', fontSize: 12 }}>Run error: {runError}</div> : null}

          <ResultsTable compact />
        </div>
      </aside>

      <Modal
        open={sqlExpanded}
        onClose={() => setSqlExpanded(false)}
        title="SQL Editor"
        width={980}
        heightVh={90}
        footer={
          <>
            <button className="btn" onClick={() => setSqlExpanded(false)}>
              Back
            </button>
            <button className="btn btnPrimary" onClick={handleRun} disabled={runLoading || (!generatedSql && !editorSql) || !!sqlError}>
              {runLoading ? 'Running…' : 'Run'}
            </button>
          </>
        }
      >
        {sqlError ? (
          <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>SQL error: {sqlError}</div>
        ) : null}

        <textarea
          className="codeBox"
          style={{
            width: '100%',
            height: '62vh',
            resize: 'none',
            borderRadius: 14,
            padding: 14,
            lineHeight: 1.45,
          }}
          value={editorSql}
          onChange={(e) => {
            setEditorSql(e.target.value)
            setEditorDirty(true)
          }}
          placeholder="Write SQL manually or generate visually..."
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {editorDirty ? 'Running uses the SQL editor content.' : 'Auto-filled from the visual builder (until you edit).'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Limit
            </span>
            <input
              className="input"
              style={{ width: 130, padding: '8px 10px' }}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value || 200))}
              inputMode="numeric"
            />
            <button
              className="btn"
              onClick={() => {
                setEditorSql(generatedSql)
                setEditorDirty(false)
              }}
              disabled={!generatedSql}
              title="Replace editor with generated SQL"
            >
              Reset to generated
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={resultsExpanded}
        onClose={() => setResultsExpanded(false)}
        title="Results"
        width={1120}
        heightVh={90}
        footer={
          <>
            <button className="btn" onClick={() => setResultsExpanded(false)}>
              Back
            </button>
          </>
        }
      >
        {runError ? <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>Run error: {runError}</div> : null}
        <ResultsTable />
      </Modal>

      <CreateTableModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          reloadSchema()
        }}
      />

      {renameTarget ? (
        <RenameTableModal
          open={!!renameTarget}
          onClose={() => setRenameTarget(null)}
          table={renameTarget}
          onDone={() => reloadSchema()}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteTableModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          table={deleteTarget}
          onDone={() => reloadSchema()}
        />
      ) : null}

      {editColsTarget ? (
        <EditColumnsModal
          open={!!editColsTarget}
          onClose={() => setEditColsTarget(null)}
          table={editColsTarget}
          onDone={() => reloadSchema()}
        />
      ) : null}

      {rowsTarget ? <RowEditorModal open={!!rowsTarget} onClose={() => setRowsTarget(null)} table={rowsTarget} /> : null}
    </div>
  )
}

