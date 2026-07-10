# Code Review — worklog

**Datum:** 2026-07-10 · **Stand:** `master` / `claude/code-review-npkdv3` (identisch) · **Umfang:** gesamte Codebase (React/TypeScript-Frontend, Rust-Backend, SQLite)

## Zusammenfassung

Die Codebase ist insgesamt in gutem Zustand: klare Modultrennung (ein Command-File pro Domäne, ein zentraler State-Hook), konsequentes Parameter-Binding in fast allen SQL-Queries, durchdachte Details wie der partielle Unique-Index für „nur eine aktive Focus-Session" und die Lane-Packung im Gantt-Dialog. Der TypeScript-Typecheck (`tsc --noEmit`) läuft fehlerfrei durch. `cargo check` konnte in der Review-Umgebung nicht ausgeführt werden (fehlende GTK-Systembibliotheken im Linux-Container — kein Code-Problem).

Die wichtigsten Punkte: Ein Datenkorrektheits-Bug beim Session-Debriefing (Log-Eintrag kann am falschen Todo landen), stiller Datenverlust beim Zurückschreiben der `config.toml`, nicht-transaktionale/nicht-idempotente Migrationen sowie eine Handvoll Zeitzonen- und Kalenderfehler, die für eine Journal-App relevant sind.

---

## Hoch

### H1 · Debrief-Log-Eintrag wird dem selektierten statt dem Session-Todo zugeordnet

`src/App.tsx:514-517` (`handleDebriefResult`), außerdem `src/App.tsx:747` (`DebriefingDialog` erhält `selectedTodo`)

Beim Beenden einer Focus-Session wird der Journal-Eintrag aus `app.todos[app.todoIdx]` erzeugt — also aus dem aktuell im TodoPanel **selektierten** Todo, nicht aus dem Todo der Session (`app.activeSession.todo_id`). Da der Focus-Dialog minimierbar ist und die Todo-Auswahl währenddessen frei per Pfeiltasten/Klick wechselbar bleibt, passiert Folgendes: Session zu Todo A starten → minimieren → Todo B selektieren → Session über die SessionBar (⏹) beenden → der Log-Eintrag bekommt Titel und `todo_id` von **Todo B**. Dieselbe Verwechslung zeigt der `DebriefingDialog` im Titel, und `handleSessionBarStop` (`src/App.tsx:498-506`) übergibt ebenfalls das selektierte Todo.

**Fix:** Das Todo aus `app.activeSession.todo_id` auflösen (`app.todos.find(t => t.id === app.activeSession.todo_id)`) und dieses sowohl an den Dialog als auch an `logAdd` geben.

### H2 · `write_config` verwirft beim Speichern unbekannte TOML-Inhalte

`src-tauri/src/commands/config.rs:88-104` (`write_config`), genutzt von `save_tags`/`save_projects`/`save_keybindings`

Beim Speichern aus dem ConfigDialog wird die `config.toml` komplett neu serialisiert — aber nur mit `db_path`, `tags`, `projects`, `keybindings`. Alles andere geht stillschweigend verloren: die laut CLAUDE.md akzeptierte `[schedule]`-Sektion, sämtliche Kommentare und jede manuelle Formatierung. Zusätzlich wird `db_path` nicht als der ursprünglich konfigurierte Wert zurückgeschrieben, sondern als der von `load_config` bereits **aufgelöste absolute Pfad** (`src-tauri/src/app_config.rs:53-67`) — ein relatives `db_path = "journal.db"` wird nach dem ersten Speichern dauerhaft absolut, was die Portabilität der Config (z. B. USB-Stick, anderer Rechner) bricht.

**Fix:** Beim Speichern das Original-Dokument laden (z. B. mit `toml_edit`, das Kommentare/Unbekanntes erhält) und nur die betroffene Sektion ersetzen; `db_path` unverändert übernehmen statt den aufgelösten Pfad zu schreiben.

### H3 · Migrationen sind weder transaktional noch idempotent

`src-tauri/src/db.rs:50-72` (`migrate`), `db.rs:209-212` (`MIGRATION_2`), `db.rs:214-260` (`MIGRATION_3/4`)

`exec_migration_sql` führt jedes Statement einzeln per `execute_batch` aus; die Versionsnummer wird erst nach Abschluss der Migration eingetragen. Bricht der Prozess mittendrin ab (Crash, Stromausfall, volle Platte), ist die Migration halb angewendet, die Version aber nicht erhöht — und der nächste Start scheitert hart: `MIGRATION_2` (`ALTER TABLE log_entries ADD COLUMN resolved`) wirft bei Wiederholung „duplicate column", `MIGRATION_3/4` scheitern an der bereits existierenden `todos_new`. Die App startet dann ohne manuelle DB-Reparatur nicht mehr.

