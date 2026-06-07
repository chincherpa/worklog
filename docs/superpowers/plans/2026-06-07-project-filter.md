# Project-Filter & farbige Project-Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, project-based filter row to the log panel (AND-combined with the existing tag filter) and replace the muted gray project label in log rows with a colored pill matching the existing tag-badge style.

**Architecture:** Mirror the existing tag-filter machinery (`logFilter`/`filterKeys`/`cycleFilter`/`setFilter`) with a parallel `projectFilter`/`projectFilterKeys`/`cycleProjectFilter`/`setProjectFilter` track in `useAppState`, generalize the existing `FilterBar` component to render either tags or projects, and restyle `LogEntryRow`'s project badge to match the tag badge's transparent-pill look.

**Tech Stack:** React + TypeScript (frontend only — no Rust/backend changes needed, `log_entries.project` already exists and is populated).

**Spec:** `docs/superpowers/specs/2026-06-07-project-filter-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/useAppState.ts` | new state fields `projectFilter`/`projectFilterKeys`, new actions `cycleProjectFilter`/`setProjectFilter`, AND-combine both filters in `moveLogIdx` |
| `src/keybindings.ts` | new actions `nextProjectFilter`/`prevProjectFilter` bound to `i`/`Shift+i` |
| `src/App.tsx` | wire new keybinding cases, pass new props to `LogPanel` |
| `src/components/widgets/FilterBar.tsx` | generalize `tags: Tag[]` prop to `items: FilterItem[]` so it works for both tags and projects |
| `src/components/panels/LogPanel.tsx` | render second `FilterBar` row for projects, AND-combine filters in `filtered`, pass `project` to `LogEntryRow` |
| `src/components/widgets/LogEntryRow.tsx` | new `project?: Project` prop, replace gray text badge with colored pill (always shown, matches tag-badge style) |

No test suite exists in this repo (per `CLAUDE.md`) — verification is `npx tsc --noEmit` after each task plus a manual smoke test in the browser preview (`pnpm dev`) at the end.

---

### Task 1: State — add `projectFilter`/`projectFilterKeys` fields + derive on load

**Files:**
- Modify: `src/useAppState.ts:13-31` (AppState interface)
- Modify: `src/useAppState.ts:60-78` (INITIAL)
- Modify: `src/useAppState.ts:108` and `:120` (loadAll)
- Modify: `src/useAppState.ts:136` and `:140` (loadLog)

- [ ] **Step 1: Add the two new fields to `AppState`**

In `src/useAppState.ts`, find:

```ts
  logFilter: string | null
  filterKeys: string[]
```

Replace with:

```ts
  logFilter: string | null
  filterKeys: string[]
  projectFilter: string | null
  projectFilterKeys: string[]
```

- [ ] **Step 2: Add matching defaults to `INITIAL`**

Find:

```ts
  logFilter: null,
  filterKeys: [],
```

Replace with:

```ts
  logFilter: null,
  filterKeys: [],
  projectFilter: null,
  projectFilterKeys: [],
```

- [ ] **Step 3: Derive `projectFilterKeys` in `loadAll`**

Find (around line 108):

```ts
      const usedTags = [...new Set(entries.map(e => e.tag_key))]
```

Replace with:

```ts
      const usedTags = [...new Set(entries.map(e => e.tag_key))]
      const usedProjects = [...new Set(entries.map(e => e.project))]
```

Then find the `setState` return object a few lines below it (around line 120):

```ts
          filterKeys: usedTags,
          displayedEntryId,
```

Replace with:

```ts
          filterKeys: usedTags,
          projectFilterKeys: usedProjects,
          displayedEntryId,
```

- [ ] **Step 4: Derive `projectFilterKeys` in `loadLog`**

Find (around line 136):

```ts
      const usedTags = [...new Set(entries.map((e: LogEntry) => e.tag_key))]
```

Replace with:

```ts
      const usedTags = [...new Set(entries.map((e: LogEntry) => e.tag_key))]
      const usedProjects = [...new Set(entries.map((e: LogEntry) => e.project))]
```

Then find (around line 140):

```ts
        filterKeys: usedTags,
        displayedEntryId: prev.displayedEntryId ?? (entries[0]?.id ?? null),
```

Replace with:

