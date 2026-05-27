import { useRef, useEffect, useCallback } from 'react'
import { BG_PANEL, BORDER_NORMAL, BORDER_ACTIVE, TEXT_DIM, TEXT_SECONDARY, ACCENT_GOLD } from '../../theme'
import LogEntryRow from '../widgets/LogEntryRow'
import DateSeparator from '../widgets/DateSeparator'
import FilterBar from '../widgets/FilterBar'
import type { AppConfig, LogEntry, Tag } from '../../types'

interface Props {
  logEntries: LogEntry[]
  filterKeys: string[]
  logFilter: string | null
  displayedEntryId: number | null
  carryOver: LogEntry[]
  currentTag: Tag | null
  config: AppConfig | null
  isActive: boolean
  inputFocused: boolean
  onEntrySelect: (id: number) => void
  onLogSubmit: (text: string) => Promise<void>
  onFilterChange: (key: string | null) => void
  onInputFocus: (focused: boolean) => void
  onOpenHelp: () => void
  focusInputRef: React.MutableRefObject<(() => void) | null>
}

export default function LogPanel({
  logEntries, filterKeys, logFilter, displayedEntryId, carryOver,
  currentTag, config, isActive, inputFocused,
  onEntrySelect, onLogSubmit, onFilterChange, onInputFocus, onOpenHelp,
  focusInputRef,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tags = config?.tags ?? []
  const tagMap = new Map(tags.map(t => [t.key, t]))

  const today = new Date().toISOString().slice(0, 10)
  const todayEntries = logEntries.filter(e => e.date === today)

  const filtered = logFilter
    ? logEntries.filter(e => e.tag_key === logFilter)
    : logEntries

  // Group by date
  const grouped: { date: string; entries: LogEntry[] }[] = []
  for (const entry of filtered) {
    const last = grouped[grouped.length - 1]
    if (!last || last.date !== entry.date) {
      grouped.push({ date: entry.date, entries: [entry] })
    } else {
      last.entries.push(entry)
    }
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      // cycle tag - handled by parent via callback
    }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const input = inputRef.current
    if (!input || !input.value.trim()) return
    const text = input.value.trim()
    input.value = ''
    await onLogSubmit(text)
  }, [onLogSubmit])

  // Expose focus method to parent
  useEffect(() => {
    focusInputRef.current = () => inputRef.current?.focus()
  }, [focusInputRef])

  const titleDate = new Date().toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: BG_PANEL,
      border: `${isActive ? 2 : 1}px solid ${isActive ? BORDER_ACTIVE : BORDER_NORMAL}`,
      borderRadius: 4,
      overflow: 'hidden',
      flex: '1.2',
      minWidth: 0,
    }}>
      {/* Title */}
      <div style={{
        padding: '6px 10px',
        borderBottom: `1px solid ${BORDER_NORMAL}`,
        fontSize: 12,
        color: TEXT_SECONDARY,
        flexShrink: 0,
      }}>
        📋 LOG · {titleDate} · {todayEntries.length} Einträge heute
      </div>

      {/* Filter bar */}
      {filterKeys.length > 0 && (
        <FilterBar
          filterKeys={filterKeys}
          activeFilter={logFilter}
          tags={tags}
          onSelect={onFilterChange}
        />
      )}

      {/* Carry-over */}
      {carryOver.length > 0 && (
        <div style={{
          padding: '4px 10px',
          color: ACCENT_GOLD,
          fontSize: 11,
          borderBottom: `1px solid ${BORDER_NORMAL}`,
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          ↩ {carryOver.slice(0, 3).map(e => e.content.split('\n')[0].slice(0, 48)).join(' · ')}
        </div>
      )}

      {/* Entry list */}
      <div className="scroll-container" style={{ flex: 1, overflowY: 'auto' }}>
        {grouped.map(g => (
          <div key={g.date}>
            <DateSeparator date={g.date} />
            {g.entries.map(e => (
              <LogEntryRow
                key={e.id}
                entry={e}
                tag={tagMap.get(e.tag_key)}
                selected={e.id === displayedEntryId}
                onClick={() => onEntrySelect(e.id)}
              />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: TEXT_DIM, fontSize: 11, padding: '12px 10px', textAlign: 'center' }}>
            Keine Einträge
          </div>
        )}
      </div>

      {/* Input row */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderTop: `1px solid ${BORDER_NORMAL}`,
        flexShrink: 0,
      }}>
        {currentTag && (
          <span style={{
            color: currentTag.color,
            fontSize: 11,
            padding: '2px 6px',
            border: `1px solid ${currentTag.color}55`,
            borderRadius: 3,
            flexShrink: 0,
          }}>
            {currentTag.symbol} {currentTag.key}
          </span>
        )}
        <input
          ref={inputRef}
          placeholder="Eintrag… (Shift+Tab = Tag wechseln)"
          onFocus={() => onInputFocus(true)}
          onBlur={() => onInputFocus(false)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: '4px 0',
            fontSize: 12,
            borderBottom: `1px solid ${inputFocused ? BORDER_ACTIVE : BORDER_NORMAL}`,
            transition: 'border-color 0.15s',
          }}
        />
      </form>

      {/* Help link */}
      <div style={{
        padding: '3px 10px',
        borderTop: `1px solid ${BORDER_NORMAL}`,
        flexShrink: 0,
      }}>
        <button
          onClick={onOpenHelp}
          style={{
            background: 'transparent',
            border: 'none',
            color: TEXT_DIM,
            fontSize: 10,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ⌨ Tastenkürzel
        </button>
      </div>
    </div>
  )
}