**Fix:** Jede Migration inklusive des `INSERT INTO schema_version` in eine Transaktion packen (SQLite-DDL ist transaktional). Die `PRAGMA foreign_keys`-Zeilen in MIGRATION_3/4 müssen dafür außerhalb der Transaktion ausgeführt werden.

---

## Mittel

### M1 · „Nothing to commit" wird auf stderr geprüft, git schreibt es aber auf stdout

`src-tauri/src/commands/git.rs:44-53`

`git commit` meldet „nothing to commit, working tree clean" auf **stdout** (mit Exit-Code 1), die Erkennung prüft aber nur `stderr`. Ergebnis: „push DB" ohne DB-Änderung liefert statt des freundlichen „Nothing to commit" immer den Fehler `git commit failed:` mit leerer Meldung.

**Fix:** stdout (oder stdout+stderr kombiniert) auf den String prüfen — oder robuster: vor dem Commit `git diff --cached --quiet` auswerten.

### M2 · `open_blocks` ignoriert das `resolved`-Flag — und `resolved` hat gar kein UI

`src-tauri/src/commands/meta.rs:174-181`; UI-Metrik „Open blocks" in `src/components/dialogs/WeeklyReviewDialog.tsx:80`

Die Wochenübersicht zählt alle `tag_key = 'block'`-Einträge des Zeitraums, obwohl laut Projektkonvention (CLAUDE.md) das `resolved`-Flag Blocker als erledigt markiert und die Metrik „**Open** blocks" heißt. Es fehlt `AND resolved = 0`. Darüber hinaus gibt es im gesamten Frontend keine Stelle, die `resolved` jemals setzt — `logUpdate` wird überall mit `resolved = undefined` aufgerufen (`src/lib/invoke.ts:37` ist der einzige Berührungspunkt). Das Feature ist also Backend-seitig vorhanden, aber faktisch tot.

**Fix:** `AND resolved = 0` ergänzen und eine Keyboard-Action zum Auflösen von Block-Einträgen anbieten (Backend-Support in `log_update` existiert bereits).

### M3 · „Heute" wird per UTC statt Lokalzeit bestimmt

`src/lib/format.ts:39` (`formatDate`), `src/components/panels/LogPanel.tsx:47`

`new Date().toISOString().slice(0, 10)` liefert das UTC-Datum, das Backend schreibt Einträge aber mit `chrono::Local` (`src-tauri/src/db.rs:14-16`). In deutscher Zeitzone (UTC+1/+2) stimmen zwischen Mitternacht und 1–2 Uhr weder das „Today"-Label im DateSeparator noch der „entries today"-Zähler: neue Einträge tragen bereits das neue lokale Datum, der Vergleichswert hängt noch am Vortag.

**Fix:** Lokales Datum bauen, z. B. über das bereits vorhandene Muster aus `toScheduledString` (`src/lib/format.ts:92-95`) oder `new Date().toLocaleDateString('sv-SE')`.

### M4 · Kalenderwoche 53 ist in der Wochennavigation unerreichbar

`src/components/dialogs/WeeklyReviewDialog.tsx:38-44` (`navWeek`)

Die Navigation kappt hart bei W52. ISO-Jahre mit 53 Wochen — **2026 ist eines** — sind damit falsch: Vorwärts von 2026-W52 springt direkt auf 2027-W01 (W53 mit 28.12.2026–03.01.2027 ist nie erreichbar), rückwärts von 2027-W01 landet man auf 2026-W52 statt W53. Das Rust-Backend (`iso_week_to_date_range`, `src-tauri/src/commands/meta.rs:19-34`) kann W53 korrekt auflösen — nur das Frontend verhindert den Zugriff.

**Fix:** Wochenanzahl des Jahres berechnen (ISO: Jahr hat 53 Wochen, wenn der 1. Januar ein Donnerstag ist bzw. in Schaltjahren Mittwoch/Donnerstag) statt konstant 52 anzunehmen.

### M5 · FocusDialog: „p" in Textfeldern toggelt die Pause, Esc verwirft Eingaben

`src/components/dialogs/FocusDialog.tsx:56-64`

