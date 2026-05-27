use crate::db::{get_connection, today};
use crate::models::LogEntry;
use rusqlite::params;

fn row_to_log(row: &rusqlite::Row) -> rusqlite::Result<LogEntry> {
    Ok(LogEntry {
        id: row.get("id")?,
        date: row.get("date")?,
        created_at: row.get("created_at")?,
        tag_key: row.get("tag_key")?,
        mode: row.get("mode")?,
        content: row.get("content")?,
        todo_id: row.get("todo_id")?,
        resolved: row.get("resolved")?,
    })
}

#[tauri::command]
pub fn log_add(
    db_path: String,
    tag_key: String,
    content: String,
    mode: Option<String>,
    date_str: Option<String>,
    todo_id: Option<i64>,
) -> Result<LogEntry, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let date = date_str.unwrap_or_else(today);
    let mode = mode.unwrap_or_else(|| "work".to_string());
    let content = content.trim().to_string();

    let row_id: i64 = conn
        .query_row(
            "INSERT INTO log_entries (date, tag_key, mode, content, todo_id) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id",
            params![date, tag_key, mode, content, todo_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    log_get(db_path, row_id)
}

#[tauri::command]
pub fn log_get(db_path: String, entry_id: i64) -> Result<LogEntry, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT * FROM log_entries WHERE id = ?1",
        params![entry_id],
        |row| row_to_log(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn log_update(
    db_path: String,
    entry_id: i64,
    content: Option<String>,
    tag_key: Option<String>,
    resolved: Option<i64>,
) -> Result<LogEntry, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut parts: Vec<String> = Vec::new();
    if let Some(ref c) = content {
        let _ = c;
        parts.push("content = ?".to_string());
    }
    if let Some(ref t) = tag_key {
        let _ = t;
        parts.push("tag_key = ?".to_string());
    }
    if let Some(r) = resolved {
        let _ = r;
        parts.push("resolved = ?".to_string());
    }
    if !parts.is_empty() {
        let sql = format!(
            "UPDATE log_entries SET {} WHERE id = {}",
            parts.join(", "),
            entry_id
        );
        // Build params dynamically
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
        }
        stmt.raw_execute().map_err(|e| e.to_string())?;
    }
    log_get(db_path, entry_id)
}

#[tauri::command]
pub fn log_get_all(db_path: String, mode: Option<String>) -> Result<Vec<LogEntry>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let (sql, params_vec): (String, Vec<String>) = if let Some(ref m) = mode {
        (
            "SELECT * FROM log_entries WHERE mode = ?1 ORDER BY date DESC, created_at DESC".to_string(),
            vec![m.clone()],
        )
    } else {
        (
            "SELECT * FROM log_entries ORDER BY date DESC, created_at DESC".to_string(),
            vec![],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    for (i, p) in params_vec.iter().enumerate() {
        stmt.raw_bind_parameter(i + 1, p).map_err(|e| e.to_string())?;
    }
    let rows = stmt
        .query_map([], |row| row_to_log(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn log_delete(db_path: String, entry_id: i64) -> Result<bool, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM log_entries WHERE id = ?1", params![entry_id])
        .map_err(|e| e.to_string())?;
    Ok(rows > 0)
}

#[tauri::command]
pub fn log_used_tags(db_path: String, mode: Option<String>) -> Result<Vec<String>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let (sql, params_vec): (String, Vec<String>) = if let Some(ref m) = mode {
        (
            "SELECT DISTINCT tag_key FROM log_entries WHERE mode = ?1".to_string(),
            vec![m.clone()],
        )
    } else {
        ("SELECT DISTINCT tag_key FROM log_entries".to_string(), vec![])
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    for (i, p) in params_vec.iter().enumerate() {
        stmt.raw_bind_parameter(i + 1, p).map_err(|e| e.to_string())?;
    }
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn log_get_open_blocks(
    db_path: String,
    before_date: Option<String>,
) -> Result<Vec<LogEntry>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let date = before_date.unwrap_or_else(today);
    let mut stmt = conn
        .prepare(
            "SELECT * FROM log_entries WHERE tag_key = 'block' AND date < ?1 AND resolved = 0 ORDER BY date DESC, created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![date], |row| row_to_log(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn log_resolve_block(db_path: String, entry_id: i64) -> Result<bool, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let rows = conn
        .execute(
            "UPDATE log_entries SET resolved = 1 WHERE id = ?1 AND tag_key = 'block'",
            params![entry_id],
        )
        .map_err(|e| e.to_string())?;
    Ok(rows > 0)
}

#[tauri::command]
pub fn log_get_range(
    db_path: String,
    date_from: String,
    date_to: String,
    tag_key: Option<String>,
) -> Result<Vec<LogEntry>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let (sql, extra): (String, Option<String>) = if let Some(ref t) = tag_key {
        (
            "SELECT * FROM log_entries WHERE date BETWEEN ?1 AND ?2 AND tag_key = ?3 ORDER BY date, created_at".to_string(),
            Some(t.clone()),
        )
    } else {
        (
            "SELECT * FROM log_entries WHERE date BETWEEN ?1 AND ?2 ORDER BY date, created_at".to_string(),
            None,
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    stmt.raw_bind_parameter(1, &date_from).map_err(|e| e.to_string())?;
    stmt.raw_bind_parameter(2, &date_to).map_err(|e| e.to_string())?;
    if let Some(ref t) = extra {
        stmt.raw_bind_parameter(3, t).map_err(|e| e.to_string())?;
    }
    let rows = stmt
        .query_map([], |row| row_to_log(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn log_search(db_path: String, query: String, limit: Option<i64>) -> Result<Vec<LogEntry>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(50);
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare("SELECT * FROM log_entries WHERE content LIKE ?1 ORDER BY date DESC, created_at DESC LIMIT ?2")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![pattern, lim], |row| row_to_log(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}
