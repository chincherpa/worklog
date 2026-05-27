use crate::db::{get_connection, now_str};
use crate::models::Todo;
use rusqlite::params;

fn row_to_todo(row: &rusqlite::Row) -> rusqlite::Result<Todo> {
    let tags_json: Option<String> = row.get("tags")?;
    let tags: Vec<String> = tags_json
        .and_then(|j| serde_json::from_str(&j).ok())
        .unwrap_or_default();
    let total_sessions: i64 = row.get("total_sessions").unwrap_or(0);
    let total_duration_s: i64 = row.get("total_duration_s").unwrap_or(0);
    Ok(Todo {
        id: row.get("id")?,
        title: row.get("title")?,
        context: row.get("context")?,
        status: row.get("status")?,
        priority: row.get("priority")?,
        mode: row.get("mode")?,
        tags,
        created_at: row.get("created_at")?,
        done_at: row.get("done_at")?,
        total_sessions,
        total_duration_s,
    })
}

const TODO_SELECT_WITH_STATS: &str = r#"
    SELECT t.*,
           COUNT(s.id)                    AS total_sessions,
           COALESCE(SUM(s.duration_s), 0) AS total_duration_s
    FROM todos t
    LEFT JOIN focus_sessions s ON s.todo_id = t.id
"#;

#[tauri::command]
pub fn todo_add(
    db_path: String,
    title: String,
    context: Option<String>,
    priority: Option<String>,
    mode: Option<String>,
) -> Result<Todo, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let priority = priority.unwrap_or_else(|| "normal".to_string());
    let mode = mode.unwrap_or_else(|| "work".to_string());
    let title = title.trim().to_string();

    let row_id: i64 = conn
        .query_row(
            "INSERT INTO todos (title, context, priority, mode) VALUES (?1, ?2, ?3, ?4) RETURNING id",
            params![title, context, priority, mode],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    todo_get(db_path, row_id)
}

#[tauri::command]
pub fn todo_get(db_path: String, todo_id: i64) -> Result<Todo, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let sql = format!(
        "{} WHERE t.id = ?1 GROUP BY t.id",
        TODO_SELECT_WITH_STATS
    );
    conn.query_row(&sql, params![todo_id], |row| row_to_todo(row))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn todo_list(
    db_path: String,
    status: Option<String>,
    mode: Option<String>,
) -> Result<Vec<Todo>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut conditions: Vec<String> = Vec::new();
    let mut bind_vals: Vec<String> = Vec::new();

    if let Some(ref s) = status {
        bind_vals.push(s.clone());
        conditions.push(format!("t.status = ?{}", bind_vals.len()));
    }
    if let Some(ref m) = mode {
        if m != "any" {
            bind_vals.push(m.clone());
            conditions.push(format!("(t.mode = ?{} OR t.mode = 'any')", bind_vals.len()));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        r#"{} {} GROUP BY t.id
        ORDER BY
            CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
            t.created_at"#,
        TODO_SELECT_WITH_STATS, where_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    for (i, val) in bind_vals.iter().enumerate() {
        stmt.raw_bind_parameter(i + 1, val).map_err(|e| e.to_string())?;
    }
    let rows = stmt
        .query_map([], |row| row_to_todo(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn todo_set_status(db_path: String, todo_id: i64, status: String) -> Result<Todo, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let done_at: Option<String> = if status == "done" { Some(now_str()) } else { None };
    conn.execute(
        "UPDATE todos SET status = ?1, done_at = ?2 WHERE id = ?3",
        params![status, done_at, todo_id],
    )
    .map_err(|e| e.to_string())?;
    todo_get(db_path, todo_id)
}

#[tauri::command]
pub fn todo_update(
    db_path: String,
    todo_id: i64,
    title: Option<String>,
    context: Option<String>,
    priority: Option<String>,
    mode: Option<String>,
) -> Result<Todo, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut parts: Vec<String> = Vec::new();
    let mut bind: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(t) = title {
        parts.push("title = ?".to_string());
        bind.push(Box::new(t.trim().to_string()));
    }
    if let Some(c) = context {
        parts.push("context = ?".to_string());
        bind.push(Box::new(c));
    }
    if let Some(p) = priority {
        parts.push("priority = ?".to_string());
        bind.push(Box::new(p));
    }
    if let Some(m) = mode {
        parts.push("mode = ?".to_string());
        bind.push(Box::new(m));
    }

    if !parts.is_empty() {
        let sql = format!(
            "UPDATE todos SET {} WHERE id = {}",
            parts.join(", "),
            todo_id
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        for (i, val) in bind.iter().enumerate() {
            stmt.raw_bind_parameter(i + 1, val.as_ref())
                .map_err(|e| e.to_string())?;
        }
        stmt.raw_execute().map_err(|e| e.to_string())?;
    }

    todo_get(db_path, todo_id)
}

#[tauri::command]
pub fn todo_delete(db_path: String, todo_id: i64) -> Result<bool, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM todos WHERE id = ?1", params![todo_id])
        .map_err(|e| e.to_string())?;
    Ok(rows > 0)
}

#[tauri::command]
pub fn todo_search(db_path: String, query: String, limit: Option<i64>) -> Result<Vec<Todo>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(20);
    let pattern = format!("%{}%", query);
    let sql = format!(
        r#"{} WHERE t.title LIKE ?1 OR t.context LIKE ?2 GROUP BY t.id ORDER BY t.created_at DESC LIMIT ?3"#,
        TODO_SELECT_WITH_STATS
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![pattern, pattern, lim], |row| row_to_todo(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}
