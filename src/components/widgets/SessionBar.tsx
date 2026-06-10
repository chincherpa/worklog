import React, { useEffect, useState } from 'react'
import { BG_SELECTED, ACCENT_GREEN, ACCENT_GOLD, ACCENT_RED, TEXT_DIM } from '../../theme'
import { PAUSE_NONE, formatTimer, pausedElapsedSeconds, type PauseState } from '../../lib/format'
import type { FocusSession } from '../../types'

interface Props {
  session: FocusSession
  title: string
  pause?: PauseState
  onPauseToggle?: () => void
  onStop?: () => void
}

export default function SessionBar({ session, title, pause = PAUSE_NONE, onPauseToggle, onStop }: Props) {
  const [elapsed, setElapsed] = useState(() => pausedElapsedSeconds(session.started_at, pause))

  useEffect(() => {
    setElapsed(pausedElapsedSeconds(session.started_at, pause))
    const id = setInterval(() => {
      setElapsed(pausedElapsedSeconds(session.started_at, pause))
    }, 1000)
    return () => clearInterval(id)
  }, [session.started_at, pause])

  const isPaused = pause.paused
  const color = isPaused ? ACCENT_GOLD : ACCENT_GREEN

  return (
    <div style={{
      background: BG_SELECTED,
      padding: '3px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color }}>
        {title}
      </span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums', fontSize: 12, flexShrink: 0 }}>
        {formatTimer(elapsed)}
      </span>
      <button
        onClick={onPauseToggle}
        disabled={!isPaused}
        title="Play"
        style={iconBtn(ACCENT_GREEN, !isPaused)}
      >▶</button>
      <button
        onClick={onPauseToggle}
        disabled={!!isPaused}
        title="Pause"
        style={iconBtn(ACCENT_GOLD, isPaused)}
      >⏸</button>
      <button
        onClick={onStop}
        title="Stop"
        style={iconBtn(ACCENT_RED, false)}
      >⏹</button>
    </div>
  )
}

function iconBtn(color: string, dimmed: boolean | undefined): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: dimmed ? TEXT_DIM : color,
    cursor: dimmed ? 'default' : 'pointer',
    fontSize: 11,
    padding: '1px 3px',
    fontFamily: 'inherit',
    lineHeight: 1,
    opacity: dimmed ? 0.4 : 1,
  }
}
