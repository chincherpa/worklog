use crate::db::{get_connection, now_str};
use crate::models::FocusSession;
use chrono::NaiveDateTime;
use rusqlite::params;

fn row_to_session(row: &rusqlite::Row) -> rusqlite::Result<FocusSession> {
    Ok(FocusSession {
        id: row.get("id")?,
        todo_id: row.get("todo_id")?,
        started_at: row.get("started_at")?,
        ended_at: row.get("ended_at")?,
        duration_s: row.get("duration_s")?,
        timer_preset: row.get("timer_preset")?,
        outcome: row.get("outcome")?,
        log_entry: row.get("log_entry")?,
    })
}

#[tauri::command]
pub fn session_start(
    db_path: String,
    todo_id: i64,
    timer_preset: Option<String>,
) -> Result<FocusSession, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let session_id: i64 = conn
        .query_row(
            "INSERT INTO focus_sessions (todo_id, timer_preset) VALUES (?1, ?2) RETURNING id",
            params![todo_id, timer_preset],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE todos SET status = 'active' WHERE id = ?1",
        params![todo_id],
    )
    .map_err(|e| e.to_string())?;
    session_get(db_path, session_id)
}

#[tauri::command]
pub fn session_end(
    db_path: String,
    session_id: i64,
    outcome: String,
    log_entry: Option<String>,
) -> Result<FocusSession, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let ended_at = now_str();
    let log_entry = log_entry.unwrap_or_default();

    let (todo_id, started_at): (i64, String) = conn
        .query_row(
            "SELECT todo_id, started_at FROM focus_sessions WHERE id = ?1",
            params![session_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Session {session_id} not found: {e}"))?;

    let fmt = "%Y-%m-%d %H:%M:%S";
    let started = NaiveDateTime::parse_from_str(&started_at, fmt)
        .map_err(|e| format!("Parse started_at: {e}"))?;
    let ended = NaiveDateTime::parse_from_str(&ended_at, fmt)
        .map_err(|e| format!("Parse ended_at: {e}"))?;
    let duration_s = (ended - started).num_seconds();

    conn.execute(
        "UPDATE focus_sessions SET ended_at = ?1, duration_s = ?2, outcome = ?3, log_entry = ?4 WHERE id = ?5",
        params![ended_at, duration_s, outcome, log_entry.trim(), session_id],
    )
    .map_err(|e| e.to_string())?;

    let (new_status, done_at): (&str, Option<String>) = match outcome.as_str() {
        "solved" => ("done", Some(ended_at.clone())),
        _ => ("paused", None),
    };
    conn.execute(
        "UPDATE todos SET status = ?1, done_at = ?2 WHERE id = ?3",
        params![new_status, done_at, todo_id],
    )
    .map_err(|e| e.to_string())?;

    session_get(db_path, session_id)
}

#[tauri::command]
pub fn session_get(db_path: String, session_id: i64) -> Result<FocusSession, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT * FROM focus_sessions WHERE id = ?1",
        params![session_id],
        |row| row_to_session(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn session_get_active(db_path: String) -> Result<Option<FocusSession>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT * FROM focus_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
        [],
        |row| row_to_session(row),
    );
    match result {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn session_close_dangling(db_path: String) -> Result<u32, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    // Pause active todos whose session is still open (before we close the sessions)
    conn.execute(
        "UPDATE todos SET status = 'paused'
         WHERE status = 'active'
         AND id IN (SELECT todo_id FROM focus_sessions WHERE ended_at IS NULL)",
        [],
    ).map_err(|e| e.to_string())?;
    let ended_at = now_str();
    let count = conn.execute(
        "UPDATE focus_sessions SET ended_at = ?1, outcome = 'open',
         duration_s = CAST((strftime('%s', ?1) - strftime('%s', started_at)) AS INTEGER)
         WHERE ended_at IS NULL",
        params![ended_at],
    ).map_err(|e| e.to_string())? as u32;
    Ok(count)
}

#[tauri::command]
pub fn session_list_for_todo(db_path: String, todo_id: i64) -> Result<Vec<FocusSession>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM focus_sessions WHERE todo_id = ?1 ORDER BY started_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![todo_id], |row| row_to_session(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn session_total_today(db_path: String) -> Result<i64, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT COALESCE(SUM(duration_s), 0) FROM focus_sessions WHERE date(started_at) = date('now', 'localtime') AND ended_at IS NOT NULL",
        [],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}
