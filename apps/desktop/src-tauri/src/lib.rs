use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath};
use walkdir::WalkDir;
use zip::ZipArchive;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveFileSummary {
    archive_path: String,
    file_name: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AttachmentManifestEntry {
    entry_name: String,
    size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveContents {
    archive_path: String,
    chat_text: String,
    attachments: Vec<AttachmentManifestEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AttachmentResource {
    url: String,
    kind: String,
    mime_type: Option<String>,
    cache_key: Option<String>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    backup_directory: Option<String>,
}

fn open_zip_archive(path: &Path) -> Result<ZipArchive<File>, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    ZipArchive::new(file).map_err(|error| error.to_string())
}

fn app_local_data_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())
}

fn ensure_app_local_data_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let directory = app_local_data_dir(app_handle)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn settings_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    Ok(ensure_app_local_data_dir(app_handle)?.join("settings.json"))
}

fn load_settings(app_handle: &AppHandle) -> Result<AppSettings, String> {
    let settings_path = settings_file_path(app_handle)?;
    if !settings_path.exists() {
        return Ok(AppSettings::default());
    }

    let raw_contents = fs::read_to_string(&settings_path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw_contents).map_err(|error| error.to_string())
}

fn save_settings(app_handle: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let settings_path = settings_file_path(app_handle)?;
    let payload = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(settings_path, payload).map_err(|error| error.to_string())
}

fn default_backup_directory(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = ensure_app_local_data_dir(app_handle)?;
    Ok(app_data_dir.join("backup"))
}

fn resolve_saved_backup_directory(app_handle: &AppHandle) -> Result<Option<PathBuf>, String> {
    let settings = load_settings(app_handle)?;
    let Some(saved_directory) = settings.backup_directory else {
        return Ok(None);
    };

    let path = PathBuf::from(saved_directory);
    if path.exists() && path.is_dir() {
        return Ok(Some(path));
    }

    Ok(None)
}

fn read_attachment_bytes(archive_path: &str, entry_name: &str) -> Result<Vec<u8>, String> {
    let archive_path_buf = PathBuf::from(archive_path);
    let mut archive = open_zip_archive(&archive_path_buf)?;
    let mut file = archive
        .by_name(entry_name)
        .map_err(|_| format!("Attachment not found: {}", entry_name))?;

    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;

    Ok(bytes)
}

#[tauri::command]
fn get_initial_backup_directory(app_handle: AppHandle) -> Result<String, String> {
    if let Some(saved_directory) = resolve_saved_backup_directory(&app_handle)? {
        return Ok(saved_directory.to_string_lossy().to_string());
    }

    let path = default_backup_directory(&app_handle)?;
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    }

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn choose_backup_directory(app_handle: AppHandle) -> Result<Option<String>, String> {
    let initial_directory = PathBuf::from(get_initial_backup_directory(app_handle.clone())?);
    let selected_directory = app_handle
        .dialog()
        .file()
        .set_directory(initial_directory)
        .blocking_pick_folder();

    let Some(selected_directory) = selected_directory else {
        return Ok(None);
    };

    let path = match selected_directory {
        FilePath::Path(path) => path,
        _ => return Err("The selected path is not valid on this platform.".to_string()),
    };

    if !path.exists() || !path.is_dir() {
        return Err("The selected folder is not available.".to_string());
    }

    save_settings(
        &app_handle,
        &AppSettings {
            backup_directory: Some(path.to_string_lossy().to_string()),
        },
    )?;

    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn scan_backup_directory(directory_path: String) -> Result<Vec<ArchiveFileSummary>, String> {
    let directory = PathBuf::from(&directory_path);
    if !directory.exists() {
        return Err(format!("Backup folder not found: {}", directory_path));
    }

    if !directory.is_dir() {
        return Err(format!("The selected path is not a folder: {}", directory_path));
    }

    let mut results = WalkDir::new(directory)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .is_some_and(|extension| extension.to_string_lossy().eq_ignore_ascii_case("zip"))
        })
        .map(|entry| {
            let metadata = entry.metadata().map_err(|error| error.to_string())?;
            Ok(ArchiveFileSummary {
                archive_path: entry.path().to_string_lossy().to_string(),
                file_name: entry.file_name().to_string_lossy().to_string(),
                size: metadata.len(),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    results.sort_by(|left, right| left.file_name.cmp(&right.file_name));
    Ok(results)
}

#[tauri::command]
fn read_archive_contents(archive_path: String) -> Result<ArchiveContents, String> {
    let archive_path_buf = PathBuf::from(&archive_path);
    let mut archive = open_zip_archive(&archive_path_buf)?;

    let mut chat_text = String::new();
    {
        let mut chat_file = archive
            .by_name("_chat.txt")
            .map_err(|_| format!("_chat.txt not found in {}", archive_path))?;
        chat_file
            .read_to_string(&mut chat_text)
            .map_err(|error| error.to_string())?;
    }

    let mut attachments = Vec::new();
    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|error| error.to_string())?;
        let name = file.name().to_string();
        if name == "_chat.txt" || name.ends_with('/') {
            continue;
        }

        attachments.push(AttachmentManifestEntry {
            entry_name: name,
            size: file.size(),
        });
    }

    Ok(ArchiveContents {
        archive_path,
        chat_text,
        attachments,
    })
}

#[tauri::command]
fn get_attachment_resource(archive_path: String, entry_name: String) -> Result<AttachmentResource, String> {
    let bytes = read_attachment_bytes(&archive_path, &entry_name)?;
    let mime_type = infer_mime_type(&entry_name).to_string();

    Ok(AttachmentResource {
        url: BASE64_STANDARD.encode(bytes),
        kind: "blobUrl".to_string(),
        mime_type: Some(mime_type),
        cache_key: Some(format!("{}::{}", archive_path, entry_name)),
    })
}

fn infer_mime_type(entry_name: &str) -> &'static str {
    match entry_name
        .split('.')
        .last()
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "heic" => "image/heic",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "3gp" => "video/3gpp",
        "mkv" => "video/x-matroska",
        "opus" => "audio/ogg;codecs=opus",
        "ogg" => "audio/ogg",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        "wav" => "audio/wav",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_initial_backup_directory,
            choose_backup_directory,
            scan_backup_directory,
            read_archive_contents,
            get_attachment_resource
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

