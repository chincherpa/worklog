# Tag Config Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-driven dialog (opened with `G`) that lets the user create, edit, and delete tags, saving changes back to `config.toml`.

**Architecture:** New Rust `save_tags` command serializes the tag list back to TOML (preserving `db_path`/`schedule`/`projects`). Frontend `ConfigDialog` maintains a local copy of tags, lets the user edit inline, then calls `api.saveTags` on `S`. After save, `api.getConfig()` reloads config into app state.

**Tech Stack:** Rust/Tauri (toml + serde), React/TypeScript, existing dialog patterns (`Overlay` from `ConfirmDialog.tsx`), theme constants from `src/theme.ts`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/src/commands/config.rs` | Modify | Add `TagInput`, serializable output structs, `save_tags` command |
| `src-tauri/src/lib.rs` | Modify | Register `save_tags` in invoke_handler |
| `src/lib/invoke.ts` | Modify | Add `api.saveTags` |
| `src/useAppState.ts` | Modify | Add `setConfig` action to state |
| `src/keybindings.ts` | Modify | Add `'openConfig'` action + `g`/`G` bindings |
| `src/components/dialogs/ConfigDialog.tsx` | Create | Full tag management dialog |
| `src/App.tsx` | Modify | Wire `'config'` dialog type, keybinding, handler, render |

---

## Task 1: Rust — `save_tags` command

**Files:**
- Modify: `src-tauri/src/commands/config.rs`

- [ ] **Step 1: Add TagInput struct and serialization helpers**

Open `src-tauri/src/commands/config.rs`. The file currently has `use crate::app_config::{load_config, AppConfig};` at the top and three commands. Add the following after the existing `use` line (before the existing commands):

```rust
use crate::app_config::{load_config, AppConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct TagInput {
    pub key: String,
    pub symbol: String,
    pub name: String,
    pub color: String,
    pub category: String,
    pub active: bool,
}

#[derive(Serialize)]
struct TagOut {
    symbol: String,
    name: String,
    color: String,
    active: bool,
}

#[derive(Serialize)]
struct ScheduleOut {
    work_start: String,
    work_end: String,
    handover_window: i64,
}

#[derive(Serialize)]
struct ProjectsOut {
    active: Vec<String>,
}

#[derive(Serialize)]
struct ConfigOut {
    db_path: String,
    schedule: ScheduleOut,
    #[serde(skip_serializing_if = "Option::is_none")]
    projects: Option<ProjectsOut>,
    tags: HashMap<String, HashMap<String, TagOut>>,
}
```

Note: remove the duplicate `use crate::app_config` line after the edit — there should only be one.

- [ ] **Step 2: Add save_tags command**

Append the following function to `src-tauri/src/commands/config.rs` (after the existing `init_db` function):

```rust
#[tauri::command]
pub fn save_tags(config_path: String, tags: Vec<TagInput>) -> Result<(), String> {
    let current = load_config(Some(config_path.clone()))?;

    let mut tags_map: HashMap<String, HashMap<String, TagOut>> = HashMap::new();
    for tag in tags {
        tags_map
            .entry(tag.category)
            .or_default()
            .insert(tag.key, TagOut {
                symbol: tag.symbol,
                name: tag.name,
                color: tag.color,
                active: tag.active,
            });
    }

    let projects = if current.projects.is_empty() {
        None
    } else {
        Some(ProjectsOut { active: current.projects })
    };

    let config_out = ConfigOut {
        db_path: current.db_path,
        schedule: ScheduleOut {
            work_start: current.schedule.work_start,
            work_end: current.schedule.work_end,
            handover_window: current.schedule.handover_window,
        },
        projects,
        tags: tags_map,
    };

    let toml_str = toml::to_string_pretty(&config_out)
        .map_err(|e| format!("TOML serialization failed: {e}"))?;

    std::fs::write(&config_path, toml_str)
        .map_err(|e| format!("Cannot write config: {e}"))?;

    Ok(())
}
```

- [ ] **Step 3: Verify Rust compiles**

```powershell
cd src-tauri && cargo check 2>&1
```

Expected: no errors. Common fix: if `use serde::{Deserialize, Serialize}` conflicts with existing imports, merge them.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/config.rs
git commit -m "feat(rust): add save_tags command"
```

---

## Task 2: Register save_tags in invoke_handler

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add save_tags to handler**

In `src-tauri/src/lib.rs`, find the `tauri::generate_handler![` block. Add `save_tags` to the `// config` section:

```rust
// config
get_config,
get_db_path,
init_db,
save_tags,
```

- [ ] **Step 2: Verify**

```powershell
cd src-tauri && cargo check 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): register save_tags in invoke_handler"
```

---

## Task 3: API layer — api.saveTags

**Files:**
- Modify: `src/lib/invoke.ts`

- [ ] **Step 1: Add saveTags to api object**

In `src/lib/invoke.ts`, find the `// Config` section (lines 13–20). Add `saveTags` after `initDb`:

```ts
// Config
getConfig: (configPath?: string) =>
  invoke<AppConfig>('get_config', { configPath }),
getDbPath: (configPath?: string) =>
  invoke<string>('get_db_path', { configPath }),
initDb: (dbPath: string) =>
  invoke<number>('init_db', { dbPath }),
saveTags: (configPath: string, tags: Tag[]) =>
  invoke<void>('save_tags', { configPath, tags }),
```

`Tag` is already imported from `'../types'` at the top of the file.

- [ ] **Step 2: Type-check**

```powershell
pnpm build 2>&1
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/invoke.ts
git commit -m "feat(api): add saveTags invoke wrapper"
```

---

## Task 4: useAppState — setConfig action

**Files:**
- Modify: `src/useAppState.ts`

- [ ] **Step 1: Add setConfig to AppActions interface**

In `src/useAppState.ts`, find the `AppActions` interface (lines 25–44). Add `setConfig` as the last entry:

```ts
export interface AppActions {
  loadAll: () => Promise<void>
  loadLog: () => Promise<void>
  loadTodos: () => Promise<void>
  workTags: () => Tag[]
  currentTag: () => Tag | null
  cycleTag: (dir: 1 | -1) => void
  cycleFilter: (dir: 1 | -1) => void
  setFilter: (key: string | null) => void
  setDisplayedEntry: (id: number | null) => void
  setTodoIdx: (idx: number) => void
  moveTodoIdx: (dir: 1 | -1) => void
  moveLogIdx: (dir: 1 | -1) => void
  setActivePanel: (panel: ActivePanel) => void
  cyclePanel: (dir: 1 | -1) => void
  setContentVisible: (v: boolean) => void
  setTodoVisible: (v: boolean) => void
  setDialogOpen: (v: boolean) => void
  setInputFocused: (v: boolean) => void
  setConfig: (config: AppConfig) => void
}
```

- [ ] **Step 2: Implement setConfig**

In `src/useAppState.ts`, after the `setInputFocused` callback definition (around line 240), add:

```ts
const setConfig = useCallback((config: AppConfig) => {
  setState(prev => {
    const validTags = config.tags.filter(t => t.active && (t.category === 'work' || t.category === 'any'))
    const clampedTagIdx = Math.min(prev.tagIdx, Math.max(0, validTags.length - 1))
    return { ...prev, config, tagIdx: clampedTagIdx }
  })
}, [])
```

- [ ] **Step 3: Add setConfig to return object**

In the `return { ...state, ... }` at the bottom of `useAppState`, add `setConfig` alongside the other actions.

- [ ] **Step 4: Type-check**

```powershell
pnpm build 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/useAppState.ts
git commit -m "feat(state): add setConfig action to useAppState"
```

---

## Task 5: Keybindings — openConfig

**Files:**
- Modify: `src/keybindings.ts`

- [ ] **Step 1: Add openConfig to ActionName**

In `src/keybindings.ts`, find the `ActionName` type (line 1). Add `'openConfig'` to the union:

```ts
export type ActionName =
  | 'focusLogInput'
  | 'addTodo'
  | 'todoDone'
  | 'deleteEntry'
  | 'cancelTodo'
  | 'startFocus'
  | 'editEntry'
  | 'changeTag'
  | 'refreshAll'
  | 'quit'
  | 'toggleContent'
  | 'toggleTodo'
  | 'openWeekly'
  | 'viewLatest'
  | 'todoActivate'
  | 'todoDetail'
  | 'arrowUp'
  | 'arrowDown'
  | 'cyclePanel'
  | 'cyclePanelBack'
  | 'nextFilter'
  | 'prevFilter'
  | 'prevTag'
  | 'openHelp'
  | 'openConfig'
```

- [ ] **Step 2: Add g/G bindings**

In the `BINDINGS` record, add `g` and `G` after the `'?': 'openHelp'` line:

```ts
'?': 'openHelp',
g: 'openConfig',
G: 'openConfig',
```

- [ ] **Step 3: Type-check**

```powershell
pnpm build 2>&1
```

Expected: no errors (TypeScript will warn in App.tsx about unhandled case — that's expected, fixed in Task 7).

- [ ] **Step 4: Commit**

```bash
git add src/keybindings.ts
git commit -m "feat(keybindings): add openConfig action bound to g/G"
```

---

## Task 6: ConfigDialog component

**Files:**
- Create: `src/components/dialogs/ConfigDialog.tsx`

- [ ] **Step 1: Create ConfigDialog.tsx**

Create `src/components/dialogs/ConfigDialog.tsx` with the full implementation below. This is a long file — write it exactly as shown:

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
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
```

- [ ] **Step 2: Type-check**

```powershell
pnpm build 2>&1
```

Expected: no TypeScript errors. If `React.CSSProperties` is unknown, add `import type React from 'react'` at the top.

- [ ] **Step 3: Commit**

```bash
git add src/components/dialogs/ConfigDialog.tsx
git commit -m "feat(ui): add ConfigDialog for tag management"
```

---

## Task 7: Wire ConfigDialog in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add 'config' to DialogType**

In `src/App.tsx`, find line 26:
```ts
type DialogType =
  | 'none' | 'confirm' | 'newTodo' | 'contentEdit'
  | 'tagSelect' | 'focus' | 'debrief' | 'todoDetail'
  | 'weekly' | 'help'
```

Change to:
```ts
type DialogType =
  | 'none' | 'confirm' | 'newTodo' | 'contentEdit'
  | 'tagSelect' | 'focus' | 'debrief' | 'todoDetail'
  | 'weekly' | 'help' | 'config'
```

- [ ] **Step 2: Add ConfigDialog import**

Add to the import block in `src/App.tsx` (after the `KeybindingsHelpDialog` import):
```ts
import ConfigDialog from './components/dialogs/ConfigDialog'
```

- [ ] **Step 3: Add openConfig case to handleAction**

In the `handleAction` switch (around line 254, after `case 'openHelp':`), add:

```ts
case 'openConfig':
  openDialog({ type: 'config' })
  break
```

- [ ] **Step 4: Add handleConfigSave callback**

After the `handleLogSubmit` callback (around line 324), add:

```ts
const handleConfigSave = useCallback(async (tags: import('./types').Tag[]) => {
  if (!app.config) return
  try {
    await api.saveTags(app.config.config_path, tags)
    const newConfig = await api.getConfig()
    app.setConfig(newConfig)
    closeDialog()
    showToast('Tags gespeichert', 'success')
  } catch (e) {
    showToast(String(e), 'error')
  }
}, [app, closeDialog, showToast])
```

Or use the explicit type import at the top of the file instead of the inline import:

```ts
import type { NewTodoResult } from './components/dialogs/NewTodoDialog'
import type { FocusOutcome, FocusResult } from './components/dialogs/FocusDialog'
import type { DebriefResult } from './components/dialogs/DebriefingDialog'
import type { Tag } from './types'  // add this line
```

Then the callback becomes:
```ts
const handleConfigSave = useCallback(async (tags: Tag[]) => {
  if (!app.config) return
  try {
    await api.saveTags(app.config.config_path, tags)
    const newConfig = await api.getConfig()
    app.setConfig(newConfig)
    closeDialog()
    showToast('Tags gespeichert', 'success')
  } catch (e) {
    showToast(String(e), 'error')
  }
}, [app, closeDialog, showToast])
```

- [ ] **Step 5: Render ConfigDialog**

In the JSX `{/* Dialogs */}` section (after `<KeybindingsHelpDialog ... />`), add:

```tsx
<ConfigDialog
  open={dialog.type === 'config'}
  tags={allTags}
  onSave={handleConfigSave}
  onClose={closeDialog}
/>
```

- [ ] **Step 6: Type-check**

```powershell
pnpm build 2>&1
```

Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire ConfigDialog — openConfig action, handler, render"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start the app**

```powershell
pnpm tauri dev
```

- [ ] **Step 2: Verify dialog opens**

Press `G` → Config dialog should appear with all current tags listed.

- [ ] **Step 3: Verify edit**

Press `Enter` on a tag → inline edit form appears with existing values. Change name → press `Enter` → row updates. Press `S` → toast "Tags gespeichert" appears. Restart app or press `R` (reload) → changes persist.

- [ ] **Step 4: Verify add**

Press `A` → blank row appears with cursor in Key field. Type key (e.g. `test`), Tab to Symbol, type `★`, Tab to Name, type `Test`. Press `Enter`. Row appears in list. Press `S` to save.

- [ ] **Step 5: Verify delete**

Select a tag, press `D` → footer shows confirm prompt. Press `D` again → tag removed. Press `S` to save.

- [ ] **Step 6: Verify cancel**

Make edits, press `Esc` → dialog closes without saving. Tags unchanged.

- [ ] **Step 7: Verify color palette**

In edit mode, click different color swatches → color swatch in row updates. Selected color has white border.

- [ ] **Step 8: Fix the local config shadow bug**

The app reads `d:\Projects\worklog\config.toml` instead of `~/.config/worklog/config.toml` because `resolve_config_path` checks `./config.toml` first. To fix: copy any needed changes from `~/.config/worklog/config.toml` into `d:\Projects\worklog\config.toml`, then use the config dialog to manage tags going forward.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "chore: verify tag config dialog complete"
```

---

## Troubleshooting

**Tags don't appear in app after saving:**
- Check config file path: the app reads `d:\Projects\worklog\config.toml`, not `~/.config/worklog/config.toml`. Verify with `api.getConfig()` response in devtools.

**Rust compile error `use of undeclared type TagInput`:**
- `TagInput` is defined in `config.rs` and used in same file — should not occur. Check that `pub fn save_tags` references `TagInput` not `crate::app_config::TagInput`.

**`toml::to_string_pretty` error at compile:**
- Ensure all structs in the serialization chain derive `Serialize`. `toml` 0.8 requires `serde` features — already present in `Cargo.toml`.

**Dialog keyboard not working after typing in input:**
- The list keyboard handler guards against `target.tagName === 'INPUT'` — inputs route to EditRow's own handler via the global window listener there.
