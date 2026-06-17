use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: i64,
    pub date: String,
    pub created_at: String,
    pub tag_key: String,
    pub project: String,
    pub content: String,
    pub todo_id: Option<i64>,
    pub resolved: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayMeta {
    pub date: String,
    pub morning_focus: Option<String>,
    pub morning_energy: Option<i64>,
    pub evening_done: Option<String>,
    pub evening_open: Option<String>,
    pub day_rating: Option<String>,
    pub evening_note: Option<String>,
    pub work_locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub context: Option<String>,
    pub status: String,
    pub priority: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub done_at: Option<String>,
    pub sort_order: i64,
    pub scheduled_at: Option<String>,
    pub est_duration_min: Option<i64>,
    pub total_sessions: i64,
    pub total_duration_s: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusSession {
    pub id: i64,
    pub todo_id: i64,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_s: Option<i64>,
    pub timer_preset: Option<String>,
    pub outcome: Option<String>,
    pub log_entry: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoNote {
    pub id: i64,
    pub todo_id: i64,
    pub session_id: Option<i64>,
    pub created_at: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubTodo {
    pub id: i64,
    pub todo_id: i64,
    pub title: String,
    pub done: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub tag_key: Option<String>,
    pub phase: String,
    pub created_at: String,
    pub done_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub kind: String,                // "log" | "todo" | "note" | "subtodo"
    pub id: i64,                     // row id of the matched record
    pub target_todo_id: Option<i64>, // parent todo for note/subtodo
    pub title: String,               // primary line to display
    pub snippet: String,             // matched context, trimmed
    pub date: Option<String>,        // for ordering/display
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeekSummary {
    pub iso_week: String,
    pub work_days: i64,
    pub log_counts: std::collections::HashMap<String, i64>,
    pub avg_energy: Option<f64>,
    pub top_tags: Vec<(String, i64)>,
    pub open_blocks: i64,
    pub focus_total_s: i64,
    pub day_ratings: Vec<String>,
}
