use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub key: String,
    pub symbol: String,
    pub name: String,
    pub color: String,
    pub category: String,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleConfig {
    pub work_start: String,
    pub work_end: String,
    pub handover_window: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub schedule: ScheduleConfig,
    pub projects: Vec<String>,
    pub tags: Vec<Tag>,
    pub config_path: String,
    pub db_path: String,
}

#[derive(Debug, Deserialize)]
struct RawConfig {
    schedule: Option<RawSchedule>,
    projects: Option<RawProjects>,
    tags: Option<HashMap<String, HashMap<String, RawTag>>>,
    db_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawSchedule {
    work_start: Option<String>,
    work_end: Option<String>,
    handover_window: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct RawProjects {
    active: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct RawTag {
    symbol: String,
    name: String,
    color: String,
    active: Option<bool>,
}

pub fn load_config(config_path: Option<String>) -> Result<AppConfig, String> {
    let path = resolve_config_path(config_path)?;

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read config: {e}"))?;

    let raw: RawConfig = toml::from_str(&content)
        .map_err(|e| format!("Invalid TOML: {e}"))?;

    let schedule = raw.schedule.map(|s| ScheduleConfig {
        work_start: s.work_start.unwrap_or_else(|| "06:00".to_string()),
        work_end: s.work_end.unwrap_or_else(|| "15:00".to_string()),
        handover_window: s.handover_window.unwrap_or(15),
    }).unwrap_or(ScheduleConfig {
        work_start: "06:00".to_string(),
        work_end: "15:00".to_string(),
        handover_window: 15,
    });

    let projects = raw.projects
        .and_then(|p| p.active)
        .unwrap_or_default();

    let mut tags: Vec<Tag> = Vec::new();
    if let Some(tags_map) = raw.tags {
        for (category, entries) in &tags_map {
            for (key, raw_tag) in entries {
                tags.push(Tag {
                    key: key.clone(),
                    symbol: raw_tag.symbol.clone(),
                    name: raw_tag.name.clone(),
                    color: raw_tag.color.clone(),
                    category: category.clone(),
                    active: raw_tag.active.unwrap_or(true),
                });
            }
        }
    }

    let db_path = if let Some(explicit) = raw.db_path {
        // Absolute path or relative to config file location
        let p = PathBuf::from(&explicit);
        if p.is_absolute() {
            explicit
        } else {
            path.parent().unwrap_or(Path::new(".")).join(p)
                .to_string_lossy().to_string()
        }
    } else {
        path.parent()
            .unwrap_or(Path::new("."))
            .join("journal.db")
            .to_string_lossy()
            .to_string()
    };

    Ok(AppConfig {
        schedule,
        projects,
        tags,
        config_path: path.to_string_lossy().to_string(),
        db_path,
    })
}

fn resolve_config_path(config_path: Option<String>) -> Result<PathBuf, String> {
    if let Some(p) = config_path {
        let path = PathBuf::from(&p);
        if path.exists() {
            return Ok(path);
        }
        return Err(format!("Config not found: {p}"));
    }

    // Check beside executable / working directory
    let local = PathBuf::from("config.toml");
    if local.exists() {
        return Ok(local);
    }

    // Check ~/.config/tui-log/config.toml
    if let Some(home) = dirs_next::home_dir() {
        let user_config = home.join(".config").join("tui-log").join("config.toml");
        if user_config.exists() {
            return Ok(user_config);
        }
    }

    Err("config.toml not found. Expected at ./config.toml or ~/.config/tui-log/config.toml".to_string())
}
