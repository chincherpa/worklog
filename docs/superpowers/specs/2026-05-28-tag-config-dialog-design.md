# Tag-Verwaltungs-Dialog — Design Spec
Date: 2026-05-28

## Problem

Tags werden in `config.toml` verwaltet. Die App liest die Konfiguration beim Start einmalig. Neue Tags müssen manuell in die Datei eingetragen werden und erscheinen erst nach App-Neustart. Außerdem: Die App liest `./config.toml` (Projektverzeichnis) vorrangig vor `~/.config/worklog/config.toml`, was zu Verwirrung führt wenn nur die User-Config bearbeitet wird.

**Scope dieser Spec:** Tag-Verwaltungs-Dialog (CRUD). Der Config-Pfad-Bug ist ein separates Fix (lokale config.toml anpassen oder löschen).

## Feature-Übersicht

Neuer Modal-Dialog für Tag-Verwaltung. Öffnet per Tastenkürzel `G`. Ermöglicht: Tags anzeigen, bearbeiten, hinzufügen, löschen. Speichert Änderungen in `config.toml`. Lädt App-Config danach neu.

## Architektur

### Datenfluss

```
ConfigDialog (lokaler State: Tag[]) 
  → api.saveTags(configPath, tags) 
  → Rust: save_tags command 
  → config.toml neu schreiben 
  → api.getConfig() 
  → App-State aktualisieren
```

### Schichten

**1. Rust — `src-tauri/src/commands/config.rs`**

Neuer Command `save_tags`:
- Parameter: `config_path: String`, `tags: Vec<TagInput>`
- `TagInput { key, symbol, name, color, category, active }`
- Implementierung:
  1. `load_config(Some(config_path))` → holt aktuellen `schedule`, `db_path`, `projects`
  2. Tags nach `category` gruppieren → `HashMap<String, HashMap<String, RawTagOut>>`
  3. Serialisierbaren `ConfigOut`-Struct bauen
  4. `toml::to_string(&config_out)` → Datei schreiben
- Kommentare gehen beim Speichern verloren (akzeptiert)
- In `src-tauri/src/lib.rs` invoke_handler registrieren (dort wo alle anderen Commands sind)

**2. API — `src/lib/invoke.ts`**

```ts
saveTags: (configPath: string, tags: Tag[]) =>
  invoke<void>('save_tags', { configPath, tags })
```

**3. Dialog — `src/components/dialogs/ConfigDialog.tsx`**

Neue Datei. Folgt bestehendem Dialog-Muster (Overlay, BG_PANEL, Keyboard-Handler im useEffect).

Lokaler State:
- `tags: Tag[]` — Arbeitskopie (initialisiert aus props)
- `selectedIdx: number`
- `editingIdx: number | null` — null = kein Inline-Edit aktiv
- `editDraft: Partial<Tag> & { key: string } | null` — aktuell bearbeiteter Tag (key leer string bei Neu-Erstellung)

**4. App.tsx**

- `'config'` zu `DialogType` hinzufügen
- Case `'openConfig'` im `handleAction` switch → `openDialog({ type: 'config' })`
- Keybinding `G` in `keybindings.ts` verdrahten
- `handleConfigSave` Handler: `saveTags` aufrufen, Config neu laden, Toast zeigen
- `<ConfigDialog>` rendern

## Dialog UX

### Layout

Modal, ~600px breit, ~480px hoch, TUI-Stil konsistent mit anderen Dialogen.

```
┌─ ⚙ Tags verwalten ───────────────────────────────────────┐
│ Kat.    Key      Sym  Name           Farbe    Aktiv       │
│ ─────────────────────────────────────────────────────── │
│ work    urgent    🔥  Wichtig         ██       ✓         │
│▶work    done      ✓   Erledigt        ██       ✓         │  ← selected
│ any     note      🗒️  Notiz           ██       ✓         │
│ ─────────────────────────────────────────────────────── │
│ ↑↓ Navigieren · Enter Bearbeiten · A Neu · D Löschen    │
│ S Speichern · Esc Abbrechen                              │
└──────────────────────────────────────────────────────────┘
```

