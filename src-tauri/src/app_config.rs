use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use toml::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub key: String,
    pub symbol: String,
    pub name: String,
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bg_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub tags: Vec<Tag>,
    pub config_path: String,
    pub db_path: String,
}

pub fn load_config(config_path: Option<String>) -> Result<AppConfig, String> {
    let path = resolve_config_path(config_path)?;

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read config: {e}"))?;

    let doc: Value = toml::from_str(&content)
        .map_err(|e| format!("Invalid TOML: {e}"))?;

    let tags = parse_tags(doc.get("tags"));

    let db_path = if let Some(explicit) = doc.get("db_path").and_then(|v| v.as_str()) {
        let p = PathBuf::from(explicit);
        if p.is_absolute() {
            explicit.to_string()
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
        tags,
        config_path: path.to_string_lossy().to_string(),
        db_path,
    })
}

fn parse_tags(tags_val: Option<&Value>) -> Vec<Tag> {
    let Some(Value::Table(tags_table)) = tags_val else { return vec![] };
    tags_table.iter().filter_map(|(key, val)| {
        Some(Tag {
            key: key.clone(),
            symbol: val.get("symbol")?.as_str()?.to_string(),
            name: val.get("name")?.as_str()?.to_string(),
            color: val.get("color")?.as_str()?.to_string(),
            bg_color: val.get("bg_color").and_then(|v| v.as_str()).map(|s| s.to_string()),
        })
    }).collect()
}

fn resolve_config_path(config_path: Option<String>) -> Result<PathBuf, String> {
    if let Some(p) = config_path {
        let path = PathBuf::from(&p);
        if path.exists() {
            return Ok(path);
        }
        return Err(format!("Config not found: {p}"));
    }

    // Check beside executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let beside_exe = exe_dir.join("config.toml");
            if beside_exe.exists() {
                return Ok(beside_exe);
            }
        }
    }

    // Fallback: working directory
    let local = PathBuf::from("config.toml");
    if local.exists() {
        return Ok(local);
    }

    // Check ~/.config/worklog/config.toml
    if let Some(home) = dirs_next::home_dir() {
        let user_config = home.join(".config").join("worklog").join("config.toml");
        if user_config.exists() {
            return Ok(user_config);
        }
    }

    Err("config.toml not found. Expected at ./config.toml or ~/.config/worklog/config.toml".to_string())
}