Der window-Keydown-Handler prüft `e.target` nicht. Wer im „Add note…"- oder „Add sub-todo…"-Feld ein Wort mit „p" tippt (z. B. „Problem"), schaltet dabei jedes Mal die Pause um; Esc mitten in der Eingabe minimiert den Dialog und verwirft den Text. Andere Dialoge (z. B. ConfigDialog, `src/components/dialogs/ConfigDialog.tsx:224-225`) filtern Input-Targets bereits korrekt heraus.

**Fix:** Wie im ConfigDialog: `if ((e.target as HTMLElement).tagName === 'INPUT') return` am Handler-Anfang.

### M6 · Pausenzeiten fließen nicht in die gespeicherte Session-Dauer ein

`src-tauri/src/commands/session.rs:60-65` (`session_end`), Pause-Logik nur clientseitig in `src/App.tsx:71-82`

Das Backend berechnet `duration_s` stets als `ended_at − started_at`. Die Pause-Funktion (FocusDialog/SessionBar) existiert nur im Frontend-State und beeinflusst ausschließlich die **Anzeige** (Debrief-Dauer, Timer). In der Datenbank — und damit in Todo-Statistiken (`total_duration_s`), `session_total_today` und der Wochenübersicht (`focus_total_s`) — zählt pausierte Zeit voll mit. Eine 25-Minuten-Session mit 30 Minuten Pause wird als 55 Minuten Fokuszeit gespeichert.

**Fix:** `session_end` einen optionalen `elapsed_s`-Parameter geben, den das Frontend aus `pausedElapsedSeconds` befüllt, und diesen bevorzugt in `duration_s` schreiben.

### M7 · „Completed this week" zeigt alle erledigten Todos, nicht die der Woche

`src/components/dialogs/WeeklyReviewDialog.tsx:46` und `118-127`

Die Liste filtert nur `status === 'done'` über den kompletten Todo-Bestand und ändert sich auch beim Blättern in andere Wochen nicht. Die Überschrift verspricht einen Wochenbezug, den es nicht gibt.

**Fix:** Zusätzlich nach `done_at` im Datumsbereich der angezeigten Woche filtern (der Bereich lässt sich analog zu `iso_week_to_date_range` im Frontend berechnen oder vom Backend mitliefern).

### M8 · „Todo done" legt aus dem Freitext-Context stillschweigend neue Projekte an

`src/App.tsx:296-304` (`todoDone`)

