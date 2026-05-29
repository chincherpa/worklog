import { useState, useEffect } from 'react'
import { BG_PANEL, BORDER_NORMAL, TEXT_DIM, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT_BLUE } from '../../theme'
import { Overlay } from './ConfirmDialog'
import { api } from '../../lib/invoke'
import { formatDuration, isoWeek } from '../../lib/format'
import type { Todo, WeekSummary } from '../../types'

interface Props {
  open: boolean
  dbPath: string
  todos: Todo[]
  onClose: () => void
}

export default function WeeklyReviewDialog({ open, dbPath, todos, onClose }: Props) {
  const [week, setWeek] = useState(() => isoWeek())
  const [summary, setSummary] = useState<WeekSummary | null>(null)

  useEffect(() => {
    if (!open || !dbPath) return
    api.weekSummary(dbPath, week).then(setSummary).catch(console.error)
  }, [open, dbPath, week])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const [yearStr, weekStr] = week.split('-W')
  const weekNum = parseInt(weekStr)

  const navWeek = (dir: 1 | -1) => {
    const y = parseInt(yearStr)
    let w = weekNum + dir
    if (w < 1) { setWeek(`${y - 1}-W52`); return }
    if (w > 52) { setWeek(`${y + 1}-W01`); return }
    setWeek(`${y}-W${String(w).padStart(2, '0')}`)
  }

  const doneTodos = todos.filter(t => t.status === 'done')

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
        {/* Week navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navWeek(-1)} style={navBtn}>‹</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: TEXT_PRIMARY }}>
            CW {weekNum} · {week}
          </div>
          <button onClick={() => navWeek(1)} style={navBtn}>›</button>
        </div>

        {summary ? (
          <>
            {/* Metrics */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Metric label="Work days" value={String(summary.work_days)} />
              <Metric label="Focus" value={formatDuration(summary.focus_total_s)} />
              {summary.avg_energy !== null && (
                <Metric label="Avg energy" value={`${summary.avg_energy.toFixed(1)}/5`} />
              )}
              <Metric label="Open blocks" value={String(summary.open_blocks)} />
            </div>

            {/* Top tags */}
            {summary.top_tags.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>Top Tags</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {summary.top_tags.map(([tag, count]) => (
                    <span key={tag} style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      border: `1px solid ${BORDER_NORMAL}`,
                      borderRadius: 12,
                      color: TEXT_SECONDARY,
                    }}>
                      {tag} × {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Day ratings */}
            {summary.day_ratings.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 4 }}>Day ratings</div>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                  {summary.day_ratings.join(' · ')}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: TEXT_DIM, fontSize: 11, textAlign: 'center' }}>Loading…</div>
        )}

        {/* Done todos */}
        {doneTodos.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>Completed this week</div>
            {doneTodos.slice(0, 10).map(t => (
              <div key={t.id} style={{ fontSize: 12, color: TEXT_SECONDARY, padding: '2px 0' }}>
                ✓ {t.title}
              </div>
            ))}
          </div>
        )}

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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, color: ACCENT_BLUE, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10, color: TEXT_DIM }}>{label}</div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid #2A3340`,
  borderRadius: 4,
  color: '#888',
  cursor: 'pointer',
  fontSize: 16,
  padding: '2px 10px',
  fontFamily: 'inherit',
}
