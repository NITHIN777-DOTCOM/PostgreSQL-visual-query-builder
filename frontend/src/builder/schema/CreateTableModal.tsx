import { useMemo, useRef, useState } from 'react'
import type { ColumnType, CreateTableRequest } from '../api'
import { createTable, importCommit, importPreview } from '../api'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toast'

const TYPES: ColumnType[] = ['integer', 'text', 'boolean', 'timestamp', 'float']

type DraftCol = {
  name: string
  type: ColumnType
  primaryKey: boolean
  nullable: boolean
  unique: boolean
}

export function CreateTableModal(props: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [table, setTable] = useState('')
  const [schema] = useState('public')
  const [cols, setCols] = useState<DraftCol[]>([
    { name: 'id', type: 'integer', primaryKey: true, nullable: false, unique: true },
  ])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [importPreviewRows, setImportPreviewRows] = useState<Record<string, unknown>[]>([])
  const [importTotalRows, setImportTotalRows] = useState<number | null>(null)
  const [importCols, setImportCols] = useState<{ name: string; type: ColumnType | 'text'; nullable: boolean }[] | null>(null)

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
          <button
            className="btn btnPrimary"
            onClick={async () => {
              if (importCols && importPreviewRows.length) {
                setError(null)
                setBusy(true)
                try {
                  await importCommit({
                    schema,
                    table: table.trim(),
                    columns: importCols,
                    rows: importPreviewRows, // inserts preview rows first (good UX); for large files we keep it lightweight
                  })
                  toast.push({ kind: 'success', title: 'Imported', message: `${importFileName ?? 'file'} → ${table.trim()}` })
                  props.onCreated()
                  props.onClose()
                  setTable('')
                  setCols([{ name: 'id', type: 'integer', primaryKey: true, nullable: false, unique: true }])
                  setImportFileName(null)
                  setImportPreviewRows([])
                  setImportTotalRows(null)
                  setImportCols(null)
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : String(e))
                } finally {
                  setBusy(false)
                }
                return
              }
              await submit()
            }}
            disabled={busy || !table.trim()}
          >
            {importCols ? 'Import' : 'Create'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {error ? <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div> : null}

        <div
          onDragOver={(e) => {
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) {
              void (async () => {
                setError(null)
                setBusy(true)
                try {
                  const p = await importPreview(f)
                  setImportFileName(p.fileName)
                  setTable((v) => (v.trim() ? v : p.suggestedTable))
                  setImportPreviewRows(p.previewRows)
                  setImportTotalRows(p.totalRows)
                  setImportCols(p.columns.map((c) => ({ name: c.name, type: (c.detectedType as any) ?? 'text', nullable: c.nullable })))
                  toast.push({ kind: 'info', title: 'Preview ready', message: 'Review columns & import.' })
                } catch (e2: unknown) {
                  setError(e2 instanceof Error ? e2.message : String(e2))
                } finally {
                  setBusy(false)
                }
              })()
            }
          }}
          style={{
            border: '1px dashed rgba(255,255,255,0.18)',
            borderRadius: 14,
            padding: 12,
            background: 'rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 750, fontSize: 12 }}>Import CSV / XLSX / JSON</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Drag & drop a file here (or upload). You can rename the table and adjust detected types before import.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  void (async () => {
                    setError(null)
                    setBusy(true)
                    try {
                      const p = await importPreview(f)
                      setImportFileName(p.fileName)
                      setTable((v) => (v.trim() ? v : p.suggestedTable))
                      setImportPreviewRows(p.previewRows)
                      setImportTotalRows(p.totalRows)
                      setImportCols(p.columns.map((c) => ({ name: c.name, type: (c.detectedType as any) ?? 'text', nullable: c.nullable })))
                      toast.push({ kind: 'info', title: 'Preview ready', message: 'Review columns & import.' })
                    } catch (e2: unknown) {
                      setError(e2 instanceof Error ? e2.message : String(e2))
                    } finally {
                      setBusy(false)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }
                  })()
                }}
              />
              <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                Upload file
              </button>
              {importCols ? (
                <button
                  className="btn"
                  onClick={() => {
                    setImportFileName(null)
                    setImportPreviewRows([])
                    setImportTotalRows(null)
                    setImportCols(null)
                  }}
                  disabled={busy}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {importCols ? (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                File: {importFileName} • Preview: {importPreviewRows.length} row(s)
                {typeof importTotalRows === 'number' ? ` (of ${importTotalRows})` : ''}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {importCols.map((c, idx) => (
                  <div
                    key={c.name}
                    style={{
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 12,
                      background: 'rgba(0,0,0,0.18)',
                      padding: 10,
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr auto',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      className="input"
                      value={c.name}
                      onChange={(e) => setImportCols((all) => (all ? all.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)) : all))}
                    />
                    <select
                      className="input"
                      value={c.type}
                      onChange={(e) =>
                        setImportCols((all) => (all ? all.map((x, i) => (i === idx ? { ...x, type: e.target.value as any } : x)) : all))
                      }
                    >
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      <option value="text">text</option>
                    </select>
                    <label className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input
                        type="checkbox"
                        checked={c.nullable}
                        onChange={(e) =>
                          setImportCols((all) => (all ? all.map((x, i) => (i === idx ? { ...x, nullable: e.target.checked } : x)) : all))
                        }
                      />
                      Null
                    </label>
                  </div>
                ))}
              </div>

              <div style={{ border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, overflow: 'auto', maxHeight: 220 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {importCols.map((c) => (
                        <th
                          key={c.name}
                          style={{
                            textAlign: 'left',
                            padding: '10px 10px',
                            borderBottom: '1px solid rgba(255,255,255,0.10)',
                            position: 'sticky',
                            top: 0,
                            background: 'rgba(0,0,0,0.55)',
                            zIndex: 1,
                          }}
                        >
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.map((r, ridx) => (
                      <tr key={ridx} style={{ background: ridx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                        {importCols.map((c) => (
                          <td key={c.name} style={{ padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontFamily: 'var(--mono)' }}>
                              {typeof r[c.name] === 'object' ? JSON.stringify(r[c.name]) : String(r[c.name] ?? '')}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

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
            disabled={!!importCols}
          >
            + Add column
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: importCols ? 0.5 : 1 }}>
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
                disabled={!!importCols}
              />

              <select
                className="input"
                value={c.type}
                onChange={(e) =>
                  setCols((all) => all.map((x, i) => (i === idx ? { ...x, type: e.target.value as ColumnType } : x)))
                }
                disabled={!!importCols}
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
                    disabled={!!importCols}
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
                    disabled={!!importCols}
                  />
                  Unique
                </label>

                <label className="muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={c.nullable}
                    onChange={(e) =>
                      setCols((all) => all.map((x, i) => (i === idx ? { ...x, nullable: e.target.checked } : x)))
                    }
                    disabled={!!importCols || c.primaryKey}
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