Beim Erledigen eines Todos wird `todo.context` als Projekt-Key interpretiert; ist er unbekannt, wird automatisch ein neues Projekt in die `config.toml` geschrieben. `context` ist im NewTodoDialog aber ein Freitextfeld („Context (optional)", `src/components/dialogs/NewTodoDialog.tsx:69-74`). Ein Kontext wie „Warten auf Rückmeldung Hr. Meier" wird damit beim Abschließen zum dauerhaften Projekt samt Config-Schreibzugriff — verschärft durch H2 (der Schreibvorgang verwirft dabei weitere Config-Inhalte).

**Fix:** Nur zuordnen, wenn der Context exakt einem existierenden Projekt-Key entspricht; sonst ohne Projekt loggen (oder das Anlegen per Bestätigung anbieten).

---

## Gering

### G1 · LIKE-Suchen escapen `%` und `_` nicht

`src-tauri/src/commands/log.rs:179` (`log_search`), `log.rs:220` (`global_search`), `todo.rs:229` (`todo_search`)

Nutzereingaben landen ungefiltert im LIKE-Pattern. Eine Suche nach „100%" oder „a_b" liefert falsche Treffer, weil die Zeichen als Wildcards wirken. Fix: `ESCAPE '\'` plus Escaping der drei Zeichen im Query-String.

### G2 · IDs werden per `format!` in SQL interpoliert

`src-tauri/src/commands/log.rs:82-86` (`log_update`), `todo.rs:158-161` (`todo_update`)

`WHERE id = {}` mit `format!` ist kein Injection-Risiko (i64), bricht aber das sonst konsequente Parameter-Binding-Muster. Die ID als weiteren gebundenen Parameter anhängen.

### G3 · Tote `let _ = …`-Zuweisungen in `log_update`

`src-tauri/src/commands/log.rs:65-79`

Die vier `let _ = c;`-Konstrukte in den `if let`-Armen sind funktionslos; `if content.is_some()` o. Ä. wäre klarer.

### G4 · `MIGRATION_5` und `MIGRATION_6` sind identisch

`src-tauri/src/db.rs:262-282`

Beide legen dieselbe `sub_todos`-Tabelle an (dank `IF NOT EXISTS` harmlos). Vermutlich ein Copy-Paste-Versehen; ein Kommentar wie bei MIGRATION_7–10 würde die Absicht klären.

### G5 · `todo_reorder` swappt ohne Transaktion

`src-tauri/src/commands/todo.rs:209-218`

Zwei getrennte UPDATEs; ein Abbruch dazwischen hinterlässt doppelte `sort_order`-Werte. Für ein Single-User-Tool tolerierbar, eine Transaktion wäre dennoch eine Zwei-Zeilen-Änderung. Gleiches Muster in `session_start`/`session_end` (Session- und Todo-Update getrennt).

### G6 · Nach dem Löschen des angezeigten Eintrags bleibt `displayedEntryId` verwaist

`src/useAppState.ts:154` (`loadLog`)

`prev.displayedEntryId ?? …` behält die ID des gerade gelöschten Eintrags; das ContentPanel zeigt dann „No entry selected", bis der User navigiert. Beim Neuladen prüfen, ob die ID noch existiert, sonst auf den ersten Eintrag zurückfallen.

### G7 · Globaler Keyboard-Listener wird bei jedem Render neu registriert

`src/App.tsx:131-159`

Das Dependency-Array enthält das bei jedem Render neue `app`-Objekt, der Listener wird also pro Render ab- und wieder angehängt. Funktional korrekt, aber unnötige Arbeit; `handleAction` per Ref stabilisieren oder die Abhängigkeiten verengen.

### G8 · Subtodo-Wiedererledigen erzeugt doppelte Journal-Einträge

`src/components/panels/TodoPanel.tsx:82-87` (`handleToggleSub`)

Jeder Übergang nach „done" loggt ins Journal. Wer versehentlich togglet (undone → done), produziert einen zweiten identischen „done"-Eintrag. Ggf. gewollt — sonst prüfen, ob bereits ein Log-Eintrag zu diesem Subtodo existiert.

### G9 · `log_get_all` lädt das komplette Journal in den Speicher

`src-tauri/src/commands/log.rs:112-121`, aufgerufen bei jedem `loadAll`/`loadLog`

Für ein persönliches Tool derzeit unkritisch, wächst aber unbegrenzt mit den Jahren. Perspektivisch: Pagination oder Zeitfenster (z. B. letzte N Monate) mit Nachladen.

---

## Hinweise

- **CSP deaktiviert** (`src-tauri/tauri.conf.json:23`, `"csp": null`): Da Log-Inhalte per `react-markdown` gerendert werden (HTML wird dort standardmäßig escaped), ist das Risiko gering — eine minimale CSP wäre trotzdem sinnvolle Verteidigungstiefe.
- **Toter Code:** `elapsedSeconds` (`src/lib/format.ts:19-22`) wird nirgends verwendet; die `mode`-Spalten in `log_entries` und `day_meta` (`src-tauri/src/db.rs:145,153`) werden von keinem Model gelesen.
- **`schema_version` ohne Primärschlüssel/Unique** (`src-tauri/src/db.rs:136-139`): Doppelte Versionszeilen wären möglich; `MAX(version)` kaschiert das, `version INTEGER PRIMARY KEY` wäre sauberer.
- **GanttDialog und Sommerzeit** (`src/components/dialogs/GanttDialog.tsx:73`): Die Zeitachse rechnet linear mit 24-h-Tagen (`xForMs`); am DST-Wechselwochenende verschieben sich Tagesgrenzen und Balkenpositionen um eine Stunde gegenüber den gezeichneten Tagesspalten.
- **Kryptische Fehlermeldung bei Session-Konflikt:** Startet man eine Session, während (z. B. durch Race/Stale State) schon eine offene existiert, schlägt der partielle Unique-Index zu und der rohe SQLite-Fehler erreicht den User. Ein Vorab-Check in `session_start` mit deutscher Fehlermeldung wäre freundlicher.
- **`exec_migration_sql` splittet an `;`** (`src-tauri/src/db.rs:118-133`): Sobald eine künftige Migration ein Semikolon in einem String-Literal enthält (z. B. `DEFAULT ';'`), zerbricht der Splitter das Statement. Bei neuen Migrationen im Hinterkopf behalten.

---

## Verifikation

- `pnpm install` + `tsc --noEmit`: **fehlerfrei** (Exit 0).
- `cargo check`: in der Review-Umgebung nicht ausführbar (GTK-/`gdk-3.0`-Systembibliotheken fehlen im Container); Rust-Findings wurden stattdessen manuell gegen den Quelltext geprüft.
- Alle Datei-/Zeilenangaben beziehen sich auf den Stand von `master` (`aca972a`).
