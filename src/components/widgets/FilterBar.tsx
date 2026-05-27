import { TEXT_DIM, BORDER_NORMAL } from '../../theme'
import type { Tag } from '../../types'

interface Props {
  filterKeys: string[]
  activeFilter: string | null
  tags: Tag[]
  onSelect: (key: string | null) => void
}

export default function FilterBar({ filterKeys, activeFilter, tags, onSelect }: Props) {
  const tagMap = new Map(tags.map(t => [t.key, t]))

  const chips = [
    { key: null, label: 'Alle', color: TEXT_DIM },
    ...filterKeys.map(k => {
      const tag = tagMap.get(k)
      return { key: k, label: tag ? `${tag.symbol} ${k}` : k, color: tag?.color ?? TEXT_DIM }
    }),
  ]

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '4px 8px',
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      {chips.map(c => {
        const active = c.key === activeFilter
        return (
          <button
            key={String(c.key)}
            onClick={() => onSelect(c.key)}
            style={{
              padding: '2px 8px',
              border: `1px solid ${active ? c.color : BORDER_NORMAL}`,
              borderRadius: 3,
              background: active ? c.color + '33' : 'transparent',
              color: active ? c.color : TEXT_DIM,
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
