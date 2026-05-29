import { useState, useEffect, useRef } from 'react'
import { BG_PANEL, BORDER_NORMAL, BORDER_ACTIVE, TEXT_SECONDARY } from '../../theme'
import { Overlay } from './ConfirmDialog'

interface Props {
  open: boolean
  initialContent: string
  onClose: (result: string | null) => void
}

export default function ContentEditDialog({ open, initialContent, onClose }: Props) {
  const [text, setText] = useState(initialContent)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setText(initialContent)
      setTimeout(() => ref.current?.focus(), 50)
    }
  }, [open, initialContent])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(null)
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
        width: 520,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>Edit entry</div>

        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={12}
          style={{
            width: '100%',
            resize: 'vertical',
            padding: '8px',
            border: `1px solid ${BORDER_ACTIVE}`,
            borderRadius: 4,
            background: '#0E1117',
            color: '#E8E8E8',
            fontSize: 13,
            fontFamily: 'inherit',
            lineHeight: 1.5,
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(null)} style={btn(false)}>Cancel</button>
          <button onClick={() => onClose(text)} style={btn(true)}>Save</button>
        </div>
      </div>
    </Overlay>
  )
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: '6px 16px',
    border: `1px solid ${primary ? BORDER_ACTIVE : BORDER_NORMAL}`,
    borderRadius: 4,
    background: primary ? BORDER_ACTIVE + '22' : 'transparent',
    color: primary ? BORDER_ACTIVE : '#888',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
  }
}
