import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react'
import { api } from '../../lib/invoke'
import {
  ACCENT_BLUE,
  BG_PANEL,
  BG_SELECTED,
  BORDER_ACTIVE,
  BORDER_NORMAL,
  TEXT_DIM,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../theme'
import type { SearchHit, SearchHitKind } from '../../types'

interface Props {
  dbPath: string
  searchInputRef: MutableRefObject<(() => void) | null>
  onSelect: (hit: SearchHit) => void
  style?: CSSProperties
}

const KIND_ICON: Record<SearchHitKind, string> = {
  log: '📄',
  todo: '☐',
  note: '🗒️',
  subtodo: '↳',
}

const KIND_LABEL: Record<SearchHitKind, string> = {
  log: 'Log',
  todo: 'Todo',
  note: 'Note',
  subtodo: 'Subtask',
}

export default function GlobalSearchBar({ dbPath, searchInputRef, onSelect, style }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Expose focus() to the parent so Ctrl+F can drive the cursor here.
  useEffect(() => {
    searchInputRef.current = () => inputRef.current?.focus()
    return () => { searchInputRef.current = null }
  }, [searchInputRef])

  // Debounced live search on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q || !dbPath) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const hits = await api.globalSearch(dbPath, q, 8)
        setResults(hits)
        setHighlight(0)
        setOpen(hits.length > 0)
      } catch {
        setResults([])
        setOpen(false)
      }
    }, 150)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, dbPath])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  const select = useCallback((hit: SearchHit) => {
    onSelect(hit)
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.blur()
  }, [onSelect])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (query) {
        setQuery('')
        setResults([])
        setOpen(false)
      } else {
        inputRef.current?.blur()
      }
      return
    }
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => (h + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => (h - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = results[highlight]
      if (hit) select(hit)
    }
  }, [open, results, highlight, query, select])

  return (
    <div style={{ position: 'relative', flexShrink: 0, ...style }}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        onBlur={() => setTimeout(close, 120)}
        placeholder="🔍 Search… (Ctrl+F)"
        spellCheck={false}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: BG_PANEL,
          border: `1px solid ${BORDER_NORMAL}`,
          borderRadius: 4,
          color: TEXT_PRIMARY,
          fontFamily: 'inherit',
          fontSize: 13,
          padding: '6px 10px',
          outline: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = BORDER_ACTIVE }}
        onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = BORDER_NORMAL }}
      />

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: BG_PANEL,
          border: `1px solid ${BORDER_ACTIVE}`,
          borderRadius: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 600,
          maxHeight: '60vh',
          overflowY: 'auto',
        }}>
          {results.map((hit, i) => (
            <div
              key={`${hit.kind}-${hit.id}`}
              // onMouseDown (not onClick) so it fires before the input's blur.
              onMouseDown={e => { e.preventDefault(); select(hit) }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                background: i === highlight ? BG_SELECTED : 'transparent',
                borderLeft: `2px solid ${i === highlight ? ACCENT_BLUE : 'transparent'}`,
              }}
            >
              <span style={{ fontSize: 12, flexShrink: 0 }} title={KIND_LABEL[hit.kind]}>
                {KIND_ICON[hit.kind]}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{
                  color: TEXT_PRIMARY,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {hit.title || '(empty)'}
                </span>
                {hit.snippet && hit.snippet !== hit.title && (
                  <span style={{
                    color: TEXT_SECONDARY,
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {hit.snippet}
                  </span>
                )}
              </span>
              <span style={{ color: TEXT_DIM, fontSize: 10, flexShrink: 0 }}>
                {KIND_LABEL[hit.kind]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
