import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BG_PANEL, BORDER_NORMAL, BORDER_ACTIVE, TEXT_DIM, TEXT_SECONDARY,
} from '../../theme'
import TodoRow from '../widgets/TodoRow'
import SessionBar from '../widgets/SessionBar'
import { api } from '../../lib/invoke'
import { formatTime, type PauseState } from '../../lib/format'
import type { AppConfig, FocusSession, LogEntry, SubTodo, Todo, TodoNote } from '../../types'

interface Props {
  todos: Todo[]
  todoIdx: number
  activeSession: FocusSession | null
  sessionPause?: PauseState
  onSessionPauseToggle?: () => void
  onSessionStop?: () => void
  dbPath: string
  config: AppConfig | null
  isActive: boolean
  logEntries: LogEntry[]
  onTodoSelect: (idx: number) => void
  subtodosRevision?: number
  style?: CSSProperties
}

interface ExpandedData {
  todoId: number
  subTodos: SubTodo[]
  notes: TodoNote[]
  linkedLogs: LogEntry[]
}

const DONE_STATUSES = new Set(['done', 'cancelled', 'dropped'])

export default function TodoPanel({
  todos, todoIdx, activeSession, sessionPause, onSessionPauseToggle, onSessionStop,
  dbPath, isActive, logEntries, onTodoSelect, subtodosRevision, style,
}: Props) {
  const [expanded, setExpanded] = useState<ExpandedData | null>(null)
  const [collapsedId, setCollapsedId] = useState<number | null>(null)
  const selectedTodo = todos[todoIdx]

  // Click selected todo again -> collapse; click another -> select + expand.
  const handleRowClick = (globalIdx: number, todoId: number) => {
    if (globalIdx === todoIdx) {
      setCollapsedId(prev => (prev === todoId ? null : todoId))
    } else {
      setCollapsedId(null)
      onTodoSelect(globalIdx)
    }
  }

  const activeTodos = todos.filter(t => !DONE_STATUSES.has(t.status))
  const doneTodos = todos.filter(t => DONE_STATUSES.has(t.status))
  const openCount = todos.filter(t => t.status === 'open' || t.status === 'active' || t.status === 'paused').length
  const doneCount = doneTodos.length

  // Load expanded data when selection changes
  useEffect(() => {
    if (!selectedTodo || !dbPath) {
      setExpanded(null)
      return
    }
    Promise.all([
      api.subtodoListForTodo(dbPath, selectedTodo.id),
      api.noteListForTodo(dbPath, selectedTodo.id),
    ]).then(([subs, notes]) => {
      const linked = logEntries.filter(e => e.todo_id === selectedTodo.id).slice(0, 5)
      setExpanded({ todoId: selectedTodo.id, subTodos: subs, notes: notes.slice(-8), linkedLogs: linked })
    }).catch(console.error)
  }, [selectedTodo?.id, dbPath, logEntries, subtodosRevision])

  const handleToggleSub = async (subId: number) => {
    const updated = await api.subtodoToggle(dbPath, subId)
    setExpanded(prev => prev && {
      ...prev,
      subTodos: prev.subTodos.map(s => s.id === subId ? updated : s),
    })
  }

  const activeSessionTitle = activeSession
    ? todos.find(t => t.id === activeSession.todo_id)?.title?.slice(0, 30) ?? ''
    : ''

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: BG_PANEL,
      border: `${isActive ? 2 : 1}px solid ${isActive ? BORDER_ACTIVE : BORDER_NORMAL}`,
      borderRadius: 4,
      overflow: 'hidden',
      flex: '1',
      minWidth: 0,
      ...style,
    }}>
      {/* Title */}
      <div style={{
        padding: '6px 10px',
        borderBottom: `1px solid ${BORDER_NORMAL}`,
        fontSize: 12,
        color: TEXT_SECONDARY,
        flexShrink: 0,
      }}>
        ✅ TODOS · {openCount} open · {doneCount} done
      </div>

      {/* Active session bar */}
      {activeSession && (
        <SessionBar
          session={activeSession}
          title={activeSessionTitle}
          pause={sessionPause}
          onPauseToggle={onSessionPauseToggle}
          onStop={onSessionStop}
        />
      )}

      {/* Todo list */}
      <div className="scroll-container" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {activeTodos.map((todo) => {
          const globalIdx = todos.indexOf(todo)
          const hasFocus = activeSession?.todo_id === todo.id && !activeSession.ended_at
          return (
            <div key={todo.id}>
              <TodoRow
                todo={todo}
                selected={globalIdx === todoIdx}
                hasFocusSession={hasFocus}
                onClick={() => handleRowClick(globalIdx, todo.id)}
              />
              {globalIdx === todoIdx && expanded?.todoId === todo.id && collapsedId !== todo.id && (
                <ExpandedSection expanded={expanded} onToggleSub={handleToggleSub} />
              )}
            </div>
          )
        })}

        {doneTodos.length > 0 && (
          <>
            <div style={{
              color: TEXT_DIM,
              fontSize: 10,
              padding: '6px 10px 2px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ flex: 1, borderTop: '1px solid #2A3340' }} />
              <span>done</span>
              <span style={{ flex: 1, borderTop: '1px solid #2A3340' }} />
            </div>
            {doneTodos.map(todo => {
              const globalIdx = todos.indexOf(todo)
              return (
                <div key={todo.id}>
                  <TodoRow
                    todo={todo}
                    selected={globalIdx === todoIdx}
                    hasFocusSession={false}
                    onClick={() => handleRowClick(globalIdx, todo.id)}
                  />
                  {globalIdx === todoIdx && expanded?.todoId === todo.id && collapsedId !== todo.id && (
                    <ExpandedSection expanded={expanded} onToggleSub={handleToggleSub} />
                  )}
                </div>
              )
            })}
          </>
        )}

        {todos.length === 0 && (
          <div style={{ color: TEXT_DIM, fontSize: 11, padding: '12px 10px', textAlign: 'center' }}>
            No todos
          </div>
        )}
      </div>
    </div>
  )
}

