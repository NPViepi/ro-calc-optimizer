// Processo principal do app desktop (Tauri 2). Porte de desktop/src/main.js (Electron).
//
// O build web do upstream é servido localmente na origem do site oficial
// (https://simulador.latam-tools.com.br) — ver site_server.rs e webview2.rs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod migration;
mod site_files;
mod site_server;
mod updater;
#[cfg(windows)]
mod webview2;

use std::path::{Path, PathBuf};

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// Pasta com o build web (scripts/build-web.mjs). No `tauri dev`, usa desktop/web direto.
fn web_root(app: &AppHandle) -> tauri::Result<PathBuf> {
    if cfg!(debug_assertions) {
        let desktop = Path::new(env!("CARGO_MANIFEST_DIR")).parent().expect("desktop/");
        return Ok(desktop.join("web"));
    }
    app.path().resolve("web", BaseDirectory::Resource)
}

/// Equivalente ao preload.js do Electron: `window.roDesktop`.
fn desktop_script() -> String {
    let platform = match std::env::consts::OS {
        "windows" => "win32",
        "macos" => "darwin",
        other => other,
    };
    format!(
        "Object.defineProperty(window, 'roDesktop', {{ value: Object.freeze({{ isDesktop: true, platform: '{platform}', shell: 'tauri' }}) }});"
    )
}

pub fn open_external(app: &AppHandle, url: &Url) {
    if let Err(error) = app.opener().open_url(url.as_str(), None::<&str>) {
        eprintln!("[links] não foi possível abrir {url}: {error}");
    }
}

/// Links para outros sites abrem no navegador padrão (como o `will-navigate` do Electron).
fn allow_navigation(app: &AppHandle, url: &Url) -> bool {
    if site_server::is_internal(url) {
        return true;
    }
    match url.scheme() {
        "http" | "https" | "mailto" => {
            open_external(app, url);
            false
        }
        _ => true, // about:blank, blob:, data:
    }
}

fn create_main_window(app: &AppHandle) -> tauri::Result<()> {
    let web_root = web_root(app)?;
    let mut scripts = vec![desktop_script()];
    scripts.extend(migration::import_script(app));
    if cfg!(debug_assertions) {
        scripts.push(include_str!("selfcheck.js").into()); // autoteste do spike, só no tauri dev
    }

    // No Windows a janela nasce em about:blank e webview2::install navega para o site depois
    // de registrar a interceptação.
    let start = if cfg!(windows) { "about:blank" } else { site_server::SITE_URL };
    let handle = app.clone();
    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(start.parse().expect("URL inicial")))
        .title("RO Calc Optimizer")
        .inner_size(1440.0, 900.0)
        .min_inner_size(1024.0, 640.0)
        .on_navigation(move |url| allow_navigation(&handle, url));
    for script in &scripts {
        builder = builder.initialization_script(script.as_str());
    }
    let window = builder.build()?;

    #[cfg(windows)]
    webview2::install(&window, web_root)?;
    #[cfg(not(windows))]
    {
        // macOS/Linux não permitem interceptar https: o app abriria o site online.
        let _ = (window, web_root);
        eprintln!("[site] servir o build local só é suportado no Windows");
    }
    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        // Instância única: precisa ser o primeiro plugin.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updater::PendingUpdate::default())
        .setup(|app| {
            create_main_window(app.handle())?;
            updater::start(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("falha ao iniciar o RO Calc Optimizer");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            updater::install_pending(app);
        }
    });
}
