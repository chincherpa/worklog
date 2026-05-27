import { TEXT_DIM } from '../../theme'
import { formatDate } from '../../lib/format'

interface Props {
  date: string
}

export default function DateSeparator({ date }: Props) {
  const label = formatDate(date)
  return (
    <div style={{
      color: TEXT_DIM,
      fontSize: 11,
      padding: '4px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <span style={{ flex: 1, borderTop: `1px solid #2A3340` }} />
      <span>{label}</span>
      <span style={{ flex: 1, borderTop: `1px solid #2A3340` }} />
    </div>
  )
}
