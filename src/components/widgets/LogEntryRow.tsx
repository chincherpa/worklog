import { useRef, useLayoutEffect } from 'react'
import { BG_SELECTED, TEXT_DIM, TEXT_PRIMARY } from '../../theme'
import { formatTime, firstLine } from '../../lib/format'
import type { LogEntry, Tag } from '../../types'

interface Props {
  entry: LogEntry
  tag: Tag | undefined
  selected: boolean
  onClick: () => void
}

export default function LogEntryRow({ entry, tag, selected, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const hasBody = entry.content.includes('\n') && entry.content.split('\n').filter(l => l.trim()).length > 1

  useLayoutEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [selected])

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        background: selected ? BG_SELECTED : 'transparent',
        cursor: 'pointer',
        borderLeft: selected ? '2px solid #5B8DEF' : '2px solid transparent',
      }}
    >
      <span style={{ color: TEXT_DIM, fontSize: 11, minWidth: 38, flexShrink: 0 }}>
        {formatTime(entry.created_at)}
      </span>
      {tag && (
        <span style={{
          color: tag.color,
          background: tag.bg_color ?? (tag.color + '28'),
          fontSize: 11,
          padding: '1px 6px',
          borderRadius: 10,
          minWidth: 60,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}>
          {tag.symbol} {tag.key}
        </span>
      )}
      <span style={{
        color: TEXT_PRIMARY,
        fontSize: 12,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
      }}>
        {firstLine(entry.content)}
      </span>
      {hasBody && <span style={{ color: TEXT_DIM, fontSize: 11, flexShrink: 0 }}>📄</span>}
    </div>
  )
}
