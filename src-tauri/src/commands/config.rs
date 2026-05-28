use crate::app_config::{load_config, AppConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct TagInput {
    pub key: String,
    pub symbol: String,
    pub name: String,
    pub color: String,
}

#[derive(Serialize)]
struct TagOut {
    symbol: String,
    name: String,
    color: String,
}

#[derive(Serialize)]
struct ScheduleOut {
    work_start: String,
    work_end: String,
    handover_window: i64,
}

#[derive(Serialize)]
struct ProjectsOut {
    active: Vec<String>,
}

#[derive(Serialize)]
struct ConfigOut {
    db_path: String,
    schedule: ScheduleOut,
    #[serde(skip_serializing_if = "Option::is_none")]
    projects: Option<ProjectsOut>,
    tags: HashMap<String, TagOut>,
}

#[tauri::command]
pub fn get_config(config_path: Option<String>) -> Result<AppConfig, String> {
    load_config(config_path)
}

#[tauri::command]
pub fn get_db_path(config_path: Option<String>) -> Result<String, String> {
    let cfg = load_config(config_path)?;
    Ok(cfg.db_path)
}

#[tauri::command]
pub fn init_db(db_path: String) -> Result<i64, String> {
    crate::db::migrate(&db_path)
}

#[tauri::command]
pub fn save_tags(config_path: String, tags: Vec<TagInput>) -> Result<(), String> {
    let current = load_config(Some(config_path.clone()))?;

    let mut tags_map: HashMap<String, TagOut> = HashMap::new();
    for tag in tags {
        tags_map.insert(tag.key, TagOut {
            symbol: tag.symbol,
            name: tag.name,
            color: tag.color,
        });
    }

    let projects = if current.projects.is_empty() {
        None
    } else {
        Some(ProjectsOut { active: current.projects })
    };

    let config_out = ConfigOut {
        db_path: current.db_path,
        schedule: ScheduleOut {
            work_start: current.schedule.work_start,
            work_end: current.schedule.work_end,
            handover_window: current.schedule.handover_window,
        },
        projects,
        tags: tags_map,
    };

    let toml_str = toml::to_string_pretty(&config_out)
        .map_err(|e| format!("TOML serialization failed: {e}"))?;

    std::fs::write(&config_path, toml_str)
        .map_err(|e| format!("Cannot write config: {e}"))?;

    Ok(())
}