```ts
        filterKeys: usedTags,
        projectFilterKeys: usedProjects,
        displayedEntryId: prev.displayedEntryId ?? (entries[0]?.id ?? null),
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (new fields exist on the interface, are initialized, and are populated — nothing consumes them yet so nothing can be broken).

- [ ] **Step 6: Commit**

```bash
git add src/useAppState.ts
git commit -m "feat(state): derive projectFilterKeys alongside filterKeys"
```

---

### Task 2: State — `cycleProjectFilter`/`setProjectFilter` actions + AND-combine in `moveLogIdx`

**Files:**
- Modify: `src/useAppState.ts:33-58` (AppActions interface)
- Modify: `src/useAppState.ts:206-217` (cycleFilter/setFilter — insert mirrors after)
- Modify: `src/useAppState.ts:237-247` (moveLogIdx)
- Modify: `src/useAppState.ts:306-332` (return object)

- [ ] **Step 1: Declare the two new actions on `AppActions`**

Find:

```ts
  cycleFilter: (dir: 1 | -1) => void
  setFilter: (key: string | null) => void
```

Replace with:

```ts
  cycleFilter: (dir: 1 | -1) => void
  setFilter: (key: string | null) => void
  cycleProjectFilter: (dir: 1 | -1) => void
  setProjectFilter: (key: string | null) => void
```

- [ ] **Step 2: Implement the two functions, mirroring `cycleFilter`/`setFilter`**

Find:

```ts
  const cycleFilter = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const keys = [null, ...prev.filterKeys]
      const currentIdx = keys.indexOf(prev.logFilter)
      const next = ((currentIdx + dir) + keys.length) % keys.length
      return { ...prev, logFilter: keys[next] ?? null }
    })
  }, [])

  const setFilter = useCallback((key: string | null) => {
    setState(prev => ({ ...prev, logFilter: key }))
  }, [])
```

Replace with (keeps both originals, adds the project mirrors directly below):

```ts
  const cycleFilter = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const keys = [null, ...prev.filterKeys]
      const currentIdx = keys.indexOf(prev.logFilter)
      const next = ((currentIdx + dir) + keys.length) % keys.length
      return { ...prev, logFilter: keys[next] ?? null }
    })
  }, [])

  const setFilter = useCallback((key: string | null) => {
    setState(prev => ({ ...prev, logFilter: key }))
  }, [])

  const cycleProjectFilter = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const keys = [null, ...prev.projectFilterKeys]
      const currentIdx = keys.indexOf(prev.projectFilter)
      const next = ((currentIdx + dir) + keys.length) % keys.length
      return { ...prev, projectFilter: keys[next] ?? null }
    })
  }, [])

  const setProjectFilter = useCallback((key: string | null) => {
    setState(prev => ({ ...prev, projectFilter: key }))
  }, [])
```

- [ ] **Step 3: AND-combine both filters in `moveLogIdx`**

Find:

```ts
  const moveLogIdx = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const filtered = prev.logFilter
        ? prev.logEntries.filter(e => e.tag_key === prev.logFilter)
        : prev.logEntries
      if (filtered.length === 0) return prev
