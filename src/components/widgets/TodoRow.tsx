import { BG_SELECTED, BORDER_ACTIVE, TEXT_DIM, TEXT_SECONDARY, STATUS_COLORS, STATUS_ICONS, PRIORITY_COLORS, PRIORITY_ICONS } from '../../theme'
import { formatDuration } from '../../lib/format'
import type { Todo } from '../../types'

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
  const isDone = todo.status === 'done' || todo.status === 'cancelled' || todo.status === 'dropped'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '4px 8px',
        background: selected ? BG_SELECTED : 'transparent',
        cursor: 'pointer',
        borderLeft: selected ? `3px solid ${BORDER_ACTIVE}` : '3px solid transparent',
        opacity: isDone ? 0.5 : 1,
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
          textDecoration: isDone ? 'line-through' : 'none',
        }}>
          {todo.title}
        </span>
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
