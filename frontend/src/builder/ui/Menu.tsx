import { type ReactNode, useEffect, useRef } from 'react'

export function Menu(props: {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!props.open) return
    const onDown = (e: MouseEvent) => {
      const a = props.anchorRef.current
      const p = panelRef.current
      if (!a || !p) return
      if (a.contains(e.target as Node)) return
      if (p.contains(e.target as Node)) return
      props.onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [props])

  if (!props.open) return null

  const rect = props.anchorRef.current?.getBoundingClientRect()
  const top = (rect?.bottom ?? 0) + 6
  const left = Math.min((rect?.left ?? 0), window.innerWidth - 220)

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: 220,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(10, 14, 26, 0.96)',
        boxShadow: 'rgba(0,0,0,0.6) 0 18px 50px',
        padding: 6,
        zIndex: 60,
      }}
    >
      {props.children}
    </div>
  )
}

export function MenuItem(props: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      className="btn"
      onClick={props.onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'block',
        padding: '10px 10px',
        borderRadius: 10,
        border: '1px solid transparent',
        background: 'transparent',
        color: props.danger ? 'rgba(239,68,68,0.95)' : 'rgba(255,255,255,0.9)',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget.style.background = 'rgba(255,255,255,0.06)')
        e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget.style.background = 'transparent')
        e.currentTarget.style.border = '1px solid transparent'
      }}
    >
      {props.label}
    </button>
  )
}

