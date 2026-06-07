import { TEXT_DIM } from '../../theme'

export interface FilterItem {
  key: string
  symbol: string
  color: string
  bg_color?: string
}

interface Props {
  filterKeys: string[]
  activeFilter: string | null
  items: FilterItem[]
  onSelect: (key: string | null) => void
}

export default function FilterBar({ filterKeys, activeFilter, items, onSelect }: Props) {
  const itemMap = new Map(items.map(t => [t.key, t]))

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '4px 8px',
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      <button
        onClick={() => onSelect(null)}
        style={{
          padding: '2px 8px',
          border: 'none',
          borderRadius: 10,
          background: activeFilter === null ? TEXT_DIM + '44' : TEXT_DIM + '18',
          color: TEXT_DIM,
          fontSize: 11,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          outline: activeFilter === null ? `1px solid ${TEXT_DIM}` : 'none',
        }}
      >
        All
      </button>
      {filterKeys.map(k => {
        const item = itemMap.get(k)
        const active = k === activeFilter
        const color = item?.color ?? TEXT_DIM
        const bg = item?.bg_color ?? (color + '28')
        return (
          <button
            key={k}
            onClick={() => onSelect(k)}
            style={{
              padding: '2px 8px',
              border: 'none',
              borderRadius: 10,
              background: bg,
              color: color,
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              outline: active ? `1px solid ${color}` : 'none',
              opacity: active ? 1 : 0.6,
            }}
          >
            {item ? `${item.symbol} ${k}` : k}
          </button>
        )
      })}
    </div>
  )
}
