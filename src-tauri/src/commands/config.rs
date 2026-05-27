use crate::app_config::{load_config, AppConfig};

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
