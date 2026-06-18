import { useEffect, useRef, useState } from 'react'
import {
  BG_PANEL, BG_BASE, BG_SELECTED, BORDER_NORMAL, TEXT_PRIMARY, TEXT_SECONDARY,
  TEXT_DIM, ACCENT_BLUE, ACCENT_RED, ACCENT_GREEN, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_ICONS,
} from '../../theme'
import { Overlay } from './ConfirmDialog'
import { parseScheduled, toScheduledString, truncate } from '../../lib/format'
import { api } from '../../lib/invoke'
import type { Todo } from '../../types'

interface Props {
  open: boolean
  todos: Todo[]
  dbPath: string
  onClose: () => void
  onTodoChange: () => void
}

// Layout constants
const PX_PER_HOUR = 50
const DAY_WIDTH = 24 * PX_PER_HOUR
const ROW_HEIGHT = 30
const HEADER_H = 38
const BACKLOG_WIDTH = 210
const DAYS_VISIBLE = 8
const SNAP_MIN = 15
const SNAP_MS = SNAP_MIN * 60_000
const DEFAULT_MIN = 60
const MIN_DUR = 15

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
// Hours with up to 2 decimals, trailing zeros stripped (15-min steps: .25/.5/.75 exact).
const fmtDurH = (min: number) => `${(min / 60).toFixed(2).replace(/\.?0+$/, '')}h`
const snapMs = (ms: number) => Math.round(ms / SNAP_MS) * SNAP_MS
const minToPx = (min: number) => (min / 60) * PX_PER_HOUR
const pxToMs = (px: number) => (px / PX_PER_HOUR) * 3_600_000

// Live preview while dragging a bar (move or resize).
interface Preview { id: number; schedMs: number; durMin: number; mode: 'move' | 'resize' }
// Ghost bar while dragging a backlog todo onto the timeline.
interface Ghost { id: number; title: string; durMin: number; x: number; y: number; over: boolean }

