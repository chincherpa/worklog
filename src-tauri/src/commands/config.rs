use crate::app_config::{load_config, AppConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct TagInput {
    pub key: String,
    pub symbol: String,
    pub name: String,
    pub color: String,
    pub bg_color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProjectInput {
    pub key: String,
    pub symbol: String,
    pub name: String,
    pub color: String,
    pub bg_color: Option<String>,
}

#[derive(Serialize)]
struct EntryOut {
    symbol: String,
    name: String,
    color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    bg_color: Option<String>,
}

#[derive(Serialize)]
struct ConfigOut {
    db_path: String,
    tags: HashMap<String, EntryOut>,
    projects: HashMap<String, EntryOut>,
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

fn tags_to_map(tags: &[crate::app_config::Tag]) -> HashMap<String, EntryOut> {
    tags.iter().map(|t| (t.key.clone(), EntryOut {
        symbol: t.symbol.clone(),
        name: t.name.clone(),
        color: t.color.clone(),
        bg_color: t.bg_color.clone(),
    })).collect()
}

fn projects_to_map(projects: &[crate::app_config::Project]) -> HashMap<String, EntryOut> {
    projects.iter().map(|p| (p.key.clone(), EntryOut {
        symbol: p.symbol.clone(),
        name: p.name.clone(),
        color: p.color.clone(),
        bg_color: p.bg_color.clone(),
    })).collect()
}

fn write_config(
    config_path: &str,
    db_path: String,
    tags: HashMap<String, EntryOut>,
    projects: HashMap<String, EntryOut>,
) -> Result<(), String> {
    let config_out = ConfigOut { db_path, tags, projects };

    let toml_str = toml::to_string_pretty(&config_out)
        .map_err(|e| format!("TOML serialization failed: {e}"))?;

    std::fs::write(config_path, toml_str)
        .map_err(|e| format!("Cannot write config: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn save_tags(config_path: String, tags: Vec<TagInput>) -> Result<(), String> {
    let current = load_config(Some(config_path.clone()))?;

    let mut tags_map: HashMap<String, EntryOut> = HashMap::new();
    for tag in tags {
        tags_map.insert(tag.key, EntryOut {
            symbol: tag.symbol,
            name: tag.name,
            color: tag.color,
            bg_color: tag.bg_color,
        });
    }

    let projects_map = projects_to_map(&current.projects);

    write_config(&config_path, current.db_path, tags_map, projects_map)
}

#[tauri::command]
pub fn open_db_file(db_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &db_path])
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&db_path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&db_path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_projects(config_path: String, projects: Vec<ProjectInput>) -> Result<(), String> {
    let current = load_config(Some(config_path.clone()))?;

    let tags_map = tags_to_map(&current.tags);

    let mut projects_map: HashMap<String, EntryOut> = HashMap::new();
    for project in projects {
        projects_map.insert(project.key, EntryOut {
            symbol: project.symbol,
            name: project.name,
            color: project.color,
            bg_color: project.bg_color,
        });
    }

    write_config(&config_path, current.db_path, tags_map, projects_map)
}
