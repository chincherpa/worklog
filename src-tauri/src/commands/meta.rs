use crate::db::{get_connection, today};
use crate::models::{DayMeta, WeekSummary};
use rusqlite::params;
use std::collections::HashMap;

fn row_to_day(row: &rusqlite::Row) -> rusqlite::Result<DayMeta> {
    Ok(DayMeta {
        date: row.get("date")?,
        mode: row.get("mode")?,
        morning_focus: row.get("morning_focus")?,
        morning_energy: row.get("morning_energy")?,
        evening_done: row.get("evening_done")?,
        evening_open: row.get("evening_open")?,
        day_rating: row.get("day_rating")?,
        evening_note: row.get("evening_note")?,
        work_locked: row.get::<_, i64>("work_locked")? != 0,
    })
}

fn iso_week_to_date_range(iso_week: &str) -> Result<(String, String), String> {
    let parts: Vec<&str> = iso_week.split("-W").collect();
    if parts.len() != 2 {
        return Err(format!("Invalid iso_week format: {iso_week}"));
    }
    let year: i32 = parts[0].parse().map_err(|e| format!("{e}"))?;
    let week: u32 = parts[1].parse().map_err(|e| format!("{e}"))?;

    use chrono::{Datelike, NaiveDate};
    let jan4 = NaiveDate::from_ymd_opt(year, 1, 4)
        .ok_or_else(|| format!("Invalid year {year}"))?;
    let iso_week_1_monday = jan4 - chrono::Duration::days(jan4.weekday().num_days_from_monday() as i64);
    let monday = iso_week_1_monday + chrono::Duration::weeks((week - 1) as i64);
    let sunday = monday + chrono::Duration::days(6);
    Ok((monday.format("%Y-%m-%d").to_string(), sunday.format("%Y-%m-%d").to_string()))
}

#[tauri::command]
pub fn day_get(db_path: String, date_str: Option<String>) -> Result<Option<DayMeta>, String> {
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let date = date_str.unwrap_or_else(today);
    let result = conn.query_row(
        "SELECT * FROM day_meta WHERE date = ?1",
        params![date],
        |row| row_to_day(row),
    );
    match result {
        Ok(d) => Ok(Some(d)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn day_get_or_create(
    db_path: String,
    date_str: Option<String>,
    mode: Option<String>,
) -> Result<DayMeta, String> {
    let date = date_str.unwrap_or_else(today);
    let mode = mode.unwrap_or_else(|| "work".to_string());
    {
        let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR IGNORE INTO day_meta (date, mode) VALUES (?1, ?2)",
            params![date, mode],
        )
        .map_err(|e| e.to_string())?;
    }
    day_get(db_path, Some(date))?.ok_or_else(|| "day_meta not found after upsert".to_string())
}

#[tauri::command]
pub fn day_set_morning(
    db_path: String,
    focus: String,
    energy: i64,
    date_str: Option<String>,
) -> Result<DayMeta, String> {
    let date = date_str.unwrap_or_else(today);
    day_get_or_create(db_path.clone(), Some(date.clone()), None)?;
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    let energy = energy.max(1).min(5);
    conn.execute(
        "UPDATE day_meta SET morning_focus = ?1, morning_energy = ?2 WHERE date = ?3",
        params![focus.trim(), energy, date],
    )
    .map_err(|e| e.to_string())?;
    day_get(db_path, Some(date))?.ok_or_else(|| "not found".to_string())
}

#[tauri::command]
pub fn day_set_evening(
    db_path: String,
    done: String,
    open_items: String,
    rating: String,
    note: Option<String>,
    date_str: Option<String>,
) -> Result<DayMeta, String> {
    let date = date_str.unwrap_or_else(today);
    day_get_or_create(db_path.clone(), Some(date.clone()), None)?;
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE day_meta SET evening_done = ?1, evening_open = ?2, day_rating = ?3, evening_note = ?4, work_locked = 1 WHERE date = ?5",
        params![done.trim(), open_items.trim(), rating, note.unwrap_or_default().trim().to_string(), date],
    )
    .map_err(|e| e.to_string())?;
    day_get(db_path, Some(date))?.ok_or_else(|| "not found".to_string())
}

#[tauri::command]
pub fn day_is_work_locked(db_path: String, date_str: Option<String>) -> Result<bool, String> {
    let meta = day_get(db_path, date_str)?;
    Ok(meta.map(|m| m.work_locked).unwrap_or(false))
}

#[tauri::command]
pub fn week_summary(db_path: String, iso_week: String) -> Result<WeekSummary, String> {
    let (date_from, date_to) = iso_week_to_date_range(&iso_week)?;
    let conn = get_connection(&db_path).map_err(|e| e.to_string())?;

    // Log counts by tag
    let mut stmt = conn
        .prepare(
            "SELECT tag_key, COUNT(*) as cnt FROM log_entries WHERE date BETWEEN ?1 AND ?2 GROUP BY tag_key ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;
    let log_rows: Vec<(String, i64)> = stmt
        .query_map(params![date_from, date_to], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let log_counts: HashMap<String, i64> = log_rows.iter().cloned().collect();
    let top_tags: Vec<(String, i64)> = log_rows.iter().take(5).cloned().collect();

    // Day meta
    let mut stmt2 = conn
        .prepare(
            "SELECT morning_energy, day_rating, mode FROM day_meta WHERE date BETWEEN ?1 AND ?2",
        )
        .map_err(|e| e.to_string())?;
    let day_rows: Vec<(Option<i64>, Option<String>, String)> = stmt2
        .query_map(params![date_from, date_to], |row| {
            Ok((
                row.get::<_, Option<i64>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let energies: Vec<i64> = day_rows.iter().filter_map(|(e, _, _)| *e).collect();
    let avg_energy = if energies.is_empty() {
        None
    } else {
        Some(energies.iter().sum::<i64>() as f64 / energies.len() as f64)
    };
    let work_days = day_rows.iter().filter(|(_, _, m)| m == "work").count() as i64;
    let day_ratings: Vec<String> = day_rows
        .iter()
        .filter_map(|(_, r, _)| r.clone())
        .collect();

    // Focus total
    let focus_total_s: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_s), 0) FROM focus_sessions WHERE date(started_at) BETWEEN ?1 AND ?2 AND ended_at IS NOT NULL",
            params![date_from, date_to],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Open blocks
    let open_blocks: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM log_entries WHERE date BETWEEN ?1 AND ?2 AND tag_key = 'block'",
            params![date_from, date_to],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(WeekSummary {
        iso_week,
        work_days,
        log_counts,
        avg_energy,
        top_tags,
        open_blocks,
        focus_total_s,
        day_ratings,
    })
}