function ExpandedSection({ expanded, onToggleSub }: { expanded: ExpandedData; onToggleSub: (subId: number) => void }) {
  const { subTodos, notes, linkedLogs } = expanded
  const [hoveredNote, setHoveredNote] = useState<number | null>(null)
  const [copiedNote, setCopiedNote] = useState<number | null>(null)

  function handleCopyNote(e: React.MouseEvent, id: number, content: string) {
    e.stopPropagation()
    navigator.clipboard.writeText(content).then(() => {
      setCopiedNote(id)
      setTimeout(() => setCopiedNote(null), 1200)
    })
  }

  if (linkedLogs.length === 0 && subTodos.length === 0 && notes.length === 0) return null

  return (
    <div style={{
      marginLeft: 24,
      marginRight: 8,
      marginBottom: 4,
      padding: '4px 8px',
      borderLeft: '2px solid #2A3340',
      fontSize: 11,
    }}>
      {linkedLogs.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {linkedLogs.map(l => (
            <div key={l.id} style={{ color: '#888899', marginBottom: 2 }}>
              <span style={{ color: '#555577' }}>{formatTime(l.created_at)}</span>
              {' '}
              {l.content.split('\n')[0].slice(0, 60)}
            </div>
          ))}
        </div>
      )}

      {subTodos.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {subTodos.map(s => (
            <div
              key={s.id}
              onClick={(e) => { e.stopPropagation(); onToggleSub(s.id) }}
              style={{
                color: s.done ? '#555577' : '#C8C8C8',
                textDecoration: s.done ? 'line-through' : 'none',
                marginBottom: 2,
                cursor: 'pointer',
              }}>
              {s.done ? '✓' : '○'} {s.title}
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <div>
          {notes.map(n => (
            <div
              key={n.id}
              onMouseEnter={() => setHoveredNote(n.id)}
              onMouseLeave={() => setHoveredNote(null)}
              style={{ color: '#888899', marginBottom: 2, display: 'flex', alignItems: 'flex-start', gap: 4 }}
            >
              <span className="selectable" style={{ flex: 1, wordBreak: 'break-word' }}>· {n.content}</span>
              {hoveredNote === n.id && (
                <button
                  onClick={(e) => handleCopyNote(e, n.id, n.content)}
                  title="Copy"
                  style={{
                    flexShrink: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedNote === n.id ? '#4a4' : '#555577',
                    fontSize: 11,
                    padding: '0 2px',
                    lineHeight: 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {copiedNote === n.id ? '✓' : '⎘'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
