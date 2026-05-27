use std::path::Path;
use std::process::Command;
use tauri::Emitter;

#[tauri::command]
pub fn git_push_db(db_path: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let db_file = Path::new(&db_path);
    let dir = db_file
        .parent()
        .ok_or_else(|| "Cannot determine DB directory".to_string())?;

    let db_filename = db_file
        .file_name()
        .ok_or_else(|| "Cannot determine DB filename".to_string())?
        .to_string_lossy()
        .to_string();

    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    emit(&app_handle, "git://progress", "Starting git push…");

    let add = Command::new("git")
        .args(["add", &db_filename])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("git add failed: {e}"))?;

    if !add.status.success() {
        let msg = format!(
            "git add failed: {}",
            String::from_utf8_lossy(&add.stderr)
        );
        emit(&app_handle, "git://progress", &msg);
        return Err(msg);
    }

    let commit_msg = format!("update {timestamp}");
    let commit = Command::new("git")
        .args(["commit", "-m", &commit_msg])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("git commit failed: {e}"))?;

    if !commit.status.success() {
        let stderr = String::from_utf8_lossy(&commit.stderr).to_string();
        if stderr.contains("nothing to commit") {
            emit(&app_handle, "git://progress", "Nothing to commit");
            return Ok(());
        }
        let msg = format!("git commit failed: {stderr}");
        emit(&app_handle, "git://progress", &msg);
        return Err(msg);
    }

    let push = Command::new("git")
        .args(["push"])
        .current_dir(dir)
        .output()
        .map_err(|e| format!("git push failed: {e}"))?;

    if !push.status.success() {
        let msg = format!(
            "git push failed: {}",
            String::from_utf8_lossy(&push.stderr)
        );
        emit(&app_handle, "git://progress", &msg);
        return Err(msg);
    }

    emit(
        &app_handle,
        "git://progress",
        &format!("journal.db gepushed {timestamp}"),
    );
    Ok(())
}

fn emit(app: &tauri::AppHandle, event: &str, payload: &str) {
    let _ = app.emit(event, payload);
}
