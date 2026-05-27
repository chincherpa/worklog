import { useEffect, useState } from 'react'
import type { ToastSeverity } from '../../types'
import { BG_PANEL, ACCENT_BLUE, ACCENT_GOLD, ACCENT_RED, ACCENT_GREEN, TEXT_PRIMARY } from '../../theme'

export interface ToastMessage {
  id: number
  message: string
  severity: ToastSeverity
}

interface Props {
  toasts: ToastMessage[]
  onDismiss: (id: number) => void
}

const COLORS: Record<ToastSeverity, string> = {
  info: ACCENT_BLUE,
  warning: ACCENT_GOLD,
  error: ACCENT_RED,
  success: ACCENT_GREEN,
}

export default function Toast({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null
  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 200)
    }, 2000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div style={{
      background: BG_PANEL,
      border: `1px solid ${COLORS[toast.severity]}`,
      color: TEXT_PRIMARY,
      padding: '6px 12px',
      borderRadius: 4,
      fontSize: 12,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: COLORS[toast.severity], marginRight: 6 }}>
        {toast.severity === 'error' ? '✗' : toast.severity === 'success' ? '✓' : toast.severity === 'warning' ? '⚠' : 'ℹ'}
      </span>
      {toast.message}
    </div>
  )
}

let _toastId = 0
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = (message: string, severity: ToastSeverity = 'info') => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, severity }])
  }

  const dismiss = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, showToast, dismiss }
}
