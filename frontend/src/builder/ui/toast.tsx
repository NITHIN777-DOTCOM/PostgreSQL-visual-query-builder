import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Toast = {
  id: string
  kind: 'success' | 'error' | 'info'
  title: string
  message?: string
}

const ToastCtx = createContext<{
  push: (t: Omit<Toast, 'id'>) => void
} | null>(null)

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

export function ToastProvider(props: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid()
    setToasts((all) => [...all, { id, ...t }])
    window.setTimeout(() => {
      setToasts((all) => all.filter((x) => x.id !== id))
    }, 2800)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastCtx.Provider value={value}>
      {props.children}
      <div
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 80,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(10, 14, 26, 0.92)',
              boxShadow: 'rgba(0,0,0,0.55) 0 18px 50px',
              padding: '10px 12px',
              minWidth: 260,
              maxWidth: 360,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <div style={{ fontWeight: 750, fontSize: 12 }}>{t.title}</div>
              <div
                style={{
                  fontSize: 11,
                  color:
                    t.kind === 'success'
                      ? 'rgba(34,197,94,0.95)'
                      : t.kind === 'error'
                        ? 'rgba(239,68,68,0.95)'
                        : 'rgba(99,102,241,0.95)',
                }}
              >
                {t.kind.toUpperCase()}
              </div>
            </div>
            {t.message ? (
              <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35 }}>
                {t.message}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

