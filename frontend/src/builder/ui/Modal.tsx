import { type ReactNode, useEffect } from 'react'

export function Modal(props: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  const { open, onClose } = props

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 20,
      }}
    >
      <div
        style={{
          width: props.width ?? 680,
          maxWidth: '100%',
          maxHeight: '85vh',
          overflow: 'hidden',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(10, 14, 26, 0.92)',
          boxShadow: 'rgba(0,0,0,0.6) 0 18px 50px',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>{props.title}</div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ padding: 14, overflow: 'auto', maxHeight: 'calc(85vh - 120px)' }}>{props.children}</div>

        {props.footer ? (
          <div
            style={{
              padding: '12px 14px',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

