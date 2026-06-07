# Log Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "project" dimension to log entries, mirroring how tags work — defined in config.toml with symbol/name/color, selectable via a picker in the log input row, displayed as a badge in log entry rows.

**Architecture:** Projects are stored as a flat key→{symbol,name,color} map in `config.toml` under `[projects]`, identical in shape to `[tags]`. The selected project key is written to the existing `log_entries.project` TEXT column (already present in DB, default 'work'). Frontend adds a project picker badge next to the tag picker in the log input; entry rows show a small project badge when project != 'work'.

**Tech Stack:** Rust (rusqlite, serde, toml), React + TypeScript, Tauri v2 invoke

---

## File Map

| File | Change |
|------|--------|
| `src-tauri/src/app_config.rs` | Add `Project` struct, parse `[projects]` section, add to `AppConfig` |
| `src-tauri/src/models.rs` | Add `project: String` field to `LogEntry` |
| `src-tauri/src/db.rs` | Add MIGRATION_8 (add_column_if_missing for log_entries.project) |
| `src-tauri/src/commands/log.rs` | Update `row_to_log`, `log_add`, `log_update` |
| `src/types.ts` | Add `Project` interface, add `project` to `LogEntry`, add `projects` to `AppConfig` |
| `src/lib/invoke.ts` | Add `projectKey` param to `logAdd` and `logUpdate` |
| `src/keybindings.ts` | Add `cycleProject` to `ActionName`, bind to `o`/`O` |
| `src/useAppState.ts` | Add `projectIdx` state, `projects()`/`currentProject()`/`cycleProject()`/`setProjectIdx()` |
| `src/App.tsx` | Handle `cycleProject` action, pass project props to LogPanel, add projectKey to logAdd calls |
| `src/components/panels/LogPanel.tsx` | Add project picker badge + dropdown next to tag picker |
| `src/components/widgets/LogEntryRow.tsx` | Show project badge when project != 'work' |

---

## Task 1: Rust — Add `Project` type to AppConfig

**Files:**
- Modify: `src-tauri/src/app_config.rs`

- [ ] **Step 1: Add `Project` struct and update `AppConfig`**

