import { useEffect, useState } from 'react'
import { BG_SELECTED, ACCENT_GREEN } from '../../theme'
import { elapsedSeconds, formatTimer } from '../../lib/format'
import type { FocusSession } from '../../types'

interface Props {
  session: FocusSession
  title: string
}

export default function SessionBar({ session, title }: Props) {
  const [elapsed, setElapsed] = useState(() => elapsedSeconds(session.started_at))

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(elapsedSeconds(session.started_at))
    }, 1000)
    return () => clearInterval(id)
  }, [session.started_at])

  return (
    <div style={{
      background: BG_SELECTED,
      padding: '4px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    }}>
      <span style={{ color: ACCENT_GREEN }}>▶</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
        {title}
      </span>
      <span style={{ color: ACCENT_GREEN, fontVariantNumeric: 'tabular-nums', fontSize: 12, flexShrink: 0 }}>
        {formatTimer(elapsed)}
      </span>
    </div>
  )
}
