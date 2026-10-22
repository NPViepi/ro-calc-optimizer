//! Auto-update (tauri-plugin-updater), com o mesmo comportamento do electron-updater:
//! verifica ao abrir e a cada 6 horas, baixa em segundo plano e instala ao fechar o app.

use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

const INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

/// Atualização já baixada, aguardando o app fechar.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<(Update, Vec<u8>)>>);

pub fn start(app: AppHandle) {
    // Só no app instalado (build release), como o `app.isPackaged` do Electron.
    if cfg!(debug_assertions) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        loop {
            if let Err(error) = check(&app).await {
                eprintln!("[auto-update] {error}");
            }
            tokio::time::sleep(INTERVAL).await;
        }
    });
}

async fn check(app: &AppHandle) -> tauri_plugin_updater::Result<()> {
    let pending = app.state::<PendingUpdate>();
    if pending.0.lock().unwrap().is_some() {
        return Ok(());
    }
    if let Some(update) = app.updater()?.check().await? {
        let bytes = update.download(|_, _| {}, || {}).await?;
        *pending.0.lock().unwrap() = Some((update, bytes));
    }
    Ok(())
}

/// Chamado no `RunEvent::Exit`: roda o instalador baixado (no Windows ele fecha o app).
pub fn install_pending(app: &AppHandle) {
    let Some(state) = app.try_state::<PendingUpdate>() else { return };
    let pending = state.0.lock().unwrap().take();
    if let Some((update, bytes)) = pending {
        if let Err(error) = update.install(bytes) {
            eprintln!("[auto-update] falha ao instalar: {error}");
        }
    }
}
