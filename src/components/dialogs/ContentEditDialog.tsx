import { useState, useEffect, useRef } from 'react'
import { BG_PANEL, BORDER_NORMAL, BORDER_ACTIVE, TEXT_SECONDARY, TEXT_DIM } from '../../theme'
import { Overlay } from './ConfirmDialog'
import type { Tag, Project } from '../../types'

export interface EntryEditResult {
  content: string
  tagKey: string
  projectKey: string
}

interface Props {
  open: boolean
  initialContent: string
  tags: Tag[]
  currentTagKey: string
  projects: Project[]
  currentProjectKey: string
  onClose: (result: EntryEditResult | null) => void
}

export default function ContentEditDialog({ open, initialContent, tags, currentTagKey, projects, currentProjectKey, onClose }: Props) {
  const [text, setText] = useState(initialContent)
  const [tagKey, setTagKey] = useState(currentTagKey)
  const [projectKey, setProjectKey] = useState(currentProjectKey)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setText(initialContent)
      setTagKey(currentTagKey)
      setProjectKey(currentProjectKey)
      setTimeout(() => ref.current?.focus(), 50)
    }
  }, [open, initialContent, currentTagKey, currentProjectKey])

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

        <PillRow label="Tag" items={tags} currentKey={tagKey} onSelect={setTagKey} />
        <PillRow label="Projekt" items={projects} currentKey={projectKey} onSelect={setProjectKey} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(null)} style={btn(false)}>Cancel</button>
          <button onClick={() => onClose({ content: text, tagKey, projectKey })} style={btn(true)}>Save</button>
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

interface Pillable {
  key: string
  symbol: string
  color: string
  bg_color?: string
}

function PillRow<T extends Pillable>({ label, items, currentKey, onSelect }: {
  label: string
  items: T[]
  currentKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: TEXT_DIM }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(item => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 10,
              border: `1px solid ${item.key === currentKey ? item.color : 'transparent'}`,
              background: item.bg_color ?? (item.color + '28'),
              color: item.color,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {item.symbol} {item.key}
          </button>
        ))}
      </div>
    </div>
  )
}