```

Replace with:

```ts
  const moveLogIdx = useCallback((dir: 1 | -1) => {
    setState(prev => {
      const filtered = prev.logEntries.filter(e =>
        (!prev.logFilter || e.tag_key === prev.logFilter) &&
        (!prev.projectFilter || e.project === prev.projectFilter)
      )
      if (filtered.length === 0) return prev
```

- [ ] **Step 4: Export the two new actions from the hook's return object**

Find:

```ts
    cycleFilter,
    setFilter,
```

Replace with:

```ts
    cycleFilter,
    setFilter,
    cycleProjectFilter,
    setProjectFilter,
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/useAppState.ts
git commit -m "feat(state): add cycleProjectFilter/setProjectFilter, AND-combine with tag filter"
```

---

### Task 3: Keybindings — `i`/`Shift+i` cycle the project filter

**Files:**
- Modify: `src/keybindings.ts:1-27` (ActionName union)
- Modify: `src/keybindings.ts:36-82` (BINDINGS map)

- [ ] **Step 1: Add the two new action names to the union**

Find:

```ts
  | 'nextFilter'
  | 'prevFilter'
```

Replace with:

```ts
  | 'nextFilter'
  | 'prevFilter'
  | 'nextProjectFilter'
  | 'prevProjectFilter'
```

- [ ] **Step 2: Bind `i` (next) and `Shift+i` (prev)**

`keyStr()` (line 29-34) builds the lookup key as `"Shift+" + e.key` whenever `shiftKey` is held — e.g. pressing Shift+i produces `e.key === 'I'` and `keyStr` returns `"Shift+I"`, NOT plain `"I"`. The only binding in this file that actually matches a Shift-combo is `'Shift+D': 'deleteEntry'` (line 42); the bare-uppercase entries (`O`, `N`, `B`, `P`, …) are unreachable via Shift on a standard keyboard — they're a pre-existing latent issue, out of scope to fix here. Use the **working** `'Shift+X'` format for the new prev-binding so it actually fires:

Find:

```ts
  o: 'cycleProject',
  O: 'cycleProject',
```

Replace with:

```ts
  o: 'cycleProject',
  O: 'cycleProject',
  i: 'nextProjectFilter',
  'Shift+I': 'prevProjectFilter',
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (new `ActionName` members are valid strings; nothing consumes them yet so no exhaustiveness errors).

- [ ] **Step 4: Commit**

```bash
git add src/keybindings.ts
git commit -m "feat(keybindings): bind i/I to cycle project filter"
```

---

### Task 4: Wire the new keybinding cases + pass new props to `LogPanel`

**Files:**
- Modify: `src/App.tsx:183-189` (switch cases)
- Modify: `src/App.tsx:426-449` (`<LogPanel>` props)

- [ ] **Step 1: Add the two switch cases right after the existing filter cases**

Find:

```ts
      case 'nextFilter':
        app.cycleFilter(1)
        break

      case 'prevFilter':
        app.cycleFilter(-1)
        break
```

Replace with:

```ts
      case 'nextFilter':
        app.cycleFilter(1)
        break

      case 'prevFilter':
        app.cycleFilter(-1)
        break

      case 'nextProjectFilter':
        app.cycleProjectFilter(1)
        break

      case 'prevProjectFilter':
        app.cycleProjectFilter(-1)
        break
```

- [ ] **Step 2: Pass the new filter props down to `LogPanel`**

Find:

```ts
        filterKeys={app.filterKeys}
        logFilter={app.logFilter}
```

Replace with:

```ts
        filterKeys={app.filterKeys}
        logFilter={app.logFilter}
        projectFilterKeys={app.projectFilterKeys}
        projectFilter={app.projectFilter}
```

Then find:

```ts
        onFilterChange={app.setFilter}
```

Replace with:

```ts
        onFilterChange={app.setFilter}
        onProjectFilterChange={app.setProjectFilter}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors `Property 'projectFilterKeys' does not exist on type 'IntrinsicAttributes & Props'` (and similarly for `projectFilter`/`onProjectFilterChange`) — this is expected; `LogPanel`'s `Props` interface doesn't have these yet. Task 6 adds them. **Do not fix this here** — just confirm the error message names exactly these three new props (sanity check that you typed them correctly), then continue.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire i/I project-filter keybindings and pass filter props to LogPanel"
```

---

### Task 5: Generalize `FilterBar` to render tags OR projects

**Files:**
- Modify: `src/components/widgets/FilterBar.tsx` (whole file — small, ~73 lines)

`Tag` and `Project` (see `src/types.ts:63-76`) share the exact same relevant shape: `key`, `symbol`, `color`, `bg_color?`. `FilterBar` only ever reads those four fields, so generalizing the prop type from `Tag[]` to a small structural shape lets the same component render either, with zero behavior change for the existing tag-filter row.

- [ ] **Step 1: Replace the `tags` prop with a generic `items` prop**

Find:

```ts
import { TEXT_DIM } from '../../theme'
import type { Tag } from '../../types'

interface Props {
  filterKeys: string[]
  activeFilter: string | null
  tags: Tag[]
  onSelect: (key: string | null) => void
}

export default function FilterBar({ filterKeys, activeFilter, tags, onSelect }: Props) {
  const tagMap = new Map(tags.map(t => [t.key, t]))
```

Replace with:

```ts
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
```

- [ ] **Step 2: Update the chip-rendering block to use `itemMap`**

Find:

```ts
      {filterKeys.map(k => {
        const tag = tagMap.get(k)
        const active = k === activeFilter
        const color = tag?.color ?? TEXT_DIM
        const bg = tag?.bg_color ?? (color + '28')
```

Replace with:

```ts
      {filterKeys.map(k => {
        const item = itemMap.get(k)
        const active = k === activeFilter
        const color = item?.color ?? TEXT_DIM
        const bg = item?.bg_color ?? (color + '28')
```

Then find (still inside the same `.map`, the chip label):

```ts
            {tag ? `${tag.symbol} ${k}` : k}
```

Replace with:

```ts
            {item ? `${item.symbol} ${k}` : k}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: a NEW error in `LogPanel.tsx` — `Property 'items' is missing in type '{ filterKeys: ...; tags: Tag[]; ... }'` (or similar, naming `tags`/`items`). This is expected — the existing `<FilterBar tags={tags} .../>` call in `LogPanel` still uses the old prop name. Task 6 fixes it. Confirm the error references `FilterBar`'s props, then continue.

- [ ] **Step 4: Commit**

```bash
git add src/components/widgets/FilterBar.tsx
git commit -m "refactor(filterbar): generalize tags prop to items so it can render projects too"
```

---

### Task 6: `LogPanel` — second filter row, AND-combined filtering, pass `project` to rows

**Files:**
- Modify: `src/components/panels/LogPanel.tsx:8-46` (Props, destructure, `filtered`)
- Modify: `src/components/panels/LogPanel.tsx:122-130` (filter bar block)
- Modify: `src/components/panels/LogPanel.tsx:138-144` (`<LogEntryRow>` props)

- [ ] **Step 1: Add the three new props to the `Props` interface**

Find:

```ts
  filterKeys: string[]
  logFilter: string | null
  displayedEntryId: number | null
```

Replace with:

```ts
  filterKeys: string[]
  logFilter: string | null
  projectFilterKeys: string[]
  projectFilter: string | null
  onProjectFilterChange: (key: string | null) => void
  displayedEntryId: number | null
```

- [ ] **Step 2: Destructure the new props**

Find:

```ts
  logEntries, filterKeys, logFilter, displayedEntryId,
```

Replace with:

```ts
  logEntries, filterKeys, logFilter, projectFilterKeys, projectFilter, onProjectFilterChange, displayedEntryId,
```

- [ ] **Step 3: Build a `projectMap` (mirrors the existing `tagMap`) and AND-combine both filters in `filtered`**

Find:

```ts
  const inputRef = useRef<HTMLInputElement>(null)
  const tagMap = new Map(tags.map(t => [t.key, t]))

  const today = new Date().toISOString().slice(0, 10)
  const todayEntries = logEntries.filter(e => e.date === today)

  const filtered = logFilter
    ? logEntries.filter(e => e.tag_key === logFilter)
    : logEntries
```

Replace with:

```ts
  const inputRef = useRef<HTMLInputElement>(null)
  const tagMap = new Map(tags.map(t => [t.key, t]))
  const projectMap = new Map(projects.map(p => [p.key, p]))

  const today = new Date().toISOString().slice(0, 10)
  const todayEntries = logEntries.filter(e => e.date === today)

  const filtered = logEntries.filter(e =>
    (!logFilter || e.tag_key === logFilter) &&
    (!projectFilter || e.project === projectFilter)
  )
```

- [ ] **Step 4: Render a project `FilterBar` row above the existing tag `FilterBar` row**

Find:

```ts
      {/* Filter bar */}
      {filterKeys.length > 0 && (
        <FilterBar
          filterKeys={filterKeys}
          activeFilter={logFilter}
          tags={tags}
          onSelect={onFilterChange}
        />
      )}
```

Replace with:

```ts
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
```

(Note `tags={tags}` → `items={tags}` on the existing block — this is the fix for the Task 5 type error.)

- [ ] **Step 5: Pass the looked-up `Project` to each `LogEntryRow`**

Find:

```ts
              <LogEntryRow
                key={e.id}
                entry={e}
                tag={tagMap.get(e.tag_key)}
                selected={e.id === displayedEntryId}
                onClick={() => onEntrySelect(e.id)}
              />
```

Replace with:

```ts
              <LogEntryRow
                key={e.id}
                entry={e}
                tag={tagMap.get(e.tag_key)}
                project={projectMap.get(e.project)}
                selected={e.id === displayedEntryId}
                onClick={() => onEntrySelect(e.id)}
              />
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: error `Property 'project' does not exist on type 'IntrinsicAttributes & Props'` in `LogEntryRow`'s usage — expected, Task 7 adds it. Confirm the error names `project` on `LogEntryRow`, then continue. (No other errors should remain — the `App.tsx` props from Task 4 and the `FilterBar` `items` prop from Task 5 are now satisfied.)

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/LogPanel.tsx
git commit -m "feat(ui): add project filter row to LogPanel, AND-combine with tag filter"
```

---

### Task 7: `LogEntryRow` — colored project badge, always shown

**Files:**
- Modify: `src/components/widgets/LogEntryRow.tsx` (whole file — small, ~82 lines)

- [ ] **Step 1: Add the `project` prop and import `Project`**

Find:

```ts
import type { LogEntry, Tag } from '../../types'

interface Props {
  entry: LogEntry
  tag: Tag | undefined
  selected: boolean
  onClick: () => void
}

export default function LogEntryRow({ entry, tag, selected, onClick }: Props) {
```

Replace with:

```ts
import type { LogEntry, Project, Tag } from '../../types'

interface Props {
  entry: LogEntry
  tag: Tag | undefined
  project: Project | undefined
  selected: boolean
  onClick: () => void
}

export default function LogEntryRow({ entry, tag, project, selected, onClick }: Props) {
```

- [ ] **Step 2: Replace the gray text badge with a colored pill matching the tag-badge style**

Find:

```ts
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

Replace with:

```ts
      {project && (
        <span style={{
          color: project.color,
          background: project.bg_color ?? (project.color + '28'),
          fontSize: 11,
          padding: '1px 6px',
          borderRadius: 10,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {project.symbol} {project.key}
        </span>
      )}
```

(Badge now renders for every entry that has a resolvable project — including the default `work` — matching the user's "always show" decision. If `project` is `undefined` — e.g. a stale `project` key no longer in config — nothing renders, same fallback behavior as the existing `tag` badge.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. This was the last dangling prop — the chain from Task 4 → 5 → 6 → 7 should now be fully satisfied.

- [ ] **Step 4: Commit**

```bash
git add src/components/widgets/LogEntryRow.tsx
git commit -m "feat(ui): replace gray project label with colored pill matching tag-badge style"
```

---

### Task 8: Manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Start the browser preview**

Run: `pnpm dev`
Expected: Vite dev server starts, app loads in browser at the printed local URL (no Rust backend needed for this UI-only check — but note `api.*` calls will fail without Tauri; if the preview shows a config error or empty state, instead run `pnpm tauri dev` for a full backend-connected check).

- [ ] **Step 2: Verify the two filter rows render in the right order**

In the log panel, confirm you see TWO chip rows stacked: the **project** row (chips like `💼 work`, `🌿 gartenhaus`, …, plus `All`) directly above the **tag** row (`✓ done`, `✕ block`, …, plus `All`) — matching the reference screenshot's layout.

- [ ] **Step 3: Verify project-row click filtering**

Click a non-`All` chip in the project row. Confirm the entry list narrows to only entries with that project. Click `All` to reset.

- [ ] **Step 4: Verify AND-combination**

With a project chip active, also click a tag chip (e.g. `✕ block`). Confirm the list now shows only entries matching BOTH (project AND tag) — i.e. fewer or equal entries vs. either filter alone, and every visible entry's badges match both active chips.

- [ ] **Step 5: Verify `i`/`Shift+i` keybinding**

Focus the log panel (click into it or press `Tab` until active), then press `i` repeatedly. Confirm the active project-filter chip cycles forward through `All → project1 → project2 → … → All`. Press `Shift+i` (`I`) and confirm it cycles backward. Confirm `n`/`N`/`b`/`B` still cycle the TAG filter independently (no cross-talk between the two filter dimensions).

- [ ] **Step 6: Verify per-row badges**

Confirm every visible log entry now shows a colored project pill (e.g. `💼 work`, `🌿 gartenhaus`) directly to the left of its tag pill — including entries whose project is the default `work` (previously hidden). Confirm the pill's color/background matches the project's configured color in `config.toml`, in the same transparent-pill style as the tag badge (not a flat gray box).

- [ ] **Step 7: Final type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Stop the dev server**

Press `Ctrl+C` in the terminal running `pnpm dev` (or `pnpm tauri dev`).