export default function GanttDialog({ open, todos, dbPath, onClose, onTodoChange }: Props) {
  const [windowStart, setWindowStart] = useState<Date>(() => midnight(new Date()))
  const [preview, setPreview] = useState<Preview | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setWindowStart(midnight(new Date()))
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') shiftWindow(-1)
      else if (e.key === 'ArrowRight') shiftWindow(1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const startMs = windowStart.getTime()
  const totalWidth = DAYS_VISIBLE * DAY_WIDTH
  const xForMs = (ms: number) => ((ms - startMs) / 3_600_000) * PX_PER_HOUR

  const scheduled = todos
    .filter(t => t.scheduled_at && t.status !== 'cancelled' && t.status !== 'dropped')
    .sort((a, b) => parseScheduled(a.scheduled_at!).getTime() - parseScheduled(b.scheduled_at!).getTime())
  const backlog = todos.filter(
    t => !t.scheduled_at && t.status !== 'done' && t.status !== 'cancelled' && t.status !== 'dropped'
  )

  // Greedy lane packing: bars that don't overlap in time share a row.
  // Lane assignment uses committed times (not drag-preview) so rows stay stable while dragging.
  const laneEnds: number[] = []
  const laneOf = new Map<number, number>()
  for (const t of scheduled) {
    const s = parseScheduled(t.scheduled_at!).getTime()
    const e = s + (t.est_duration_min ?? DEFAULT_MIN) * 60_000
    let lane = laneEnds.findIndex(end => end <= s)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(e) } else laneEnds[lane] = e
    laneOf.set(t.id, lane)
  }
  const laneCount = Math.max(laneEnds.length, 1)

  function shiftWindow(days: number) {
    setWindowStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + days)
      return d
    })
  }

  // --- Move existing bar -> change scheduled_at ---
  function onBarMouseDown(e: React.MouseEvent, todo: Todo) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const origMs = parseScheduled(todo.scheduled_at!).getTime()
    const durMin = todo.est_duration_min ?? DEFAULT_MIN
    const onMove = (ev: MouseEvent) => {
      const newMs = snapMs(origMs + pxToMs(ev.clientX - startX))
      setPreview({ id: todo.id, schedMs: newMs, durMin, mode: 'move' })
    }
    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const newMs = snapMs(origMs + pxToMs(ev.clientX - startX))
      setPreview(null)
      if (newMs !== origMs) {
        try {
          await api.todoUpdate(dbPath, todo.id, undefined, undefined, undefined, toScheduledString(new Date(newMs)))
          onTodoChange()
        } catch (err) { console.error(err) }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Resize right edge -> change est_duration_min ---
  function onResizeMouseDown(e: React.MouseEvent, todo: Todo) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const schedMs = parseScheduled(todo.scheduled_at!).getTime()
    const origDur = todo.est_duration_min ?? DEFAULT_MIN
    const snapDur = (m: number) => Math.max(MIN_DUR, Math.round(m / SNAP_MIN) * SNAP_MIN)
    const onMove = (ev: MouseEvent) => {
      const newDur = snapDur(origDur + (pxToMs(ev.clientX - startX) / 60_000))
      setPreview({ id: todo.id, schedMs, durMin: newDur, mode: 'resize' })
    }
    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const newDur = snapDur(origDur + (pxToMs(ev.clientX - startX) / 60_000))
      setPreview(null)
      if (newDur !== origDur) {
        try {
          await api.todoUpdate(dbPath, todo.id, undefined, undefined, undefined, undefined, newDur)
          onTodoChange()
        } catch (err) { console.error(err) }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // --- Drag backlog todo onto the timeline -> set scheduled_at + default duration ---
  function onBacklogMouseDown(e: React.MouseEvent, todo: Todo) {
    e.preventDefault()
    const durMin = todo.est_duration_min ?? DEFAULT_MIN
    const inside = (ev: MouseEvent) => {
      const r = timelineRef.current?.getBoundingClientRect()
      return !!r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
    }
    setGhost({ id: todo.id, title: todo.title, durMin, x: e.clientX, y: e.clientY, over: false })
    const onMove = (ev: MouseEvent) => {
      setGhost({ id: todo.id, title: todo.title, durMin, x: ev.clientX, y: ev.clientY, over: inside(ev) })
    }
    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      const el = timelineRef.current
      const r = el?.getBoundingClientRect()
      setGhost(null)
      if (el && r && inside(ev)) {
        const contentX = ev.clientX - r.left + el.scrollLeft
        const ms = snapMs(startMs + pxToMs(contentX))
        try {
          await api.todoUpdate(dbPath, todo.id, undefined, undefined, undefined, toScheduledString(new Date(ms)), durMin)
          onTodoChange()
        } catch (err) { console.error(err) }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const nowMs = Date.now()
  const nowX = xForMs(nowMs)
  const showNow = nowMs >= startMs && nowMs <= startMs + DAYS_VISIBLE * 86_400_000

  return (
    <Overlay>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_NORMAL}`,
        borderRadius: 6,
        width: '90vw',
        maxWidth: 1200,
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderBottom: `1px solid ${BORDER_NORMAL}`,
        }}>
          <div style={{ fontSize: 14, color: TEXT_PRIMARY, fontWeight: 600 }}>📅 Schedule</div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => shiftWindow(-1)} style={navBtn}>‹</button>
            <button onClick={() => setWindowStart(midnight(new Date()))} style={navBtn}>today</button>
            <button onClick={() => shiftWindow(1)} style={navBtn}>›</button>
          </div>
          <div style={{ fontSize: 10, color: TEXT_DIM }}>
            Drag bar = time · right edge = duration · drag backlog = schedule · 15-min grid
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={navBtn}>Close (Esc)</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Backlog */}
          <div style={{
            width: BACKLOG_WIDTH, flexShrink: 0, borderRight: `1px solid ${BORDER_NORMAL}`,
            display: 'flex', flexDirection: 'column', minHeight: 0,
          }}>
            <div style={{ padding: '8px 10px', fontSize: 11, color: TEXT_SECONDARY, borderBottom: `1px solid ${BORDER_NORMAL}` }}>
              Backlog · {backlog.length} unscheduled
            </div>
            <div className="scroll-container" style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
              {backlog.length === 0 && (
                <div style={{ color: TEXT_DIM, fontSize: 11, padding: 6 }}>(all todos scheduled)</div>
              )}
              {backlog.map(t => (
                <div
                  key={t.id}
                  onMouseDown={e => onBacklogMouseDown(e, t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 8px', marginBottom: 4, fontSize: 12,
                    background: BG_SELECTED, borderRadius: 4, cursor: 'grab',
                    color: TEXT_PRIMARY, userSelect: 'none',
                  }}
                  title={t.title}
                >
                  <span style={{ color: PRIORITY_COLORS[t.priority] ?? TEXT_DIM, fontSize: 10 }}>
                    {PRIORITY_ICONS[t.priority] ?? '●'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div ref={timelineRef} className="scroll-container" style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            <div style={{ width: totalWidth, position: 'relative' }}>
              {/* Header: day columns + hour ticks */}
              <div style={{ height: HEADER_H, position: 'relative', borderBottom: `1px solid ${BORDER_NORMAL}` }}>
                {Array.from({ length: DAYS_VISIBLE }).map((_, i) => {
                  const d = new Date(startMs + i * 86_400_000)
                  const isToday = midnight(d).getTime() === midnight(new Date()).getTime()
                  return (
                    <div key={i} style={{
                      position: 'absolute', left: i * DAY_WIDTH, top: 0, width: DAY_WIDTH, height: '100%',
                      borderLeft: `1px solid ${BORDER_NORMAL}`,
                      background: isToday ? 'rgba(91,141,239,0.07)' : 'transparent',
                      padding: '4px 6px', boxSizing: 'border-box',
                    }}>
                      <div style={{ fontSize: 11, color: isToday ? ACCENT_BLUE : TEXT_SECONDARY, fontWeight: 600 }}>
                        {WEEKDAYS[d.getDay()]} {String(d.getDate()).padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}
                      </div>
                      <div style={{ display: 'flex', position: 'relative', height: 12, marginTop: 2 }}>
                        {[6, 12, 18].map(h => (
                          <span key={h} style={{
                            position: 'absolute', left: h * PX_PER_HOUR, fontSize: 9, color: TEXT_DIM,
                          }}>
                            {h}h
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Rows area */}
              <div style={{ position: 'relative', height: Math.max(laneCount * ROW_HEIGHT + 12, 120) }}>
                {/* Day separators (full height) */}
                {Array.from({ length: DAYS_VISIBLE + 1 }).map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: i * DAY_WIDTH, top: 0, bottom: 0, width: 1,
                    background: BORDER_NORMAL,
                  }} />
                ))}
                {/* Now line */}
                {showNow && (
                  <div style={{ position: 'absolute', left: nowX, top: 0, bottom: 0, width: 2, background: ACCENT_RED, opacity: 0.7 }} />
                )}

                {/* Bars */}
                {scheduled.map((t) => {
                  const isDone = t.status === 'done'
                  const lane = laneOf.get(t.id) ?? 0
                  const usePrev = preview?.id === t.id
                  const ms = usePrev ? preview!.schedMs : parseScheduled(t.scheduled_at!).getTime()
                  const dur = usePrev ? preview!.durMin : (t.est_duration_min ?? DEFAULT_MIN)
                  const left = xForMs(ms)
                  const width = Math.max(minToPx(dur), 14)
                  const overdue = !isDone && ms < nowMs
                  const color = STATUS_COLORS[t.status] ?? '#C8C8C8'
                  const isHigh = t.priority === 'high'
                  // Done todos: green hatched. High-priority (open) bars get a faint red tint.
                  const background = isDone
                    ? `repeating-linear-gradient(45deg, ${ACCENT_GREEN} 0 5px, rgba(76,175,80,0.35) 5px 10px)`
                    : isHigh
                      ? `linear-gradient(0deg, rgba(255,107,107,0.32), rgba(255,107,107,0.32)), ${color}`
                      : color
                  return (
                    <div
                      key={t.id}
                      onMouseDown={isDone ? undefined : e => onBarMouseDown(e, t)}
                      title={`${t.title} · ${toScheduledString(new Date(ms)).slice(0, 16)} · ${fmtDurH(dur)}${isDone ? ' · done' : ''}`}
                      style={{
                        position: 'absolute', top: lane * ROW_HEIGHT + 4, left, width, height: ROW_HEIGHT - 8,
                        background, borderRadius: 4, cursor: isDone ? 'default' : 'grab',
                        border: overdue ? `2px solid ${ACCENT_RED}` : `1px solid rgba(0,0,0,0.3)`,
                        display: 'flex', alignItems: 'center', padding: '0 6px',
                        boxSizing: 'border-box', userSelect: 'none', overflow: 'hidden',
                        opacity: usePrev ? 0.85 : 1,
                      }}
                    >
                      <span style={{
                        fontSize: 11, color: BG_BASE, fontWeight: 600, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        textShadow: isDone ? '0 0 3px rgba(255,255,255,0.6)' : 'none',
                      }}>
                        {isDone ? '✓ ' : ''}{truncate(t.title, 28)} · {fmtDurH(dur)}
                      </span>
                      {/* Resize handle (not on done bars) */}
                      {!isDone && (
                        <div
                          onMouseDown={e => onResizeMouseDown(e, t)}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize' }}
                        />
                      )}
                    </div>
                  )
                })}

                {/* Duration badge while resizing — stays readable even if the title overflows the bar. */}
                {preview?.mode === 'resize' && (() => {
                  const lane = laneOf.get(preview.id) ?? 0
                  const left = xForMs(preview.schedMs) + Math.max(minToPx(preview.durMin), 14)
                  return (
                    <div style={{
                      position: 'absolute', left: left + 6, top: lane * ROW_HEIGHT + 3,
                      background: ACCENT_BLUE, color: BG_BASE, fontSize: 11, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                      pointerEvents: 'none', zIndex: 20,
                    }}>
                      {fmtDurH(preview.durMin)}
                    </div>
                  )
                })()}

                {scheduled.length === 0 && (
                  <div style={{ position: 'absolute', left: 16, top: 16, color: TEXT_DIM, fontSize: 12 }}>
                    No scheduled todos in this window. Drag a todo from the backlog here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating ghost while dragging from backlog */}
      {ghost && (
        <div style={{
          position: 'fixed', left: ghost.x + 8, top: ghost.y + 8, pointerEvents: 'none', zIndex: 1000,
          background: ghost.over ? ACCENT_BLUE : BG_SELECTED, color: ghost.over ? BG_BASE : TEXT_PRIMARY,
          padding: '4px 8px', borderRadius: 4, fontSize: 11, border: `1px solid ${BORDER_NORMAL}`,
          maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {ghost.over ? '📌 ' : ''}{truncate(ghost.title, 28)}
        </div>
      )}
    </Overlay>
  )
}

const navBtn: React.CSSProperties = {
  padding: '4px 10px',
  border: `1px solid ${BORDER_NORMAL}`,
  borderRadius: 4,
  background: 'transparent',
  color: TEXT_SECONDARY,
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
}
