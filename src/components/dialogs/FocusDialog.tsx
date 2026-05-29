import { useState, useEffect, useRef } from 'react'
import { BG_PANEL, BORDER_NORMAL, ACCENT_GREEN, ACCENT_GOLD, ACCENT_RED, TEXT_DIM, TEXT_PRIMARY, TEXT_SECONDARY } from '../../theme'
import { Overlay } from './ConfirmDialog'
import { api } from '../../lib/invoke'
import { elapsedSeconds, formatTimer } from '../../lib/format'
import type { FocusSession, SubTodo, Todo, TodoNote } from '../../types'

export type FocusOutcome = 'solved' | 'open' | 'blocked'

export interface FocusResult {
  action: 'end' | 'minimize'
  outcome?: FocusOutcome
  elapsed_s: number
  notes: string[]
}

interface Props {
  open: boolean
  todo: Todo | null
  session: FocusSession | null
  dbPath: string
  onClose: (result: FocusResult) => void
}

export default function FocusDialog({ open, todo, session, dbPath, onClose }: Props) {
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [pauseStart, setPauseStart] = useState<number | null>(null)
  const [pausedTotal, setPausedTotal] = useState(0)
  const [subTodos, setSubTodos] = useState<SubTodo[]>([])
  const [notes, setNotes] = useState<TodoNote[]>([])
  const [noteInput, setNoteInput] = useState('')
  const [subInput, setSubInput] = useState('')
  const noteRef = useRef<HTMLInputElement>(null)
  const subRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !todo || !dbPath) return
    Promise.all([
      api.subtodoListForTodo(dbPath, todo.id),
      api.noteListForTodo(dbPath, todo.id),
    ]).then(([subs, ns]) => {
      setSubTodos(subs)
      setNotes(ns)
    }).catch(console.error)
  }, [open, todo?.id, dbPath])

  useEffect(() => {
    if (!open || !session) return
    const id = setInterval(() => {
      if (!paused) {
        const base = elapsedSeconds(session.started_at)
        setElapsed(Math.max(0, base - pausedTotal))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [open, session, paused, pausedTotal])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleMinimize()
      if (e.key === 'p' || e.key === 'P') handlePauseToggle()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, paused, pauseStart, pausedTotal, elapsed])

  const handlePauseToggle = () => {
    if (!paused) {
      setPauseStart(Date.now())
      setPaused(true)
    } else {
      if (pauseStart) {
        setPausedTotal(prev => prev + Math.floor((Date.now() - pauseStart) / 1000))
      }
      setPauseStart(null)
      setPaused(false)
    }
  }

  const handleMinimize = () => {
    onClose({ action: 'minimize', elapsed_s: elapsed, notes: [] })
  }

  const handleEnd = (outcome: FocusOutcome) => {
    onClose({ action: 'end', outcome, elapsed_s: elapsed, notes: [] })
  }

  const handleAddNote = async () => {
    if (!noteInput.trim() || !todo || !session) return
    const note = await api.noteAdd(dbPath, todo.id, noteInput.trim(), session.id)
    setNotes(prev => [...prev, note])
    setNoteInput('')
  }

  const handleAddSub = async () => {
    if (!subInput.trim() || !todo) return
    const sub = await api.subtodoAdd(dbPath, todo.id, subInput.trim())
    setSubTodos(prev => [...prev, sub])
    setSubInput('')
  }

  const handleToggleSub = async (subtodoId: number) => {
    const updated = await api.subtodoToggle(dbPath, subtodoId)
    setSubTodos(prev => prev.map(s => s.id === subtodoId ? updated : s))
  }

  if (!open || !todo || !session) return null

  const timerColor = paused ? ACCENT_GOLD : ACCENT_GREEN

  return (
    <Overlay>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_NORMAL}`,
        borderRadius: 6,
        padding: 24,
        width: 480,
        maxHeight: '80vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Title */}
        <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>Focus Session</div>
        <div style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600 }}>{todo.title}</div>

        {/* Timer */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: timerColor, fontSize: 32, fontVariantNumeric: 'tabular-nums' }}>
            {formatTimer(elapsed)}
          </div>
        </div>

        {/* Pause button */}
        <div style={{ textAlign: 'center' }}>
          <button onClick={handlePauseToggle} style={{
            padding: '6px 20px',
            border: `1px solid ${timerColor}`,
            borderRadius: 4,
            background: timerColor + '22',
            color: timerColor,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
          }}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>

        {/* Sub-todos */}
        <div>
          <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>Sub-todos</div>
          {subTodos.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 0', cursor: 'pointer',
              color: s.done ? TEXT_DIM : TEXT_PRIMARY,
              textDecoration: s.done ? 'line-through' : 'none',
              fontSize: 12,
            }} onClick={() => handleToggleSub(s.id)}>
              <span style={{ color: s.done ? ACCENT_GREEN : TEXT_DIM }}>{s.done ? '✓' : '○'}</span>
              {s.title}
            </div>
          ))}
          <form onSubmit={e => { e.preventDefault(); handleAddSub() }}>
            <input
              ref={subRef}
              value={subInput}
              onChange={e => setSubInput(e.target.value)}
              placeholder="Add sub-todo…"
              style={{ ...inlineInputStyle, marginTop: 4 }}
            />
          </form>
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>Notes</div>
          {notes.slice(-8).map(n => (
            <div key={n.id} style={{ color: TEXT_SECONDARY, fontSize: 12, marginBottom: 2 }}>
              · {n.content}
            </div>
          ))}
          <form onSubmit={e => { e.preventDefault(); handleAddNote() }}>
            <input
              ref={noteRef}
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="Add note…"
              style={inlineInputStyle}
            />
          </form>
        </div>

        {/* Outcome buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => handleEnd('blocked')} style={outcomeBtn(ACCENT_RED, false)}>
            Blocked
          </button>
          <button onClick={() => handleEnd('open')} style={outcomeBtn(ACCENT_GOLD, false)}>
            Still open
          </button>
          <button onClick={() => handleEnd('solved')} style={outcomeBtn(ACCENT_GREEN, true)}>
            Solved
          </button>
          <button onClick={handleMinimize} style={{ ...outcomeBtn(TEXT_DIM, false), marginLeft: 'auto' }}>
            ← Minimize (Esc)
          </button>
        </div>
      </div>
    </Overlay>
  )
}

const inlineInputStyle: React.CSSProperties = {
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

function outcomeBtn(color: string, fill: boolean): React.CSSProperties {
  return {
    padding: '6px 14px',
    border: `1px solid ${color}`,
    borderRadius: 4,
    background: fill ? color : color + '22',
    color: fill ? '#000' : color,
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
  }
}
