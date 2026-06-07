import { useRef, useEffect, useCallback, useState } from 'react'
import { BG_PANEL, BORDER_NORMAL, BORDER_ACTIVE, TEXT_DIM, TEXT_SECONDARY } from '../../theme'
import LogEntryRow from '../widgets/LogEntryRow'
import DateSeparator from '../widgets/DateSeparator'
import FilterBar from '../widgets/FilterBar'
import type { LogEntry, Project, Tag } from '../../types'

interface Props {
  logEntries: LogEntry[]
  filterKeys: string[]
  logFilter: string | null
  projectFilterKeys: string[]
  projectFilter: string | null
  onProjectFilterChange: (key: string | null) => void
  displayedEntryId: number | null
  tags: Tag[]
  tagIdx: number
  onTagChange: (idx: number) => void
  projects: Project[]
  projectIdx: number
  onProjectChange: (idx: number) => void
  isActive: boolean
  inputFocused: boolean
  onEntrySelect: (id: number) => void
  onLogSubmit: (text: string) => Promise<void>
  onFilterChange: (key: string | null) => void
  onInputFocus: (focused: boolean) => void
  onOpenHelp: () => void
  focusInputRef: React.MutableRefObject<(() => void) | null>
  style?: React.CSSProperties
}

export default function LogPanel({
  logEntries, filterKeys, logFilter, projectFilterKeys, projectFilter, onProjectFilterChange, displayedEntryId,
  tags, tagIdx, onTagChange,
  projects, projectIdx, onProjectChange,
  isActive, inputFocused,
  onEntrySelect, onLogSubmit, onFilterChange, onInputFocus, onOpenHelp,
  focusInputRef, style,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tagMap = new Map(tags.map(t => [t.key, t]))
  const projectMap = new Map(projects.map(p => [p.key, p]))

  const today = new Date().toISOString().slice(0, 10)
  const todayEntries = logEntries.filter(e => e.date === today)

  const filtered = logEntries.filter(e =>
    (!logFilter || e.tag_key === logFilter) &&
    (!projectFilter || e.project === projectFilter)
  )

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

  const [tagDropOpen, setTagDropOpen] = useState(false)
  const tagDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tagDropOpen) return
    const handler = (e: MouseEvent) => {
      if (!tagDropRef.current?.contains(e.target as Node)) setTagDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tagDropOpen])

  const [projectDropOpen, setProjectDropOpen] = useState(false)
  const projectDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!projectDropOpen) return
    const handler = (e: MouseEvent) => {
      if (!projectDropRef.current?.contains(e.target as Node)) setProjectDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [projectDropOpen])

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

  const titleDate = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: BG_PANEL,
      border: `${isActive ? 2 : 1}px solid ${isActive ? BORDER_ACTIVE : BORDER_NORMAL}`,
      borderRadius: 4,
      overflow: 'hidden',
      flex: '1',
      minWidth: 0,
      ...style,
    }}>
      {/* Title */}
      <div style={{
        padding: '6px 10px',
        borderBottom: `1px solid ${BORDER_NORMAL}`,
        fontSize: 12,
        color: TEXT_SECONDARY,
        flexShrink: 0,
      }}>
        📋 LOG · {titleDate} · {todayEntries.length} entries today
      </div>

      {/* Filter bars */}
      {projectFilterKeys.length > 0 && (
        <FilterBar
          filterKeys={projectFilterKeys}
          activeFilter={projectFilter}
          items={projects}
          onSelect={onProjectFilterChange}
        />
      )}
      {filterKeys.length > 0 && (
        <FilterBar
          filterKeys={filterKeys}
          activeFilter={logFilter}
          items={tags}
          onSelect={onFilterChange}
        />
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
                project={projectMap.get(e.project)}
                selected={e.id === displayedEntryId}
                onClick={() => onEntrySelect(e.id)}
              />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: TEXT_DIM, fontSize: 11, padding: '12px 10px', textAlign: 'center' }}>
            No entries
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
        {projects.length > 1 && (
          <div ref={projectDropRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setProjectDropOpen(v => !v)}
              style={{
                color: projects[projectIdx]?.color ?? 'inherit',
                background: projects[projectIdx]?.bg_color ?? ((projects[projectIdx]?.color ?? '#888') + '28'),
                fontSize: 11,
                padding: '2px 8px',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {projects[projectIdx]?.symbol} {projects[projectIdx]?.key} ▾
            </button>
            {projectDropOpen && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                background: BG_PANEL,
                border: `1px solid ${BORDER_NORMAL}`,
                borderRadius: 4,
                marginBottom: 4,
                zIndex: 100,
                minWidth: 130,
                overflow: 'hidden',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}>
                {projects.map((p, i) => (
                  <div
                    key={p.key}
                    onMouseDown={() => { onProjectChange(i); setProjectDropOpen(false) }}
                    style={{
                      color: p.color,
                      background: p.bg_color ?? (p.color + '28'),
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      outline: i === projectIdx ? `1px solid ${p.color}` : 'none',
                    }}
                  >
                    {p.symbol} {p.key}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tags.length > 0 && (
          <div ref={tagDropRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setTagDropOpen(v => !v)}
              style={{
                color: tags[tagIdx]?.color ?? 'inherit',
                background: tags[tagIdx]?.bg_color ?? ((tags[tagIdx]?.color ?? '#888') + '28'),
                fontSize: 11,
                padding: '2px 8px',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {tags[tagIdx]?.symbol} {tags[tagIdx]?.key} ▾
            </button>
            {tagDropOpen && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                background: BG_PANEL,
                border: `1px solid ${BORDER_NORMAL}`,
                borderRadius: 4,
                marginBottom: 4,
                zIndex: 100,
                minWidth: 120,
                overflow: 'hidden',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}>
                {tags.map((t, i) => (
                  <div
                    key={t.key}
                    onMouseDown={() => { onTagChange(i); setTagDropOpen(false) }}
                    style={{
                      color: t.color,
                      background: t.bg_color ?? (t.color + '28'),
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      outline: i === tagIdx ? `1px solid ${t.color}` : 'none',
                    }}
                  >
                    {t.symbol} {t.key}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          placeholder="Entry…"
          onFocus={() => onInputFocus(true)}
          onBlur={() => onInputFocus(false)}
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
          ⌨ Shortcuts
        </button>
      </div>
    </div>
  )
}
