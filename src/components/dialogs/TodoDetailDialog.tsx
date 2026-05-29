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
}

export default function TodoDetailDialog({ open, todo, dbPath, onClose }: Props) {
  const [subTodos, setSubTodos] = useState<SubTodo[]>([])
  const [notes, setNotes] = useState<TodoNote[]>([])
  const [subInput, setSubInput] = useState('')
  const [noteInput, setNoteInput] = useState('')

  useEffect(() => {
    if (!open || !todo) return
    Promise.all([
      api.subtodoListForTodo(dbPath, todo.id),
      api.noteListForTodo(dbPath, todo.id),
    ]).then(([subs, ns]) => {
      setSubTodos(subs)
      setNotes(ns.slice(-12))
    }).catch(console.error)
  }, [open, todo?.id, dbPath])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !todo) return null

  const handleToggleSub = async (id: number) => {
    const updated = await api.subtodoToggle(dbPath, id)
    setSubTodos(prev => prev.map(s => s.id === id ? updated : s))
  }

  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subInput.trim()) return
    const sub = await api.subtodoAdd(dbPath, todo.id, subInput.trim())
    setSubTodos(prev => [...prev, sub])
    setSubInput('')
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
          <button onClick={onClose} style={{
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
