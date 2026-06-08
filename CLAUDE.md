# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tauri v2 desktop app: keyboard-driven work journal with todos, focus sessions, and daily/weekly reviews. React frontend (TUI-style, no mouse), Rust backend, SQLite database.

## Commands

```powershell
# Dev (starts Vite + Tauri)
pnpm tauri dev

# Build release
pnpm tauri build

# Frontend only (no Rust, browser preview)
pnpm dev

# Type-check frontend
pnpm build   # runs tsc && vite build
```

No test suite exists. Type checking is the primary correctness check.

## Config

App requires `config.toml` at `./config.toml` or `~/.config/worklog/config.toml`. Structure:

```toml
db_path = "journal.db"   # relative to config file (or absolute)

[tags]
done   = { symbol = "✓",  name = "Erledigt",  color = "#00C896" }
block  = { symbol = "✕",  name = "Blockiert", color = "#FF6B6B" }
note   = { symbol = "🗒️",  name = "Notiz",     color = "#D0D0D0" }
```

Tags and projects are each a flat key→{symbol, name, color, bg_color?} map, both editable at runtime via `ConfigDialog` (g/G — Tab switches between Tags/Projects sections). No categories or active flags. `[schedule]` is accepted in TOML but currently ignored by the backend.

## Architecture

**Data flow:** React → `api` object (`src/lib/invoke.ts`) → Tauri `invoke()` → Rust command → rusqlite → SQLite file.

**Frontend state:** Single `useAppState` hook (`src/useAppState.ts`) owns all app state. `App.tsx` wires keyboard events to state actions and dialog open/close. No external state library.

**Panels:** Three side-by-side panels — `LogPanel` (left), `ContentPanel` (center, toggleable), `TodoPanel` (right, toggleable). Active panel determines which keyboard actions apply.

**Dialogs:** Controlled from `App.tsx` via a single `{ type: DialogType }` state. Types: `confirm`, `newTodo`, `contentEdit`, `tagSelect`, `focus`, `debrief`, `todoDetail`, `weekly`, `help`, `config`. Modal, block global keyboard handler via `app.dialogOpen`.

**Backend modules:**
- `src-tauri/src/commands/` — one file per domain (log, todo, session, notes, config, git, meta)
- `src-tauri/src/db.rs` — SQLite connection (WAL mode) + migration runner (numbered `MIGRATION_N` constants)
- `src-tauri/src/app_config.rs` — TOML config loader
- `src-tauri/src/models.rs` — Serde structs shared across commands

**Database:** SQLite with WAL + foreign keys. Migrations run on `init_db` call at startup (`db::migrate`). Schema version tracked in `schema_version` table. New migrations: add a new `(N, MIGRATION_N)` tuple in `db.rs`.

**`dbPath` threading:** Every Rust command takes `db_path: String` and opens a fresh connection. No global connection state.

## Key conventions

- All tags cycle in log input (Tab to cycle); no category filtering anymore.
- `todo.mode` controls which todos show: `"work"` todos only visible in work mode.
- `log_entries.resolved` flag marks "block" entries as resolved.
- Focus sessions have a single-active constraint via SQLite partial unique index (`WHERE ended_at IS NULL`).
- UI strings are German (the app is personal tooling).
- `ConfigDialog` (g/G) edits tags at runtime and writes back to `config.toml`.

## Build & Release

```bat
build-release.bat       # bumps patch version, builds, zips exe to X:\Bertrandt\worklog.zip
bump-version.ps1        # increments patch in package.json + tauri.conf.json + Cargo.toml
```
