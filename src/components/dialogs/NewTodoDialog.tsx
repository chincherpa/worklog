import { useState, useEffect, useRef } from 'react'
import { BG_PANEL, BORDER_NORMAL, BORDER_ACTIVE, TEXT_SECONDARY, PRIORITY_COLORS } from '../../theme'
import { Overlay } from './ConfirmDialog'

export interface NewTodoResult {
  title: string
  context: string
  priority: 'high' | 'normal' | 'low'
}

interface Props {
  open: boolean
  initialTitle?: string
  onClose: (result: NewTodoResult | null) => void
}

const PRIORITIES = ['high', 'normal', 'low'] as const

export default function NewTodoDialog({ open, initialTitle, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle ?? '')
  const [context, setContext] = useState('')
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? '')
      setContext('')
      setPriority('normal')
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open, initialTitle])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const canSave = title.trim().length > 0

  return (
    <Overlay>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_NORMAL}`,
        borderRadius: 6,
        padding: 24,
        width: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>Neues Todo</div>

        <input
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titel *"
          onKeyDown={e => { if (e.key === 'Enter' && canSave) onClose({ title: title.trim(), context: context.trim(), priority }) }}
          style={inputStyle(true)}
        />
        <input
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="Kontext (optional)"
          style={inputStyle(false)}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          {PRIORITIES.map(p => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              style={{
                padding: '4px 12px',
                border: `1px solid ${priority === p ? PRIORITY_COLORS[p] : BORDER_NORMAL}`,
                borderRadius: 4,
                background: priority === p ? PRIORITY_COLORS[p] + '22' : 'transparent',
                color: priority === p ? PRIORITY_COLORS[p] : '#888',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(null)} style={btnStyle(false)}>Abbrechen</button>
          <button
            disabled={!canSave}
            onClick={() => canSave && onClose({ title: title.trim(), context: context.trim(), priority })}
            style={btnStyle(true, !canSave)}
          >
            Speichern
          </button>
        </div>
      </div>
    </Overlay>
  )
}

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '6px 0',
    fontSize: 13,
    color: '#E8E8E8',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${focused ? BORDER_ACTIVE : BORDER_NORMAL}`,
    outline: 'none',
    fontFamily: 'inherit',
  }
}

function btnStyle(primary: boolean, disabled = false): React.CSSProperties {
  return {
    padding: '6px 16px',
    border: `1px solid ${primary ? BORDER_ACTIVE : BORDER_NORMAL}`,
    borderRadius: 4,
    background: primary && !disabled ? BORDER_ACTIVE + '22' : 'transparent',
    color: primary && !disabled ? BORDER_ACTIVE : '#888',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize: 12,
    fontFamily: 'inherit',
  }
}
