import { Handle, Position, type NodeProps } from 'reactflow'
import type { TableNodeData } from './store'
import { useBuilderStore } from './store'

export function TableNode(props: NodeProps<TableNodeData>) {
  const { id, data } = props
  const toggleColumn = useBuilderStore((s) => s.toggleColumn)

  return (
    <div
      style={{
        minWidth: 240,
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(0,0,0,0.35)',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: 'rgba(0,0,0,0.35) 0 10px 24px',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'baseline',
        }}
      >
        <div style={{ fontWeight: 650, fontSize: 12 }}>
          {data.schema}.{data.table}
        </div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>{data.columns.length} cols</div>
      </div>

      <div style={{ padding: 10 }}>
        {data.columns.map((c) => {
          const checked = !!data.selected[c.name]
          return (
            <div
              key={c.name}
              style={{
                position: 'relative',
                padding: '6px 8px',
                borderRadius: 10,
                display: 'grid',
                gridTemplateColumns: '18px 1fr auto',
                gap: 8,
                alignItems: 'center',
                background: checked ? 'rgba(124,58,237,0.18)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleColumn(id, c.name)}
                title="Select column"
              />

              <div style={{ fontSize: 12 }}>
                <span style={{ fontFamily: 'var(--mono)' }}>{c.name}</span>
                <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 11 }}>{c.dataType}</span>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ opacity: 0.6, fontSize: 10 }}>join</span>
              </div>

              <Handle
                type="target"
                position={Position.Left}
                id={c.name}
                style={{
                  left: -6,
                  width: 10,
                  height: 10,
                  border: '1px solid rgba(255,255,255,0.55)',
                  background: 'rgba(124,58,237,0.9)',
                }}
              />
              <Handle
                type="source"
                position={Position.Right}
                id={c.name}
                style={{
                  right: -6,
                  width: 10,
                  height: 10,
                  border: '1px solid rgba(255,255,255,0.55)',
                  background: 'rgba(59,130,246,0.9)',
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

