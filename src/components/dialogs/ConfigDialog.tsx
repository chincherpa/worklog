import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import {
  BG_PANEL, BG_SELECTED, BORDER_NORMAL,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_DIM, ACCENT_RED,
} from '../../theme'
import { Overlay } from './ConfirmDialog'
import type { Tag, Project, Keybinding } from '../../types'
import {
  ALL_ACTIONS, ACTION_LABELS, DEFAULT_PER_ACTION,
  keyStr, withCaseVariant, keybindingListToPerAction,
  type ActionName,
} from '../../keybindings'

type Mode = 'tags' | 'projects' | 'keybindings'

// Tag and Project share the same shape — manage both through one entry type.
type Entry = Tag

interface EntryDraft {
  key: string
  symbol: string
  name: string
  color: string
  bg_color?: string
}

interface Props {
  open: boolean
  tags: Tag[]
  projects: Project[]
  keybindings: Keybinding[]
  onSaveTags: (tags: Tag[]) => void
  onSaveProjects: (projects: Project[]) => void
  onSaveKeybindings: (keybindings: Keybinding[]) => void
  onClose: () => void
}

const TITLES: Record<Mode, string> = {
  tags: '⚙ Manage Tags',
  projects: '⚙ Manage Projects',
  keybindings: '⌨ Manage Keybindings',
}

const EMPTY_HINTS: Record<Mode, string> = {
  tags: 'No tags — press N to add one.',
  projects: 'No projects — press N to add one.',
  keybindings: '',
}

const MODE_ORDER: Mode[] = ['tags', 'projects', 'keybindings']

/** Build the editor's per-action map: config overrides, falling back to defaults. */
function initialPerAction(keybindings: Keybinding[]): Record<string, string[]> {
  const override = keybindingListToPerAction(keybindings)
  const out: Record<string, string[]> = {}
  for (const a of ALL_ACTIONS) {
    out[a] = override[a]?.length ? [...override[a]] : [...(DEFAULT_PER_ACTION[a] ?? [])]
  }
  return out
}

