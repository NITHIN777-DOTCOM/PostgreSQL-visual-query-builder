import { useMemo, useState } from 'react'
import type { ColumnType } from '../api'
import { alterTable, deleteTable, renameTable } from '../api'
import type { TableInfo } from '../types'
import { Modal } from '../ui/Modal'

const TYPES: ColumnType[] = ['integer', 'text', 'boolean', 'timestamp', 'float']

export function RenameTableModal(props: {
  open: boolean
  onClose: () => void
  table: TableInfo
  onDone: () => void
}) {
  const [to, setTo] = useState(props.table.name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await renameTable({ schema: props.table.schema, from: props.table.name, to: to.trim() })
      props.onDone()
      props.onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={`Rename ${props.table.schema}.${props.table.name}`}
      footer={
        <>
          <button className="btn" onClick={props.onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btnPrimary" onClick={submit} disabled={busy || !to.trim()}>
            Rename
          </button>
        </>
      }
    >
      {error ? <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div> : null}
      <div className="muted">New name</div>
      <div style={{ height: 8 }} />
      <input className="input" value={to} onChange={(e) => setTo(e.target.value)} />
    </Modal>
  )
}

export function ConfirmDeleteTableModal(props: {
  open: boolean
  onClose: () => void
  table: TableInfo
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteTable({ schema: props.table.schema, table: props.table.name })
      props.onDone()
      props.onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Delete table"
      footer={
        <>
          <button className="btn" onClick={props.onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btnDanger" onClick={submit} disabled={busy}>
            Delete
          </button>
        </>
      }
    >
      <div style={{ fontSize: 12 }}>
        This will permanently delete <span style={{ fontFamily: 'var(--mono)' }}>{props.table.schema}.{props.table.name}</span>{' '}
        (cascade).
      </div>
      {error ? <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }}>{error}</div> : null}
    </Modal>
  )
}

function guessTypeFromPg(dataType: string): ColumnType {
  const t = dataType.toLowerCase()
  if (t.includes('int')) return 'integer'
  if (t.includes('bool')) return 'boolean'
  if (t.includes('timestamp')) return 'timestamp'
  if (t.includes('double') || t.includes('real') || t.includes('numeric') || t.includes('float')) return 'float'
  return 'text'
}

export function EditColumnsModal(props: { open: boolean; onClose: () => void; table: TableInfo; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cols = useMemo(
    () =>
      props.table.columns.map((c) => ({
        name: c.name,
        type: guessTypeFromPg(c.dataType),
      })),
    [props.table.columns],
  )

  const [addName, setAddName] = useState('')
  const [addType, setAddType] = useState<ColumnType>('text')
  const [addNullable, setAddNullable] = useState(true)
  const [addUnique, setAddUnique] = useState(false)

  const doOp = async (op: Parameters<typeof alterTable>[0]['op']) => {
    setError(null)
    setBusy(true)
    try {
      await alterTable({ schema: props.table.schema, table: props.table.name, op })
      props.onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={props.open} onClose={props.onClose} title={`Edit columns: ${props.table.schema}.${props.table.name}`} width={820}>
      {error ? <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 12 }}>Existing columns</div>

        {cols.map((c) => (
          <div
            key={c.name}
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: 10,
              background: 'rgba(0,0,0,0.25)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.name}</div>
            <div className="muted">{c.type}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  const to = prompt(`Rename column "${c.name}" to:`)
                  if (!to) return
                  void doOp({ type: 'renameColumn', from: c.name, to })
                }}
              >
                Rename
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  const to = prompt(`Change type for "${c.name}" (${TYPES.join(', ')}):`, c.type)
                  if (!to) return
                  if (!TYPES.includes(to as ColumnType)) {
                    setError(`Invalid type: ${to}`)
                    return
                  }
                  void doOp({ type: 'changeType', columnName: c.name, newType: to as ColumnType })
                }}
              >
                Change type
              </button>
              <button className="btn btnDanger" disabled={busy} onClick={() => void doOp({ type: 'dropColumn', columnName: c.name })}>
                Delete
              </button>
            </div>
          </div>
        ))}

        <div className="divider" />

        <div style={{ fontWeight: 700, fontSize: 12 }}>Add column</div>
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: 10,
            background: 'rgba(0,0,0,0.25)',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr auto',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <input className="input" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="new_column" />
          <select className="input" value={addType} onChange={(e) => setAddType(e.target.value as ColumnType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end' }}>
            <label className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={addUnique} onChange={(e) => setAddUnique(e.target.checked)} />
              Unique
            </label>
            <label className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={addNullable} onChange={(e) => setAddNullable(e.target.checked)} />
              Null
            </label>
            <button
              className="btn btnPrimary"
              disabled={busy || !addName.trim()}
              onClick={() => {
                void doOp({
                  type: 'addColumn',
                  column: { name: addName.trim(), type: addType, nullable: addNullable, unique: addUnique },
                }).then(() => {
                  setAddName('')
                  setAddType('text')
                  setAddNullable(true)
                  setAddUnique(false)
                })
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={props.onClose} disabled={busy}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}

