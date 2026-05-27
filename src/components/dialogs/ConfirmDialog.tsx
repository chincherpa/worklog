import { useEffect } from 'react'
import { BG_PANEL, BORDER_NORMAL, ACCENT_RED, TEXT_PRIMARY } from '../../theme'

interface Props {
  open: boolean
  message: string
  onClose: (confirmed: boolean) => void
}

export default function ConfirmDialog({ open, message, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false)
      if (e.key === 'Enter') onClose(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <Overlay>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_NORMAL}`,
        borderRadius: 6,
        padding: 24,
        minWidth: 300,
        maxWidth: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <div style={{ color: TEXT_PRIMARY, fontSize: 13 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(false)} style={btnStyle(false)}>Nein</button>
          <button onClick={() => onClose(true)} style={btnStyle(true)}>Ja</button>
        </div>
      </div>
    </Overlay>
  )
}

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    padding: '6px 16px',
    border: `1px solid ${primary ? ACCENT_RED : BORDER_NORMAL}`,
    borderRadius: 4,
    background: primary ? ACCENT_RED + '22' : 'transparent',
    color: primary ? ACCENT_RED : '#888',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
  }
}

export function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 500,
    }}>
      {children}
    </div>
  )
}