export default function ConfigDialog({ open, tags: initialTags, projects: initialProjects, keybindings: initialKeybindings, onSaveTags, onSaveProjects, onSaveKeybindings, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('tags')
  const [tagEntries, setTagEntries] = useState<Entry[]>([])
  const [projectEntries, setProjectEntries] = useState<Entry[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<EntryDraft | null>(null)
  const [isNewEntry, setIsNewEntry] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Keybindings mode
  const [kbPerAction, setKbPerAction] = useState<Record<string, string[]>>({})
  const [capturing, setCapturing] = useState(false)
  const [kbConflict, setKbConflict] = useState<string | null>(null)

  const entries = mode === 'tags' ? tagEntries : projectEntries
  const setEntries = mode === 'tags' ? setTagEntries : setProjectEntries

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setMode('tags')
      setTagEntries([...initialTags])
      setProjectEntries([...initialProjects])
      setKbPerAction(initialPerAction(initialKeybindings))
      setSelectedIdx(0)
      setEditingIdx(null)
      setDraft(null)
      setIsNewEntry(false)
      setConfirmDelete(false)
      setCapturing(false)
      setKbConflict(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = useCallback((next: Mode) => {
    setMode(next)
    setSelectedIdx(0)
    setEditingIdx(null)
    setDraft(null)
    setIsNewEntry(false)
    setConfirmDelete(false)
    setCapturing(false)
    setKbConflict(null)
  }, [])

  const startEdit = useCallback((idx: number, current: Entry[]) => {
    setDraft({ ...current[idx] })
    setEditingIdx(idx)
    setIsNewEntry(false)
    setConfirmDelete(false)
  }, [])

  const startAdd = useCallback((currentLength: number) => {
    const blank: EntryDraft = { key: '', symbol: '', name: '', color: '#CED4DA', bg_color: '#888888' }
    setEntries(prev => [...prev, blank as Entry])
    setSelectedIdx(currentLength)
    setDraft(blank)
    setEditingIdx(currentLength)
    setIsNewEntry(true)
    setConfirmDelete(false)
  }, [setEntries])

  const commitDraft = useCallback((currentDraft: EntryDraft, idx: number) => {
    if (!currentDraft.key.trim() || !currentDraft.name.trim()) return
    setEntries(prev => {
      const next = [...prev]
      next[idx] = currentDraft as Entry
      return next
    })
    setEditingIdx(null)
    setDraft(null)
    setIsNewEntry(false)
  }, [setEntries])

  const cancelDraft = useCallback((wasNew: boolean) => {
    if (wasNew) {
      setEntries(prev => prev.slice(0, -1))
      setSelectedIdx(prev => Math.max(0, prev - 1))
    }
    setEditingIdx(null)
    setDraft(null)
    setIsNewEntry(false)
  }, [setEntries])

  const moveEntry = useCallback((from: number, dir: -1 | 1) => {
    const to = from + dir
    setEntries(prev => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSelectedIdx(prev => {
      const t = prev + dir
      return t < 0 || t >= entries.length ? prev : t
    })
    setConfirmDelete(false)
  }, [setEntries, entries.length])

  const deleteSelected = useCallback((idx: number) => {
    setEntries(prev => prev.filter((_, i) => i !== idx))
    setSelectedIdx(Math.max(0, idx - 1))
    setConfirmDelete(false)
  }, [setEntries])

  const handleSave = useCallback(() => {
    if (mode === 'tags') onSaveTags(tagEntries as Tag[])
    else if (mode === 'projects') onSaveProjects(projectEntries as Project[])
    else {
      const list: Keybinding[] = ALL_ACTIONS.map(a => ({ action: a, keys: kbPerAction[a] ?? [] }))
      onSaveKeybindings(list)
    }
  }, [mode, tagEntries, projectEntries, kbPerAction, onSaveTags, onSaveProjects, onSaveKeybindings])

  const resetActionToDefault = useCallback((action: ActionName) => {
    setKbPerAction(prev => ({ ...prev, [action]: [...(DEFAULT_PER_ACTION[action] ?? [])] }))
    setKbConflict(null)
  }, [])

  const resetAllToDefault = useCallback(() => {
    setKbPerAction(initialPerAction([]))
    setKbConflict(null)
  }, [])

  // Capture a pressed combo for the currently selected action (active while `capturing`).
  useEffect(() => {
    if (!open || !capturing || mode !== 'keybindings') return
    const action = ALL_ACTIONS[selectedIdx]
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setCapturing(false); setKbConflict(null); return }
      // Ignore lone modifier presses — wait for the real key.
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return
      const newKeys = withCaseVariant(keyStr(e))
      // Conflict: any captured key already bound to a different action.
      for (const other of ALL_ACTIONS) {
        if (other === action) continue
        if (kbPerAction[other]?.some(k => newKeys.includes(k))) {
          setKbConflict(`"${keyStr(e)}" is already assigned to "${ACTION_LABELS[other]}"`)
          return
        }
      }
      setKbPerAction(prev => ({ ...prev, [action]: newKeys }))
      setCapturing(false)
      setKbConflict(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open, capturing, mode, selectedIdx, kbPerAction])

  const cycleMode = useCallback((dir: 1 | -1) => {
    const i = MODE_ORDER.indexOf(mode)
    switchMode(MODE_ORDER[(i + dir + MODE_ORDER.length) % MODE_ORDER.length])
  }, [mode, switchMode])

  // Keybindings-mode list handler (active when not capturing)
  useEffect(() => {
    if (!open || mode !== 'keybindings' || capturing) return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT') return
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setSelectedIdx(p => Math.max(0, p - 1))
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setSelectedIdx(p => Math.min(ALL_ACTIONS.length - 1, p + 1))
      } else if (e.key === 'Tab') {
        e.preventDefault()
        cycleMode(e.shiftKey ? -1 : 1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        setKbConflict(null)
        setCapturing(true)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        resetActionToDefault(ALL_ACTIONS[selectedIdx])
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        resetAllToDefault()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, mode, capturing, selectedIdx, cycleMode, resetActionToDefault, resetAllToDefault, handleSave, onClose])

  // List keyboard handler for tags/projects (active when not editing)
  useEffect(() => {
    if (!open || mode === 'keybindings' || editingIdx !== null) return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT') return

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        if (e.shiftKey) {
          if (!confirmDelete) moveEntry(selectedIdx, -1)
        } else {
          setSelectedIdx(p => Math.max(0, p - 1))
          setConfirmDelete(false)
        }
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        if (e.shiftKey) {
          if (!confirmDelete) moveEntry(selectedIdx, 1)
        } else {
          setSelectedIdx(p => Math.min(entries.length - 1, p + 1))
          setConfirmDelete(false)
        }
      } else if (e.key === 'Tab') {
        e.preventDefault()
        if (!confirmDelete) cycleMode(e.shiftKey ? -1 : 1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (entries.length > 0 && !confirmDelete) startEdit(selectedIdx, entries)
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        if (!confirmDelete) startAdd(entries.length)
      } else if ((e.key === 'd' || e.key === 'D') && !confirmDelete) {
        e.preventDefault()
        if (entries.length > 0) setConfirmDelete(true)
      } else if ((e.key === 'd' || e.key === 'D') && confirmDelete) {
        e.preventDefault()
        deleteSelected(selectedIdx)
      } else if ((e.key === 's' || e.key === 'S') && !confirmDelete) {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        if (confirmDelete) setConfirmDelete(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, editingIdx, entries, mode, selectedIdx, confirmDelete, startEdit, startAdd, deleteSelected, moveEntry, cycleMode, handleSave, onClose])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: TEXT_PRIMARY, fontWeight: 600 }}>
            {TITLES[mode]}
          </div>
          <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
            {MODE_ORDER.map(m => (
              <span
                key={m}
                onClick={() => switchMode(m)}
                style={{
                  padding: '2px 10px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: mode === m ? BG_SELECTED : 'transparent',
                  color: mode === m ? TEXT_PRIMARY : TEXT_DIM,
                  border: `1px solid ${mode === m ? BORDER_NORMAL : 'transparent'}`,
                }}
              >
                {m === 'tags' ? 'Tags' : m === 'projects' ? 'Projects' : 'Keybindings'}
              </span>
            ))}
          </div>
        </div>

        {mode === 'keybindings' ? (
          <KeybindingsList
            perAction={kbPerAction}
            selectedIdx={selectedIdx}
            capturing={capturing}
            onSelect={(idx) => { setSelectedIdx(idx); setCapturing(false); setKbConflict(null) }}
            onCapture={(idx) => { setSelectedIdx(idx); setKbConflict(null); setCapturing(true) }}
          />
        ) : (
        <>
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

        {/* Entry rows */}
        <div style={{ overflowY: 'auto', minHeight: 120, maxHeight: 360 }}>
          {entries.length === 0 && (
            <div style={{ padding: '16px 8px', fontSize: 12, color: TEXT_DIM }}>
              {EMPTY_HINTS[mode]}
            </div>
          )}
          {entries.map((entry, idx) => {
            if (idx === editingIdx && draft) {
              return (
                <EditRow
                  key={idx}
                  draft={draft}
                  isNew={isNewEntry}
                  onChange={setDraft}
                  onCommit={() => commitDraft(draft, idx)}
                  onCancel={() => cancelDraft(isNewEntry)}
                />
              )
            }
            const isSelected = idx === selectedIdx
            return (
              <div
                key={idx}
                onClick={() => { setSelectedIdx(idx); setConfirmDelete(false) }}
                onDoubleClick={() => startEdit(idx, entries)}
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
                <span style={{ color: TEXT_SECONDARY }}>{entry.key}</span>
                <span>{entry.symbol}</span>
                <span style={{ color: TEXT_PRIMARY }}>{entry.name}</span>
                <span style={{
                  color: entry.color,
                  background: entry.bg_color ?? (entry.color + '28'),
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 10,
                  display: 'inline-block',
                }}>
                  {entry.symbol} {entry.key}
                </span>
              </div>
            )
          })}
        </div>
        </>
        )}

        {/* Footer */}
        <div style={{
          borderTop: `1px solid ${BORDER_NORMAL}`,
          paddingTop: 10,
          marginTop: 8,
          fontSize: 11,
          color: TEXT_DIM,
          minHeight: 24,
        }}>
          {mode === 'keybindings' ? (
            kbConflict ? (
              <span style={{ color: ACCENT_RED }}>{kbConflict} · another key or Esc</span>
            ) : capturing ? (
              <span style={{ color: TEXT_PRIMARY }}>
                Press key for "{ACTION_LABELS[ALL_ACTIONS[selectedIdx]]}"… · Esc Cancel
              </span>
            ) : (
              <span>↑↓ Navigate · Enter Rebind · Backspace Reset · R Reset all · S Save · Tab Switch · Esc Close</span>
            )
          ) : confirmDelete && entries[selectedIdx] ? (
            <span style={{ color: ACCENT_RED }}>
              Delete "{entries[selectedIdx].name}"? D=Yes · Esc=Cancel
            </span>
          ) : (
            <span>↑↓ Navigate · ⇧↑↓ Move · Enter Edit · N New · D Delete · S Save · Tab Switch · Esc Close</span>
          )}
        </div>
      </div>
    </Overlay>
  )
}

interface KeybindingsListProps {
  perAction: Record<string, string[]>
  selectedIdx: number
  capturing: boolean
  onSelect: (idx: number) => void
  onCapture: (idx: number) => void
}

function KeybindingsList({ perAction, selectedIdx, capturing, onSelect, onCapture }: KeybindingsListProps) {
  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 200px',
        gap: 8,
        padding: '0 8px 6px',
        borderBottom: `1px solid ${BORDER_NORMAL}`,
        fontSize: 11,
        color: TEXT_DIM,
      }}>
        <span>Action</span>
        <span>Keys</span>
      </div>
      <div style={{ overflowY: 'auto', minHeight: 120, maxHeight: 360 }}>
        {ALL_ACTIONS.map((action, idx) => {
          const isSelected = idx === selectedIdx
          const isCapturing = isSelected && capturing
          const keys = perAction[action] ?? []
          return (
            <div
              key={action}
              onClick={() => onSelect(idx)}
              onDoubleClick={() => onCapture(idx)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 200px',
                gap: 8,
                padding: '5px 8px',
                background: isSelected ? BG_SELECTED : 'transparent',
                cursor: 'pointer',
                fontSize: 12,
                alignItems: 'center',
              }}
            >
              <span style={{ color: TEXT_PRIMARY }}>{ACTION_LABELS[action]}</span>
              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {isCapturing ? (
                  <span style={{ color: TEXT_PRIMARY, fontStyle: 'italic' }}>Press key…</span>
                ) : keys.length === 0 ? (
                  <span style={{ color: TEXT_DIM }}>—</span>
                ) : (
                  keys.map(k => (
                    <code key={k} style={{
                      background: '#1a2030',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 11,
                      color: TEXT_SECONDARY,
                    }}>{k}</code>
                  ))
                )}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

interface EditRowProps {
  draft: EntryDraft
  isNew: boolean
  onChange: (d: EntryDraft) => void
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
