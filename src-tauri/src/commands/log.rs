use crate::db::{get_connection, today};
use crate::models::{LogEntry, SearchHit};
use rusqlite::params;

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
    project_key: Option<String>,
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
    if let Some(ref p) = project_key {
        let _ = p;
        parts.push("project = ?".to_string());
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
            idx += 1;
        }
        if let Some(ref p) = project_key {
            stmt.raw_bind_parameter(idx, p).map_err(|e| e.to_string())?;
        }
        stmt.raw_execute().map_err(|e| e.to_string())?;
    }
    log_get(db_path, entry_id)
}

#[tauri::command]
pub fn log_get_all(db_path: String) -> Result<Vec<LogEntry>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM log_entries ORDER BY date DESC, created_at DESC")
        .map_err(|e| e.to_string())?;
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
pub fn log_used_tags(db_path: String) -> Result<Vec<String>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT DISTINCT tag_key FROM log_entries")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
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

    let mut param_vals = vec![date_from, date_to];
    if let Some(t) = extra {
        param_vals.push(t);
    }
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params_from_iter(param_vals.iter()), |row| row_to_log(row))
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

/// First line of a multi-line string, used as a result title.
fn first_line(s: &str) -> String {
    s.lines().next().unwrap_or("").trim().to_string()
}

/// Single-line, length-capped snippet for display in the result list.
fn snippet(s: &str) -> String {
    let flat: String = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > 120 {
        let truncated: String = flat.chars().take(120).collect();
        format!("{}…", truncated)
    } else {
        flat
    }
}

/// Searches every searchable text column across the app and returns a flat,
/// typed list of hits. Note/subtodo hits carry `target_todo_id` so the
/// frontend can select the parent todo.
#[tauri::command]
pub fn global_search(
    db_path: String,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<SearchHit>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(20);
    let pattern = format!("%{}%", trimmed);
    let mut hits: Vec<SearchHit> = Vec::new();

    // log_entries.content
    {
        let mut stmt = conn
            .prepare("SELECT id, content, date FROM log_entries WHERE content LIKE ?1 ORDER BY date DESC, created_at DESC LIMIT ?2")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pattern, lim], |row| {
                let id: i64 = row.get(0)?;
                let content: String = row.get(1)?;
                let date: Option<String> = row.get(2)?;
                Ok(SearchHit {
                    kind: "log".to_string(),
                    id,
                    target_todo_id: None,
                    title: first_line(&content),
                    snippet: snippet(&content),
                    date,
                })
            })
            .map_err(|e| e.to_string())?;
        for r in rows {
            hits.push(r.map_err(|e| e.to_string())?);
        }
    }

    // todos.title / todos.context
    {
        let mut stmt = conn
            .prepare("SELECT id, title, context, created_at FROM todos WHERE title LIKE ?1 OR context LIKE ?1 ORDER BY created_at DESC LIMIT ?2")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pattern, lim], |row| {
                let id: i64 = row.get(0)?;
                let title: String = row.get(1)?;
                let context: Option<String> = row.get(2)?;
                let date: Option<String> = row.get(3)?;
                Ok(SearchHit {
                    kind: "todo".to_string(),
                    id,
                    target_todo_id: Some(id),
                    title,
                    snippet: context.map(|c| snippet(&c)).unwrap_or_default(),
                    date,
                })
            })
            .map_err(|e| e.to_string())?;
        for r in rows {
            hits.push(r.map_err(|e| e.to_string())?);
        }
    }

    // todo_notes.content
    {
        let mut stmt = conn
            .prepare("SELECT id, todo_id, content, created_at FROM todo_notes WHERE content LIKE ?1 ORDER BY created_at DESC LIMIT ?2")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pattern, lim], |row| {
                let id: i64 = row.get(0)?;
                let todo_id: i64 = row.get(1)?;
                let content: String = row.get(2)?;
                let date: Option<String> = row.get(3)?;
                Ok(SearchHit {
                    kind: "note".to_string(),
                    id,
                    target_todo_id: Some(todo_id),
                    title: first_line(&content),
                    snippet: snippet(&content),
                    date,
                })
            })
            .map_err(|e| e.to_string())?;
        for r in rows {
            hits.push(r.map_err(|e| e.to_string())?);
        }
    }

    // sub_todos.title
    {
        let mut stmt = conn
            .prepare("SELECT id, todo_id, title, created_at FROM sub_todos WHERE title LIKE ?1 ORDER BY created_at DESC LIMIT ?2")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pattern, lim], |row| {
                let id: i64 = row.get(0)?;
                let todo_id: i64 = row.get(1)?;
                let title: String = row.get(2)?;
                let date: Option<String> = row.get(3)?;
                Ok(SearchHit {
                    kind: "subtodo".to_string(),
                    id,
                    target_todo_id: Some(todo_id),
                    title: title.clone(),
                    snippet: snippet(&title),
                    date,
                })
            })
            .map_err(|e| e.to_string())?;
        for r in rows {
            hits.push(r.map_err(|e| e.to_string())?);
        }
    }

    Ok(hits)
}