In `src-tauri/src/app_config.rs`, add `Project` below the `Tag` struct, and add `projects: Vec<Project>` to `AppConfig`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub key: String,
    pub symbol: String,
    pub name: String,
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bg_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub tags: Vec<Tag>,
    pub projects: Vec<Project>,
    pub config_path: String,
    pub db_path: String,
}
```

- [ ] **Step 2: Parse `[projects]` in `load_config`**

In `load_config`, add project parsing after tags:

```rust
let tags = parse_tags(doc.get("tags"));
let projects = parse_projects(doc.get("projects"));
```

Update the `Ok(AppConfig { ... })` return to include `projects`:

```rust
Ok(AppConfig {
    tags,
    projects,
    config_path: path.to_string_lossy().to_string(),
    db_path,
})
```

- [ ] **Step 3: Add `parse_projects` function**

Add after `parse_tags`:

```rust
fn parse_projects(projects_val: Option<&Value>) -> Vec<Project> {
    let Some(Value::Table(table)) = projects_val else {
        return vec![Project {
            key: "work".to_string(),
            symbol: "💼".to_string(),
            name: "Arbeit".to_string(),
            color: "#5B8DEF".to_string(),
            bg_color: None,
        }];
    };
    let mut projects: Vec<Project> = table.iter().filter_map(|(key, val)| {
        Some(Project {
            key: key.clone(),
            symbol: val.get("symbol")?.as_str()?.to_string(),
            name: val.get("name")?.as_str()?.to_string(),
            color: val.get("color")?.as_str()?.to_string(),
            bg_color: val.get("bg_color").and_then(|v| v.as_str()).map(|s| s.to_string()),
        })
    }).collect();
    if projects.is_empty() {
        projects.push(Project {
            key: "work".to_string(),
            symbol: "💼".to_string(),
            name: "Arbeit".to_string(),
            color: "#5B8DEF".to_string(),
            bg_color: None,
        });
    }
    projects
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/app_config.rs
git commit -m "feat(config): add Project type and parse [projects] from config.toml"
```

---

## Task 2: Rust — Add `project` field to `LogEntry` + DB migration

**Files:**
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/db.rs`

- [ ] **Step 1: Add `project` to `LogEntry` in models.rs**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: i64,
    pub date: String,
    pub created_at: String,
    pub tag_key: String,
    pub project: String,      // ← ADD THIS
    pub content: String,
    pub todo_id: Option<i64>,
    pub resolved: i64,
}
```

- [ ] **Step 2: Add MIGRATION_8 to db.rs**

In the `migrations` slice in `migrate()`, extend to version 8:

```rust
let migrations: &[(i64, &str)] = &[
    (1, MIGRATION_1),
    (2, MIGRATION_2),
    (3, MIGRATION_3),
    (4, MIGRATION_4),
    (5, MIGRATION_5),
    (6, MIGRATION_6),
    (7, MIGRATION_7),
    (8, MIGRATION_8),
];
```

In the version-dispatch block, add the case for version 8:

```rust
for (version, sql) in migrations {
    if *version <= current {
        continue;
    }
    if *version == 7 {
        add_column_if_missing(&conn, "todos", "tags", "TEXT").map_err(|e| e.to_string())?;
    } else if *version == 8 {
        add_column_if_missing(&conn, "log_entries", "project", "TEXT NOT NULL DEFAULT 'work'").map_err(|e| e.to_string())?;
    } else {
        exec_migration_sql(&conn, sql).map_err(|e| e.to_string())?;
    }
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (?1)",
        rusqlite::params![version],
    )
    .map_err(|e| e.to_string())?;
}
```

Add the constant at the bottom of db.rs:

```rust
// Handled programmatically — adds project column to log_entries if missing.
const MIGRATION_8: &str = "";
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/models.rs src-tauri/src/db.rs
git commit -m "feat(db): add project field to LogEntry, migration 8 for log_entries.project"
```

---

## Task 3: Rust — Update log commands

**Files:**
- Modify: `src-tauri/src/commands/log.rs`

- [ ] **Step 1: Update `row_to_log` to read `project`**

```rust
fn row_to_log(row: &rusqlite::Row) -> rusqlite::Result<LogEntry> {
    Ok(LogEntry {
        id: row.get("id")?,
        date: row.get("date")?,
        created_at: row.get("created_at")?,
        tag_key: row.get("tag_key")?,
        project: row.get("project").unwrap_or_else(|_| "work".to_string()),
        content: row.get("content")?,
        todo_id: row.get("todo_id")?,
        resolved: row.get("resolved")?,
    })
}
```

(Use `unwrap_or_else` as a safety fallback for rows that predate the column.)

- [ ] **Step 2: Add `project_key` to `log_add`**

```rust
#[tauri::command]
pub fn log_add(
    db_path: String,
    tag_key: String,
    content: String,
    project_key: Option<String>,
    date_str: Option<String>,
    todo_id: Option<i64>,
) -> Result<LogEntry, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let date = date_str.unwrap_or_else(today);
    let content = content.trim().to_string();
    let project = project_key.unwrap_or_else(|| "work".to_string());

    let row_id: i64 = conn
        .query_row(
            "INSERT INTO log_entries (date, tag_key, project, content, todo_id) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id",
            params![date, tag_key, project, content, todo_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    log_get(db_path, row_id)
}
```

- [ ] **Step 3: Add `project_key` to `log_update`**

In `log_update`, add `project_key: Option<String>` parameter and wire it into the dynamic query builder. Add after the `resolved` block:

```rust
#[tauri::command]
pub fn log_update(
    db_path: String,
    entry_id: i64,
    content: Option<String>,
    tag_key: Option<String>,
    resolved: Option<i64>,
    project_key: Option<String>,
) -> Result<LogEntry, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut parts: Vec<String> = Vec::new();
    if let Some(ref c) = content { let _ = c; parts.push("content = ?".to_string()); }
    if let Some(ref t) = tag_key  { let _ = t; parts.push("tag_key = ?".to_string()); }
    if let Some(r) = resolved     { let _ = r; parts.push("resolved = ?".to_string()); }
    if let Some(ref p) = project_key { let _ = p; parts.push("project = ?".to_string()); }
    if !parts.is_empty() {
        let sql = format!(
            "UPDATE log_entries SET {} WHERE id = {}",
            parts.join(", "),
            entry_id
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let mut idx = 1usize;
        if let Some(ref c) = content {
            stmt.raw_bind_parameter(idx, c.trim()).map_err(|e| e.to_string())?;
            idx += 1;
        }
        if let Some(ref t) = tag_key {
            stmt.raw_bind_parameter(idx, t).map_err(|e| e.to_string())?;
            idx += 1;
        }
        if let Some(r) = resolved {
            stmt.raw_bind_parameter(idx, if r != 0 { 1i64 } else { 0i64 })
                .map_err(|e| e.to_string())?;
            idx += 1;
        }
        if let Some(ref p) = project_key {
            stmt.raw_bind_parameter(idx, p).map_err(|e| e.to_string())?;
        }
        stmt.raw_execute().map_err(|e| e.to_string())?;
    }
    log_get(db_path, entry_id)
}
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/log.rs
git commit -m "feat(log): wire project_key through log_add, log_update, row_to_log"
```

---

## Task 4: Frontend — Types + invoke

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/invoke.ts`

- [ ] **Step 1: Add `Project` interface and update `LogEntry` + `AppConfig` in types.ts**

Add `Project` interface (same shape as `Tag`):

```typescript
export interface Project {
  key: string
  symbol: string
  name: string
  color: string
  bg_color?: string
}
```

Update `LogEntry`:

```typescript
export interface LogEntry {
  id: number
  date: string
  created_at: string
  tag_key: string
  project: string          // ← ADD
  content: string
  todo_id: number | null
  resolved: number
}
```

Update `AppConfig`:

```typescript
export interface AppConfig {
  tags: Tag[]
  projects: Project[]      // ← ADD
  config_path: string
  db_path: string
}
```

- [ ] **Step 2: Update `logAdd` and `logUpdate` in invoke.ts**

```typescript
logAdd: (dbPath: string, tagKey: string, content: string, projectKey?: string, todoId?: number) =>
  invoke<LogEntry>('log_add', { dbPath, tagKey, content, projectKey, todoId }),
logUpdate: (dbPath: string, entryId: number, content?: string, tagKey?: string, resolved?: number, projectKey?: string) =>
  invoke<LogEntry>('log_update', { dbPath, entryId, content, tagKey, resolved, projectKey }),
```

- [ ] **Step 3: Run type-check**

```bash
cd d:\Projects\worklog && pnpm build
```

Expected: type errors only in files not yet updated (App.tsx, useAppState.ts). Fix by proceeding to next tasks.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/lib/invoke.ts
git commit -m "feat(types): add Project type, project field to LogEntry, projects to AppConfig"
```

---

## Task 5: Frontend — Project state in useAppState

**Files:**
- Modify: `src/useAppState.ts`

- [ ] **Step 1: Add `Project` import and `projectIdx` to state**

Add `Project` to the import:

```typescript
import type { ActivePanel, AppConfig, FocusSession, LogEntry, Project, Tag, Todo } from './types'
```

Add to `AppState` interface:

```typescript
export interface AppState {
  // ...existing fields...
  projectIdx: number
}
```

Add to `AppActions` interface:

```typescript
export interface AppActions {
  // ...existing actions...
  projects: () => Project[]
  currentProject: () => Project | null
  cycleProject: (dir: 1 | -1) => void
  setProjectIdx: (idx: number) => void
}
```

- [ ] **Step 2: Add `projectIdx: 0` to `INITIAL` state**

```typescript
const INITIAL: AppState = {
  // ...existing fields...
  projectIdx: 0,
}
```

- [ ] **Step 3: Add project actions inside `useAppState` return**

Add these alongside the existing tag helpers (after `cycleTag`):

```typescript
projects: () => stateRef.current.config?.projects ?? [],

currentProject: () => {
  const projs = stateRef.current.config?.projects ?? []
  return projs[stateRef.current.projectIdx] ?? null
},

cycleProject: (dir: 1 | -1) => {
  const projs = stateRef.current.config?.projects ?? []
  if (projs.length === 0) return
  setState(s => ({
    ...s,
    projectIdx: (s.projectIdx + dir + projs.length) % projs.length,
  }))
},

setProjectIdx: (idx: number) => setState(s => ({ ...s, projectIdx: idx })),
```

- [ ] **Step 4: Run type-check**

```bash
pnpm build
```

Expected: remaining errors only in App.tsx and panel components.

- [ ] **Step 5: Commit**

```bash
git add src/useAppState.ts
git commit -m "feat(state): add projectIdx, projects(), currentProject(), cycleProject() to useAppState"
```

---

## Task 6: Frontend — Keybindings + App.tsx wiring

**Files:**
- Modify: `src/keybindings.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `cycleProject` to keybindings.ts**

Add to the `ActionName` union:

```typescript
export type ActionName =
  // ...existing...
  | 'cycleProject'
```

Add binding (`o`/`O` — mnemonic for "project" since `p` is taken):

```typescript
const BINDINGS: Record<string, ActionName> = {
  // ...existing...
  o: 'cycleProject',
  O: 'cycleProject',
}
```

- [ ] **Step 2: Handle `cycleProject` in App.tsx switch**

Find the `case 'prevTag':` block and add after it:

```typescript
case 'cycleProject':
  app.cycleProject(1)
  break
```

- [ ] **Step 3: Pass project props to LogPanel in App.tsx**

Find the `<LogPanel ... />` JSX and add:

```tsx
projects={app.config?.projects ?? []}
projectIdx={app.projectIdx}
onProjectChange={app.setProjectIdx}
```

- [ ] **Step 4: Add projectKey to `handleLogSubmit` in App.tsx**

Find `handleLogSubmit` callback and update the `api.logAdd` call:

```typescript
const handleLogSubmit = useCallback(async (text: string) => {
  if (!app.dbPath || !app.currentTag()) return
  const tag = app.currentTag()!
  const project = app.currentProject()
  try {
    await api.logAdd(app.dbPath, tag.key, text, project?.key)
    await app.loadLog()
  } catch (e) {
    showToast(String(e), 'error')
  }
}, [app, showToast])
```

- [ ] **Step 5: Commit**

```bash
git add src/keybindings.ts src/App.tsx
git commit -m "feat(app): wire cycleProject keybinding (o/O) and pass project to logAdd"
```

---

## Task 7: Frontend — LogPanel project picker UI

**Files:**
- Modify: `src/components/panels/LogPanel.tsx`

- [ ] **Step 1: Add project props to `Props` interface**

```typescript
import type { LogEntry, Project, Tag } from '../../types'

interface Props {
  // ...existing...
  projects: Project[]
  projectIdx: number
  onProjectChange: (idx: number) => void
}
```

- [ ] **Step 2: Destructure new props in component signature**

```typescript
export default function LogPanel({
  logEntries, filterKeys, logFilter, displayedEntryId, carryOver,
  tags, tagIdx, onTagChange,
  projects, projectIdx, onProjectChange,   // ← ADD
  isActive, inputFocused,
  onEntrySelect, onLogSubmit, onFilterChange, onInputFocus, onOpenHelp,
  focusInputRef, style,
}: Props) {
```

- [ ] **Step 3: Add project dropdown state**

Add alongside existing `tagDropOpen` state:

```typescript
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
```

- [ ] **Step 4: Add project picker badge to the input row**

In the form JSX, add the project picker **after** the tag picker and **before** the input:

```tsx
{projects.length > 1 && (
  <div ref={projectDropRef} style={{ position: 'relative', flexShrink: 0 }}>
    <button
      type="button"
      tabIndex={-1}
      onClick={() => setProjectDropOpen(v => !v)}
      style={{
        color: projects[projectIdx]?.color ?? 'inherit',
        background: projects[projectIdx]?.bg_color ?? ((projects[projectIdx]?.color ?? '#888') + '18'),
        fontSize: 10,
        padding: '2px 7px',
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
              background: p.bg_color ?? (p.color + '18'),
              fontSize: 10,
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
```

Note: The picker is only rendered when `projects.length > 1` — if the user has only "work", no picker clutters the UI.

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/LogPanel.tsx
git commit -m "feat(ui): add project picker badge to LogPanel input row"
```

---

## Task 8: Frontend — LogEntryRow project badge

**Files:**
- Modify: `src/components/widgets/LogEntryRow.tsx`

- [ ] **Step 1: Add project badge to entry row**

Show a small project badge between the tag badge and the content, **only when project is not 'work'** (keeps the view uncluttered for the common case).

Update the return JSX (add between the tag span and the content span):

```tsx
{entry.project && entry.project !== 'work' && (
  <span style={{
    color: '#888',
    background: '#88888818',
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 10,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  }}>
    {entry.project}
  </span>
)}
```

Note: We don't have the full Project object here (LogEntryRow only receives `tag: Tag | undefined`). The project key is enough for identification; if the user wants colored badges in the row, the parent would need to pass a project map. Keep it simple for now — just show the key as a neutral badge.

- [ ] **Step 2: Commit**

```bash
git add src/components/widgets/LogEntryRow.tsx
git commit -m "feat(ui): show project key badge in LogEntryRow when project != work"
```

---

## Task 9: Config update + final type-check

**Files:**
- Modify: `config.toml` (user's local config — not checked in)

- [ ] **Step 1: Update config.toml `[projects]` section**

Replace the current `[projects]` section:

```toml
# Before:
[projects]
active = ["Gartenhaus", "Hochbeet", "Foto-Archiv"]
```

With the tags-style format:

```toml
[projects]
work       = { symbol = "💼", name = "Arbeit",     color = "#5B8DEF" }
gartenhaus = { symbol = "🌿", name = "Gartenhaus", color = "#94D82D" }
hochbeet   = { symbol = "🪴", name = "Hochbeet",   color = "#00C896" }
foto       = { symbol = "📷", name = "Foto-Archiv",color = "#C77DFF" }
```

Keys must be lowercase, no spaces (they are stored in the DB). The `[schedule]` section can remain as-is (it is parsed but ignored).

- [ ] **Step 2: Run full type-check**

```bash
cd d:\Projects\worklog && pnpm build
```

Expected: 0 errors.

- [ ] **Step 3: Run app and verify end-to-end**

```bash
pnpm tauri dev
```

Verify:
- Project picker badge appears in log input row (only if `[projects]` has >1 entry)
- `o` key cycles through projects
- Submitting a log entry writes the selected project to DB
- Log entries with a non-'work' project show a small grey badge in the row
- Entries with project 'work' show no badge (clean view)

- [ ] **Step 4: Final commit**

```bash
git add config.toml
git commit -m "chore: update config.toml projects to symbol/name/color format"
```

---

## Self-Review

**Spec coverage:**
- ✅ Projects defined in config.toml, same structure as tags
- ✅ Default "work" (hardcoded fallback if section missing)
- ✅ DB column already exists, migration 8 handles new installs
- ✅ Project stored on log_add, readable in all log queries
- ✅ UI picker in log input (click to dropdown)
- ✅ Keyboard cycling via `o`/`O`
- ✅ Entry row shows project badge when != 'work'
- ✅ Picker hidden when only 1 project defined (no noise)

**Placeholder scan:** None found — all steps contain actual code.

**Type consistency:**
- `Project` struct (Rust) matches `Project` interface (TS) field-for-field
- `project_key` parameter name consistent across `log_add`/`log_update` Rust ↔ `logAdd`/`logUpdate` TS
- `projectIdx` naming consistent across `AppState`, `AppActions`, INITIAL, LogPanel props
