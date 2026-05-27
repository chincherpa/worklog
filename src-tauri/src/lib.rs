mod app_config;
mod commands;
mod db;
mod models;

use commands::{config::*, git::*, log::*, meta::*, notes::*, session::*, todo::*};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // config
            get_config,
            get_db_path,
            init_db,
            // log
            log_add,
            log_get,
            log_update,
            log_get_all,
            log_delete,
            log_used_tags,
            log_get_open_blocks,
            log_resolve_block,
            log_get_range,
            log_search,
            // todo
            todo_add,
            todo_get,
            todo_list,
            todo_set_status,
            todo_update,
            todo_delete,
            todo_search,
            // session
            session_start,
            session_end,
            session_get,
            session_get_active,
            session_list_for_todo,
            session_total_today,
            // notes + subtodos
            note_add,
            note_get,
            note_list_for_todo,
            note_list_for_session,
            note_delete,
            subtodo_add,
            subtodo_get,
            subtodo_list_for_todo,
            subtodo_toggle,
            subtodo_delete,
            // day meta
            day_get,
            day_get_or_create,
            day_set_morning,
            day_set_evening,
            day_is_work_locked,
            week_summary,
            // git
            git_push_db,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

