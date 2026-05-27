use rusqlite::{Connection, Result};
use std::path::Path;

pub fn get_connection(db_path: &str) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
        PRAGMA busy_timeout=3000;
    ")?;
    Ok(conn)
}

pub fn today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

pub fn now_str() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn migrate(db_path: &str) -> Result<i64, String> {
    if let Some(parent) = Path::new(db_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let conn = get_connection(db_path).map_err(|e| e.to_string())?;

    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let migrations: &[(i64, &str)] = &[
        (1, MIGRATION_1),
        (2, MIGRATION_2),
        (3, MIGRATION_3),
        (4, MIGRATION_4),
        (5, MIGRATION_5),
        (6, MIGRATION_6),
    ];

    for (version, sql) in migrations {
        if *version <= current {
            continue;
        }
        exec_migration_sql(&conn, sql).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO schema_version (version) VALUES (?1)",
            rusqlite::params![version],
        )
        .map_err(|e| e.to_string())?;
    }

    let new_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(new_version)
}

fn exec_migration_sql(conn: &Connection, sql: &str) -> Result<()> {
    for stmt in sql.split(';') {
        let code: String = stmt
            .lines()
            .filter(|l| {
                let t = l.trim();
                !t.is_empty() && !t.starts_with("--")
            })
            .collect::<Vec<_>>()
            .join("\n");
        if !code.trim().is_empty() {
            conn.execute_batch(&format!("{};", code))?;
        }
    }
    Ok(())
}

const MIGRATION_1: &str = r#"
    CREATE TABLE IF NOT EXISTS schema_version (
        version     INTEGER NOT NULL,
        applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS log_entries (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        date        TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        tag_key     TEXT    NOT NULL,
        mode        TEXT    NOT NULL DEFAULT 'work',
        content     TEXT    NOT NULL,
        todo_id     INTEGER REFERENCES todos(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_log_date ON log_entries(date);
    CREATE INDEX IF NOT EXISTS idx_log_tag  ON log_entries(tag_key);
    CREATE TABLE IF NOT EXISTS day_meta (
        date            TEXT PRIMARY KEY,
        mode            TEXT NOT NULL DEFAULT 'work',
        morning_focus   TEXT,
        morning_energy  INTEGER CHECK(morning_energy BETWEEN 1 AND 5),
        evening_done    TEXT,
        evening_open    TEXT,
        day_rating      TEXT CHECK(day_rating IN ('zaeh','ok','gut','sehr_gut')),
        evening_note    TEXT,
        work_locked     INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS todos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT    NOT NULL,
        context     TEXT,
        status      TEXT    NOT NULL DEFAULT 'open'
                    CHECK(status IN ('open','active','paused','done','dropped')),
        priority    TEXT    NOT NULL DEFAULT 'normal'
                    CHECK(priority IN ('high','normal','low')),
        mode        TEXT    NOT NULL DEFAULT 'work'
                    CHECK(mode IN ('work','weekend','any')),
        tags        TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        done_at     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_todo_status ON todos(status);
    CREATE INDEX IF NOT EXISTS idx_todo_mode   ON todos(mode);
    CREATE TABLE IF NOT EXISTS focus_sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        todo_id     INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        started_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        ended_at    TEXT,
        duration_s  INTEGER,
        timer_preset TEXT,
        outcome     TEXT CHECK(outcome IN ('solved','open','blocked', NULL)),
        log_entry   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_session_todo ON focus_sessions(todo_id);
    CREATE TABLE IF NOT EXISTS todo_notes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        todo_id     INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        session_id  INTEGER REFERENCES focus_sessions(id) ON DELETE SET NULL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        content     TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_note_todo    ON todo_notes(todo_id);
    CREATE INDEX IF NOT EXISTS idx_note_session ON todo_notes(session_id);
    CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL UNIQUE,
        tag_key     TEXT,
        phase       TEXT    NOT NULL DEFAULT 'active'
                    CHECK(phase IN ('planning','active','paused','done')),
        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        done_at     TEXT
    )
"#;

const MIGRATION_2: &str = r#"
    ALTER TABLE log_entries ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session ON focus_sessions((1)) WHERE ended_at IS NULL
"#;

const MIGRATION_3: &str = r#"
    PRAGMA foreign_keys=OFF;
    CREATE TABLE todos_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT    NOT NULL,
        context     TEXT,
        status      TEXT    NOT NULL DEFAULT 'open'
                    CHECK(status IN ('open','active','paused','done','dropped')),
        priority    TEXT    NOT NULL DEFAULT 'normal'
                    CHECK(priority IN ('high','normal','low')),
        mode        TEXT    NOT NULL DEFAULT 'work'
                    CHECK(mode IN ('work','family','weekend','any')),
        tags        TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        done_at     TEXT
    );
    INSERT INTO todos_new SELECT * FROM todos;
    DROP TABLE IF EXISTS todos;
    ALTER TABLE todos_new RENAME TO todos;
    CREATE INDEX IF NOT EXISTS idx_todo_status ON todos(status);
    CREATE INDEX IF NOT EXISTS idx_todo_mode   ON todos(mode);
    PRAGMA foreign_keys=ON
"#;

const MIGRATION_4: &str = r#"
    PRAGMA foreign_keys=OFF;
    CREATE TABLE todos_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT    NOT NULL,
        context     TEXT,
        status      TEXT    NOT NULL DEFAULT 'open'
                    CHECK(status IN ('open','active','paused','done','dropped','cancelled')),
        priority    TEXT    NOT NULL DEFAULT 'normal'
                    CHECK(priority IN ('high','normal','low')),
        mode        TEXT    NOT NULL DEFAULT 'work'
                    CHECK(mode IN ('work','family','weekend','any')),
        tags        TEXT,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        done_at     TEXT
    );
    INSERT INTO todos_new SELECT * FROM todos;
    DROP TABLE IF EXISTS todos;
    ALTER TABLE todos_new RENAME TO todos;
    CREATE INDEX IF NOT EXISTS idx_todo_status ON todos(status);
    CREATE INDEX IF NOT EXISTS idx_todo_mode   ON todos(mode);
    PRAGMA foreign_keys=ON
"#;

const MIGRATION_5: &str = r#"
    CREATE TABLE IF NOT EXISTS sub_todos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        todo_id     INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        title       TEXT    NOT NULL,
        done        INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_subtodo_todo ON sub_todos(todo_id)
"#;

const MIGRATION_6: &str = r#"
    CREATE TABLE IF NOT EXISTS sub_todos (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        todo_id     INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        title       TEXT    NOT NULL,
        done        INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_subtodo_todo ON sub_todos(todo_id)
"#;