### Inline-Edit-Zeile

Wenn `editingIdx !== null` wird die Zeile durch ein Formular ersetzt:

```
│▶ Key:[done____] Sym:[✓_] Name:[Erledigt______] Kat:[work]│
│  Farbe: ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■    Aktiv: [✓]          │
│  Enter=Übernehmen · Esc=Abbruch                           │
```

- Bei neuem Tag (A): Key-Feld editierbar, prefill leer
- Bei bestehendem Tag: Key-Feld read-only (Key ist identifier)
- Kategorie: Toggle work / any (Tab zwischen Feldern)
- Farbe: Palette mit 12 Presets, ←/→ oder Klick

### Farbpalette (12 Presets)

```
#F03E3E  #FF6B6B  #FFD93D  #94D82D  #00C896
#339AF0  #5B8DEF  #C77DFF  #FF922B  #CED4DA  #D0D0D0  #F9C74F
```

Dargestellt als farbige Quadrate (~18×18px), aktuelle Farbe mit Rahmen hervorgehoben.

### Löschen-Bestätigung

D drücken → ConfigDialog zeigt intern eine Confirm-Zeile ("Tag löschen? D=Ja, Esc=Nein") im Dialog-Footer. Kein externer ConfirmDialog — wir sind bereits in einem Modal. Bei Bestätigung: Tag aus lokalem State entfernen.

### Tastatursteuerung

| Taste | Aktion |
|-------|--------|
| ↑ / ↓ | Navigation |
| Enter | Ausgewählten Tag bearbeiten (öffnet Inline-Edit) |
| A | Neuen Tag hinzufügen (Inline-Edit am Ende) |
| D | Ausgewählten Tag löschen (mit Confirm-Dialog) |
| S | Alle Änderungen speichern → disk + config reload |
| Esc | Dialog schließen ohne speichern |

Im Inline-Edit:
| Taste | Aktion |
|-------|--------|
| Enter | Änderungen übernehmen (in lokalen State) |
| Esc | Bearbeitung abbrechen |
| Tab | Nächstes Feld |

### Wichtig: Kein Auto-Save

Änderungen leben im Dialog-State. Erst `S` schreibt auf Disk. Esc verwirft alles.

## Rust: Config-Serialisierung

```rust
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

`toml::to_string(&config_out)` liefert valides TOML. Kommentare und Formatierung der Originaldate gehen verloren.

## Config-Reload nach Save

In `handleConfigSave` in `App.tsx`:
1. `await api.saveTags(app.config.config_path, editedTags)`
2. `const newConfig = await api.getConfig()`
3. `app.setConfig(newConfig)` — neuer Action in `useAppState`
4. `closeDialog()`
5. `showToast('Tags gespeichert', 'success')`

`setConfig` in `useAppState` → `setState(prev => ({ ...prev, config: newConfig }))`. Tagidx wird auf 0 zurückgesetzt wenn aktiver Tag nicht mehr existiert.

## Dateien die sich ändern

| Datei | Änderung |
|-------|----------|
| `src-tauri/src/commands/config.rs` | `save_tags` command + Hilfs-Structs |
| `src-tauri/src/lib.rs` | `save_tags` in invoke_handler |
| `src/lib/invoke.ts` | `api.saveTags` |
| `src/components/dialogs/ConfigDialog.tsx` | Neue Datei |
| `src/App.tsx` | DialogType, Keybinding, Handler, Render |
| `src/useAppState.ts` | `setConfig` Action |
| `src/keybindings.ts` | `G` → `openConfig` |

## Außerhalb des Scope

- Config-Pfad-Bug (lokale `config.toml` shadowed User-Config) — separates Fix
- Schedule-Verwaltung im Dialog
- Tag-Reihenfolge in config.toml bestimmen
- Farbfreitext-Eingabe (nur Palette)
