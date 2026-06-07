# Project-Filter & farbige Project-Badges

## Context

Projects (Arbeit/Garten/Hochbeet/Foto…) lassen sich seit `2026-06-06-log-projects.md` einem Log-Eintrag zuweisen (Picker `o`/`O`, gespeichert in `log_entries.project`). Was fehlt: nach Project filtern, und Project in der Eintragsliste visuell erkennen. Aktuell zeigt `LogEntryRow` einen dezenten grauen Text-Badge, nur wenn `project !== 'work'`.

Ziel: zweite Filterzeile (analog Tag-Filter) + farbige, immer sichtbare Project-Badges, im selben transparenten Pillen-Stil wie bestehende Tag-Badges.

## State & Filter-Logik (`useAppState.ts`)

- Neue Felder im `AppState`: `projectFilter: string | null`, `projectFilterKeys: string[]`
- `projectFilterKeys` wird wie `usedTags` aus den geladenen Entries abgeleitet:
  `[...new Set(entries.map(e => e.project))]` — in `loadAll` und `loadLog`
- Neue Actions, 1:1 Spiegel der bestehenden Tag-Filter-Functions:
  - `cycleProjectFilter(dir: 1 | -1)` — analog `cycleFilter`, zykelt durch `[null, ...projectFilterKeys]`
  - `setProjectFilter(key: string | null)` — analog `setFilter`
- **Kombination beider Filter = UND-Verknüpfung.** Überall wo aktuell nach `logFilter` gefiltert wird (LogPanel `filtered`, `moveLogIdx`), zusätzlich auf `projectFilter` prüfen:
  ```ts
  entries.filter(e =>
    (!logFilter || e.tag_key === logFilter) &&
    (!projectFilter || e.project === projectFilter)
  )
  ```

## Keybinding

Neue `ActionName`-Varianten `nextProjectFilter` / `prevProjectFilter`, gebunden auf `i` (next) / `Shift+i` = `I` (prev) — analog zu `n`/`N` und `b`/`B` für den Tag-Filter, aber als eigenes Tastenpaar, da beide Filter unabhängig bedienbar sein müssen. In `App.tsx` rufen die neuen Cases `app.cycleProjectFilter(1)` bzw. `app.cycleProjectFilter(-1)`.

## UI — FilterBar generalisieren

`FilterBar` nimmt aktuell `tags: Tag[]` entgegen und rendert Chips für die in `filterKeys` enthaltenen Keys. `Tag` und `Project` haben dasselbe relevante Shape (`key`, `symbol`, `color`, `bg_color?`). Prop wird generalisiert:

```ts
interface FilterBarProps {
  filterKeys: string[]
  activeFilter: string | null
  items: { key: string; symbol: string; color: string; bg_color?: string }[]
  onSelect: (key: string | null) => void
}
```

Interne Logik (Map-Lookup, Chip-Rendering, "All"-Button, Styling) bleibt unverändert — nur der Lookup-Typ wird generischer.

`LogPanel` rendert künftig **zwei** `FilterBar`-Zeilen übereinander:
1. Project-FilterBar (oben) — `items={projects}`, `filterKeys={projectFilterKeys}`, `activeFilter={projectFilter}`, `onSelect={onProjectFilterChange}`
2. Tag-FilterBar (unten) — wie bisher

Reihenfolge entspricht dem vom User gezeigten Referenz-Screenshot. Neue Props `projectFilter`, `projectFilterKeys`, `onProjectFilterChange` werden von `App.tsx` durchgereicht.

## LogEntryRow — Badge umstellen

- Neuer Prop `project?: Project` (Lookup über `projectMap`, analog zum bestehenden `tag`-Lookup in `LogPanel`)
- Bestehender grauer Text-Badge (Zeilen 55-67) wird ersetzt durch farbige Pille im selben Stil wie der Tag-Badge:
  ```ts
  {
    color: project.color,
    background: project.bg_color ?? (project.color + '28'),
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 10,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  }
  ```
  Inhalt: `{project.symbol} {project.key}` (konsistent zu Tag-Badge und Input-Picker)
- Bedingung `entry.project !== 'work'` entfällt — Badge wird **immer** angezeigt (auch für Default-Project), da es jetzt auch als Filter-Kategorie sichtbar/wählbar ist und Konsistenz wichtiger ist als Reduktion von Sichtbarem.

## Out of scope

- Solide/gefüllte Pillen-Optik (Screenshot war reine Layout-Skizze, kein Style-Vorbild — bestätigt vom User)
- Änderungen an bestehender Tag-Badge-Optik
- Persistenz des Filter-Zustands über Sessions hinweg (wie bisher: flüchtig, reset bei Neustart)
