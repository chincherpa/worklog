import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import {
  BG_PANEL, BG_SELECTED, BORDER_NORMAL,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM, ACCENT_RED,
} from '../../theme'
import { Overlay } from './ConfirmDialog'
import type { Tag } from '../../types'


interface TagDraft {
  key: string
  symbol: string
  name: string
  color: string
  bg_color?: string
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
    const blank: TagDraft = { key: '', symbol: '', name: '', color: '#CED4DA', bg_color: undefined }
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
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        if (!confirmDelete) startAdd(tags.length)
      } else if ((e.key === 'd' || e.key === 'D') && !confirmDelete) {
        e.preventDefault()
        if (tags.length > 0) setConfirmDelete(true)
      } else if ((e.key === 'd' || e.key === 'D') && confirmDelete) {
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
          ⚙ Manage Tags
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 36px 1fr 140px',
          gap: 8,
          padding: '0 8px 6px',
          borderBottom: `1px solid ${BORDER_NORMAL}`,
          fontSize: 11,
          color: TEXT_DIM,
        }}>
          <span>Key</span>
          <span>Sym</span>
          <span>Name</span>
          <span>Preview</span>
        </div>

        {/* Tag rows */}
        <div style={{ overflowY: 'auto', minHeight: 120, maxHeight: 360 }}>
          {tags.length === 0 && (
            <div style={{ padding: '16px 8px', fontSize: 12, color: TEXT_DIM }}>
              No tags — press N to add one.
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
                  gridTemplateColumns: '80px 36px 1fr 140px',
                  gap: 8,
                  padding: '5px 8px',
                  background: isSelected ? BG_SELECTED : 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  alignItems: 'center',
                }}
              >
                <span style={{ color: TEXT_SECONDARY }}>{tag.key}</span>
                <span>{tag.symbol}</span>
                <span style={{ color: TEXT_PRIMARY }}>{tag.name}</span>
                <span style={{
                  color: tag.color,
                  background: tag.bg_color ?? (tag.color + '28'),
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  display: 'inline-block',
                }}>
                  {tag.symbol} {tag.key}
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
              Delete tag "{tags[selectedIdx].name}"? D=Yes · Esc=Cancel
            </span>
          ) : (
            <span>↑↓ Navigate · Enter Edit · N New · D Delete · S Save · Esc Close</span>
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
        gridTemplateColumns: '80px 36px 1fr',
        gap: 6,
        alignItems: 'center',
      }}>
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

      {/* Color pickers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_DIM, width: 80, flexShrink: 0 }}>Text color:</span>
          <input
            type="color"
            value={draft.color}
            onChange={e => onChange({ ...draft, color: e.target.value })}
            style={{ width: 28, height: 22, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 3, background: 'none' }}
          />
          <input
            value={draft.color}
            onChange={e => onChange({ ...draft, color: e.target.value })}
            placeholder="#rrggbb"
            style={{ ...inputStyle, width: 80 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_DIM, width: 80, flexShrink: 0 }}>Background:</span>
          <input
            type="color"
            value={draft.bg_color ?? '#000000'}
            disabled={draft.bg_color === undefined}
            onChange={e => onChange({ ...draft, bg_color: e.target.value })}
            style={{ width: 28, height: 22, border: 'none', padding: 0, cursor: draft.bg_color !== undefined ? 'pointer' : 'default', borderRadius: 3, background: 'none', opacity: draft.bg_color !== undefined ? 1 : 0.3 }}
          />
          <input
            value={draft.bg_color ?? ''}
            onChange={e => onChange({ ...draft, bg_color: e.target.value || undefined })}
            placeholder="empty = auto"
            style={{ ...inputStyle, width: 80 }}
          />
          <button
            type="button"
            onClick={() => onChange({ ...draft, bg_color: undefined })}
            style={{ fontSize: 11, background: 'transparent', border: `1px solid #555`, borderRadius: 3, color: '#888', cursor: 'pointer', padding: '2px 6px' }}
          >✕ clear</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_DIM, width: 80, flexShrink: 0 }}>Preview:</span>
          <span style={{
            color: draft.color,
            background: draft.bg_color ?? (draft.color + '28'),
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 10,
          }}>
            {draft.symbol || '?'} {draft.key || 'key'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: TEXT_DIM }}>
            Enter=Apply · Esc=Cancel
          </span>
        </div>
      </div>
    </div>
  )
}
