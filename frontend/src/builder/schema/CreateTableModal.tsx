import { useMemo, useState } from 'react'
import type { ColumnType, CreateTableRequest } from '../api'
import { createTable } from '../api'
import { Modal } from '../ui/Modal'

const TYPES: ColumnType[] = ['integer', 'text', 'boolean', 'timestamp', 'float']

type DraftCol = {
  name: string
  type: ColumnType
  primaryKey: boolean
  nullable: boolean
  unique: boolean
}

export function CreateTableModal(props: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [table, setTable] = useState('')
  const [schema] = useState('public')
  const [cols, setCols] = useState<DraftCol[]>([
    { name: 'id', type: 'integer', primaryKey: true, nullable: false, unique: true },
  ])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const hasPk = useMemo(() => cols.some((c) => c.primaryKey), [cols])

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const req: CreateTableRequest = {
        schema,
        table: table.trim(),
        columns: cols
          .map((c) => ({
            name: c.name.trim(),
            type: c.type,
            primaryKey: c.primaryKey,
            nullable: c.nullable,
            unique: c.unique,
          }))
          .filter((c) => c.name.length > 0),
      }
      await createTable(req)
      props.onCreated()
      props.onClose()
      setTable('')
      setCols([{ name: 'id', type: 'integer', primaryKey: true, nullable: false, unique: true }])
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
      title="Create table"
      width={760}
      footer={
        <>
          <button className="btn" onClick={props.onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btnPrimary" onClick={submit} disabled={busy || !table.trim()}>
            Create
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {error ? <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          <div className="muted">Table name</div>
          <input className="input" value={table} onChange={(e) => setTable(e.target.value)} placeholder="students" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>Columns</div>
          <button
            className="btn"
            onClick={() =>
              setCols((c) => [...c, { name: '', type: 'text', primaryKey: false, nullable: true, unique: false }])
            }
          >
            + Add column
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cols.map((c, idx) => (
            <div
              key={idx}
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
              <input
                className="input"
                value={c.name}
                onChange={(e) =>
                  setCols((all) => all.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                }
                placeholder="column_name"
              />

              <select
                className="input"
                value={c.type}
                onChange={(e) =>
                  setCols((all) => all.map((x, i) => (i === idx ? { ...x, type: e.target.value as ColumnType } : x)))
                }
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                <label className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={c.primaryKey}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setCols((all) =>
                        all.map((x, i) =>
                          i !== idx
                            ? { ...x, primaryKey: checked ? false : x.primaryKey }
                            : { ...x, primaryKey: checked, nullable: checked ? false : x.nullable },
                        ),
                      )
                    }}
                  />
                  PK
                </label>

                <label className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={c.unique}
                    onChange={(e) =>
                      setCols((all) => all.map((x, i) => (i === idx ? { ...x, unique: e.target.checked } : x)))
                    }
                  />
                  Unique
                </label>

                <label className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={c.nullable}
                    disabled={c.primaryKey}
                    onChange={(e) =>
                      setCols((all) => all.map((x, i) => (i === idx ? { ...x, nullable: e.target.checked } : x)))
                    }
                  />
                  Null
                </label>

                <button
                  className="btn btnDanger"
                  onClick={() => setCols((all) => all.filter((_, i) => i !== idx))}
                  disabled={cols.length <= 1}
                  title="Remove column"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {!hasPk ? <div className="muted">Tip: set a primary key for best UX.</div> : null}
      </div>
    </Modal>
  )
}

