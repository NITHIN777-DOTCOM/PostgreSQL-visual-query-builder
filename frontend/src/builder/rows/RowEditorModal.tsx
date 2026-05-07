import { useEffect, useMemo, useState } from 'react'
import type { TableInfo } from '../types'
import { deleteTableRow, insertTableRow, listTableRows, updateTableRow } from '../api'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toast'

function stringifyCell(v: unknown) {
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function RowEditorModal(props: {
  open: boolean
  onClose: () => void
  table: TableInfo
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [primaryKey, setPrimaryKey] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const pk = primaryKey ?? props.table.columns.find((c) => c.isPrimaryKey)?.name ?? null

  const columns = useMemo(() => props.table.columns.map((c) => c.name), [props.table.columns])

  const reload = async (nextOffset: number) => {
    setError(null)
    setLoading(true)
    try {
      const r = await listTableRows({ schema: props.table.schema, table: props.table.name, limit, offset: nextOffset })
      setRows(r.rows)
      setTotalCount(r.totalCount)
      setPrimaryKey(r.primaryKey)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!props.open) return
    setOffset(0)
    void reload(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.table.schema, props.table.name])

  const [addOpen, setAddOpen] = useState(false)
  const [addValues, setAddValues] = useState<Record<string, string>>({})
  const [editPkValue, setEditPkValue] = useState<unknown | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const startEdit = (row: Record<string, unknown>) => {
    if (!pk) {
      toast.push({ kind: 'error', title: 'No primary key', message: 'This table has no primary key. Add one for row editing.' })
      return
    }
    setEditPkValue(row[pk])
    const next: Record<string, string> = {}
    for (const c of columns) next[c] = stringifyCell(row[c])
    setEditValues(next)
  }

  const saveEdit = async () => {
    if (!pk) return
    setLoading(true)
    setError(null)
    try {
      const values: Record<string, unknown> = {}
      for (const c of columns) {
        if (c === pk) continue
        values[c] = editValues[c]
      }
      await updateTableRow({
        schema: props.table.schema,
        table: props.table.name,
        pk: { column: pk, value: editPkValue },
        values,
      })
      toast.push({ kind: 'success', title: 'Row updated' })
      setEditPkValue(null)
      await reload(offset)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.push({ kind: 'error', title: 'Update failed', message: msg })
    } finally {
      setLoading(false)
    }
  }

  const doDelete = async (row: Record<string, unknown>) => {
    if (!pk) {
      toast.push({ kind: 'error', title: 'No primary key', message: 'This table has no primary key. Add one for row deletion.' })
      return
    }
    setLoading(true)
    setError(null)
    try {
      await deleteTableRow({ schema: props.table.schema, table: props.table.name, pk: { column: pk, value: row[pk] } })
      toast.push({ kind: 'success', title: 'Row deleted' })
      await reload(offset)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.push({ kind: 'error', title: 'Delete failed', message: msg })
    } finally {
      setLoading(false)
    }
  }

  const doAdd = async () => {
    setLoading(true)
    setError(null)
    try {
      const values: Record<string, unknown> = {}
      for (const c of columns) values[c] = addValues[c] ?? ''
      await insertTableRow({ schema: props.table.schema, table: props.table.name, values })
      toast.push({ kind: 'success', title: 'Row added' })
      setAddOpen(false)
      setAddValues({})
      await reload(0)
      setOffset(0)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.push({ kind: 'error', title: 'Insert failed', message: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={`Rows — ${props.table.schema}.${props.table.name}`}
      width={1120}
      heightVh={90}
      footer={
        <>
          <button className="btn" onClick={props.onClose} disabled={loading}>
            Close
          </button>
        </>
      }
    >
      {error ? <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div> : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 12 }}>
          {loading ? 'Loading…' : `${rows.length} rows (of ${totalCount})`} {pk ? `• PK: ${pk}` : '• PK: —'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btnPrimary" onClick={() => setAddOpen(true)} disabled={loading}>
            + Add row
          </button>
        </div>
      </div>

      {addOpen ? (
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
            background: 'rgba(0,0,0,0.22)',
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontWeight: 750, fontSize: 12 }}>Add row</div>
            <button className="btn" onClick={() => setAddOpen(false)} disabled={loading}>
              Cancel
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            {props.table.columns.map((c) => (
              <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {c.name} <span style={{ opacity: 0.7 }}>({c.dataType})</span>
                </div>
                <input
                  className="input"
                  value={addValues[c.name] ?? ''}
                  onChange={(e) => setAddValues((v) => ({ ...v, [c.name]: e.target.value }))}
                  placeholder={c.isNullable ? 'null allowed' : 'required'}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button className="btn btnPrimary" onClick={doAdd} disabled={loading}>
              {loading ? 'Saving…' : 'Insert'}
            </button>
          </div>
        </div>
      ) : null}

      {editPkValue != null && pk ? (
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
            background: 'rgba(0,0,0,0.22)',
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontWeight: 750, fontSize: 12 }}>
              Edit row <span className="muted">({pk} = {stringifyCell(editPkValue)})</span>
            </div>
            <button className="btn" onClick={() => setEditPkValue(null)} disabled={loading}>
              Cancel
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            {props.table.columns.map((c) => (
              <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  {c.name} <span style={{ opacity: 0.7 }}>({c.dataType})</span>
                </div>
                <input
                  className="input"
                  value={editValues[c.name] ?? ''}
                  disabled={c.name === pk}
                  onChange={(e) => setEditValues((v) => ({ ...v, [c.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button className="btn btnPrimary" onClick={saveEdit} disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', background: 'rgba(0,0,0,0.25)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '10px 10px',
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky',
                  top: 0,
                  background: 'rgba(0,0,0,0.65)',
                  zIndex: 1,
                  width: 160,
                }}
              >
                Actions
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  style={{
                    textAlign: 'left',
                    padding: '10px 10px',
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky',
                    top: 0,
                    background: 'rgba(0,0,0,0.65)',
                    zIndex: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={() => startEdit(r)} disabled={loading}>
                      Edit
                    </button>
                    <button className="btn btnDanger" onClick={() => void doDelete(r)} disabled={loading}>
                      Delete
                    </button>
                  </div>
                </td>
                {columns.map((c) => (
                  <td key={c} style={{ padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: 'var(--mono)' }}>{stringifyCell(r[c])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button
          className="btn"
          disabled={loading || offset <= 0}
          onClick={() => {
            const next = Math.max(0, offset - limit)
            setOffset(next)
            void reload(next)
          }}
        >
          Prev
        </button>
        <button
          className="btn"
          disabled={loading || offset + limit >= totalCount}
          onClick={() => {
            const next = offset + limit
            setOffset(next)
            void reload(next)
          }}
        >
          Next
        </button>
      </div>
    </Modal>
  )
}

