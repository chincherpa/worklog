use crate::db::get_connection;
use crate::models::{SubTodo, TodoNote};
use rusqlite::params;

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<TodoNote> {
    Ok(TodoNote {
        id: row.get("id")?,
        todo_id: row.get("todo_id")?,
        session_id: row.get("session_id")?,
        created_at: row.get("created_at")?,
        content: row.get("content")?,
    })
}

fn row_to_subtodo(row: &rusqlite::Row) -> rusqlite::Result<SubTodo> {
    Ok(SubTodo {
        id: row.get("id")?,
        todo_id: row.get("todo_id")?,
        title: row.get("title")?,
        done: row.get::<_, i64>("done")? != 0,
        created_at: row.get("created_at")?,
    })
}

#[tauri::command]
pub fn note_add(
    db_path: String,
    todo_id: i64,
    content: String,
    session_id: Option<i64>,
) -> Result<TodoNote, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let content = content.trim().to_string();
    let note_id: i64 = conn
        .query_row(
            "INSERT INTO todo_notes (todo_id, session_id, content) VALUES (?1, ?2, ?3) RETURNING id",
            params![todo_id, session_id, content],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    note_get(db_path, note_id)
}

#[tauri::command]
pub fn note_get(db_path: String, note_id: i64) -> Result<TodoNote, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT * FROM todo_notes WHERE id = ?1",
        params![note_id],
        |row| row_to_note(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn note_list_for_todo(db_path: String, todo_id: i64) -> Result<Vec<TodoNote>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM todo_notes WHERE todo_id = ?1 ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![todo_id], |row| row_to_note(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn note_list_for_session(db_path: String, session_id: i64) -> Result<Vec<TodoNote>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM todo_notes WHERE session_id = ?1 ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![session_id], |row| row_to_note(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn note_delete(db_path: String, note_id: i64) -> Result<bool, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM todo_notes WHERE id = ?1", params![note_id])
        .map_err(|e| e.to_string())?;
    Ok(rows > 0)
}

#[tauri::command]
pub fn subtodo_add(db_path: String, todo_id: i64, title: String) -> Result<SubTodo, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let title = title.trim().to_string();
    let id: i64 = conn
        .query_row(
            "INSERT INTO sub_todos (todo_id, title) VALUES (?1, ?2) RETURNING id",
            params![todo_id, title],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    subtodo_get(db_path, id)
}

#[tauri::command]
pub fn subtodo_get(db_path: String, subtodo_id: i64) -> Result<SubTodo, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT * FROM sub_todos WHERE id = ?1",
        params![subtodo_id],
        |row| row_to_subtodo(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn subtodo_list_for_todo(db_path: String, todo_id: i64) -> Result<Vec<SubTodo>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM sub_todos WHERE todo_id = ?1 ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![todo_id], |row| row_to_subtodo(row))
        .map_err(|e| e.to_string())?;
    rows.map(|r| r.map_err(|e| e.to_string())).collect()
}

#[tauri::command]
pub fn subtodo_toggle(db_path: String, subtodo_id: i64) -> Result<SubTodo, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sub_todos SET done = NOT done WHERE id = ?1",
        params![subtodo_id],
    )
    .map_err(|e| e.to_string())?;
    subtodo_get(db_path, subtodo_id)
}

#[tauri::command]
pub fn subtodo_delete(db_path: String, subtodo_id: i64) -> Result<bool, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let rows = conn
        .execute("DELETE FROM sub_todos WHERE id = ?1", params![subtodo_id])
        .map_err(|e| e.to_string())?;
    Ok(rows > 0)
}
