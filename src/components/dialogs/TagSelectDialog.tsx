import { useEffect } from 'react'
import { BG_PANEL, BORDER_NORMAL, TEXT_DIM } from '../../theme'
import { Overlay } from './ConfirmDialog'
import type { Tag } from '../../types'

interface Props {
  open: boolean
  tags: Tag[]
  currentKey: string | null
  onClose: (key: string | null) => void
}

export default function TagSelectDialog({ open, tags, currentKey, onClose }: Props) {
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
        padding: 8,
        width: 280,
        maxHeight: 400,
        overflowY: 'auto',
      }}>
        {tags.map(tag => (
          <button
            key={tag.key}
            onClick={() => onClose(tag.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 12px',
              background: tag.key === currentKey ? '#1E2530' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              borderRadius: 3,
            }}
          >
            <span style={{
              color: tag.color,
              background: tag.bg_color ?? (tag.color + '28'),
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 10,
              whiteSpace: 'nowrap',
              minWidth: 60,
              textAlign: 'center',
            }}>{tag.symbol} {tag.key}</span>
            <span style={{ color: TEXT_DIM, fontSize: 11 }}>{tag.name}</span>
          </button>
        ))}
        <div style={{ borderTop: `1px solid ${BORDER_NORMAL}`, marginTop: 4, paddingTop: 4 }}>
          <button
            onClick={() => onClose(null)}
            style={{
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              color: TEXT_DIM,
              fontSize: 11,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Overlay>
  )
}
