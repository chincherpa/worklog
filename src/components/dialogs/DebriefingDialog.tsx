import { useState, useEffect } from 'react'
import { BG_PANEL, BORDER_NORMAL, BORDER_ACTIVE, ACCENT_GREEN, ACCENT_GOLD, ACCENT_RED, TEXT_DIM, TEXT_SECONDARY } from '../../theme'
import { Overlay } from './ConfirmDialog'
import { formatTimer } from '../../lib/format'
import type { Todo } from '../../types'

export type DebriefOutcome = 'solved' | 'open' | 'blocked'

export interface DebriefResult {
  outcome: DebriefOutcome
  log_entry: string
}

interface Props {
  open: boolean
  todo: Todo | null
  durationS: number
  initialOutcome?: DebriefOutcome
  onClose: (result: DebriefResult | null) => void
}

const OUTCOMES: { key: DebriefOutcome; label: string; color: string }[] = [
  { key: 'solved', label: 'Gelöst', color: ACCENT_GREEN },
  { key: 'open', label: 'Weiter offen', color: ACCENT_GOLD },
  { key: 'blocked', label: 'Blockiert', color: ACCENT_RED },
]

export default function DebriefingDialog({ open, todo, durationS, initialOutcome, onClose }: Props) {
  const [outcome, setOutcome] = useState<DebriefOutcome>(initialOutcome ?? 'open')
  const [logEntry, setLogEntry] = useState('')

  useEffect(() => {
    if (open) {
      setOutcome(initialOutcome ?? 'open')
      setLogEntry('')
    }
  }, [open, initialOutcome])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !todo) return null

  const canSave = logEntry.trim().length > 0

  return (
    <Overlay>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_NORMAL}`,
        borderRadius: 6,
        padding: 24,
        width: 460,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
          Session abgeschlossen · {todo.title.slice(0, 40)} · {formatTimer(durationS)}
        </div>

        {/* Outcome */}
        <div style={{ display: 'flex', gap: 8 }}>
          {OUTCOMES.map(o => (
            <button
              key={o.key}
              onClick={() => setOutcome(o.key)}
              style={{
                padding: '5px 12px',
                border: `1px solid ${o.color}`,
                borderRadius: 4,
                background: outcome === o.key ? o.color + '33' : 'transparent',
                color: o.color,
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Log entry */}
        <div>
          <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 6 }}>Eintrag fürs Tages-Log</div>
          <textarea
            autoFocus
            value={logEntry}
            onChange={e => setLogEntry(e.target.value)}
            rows={3}
            placeholder="Was hast du getan?"
            style={{
              width: '100%',
              resize: 'none',
              padding: '6px 8px',
              border: `1px solid ${BORDER_ACTIVE}`,
              borderRadius: 4,
              background: '#0E1117',
              color: '#E8E8E8',
              fontSize: 12,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(null)} style={btn(false)}>Ohne Eintrag</button>
          <button
            disabled={!canSave}
            onClick={() => canSave && onClose({ outcome, log_entry: logEntry.trim() })}
            style={btn(true, !canSave)}
          >
            Speichern
          </button>
        </div>
      </div>
    </Overlay>
  )
}

function btn(primary: boolean, disabled = false): React.CSSProperties {
  return {
    padding: '6px 16px',
    border: `1px solid ${primary ? BORDER_ACTIVE : BORDER_NORMAL}`,
    borderRadius: 4,
    background: primary && !disabled ? BORDER_ACTIVE + '22' : 'transparent',
    color: primary && !disabled ? BORDER_ACTIVE : '#888',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize: 12,
    fontFamily: 'inherit',
  }
}
