import { useRef, useLayoutEffect } from 'react'
import { BG_SELECTED, BORDER_ACTIVE, TEXT_DIM, TEXT_SECONDARY, ACCENT_RED, STATUS_COLORS, STATUS_ICONS, PRIORITY_COLORS, PRIORITY_ICONS } from '../../theme'
import { formatDuration, formatScheduled, formatEstDuration, isOverdue } from '../../lib/format'
import type { Todo } from '../../types'

const DONE_STATUSES = new Set(['done', 'cancelled', 'dropped'])

interface Props {
  todo: Todo
  selected: boolean
  hasFocusSession: boolean
  onClick: () => void
}

export default function TodoRow({ todo, selected, hasFocusSession, onClick }: Props) {
  const effectiveStatus = hasFocusSession ? 'focus' : todo.status
  const statusColor = STATUS_COLORS[effectiveStatus] ?? '#888'
  const statusIcon = STATUS_ICONS[effectiveStatus] ?? '○'
  const priorityColor = PRIORITY_COLORS[todo.priority] ?? '#888'
  const priorityIcon = PRIORITY_ICONS[todo.priority] ?? '●'
  const overdue = !!todo.scheduled_at && !DONE_STATUSES.has(todo.status) && isOverdue(todo.scheduled_at)
  const ref = useRef<HTMLDivElement>(null)

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
        padding: '4px 8px',
        background: selected ? BG_SELECTED : 'transparent',
        cursor: 'pointer',
        borderLeft: selected ? `3px solid ${BORDER_ACTIVE}` : '3px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: statusColor, fontSize: 14, minWidth: 16, flexShrink: 0 }}>
          {statusIcon}
        </span>
        <span style={{ color: priorityColor, fontSize: 10, minWidth: 12, flexShrink: 0 }}>
          {priorityIcon}
        </span>
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: effectiveStatus !== 'open' ? statusColor : undefined,
        }}>
          {todo.title}
        </span>
        {todo.scheduled_at && (
          <span style={{ color: overdue ? ACCENT_RED : TEXT_DIM, fontSize: 11, flexShrink: 0 }}>
            📅 {formatScheduled(todo.scheduled_at)}
          </span>
        )}
        {todo.est_duration_min != null && (
          <span style={{ color: TEXT_DIM, fontSize: 11, flexShrink: 0 }}>
            ⏱{formatEstDuration(todo.est_duration_min)}
          </span>
        )}
        {todo.total_duration_s > 0 && (
          <span style={{ color: TEXT_DIM, fontSize: 11, flexShrink: 0 }}>
            {formatDuration(todo.total_duration_s)}
          </span>
        )}
      </div>
      {todo.context && (
        <div style={{ color: TEXT_SECONDARY, fontSize: 11, paddingLeft: 38, marginTop: 1 }}>
          {todo.context}
        </div>
      )}
    </div>
  )
}
