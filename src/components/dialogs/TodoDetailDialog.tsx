import { useState, useEffect } from 'react'
import { BG_PANEL, BORDER_NORMAL, TEXT_DIM, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT_GREEN } from '../../theme'
import { Overlay } from './ConfirmDialog'
import { api } from '../../lib/invoke'
import type { SubTodo, Todo, TodoNote } from '../../types'

interface Props {
  open: boolean
  todo: Todo | null
  dbPath: string
  onClose: () => void
  onSubtodosChange?: () => void
  onTodoChange?: () => void
}

export default function TodoDetailDialog({ open, todo, dbPath, onClose, onSubtodosChange, onTodoChange }: Props) {
  const [subTodos, setSubTodos] = useState<SubTodo[]>([])
  const [notes, setNotes] = useState<TodoNote[]>([])
  const [subInput, setSubInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [durationH, setDurationH] = useState('')

  useEffect(() => {
    if (!open || !todo) return
    Promise.all([
      api.subtodoListForTodo(dbPath, todo.id),
      api.noteListForTodo(dbPath, todo.id),
    ]).then(([subs, ns]) => {
      setSubTodos(subs)
      setNotes(ns.slice(-12))
    }).catch(console.error)
    // Termin "YYYY-MM-DD HH:MM:SS" -> date + time inputs
    setSchedDate(todo.scheduled_at ? todo.scheduled_at.slice(0, 10) : '')
    setSchedTime(todo.scheduled_at ? todo.scheduled_at.slice(11, 16) : '')
    setDurationH(todo.est_duration_min != null ? String(todo.est_duration_min / 60) : '')
  }, [open, todo?.id, dbPath])

  const handleClose = async () => {
    if (todo) {
      // Compose Termin; empty date clears it (backend treats "" as NULL).
      const scheduledAt = schedDate ? `${schedDate} ${schedTime || '00:00'}:00` : ''
      const hours = parseFloat(durationH.replace(',', '.'))
      const estDurationMin = Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : 0
      const prevAt = todo.scheduled_at ?? ''
      const prevMin = todo.est_duration_min ?? 0
      if (scheduledAt !== prevAt || estDurationMin !== prevMin) {
        try {
          await api.todoUpdate(dbPath, todo.id, undefined, undefined, undefined, scheduledAt, estDurationMin)
          onTodoChange?.()
        } catch (e) {
          console.error(e)
        }
      }
    }
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleClose])

  if (!open || !todo) return null

  const handleToggleSub = async (id: number) => {
    const updated = await api.subtodoToggle(dbPath, id)
    setSubTodos(prev => prev.map(s => s.id === id ? updated : s))
    onSubtodosChange?.()
  }

  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subInput.trim()) return
    const sub = await api.subtodoAdd(dbPath, todo.id, subInput.trim())
    setSubTodos(prev => [...prev, sub])
    setSubInput('')
    onSubtodosChange?.()
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteInput.trim()) return
    const note = await api.noteAdd(dbPath, todo.id, noteInput.trim())
    setNotes(prev => [...prev, note])
    setNoteInput('')
  }

  return (
    <Overlay>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_NORMAL}`,
        borderRadius: 6,
        padding: 24,
        width: 460,
        maxHeight: '80vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontWeight: 600 }}>{todo.title}</div>
          {todo.context && <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 2 }}>{todo.context}</div>}
        </div>

        {/* Termin & Dauer */}
        <div>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 6 }}>Termin &amp; Dauer</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <label style={{ flex: 1, fontSize: 10, color: TEXT_DIM }}>
              Datum
              <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ width: 110, fontSize: 10, color: TEXT_DIM }}>
              Uhrzeit
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select
                  value={schedTime ? schedTime.slice(0, 2) : ''}
                  onChange={e => setSchedTime(`${e.target.value}:${schedTime ? schedTime.slice(3, 5) : '00'}`)}
                  style={selectStyle}
                >
                  <option value="" style={optionStyle}>--</option>
                  {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')).map(h => (
                    <option key={h} value={h} style={optionStyle}>{h}</option>
                  ))}
                </select>
                <span style={{ color: TEXT_DIM }}>:</span>
                <select
                  value={schedTime ? schedTime.slice(3, 5) : '00'}
                  onChange={e => setSchedTime(`${schedTime ? schedTime.slice(0, 2) : '00'}:${e.target.value}`)}
                  style={selectStyle}
                >
                  {['00', '15', '30', '45'].map(m => (
                    <option key={m} value={m} style={optionStyle}>{m}</option>
                  ))}
                </select>
              </div>
            </label>
            <label style={{ width: 90, fontSize: 10, color: TEXT_DIM }}>
              Dauer (h)
              <input
                type="number" step="0.5" min="0" placeholder="z.B. 1.5"
                value={durationH} onChange={e => setDurationH(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        {/* Sub-todos */}
        <div>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 6 }}>Sub-todos</div>
          {subTodos.length === 0 && (
            <div style={{ color: TEXT_DIM, fontSize: 11 }}>(no sub-todos yet)</div>
          )}
          {subTodos.map(s => (
            <div
              key={s.id}
              onClick={() => handleToggleSub(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 0', cursor: 'pointer', fontSize: 12,
                color: s.done ? TEXT_DIM : TEXT_PRIMARY,
                textDecoration: s.done ? 'line-through' : 'none',
              }}
            >
              <span style={{ color: s.done ? ACCENT_GREEN : TEXT_DIM }}>{s.done ? '✓' : '○'}</span>
              {s.title}
            </div>
          ))}
          <form onSubmit={handleAddSub} style={{ marginTop: 4 }}>
            <input
              value={subInput}
              onChange={e => setSubInput(e.target.value)}
              placeholder="Add sub-todo…"
              style={inputStyle}
            />
          </form>
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 11, color: TEXT_SECONDARY, marginBottom: 6 }}>Notes</div>
          {notes.length === 0 && (
            <div style={{ color: TEXT_DIM, fontSize: 11 }}>(no notes yet)</div>
          )}
          {notes.map(n => (
            <div key={n.id} style={{
              fontSize: 12, color: TEXT_SECONDARY,
              padding: '3px 0', borderBottom: `1px solid #1a2030`,
            }}>
              <span style={{ color: TEXT_DIM, fontSize: 10 }}>{n.created_at.slice(5, 16)}</span>
              {' '}
              {n.content}
            </div>
          ))}
          <form onSubmit={handleAddNote} style={{ marginTop: 4 }}>
            <input
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="Add note…"
              style={inputStyle}
            />
          </form>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleClose} style={{
            padding: '6px 16px',
            border: `1px solid ${BORDER_NORMAL}`,
            borderRadius: 4,
            background: 'transparent',
            color: '#888',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
          }}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  )
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 2px',
  fontSize: 12,
  background: BG_PANEL,
  color: '#E8E8E8',
  outline: 'none',
  fontFamily: 'inherit',
  border: 'none',
  borderBottom: `1px solid #2A3340`,
}

const optionStyle: React.CSSProperties = { background: BG_PANEL, color: '#E8E8E8' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 0',
  fontSize: 12,
  background: 'transparent',
  color: '#E8E8E8',
  outline: 'none',
  fontFamily: 'inherit',
  border: 'none',
  borderBottom: `1px solid #2A3340`,
}
