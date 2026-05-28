import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import {
  BG_PANEL, BG_SELECTED, BORDER_NORMAL,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM, ACCENT_RED,
} from '../../theme'
import { Overlay } from './ConfirmDialog'
import type { Tag } from '../../types'

const PRESET_COLORS = [
  '#F03E3E', '#FF6B6B', '#FFD93D', '#94D82D', '#00C896',
  '#339AF0', '#5B8DEF', '#C77DFF', '#FF922B', '#CED4DA',
  '#D0D0D0', '#F9C74F',
]

interface TagDraft {
  key: string
  symbol: string
  name: string
  color: string
  category: string
  active: boolean
}

interface Props {
  open: boolean
  tags: Tag[]
  onSave: (tags: Tag[]) => void
  onClose: () => void
}

export default function ConfigDialog({ open, tags: initialTags, onSave, onClose }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<TagDraft | null>(null)
  const [isNewTag, setIsNewTag] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setTags([...initialTags])
      setSelectedIdx(0)
      setEditingIdx(null)
      setDraft(null)
      setIsNewTag(false)
      setConfirmDelete(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = useCallback((idx: number, currentTags: Tag[]) => {
    setDraft({ ...currentTags[idx] })
    setEditingIdx(idx)
    setIsNewTag(false)
    setConfirmDelete(false)
  }, [])

  const startAdd = useCallback((currentLength: number) => {
    const blank: TagDraft = { key: '', symbol: '', name: '', color: '#CED4DA', category: 'work', active: true }
    setTags(prev => [...prev, blank as Tag])
    setSelectedIdx(currentLength)
    setDraft(blank)
    setEditingIdx(currentLength)
    setIsNewTag(true)
    setConfirmDelete(false)
  }, [])

  const commitDraft = useCallback((currentDraft: TagDraft, idx: number) => {
    if (!currentDraft.key.trim() || !currentDraft.name.trim()) return
    setTags(prev => {
      const next = [...prev]
      next[idx] = currentDraft as Tag
      return next
    })
    setEditingIdx(null)
    setDraft(null)
    setIsNewTag(false)
  }, [])

  const cancelDraft = useCallback((wasNew: boolean) => {
    if (wasNew) {
      setTags(prev => prev.slice(0, -1))
      setSelectedIdx(prev => Math.max(0, prev - 1))
    }
    setEditingIdx(null)
    setDraft(null)
    setIsNewTag(false)
  }, [])

  const deleteSelected = useCallback((idx: number) => {
    setTags(prev => prev.filter((_, i) => i !== idx))
    setSelectedIdx(Math.max(0, idx - 1))
    setConfirmDelete(false)
  }, [])

  // List keyboard handler (active when not editing)
  useEffect(() => {
    if (!open || editingIdx !== null) return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT') return

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setSelectedIdx(p => Math.max(0, p - 1))
        setConfirmDelete(false)
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setSelectedIdx(p => Math.min(tags.length - 1, p + 1))
        setConfirmDelete(false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (tags.length > 0 && !confirmDelete) startEdit(selectedIdx, tags)
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        if (!confirmDelete) startAdd(tags.length)
      } else if ((e.key === 'd' || e.key === 'D') && !confirmDelete) {
        e.preventDefault()
        if (tags.length > 0) setConfirmDelete(true)
      } else if (e.key === 'd' && confirmDelete) {
        e.preventDefault()
        deleteSelected(selectedIdx)
      } else if ((e.key === 's' || e.key === 'S') && !confirmDelete) {
        e.preventDefault()
        onSave(tags)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (confirmDelete) setConfirmDelete(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, editingIdx, tags, selectedIdx, confirmDelete, startEdit, startAdd, deleteSelected, onSave, onClose])

  if (!open) return null

  return (
    <Overlay>
      <div style={{
        background: BG_PANEL,
        border: `1px solid ${BORDER_NORMAL}`,
        borderRadius: 6,
        padding: 20,
        width: 640,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        maxHeight: '80vh',
      }}>
        <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 12 }}>
          ⚙ Tags verwalten
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 80px 36px 1fr 130px 40px',
          gap: 8,
          padding: '0 8px 6px',
          borderBottom: `1px solid ${BORDER_NORMAL}`,
          fontSize: 11,
          color: TEXT_DIM,
        }}>
          <span>Kategorie</span>
          <span>Key</span>
          <span>Sym</span>
          <span>Name</span>
          <span>Farbe</span>
          <span>Aktiv</span>
        </div>

        {/* Tag rows */}
        <div style={{ overflowY: 'auto', minHeight: 120, maxHeight: 360 }}>
          {tags.length === 0 && (
            <div style={{ padding: '16px 8px', fontSize: 12, color: TEXT_DIM }}>
              Keine Tags — A drücken um einen hinzuzufügen.
            </div>
          )}
          {tags.map((tag, idx) => {
            if (idx === editingIdx && draft) {
              return (
                <EditRow
                  key={idx}
                  draft={draft}
                  isNew={isNewTag}
                  onChange={setDraft}
                  onCommit={() => commitDraft(draft, idx)}
                  onCancel={() => cancelDraft(isNewTag)}
                />
              )
            }
            const isSelected = idx === selectedIdx
            return (
              <div
                key={idx}
                onClick={() => { setSelectedIdx(idx); setConfirmDelete(false) }}
                onDoubleClick={() => startEdit(idx, tags)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 80px 36px 1fr 130px 40px',
                  gap: 8,
                  padding: '5px 8px',
                  background: isSelected ? BG_SELECTED : 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  alignItems: 'center',
                }}
              >
                <span style={{ color: TEXT_DIM, fontSize: 11 }}>{tag.category}</span>
                <span style={{ color: TEXT_SECONDARY }}>{tag.key}</span>
                <span>{tag.symbol}</span>
                <span style={{ color: TEXT_PRIMARY }}>{tag.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: tag.color,
                    border: '1px solid rgba(255,255,255,0.15)',
                    flexShrink: 0,
                  }} />
                  <span style={{ color: TEXT_DIM, fontSize: 10 }}>{tag.color}</span>
                </div>
                <span style={{ color: tag.active ? '#00C896' : TEXT_DIM, fontSize: 13 }}>
                  {tag.active ? '✓' : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${BORDER_NORMAL}`,
          paddingTop: 10,
          marginTop: 8,
          fontSize: 11,
          color: TEXT_DIM,
          minHeight: 24,
        }}>
          {confirmDelete && tags[selectedIdx] ? (
            <span style={{ color: ACCENT_RED }}>
              Tag „{tags[selectedIdx].name}" löschen? D=Ja · Esc=Abbruch
            </span>
          ) : (
            <span>↑↓ Navigieren · Enter Bearbeiten · A Neu · D Löschen · S Speichern · Esc Schließen</span>
          )}
        </div>
      </div>
    </Overlay>
  )
}

interface EditRowProps {
  draft: TagDraft
  isNew: boolean
  onChange: (d: TagDraft) => void
  onCommit: () => void
  onCancel: () => void
}

function EditRow({ draft, isNew, onChange, onCommit, onCancel }: EditRowProps) {
  const keyRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => {
      if (isNew) keyRef.current?.focus()
      else nameRef.current?.focus()
    }, 0)
  }, [isNew])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onCommit() }
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCommit, onCancel])

  const inputStyle: React.CSSProperties = {
    background: '#0d1420',
    border: `1px solid ${BORDER_NORMAL}`,
    borderRadius: 3,
    color: TEXT_PRIMARY,
    fontSize: 12,
    fontFamily: 'inherit',
    padding: '3px 6px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const colorIdx = PRESET_COLORS.indexOf(draft.color)

  return (
    <div style={{
      padding: '8px 8px',
      background: '#1a2540',
      borderLeft: `2px solid ${BORDER_NORMAL}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '60px 80px 36px 1fr',
        gap: 6,
        alignItems: 'center',
      }}>
        {/* Category toggle */}
        <button
          onClick={() => onChange({ ...draft, category: draft.category === 'work' ? 'any' : 'work' })}
          style={{
            background: 'transparent',
            border: `1px solid ${BORDER_NORMAL}`,
            borderRadius: 3,
            color: TEXT_SECONDARY,
            cursor: 'pointer',
            fontSize: 11,
            padding: '3px 4px',
            fontFamily: 'inherit',
          }}
        >
          {draft.category}
        </button>
        {/* Key */}
        {isNew ? (
          <input
            ref={keyRef}
            value={draft.key}
            onChange={e => onChange({ ...draft, key: e.target.value })}
            placeholder="key"
            style={inputStyle}
          />
        ) : (
          <span style={{ color: TEXT_DIM, fontSize: 12, paddingLeft: 6 }}>{draft.key}</span>
        )}
        {/* Symbol */}
        <input
          value={draft.symbol}
          onChange={e => onChange({ ...draft, symbol: e.target.value })}
          placeholder="⚡"
          style={inputStyle}
        />
        {/* Name */}
        <input
          ref={isNew ? undefined : nameRef}
          value={draft.name}
          onChange={e => onChange({ ...draft, name: e.target.value })}
          placeholder="Name"
          style={inputStyle}
        />
      </div>

      {/* Color palette + active toggle + hint */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: TEXT_DIM, marginRight: 2 }}>Farbe:</span>
        {PRESET_COLORS.map((c, i) => (
          <div
            key={c}
            onClick={() => onChange({ ...draft, color: c })}
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              background: c,
              cursor: 'pointer',
              border: i === colorIdx ? '2px solid white' : '2px solid transparent',
              flexShrink: 0,
            }}
          />
        ))}
        <span style={{ fontSize: 11, color: TEXT_DIM, marginLeft: 8 }}>Aktiv:</span>
        <div
          onClick={() => onChange({ ...draft, active: !draft.active })}
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            border: `1px solid ${BORDER_NORMAL}`,
            background: draft.active ? '#00C896' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'white',
            flexShrink: 0,
          }}
        >
          {draft.active ? '✓' : ''}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: TEXT_DIM }}>
          Enter=Übernehmen · Esc=Abbruch
        </span>
      </div>
    </div>
  )
}
