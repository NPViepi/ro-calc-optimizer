//! Importa o `localStorage` (autosave, builds salvas) do app Electron para o Tauri.
//!
//! O WebView2 do Tauri guarda os dados em `%LOCALAPPDATA%\<identifier>\EBWebView` e não lê o
//! perfil do Electron (`%APPDATA%\RO Calc Optimizer`). Fontes, em ordem:
//!   1. o LevelDB do perfil do Electron (`electron_profile.rs`): funciona para qualquer versão,
//!      inclusive quem instalou o Tauri direto da 0.1.0, e sempre tem os dados mais recentes;
//!   2. `%APPDATA%\RO Calc Optimizer\migration.json`, exportado pela versão Electron "ponte"
//!      (desktop/src/tauri-bridge.js) — reserva caso o LevelDB não possa ser lido.
//! Geramos um script de inicialização que restaura as chaves antes do app carregar. Chaves que já
//! existirem no Tauri não são sobrescritas. Ao terminar, o script avisa o processo Rust
//! (`/__desktop/migration-done`, ver site_server.rs), que grava uma marca e não lê mais o perfil.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use tauri::{AppHandle, Manager};

use crate::electron_profile;
use crate::site_server::SITE_ORIGIN;

/// Pasta de dados do Electron (`app.getPath('userData')`, que usa o productName).
const ELECTRON_DATA_DIR: &str = "RO Calc Optimizer";
const MIGRATION_FILE: &str = "migration.json";
/// Marca no localStorage do Tauri: a importação já foi feita.
const MIGRATED_KEY: &str = "roDesktop:migratedFromElectron";
/// Marca no disco (pasta de dados do Tauri): idem, para não ler o perfil a cada abertura.
const DONE_FILE: &str = "electron-migration.done";
pub const DONE_PATH: &str = "/__desktop/migration-done";

static DONE_MARKER: OnceLock<PathBuf> = OnceLock::new();

const TEMPLATE: &str = r#"(() => {
  if (location.origin !== __ORIGIN__ || window.top !== window) return;
  try {
    if (localStorage.getItem(__KEY__) === null) {
      const data = __DATA__;
      for (const [key, value] of Object.entries(data)) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      }
      localStorage.setItem(__KEY__, JSON.stringify({ at: new Date().toISOString(), source: __SOURCE__ }));
    }
    fetch(__DONE__).catch(() => {});
  } catch (error) {
    console.error('[migração Electron → Tauri]', error);
  }
})();"#;

pub fn import_script(app: &AppHandle) -> Option<String> {
    let marker = app.path().app_data_dir().ok()?.join(DONE_FILE);
    if marker.exists() {
        return None;
    }
    let _ = DONE_MARKER.set(marker);
    let electron = app.path().data_dir().ok()?.join(ELECTRON_DATA_DIR);
    let (data, source) = read_sources(&electron)?;
    build_script(&data, source)
}

/// Chamado quando o script de importação termina: grava a marca no disco.
pub fn mark_done() {
    if let Some(marker) = DONE_MARKER.get() {
        if let Some(dir) = marker.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(marker, b"ok");
    }
}

fn read_sources(electron: &Path) -> Option<(BTreeMap<String, String>, &'static str)> {
    if let Some(data) = electron_profile::read_local_storage(&electron.join("Local Storage").join("leveldb"), SITE_ORIGIN) {
        return Some((data, "leveldb"));
    }
    let text = std::fs::read_to_string(electron.join(MIGRATION_FILE)).ok()?;
    Some((parse_export(&text)?, "migration.json"))
}

/// Formato do migration.json: `{ "version": 1, "origin": "...", "exportedAt": "...", "localStorage": { chave: valor } }`.
pub fn parse_export(json: &str) -> Option<BTreeMap<String, String>> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    if value.get("origin").and_then(|o| o.as_str()).is_some_and(|o| o != SITE_ORIGIN) {
        return None;
    }
    let data: BTreeMap<String, String> = value
        .get("localStorage")?
        .as_object()?
        .iter()
        .filter_map(|(k, v)| Some((k.clone(), v.as_str()?.to_owned())))
        .collect();
    (!data.is_empty()).then_some(data)
}

pub fn build_script(data: &BTreeMap<String, String>, source: &str) -> Option<String> {
    if data.is_empty() {
        return None;
    }
    Some(
        TEMPLATE
            .replace("__ORIGIN__", &serde_json::to_string(SITE_ORIGIN).ok()?)
            .replace("__KEY__", &serde_json::to_string(MIGRATED_KEY).ok()?)
            .replace("__SOURCE__", &serde_json::to_string(source).ok()?)
            .replace("__DONE__", &serde_json::to_string(DONE_PATH).ok()?)
            .replace("__DATA__", &serde_json::to_string(data).ok()?),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gera_script_com_as_chaves() {
        let json = r#"{"version":1,"origin":"https://simulador.latam-tools.com.br","localStorage":{"autosave":"{\"a\":1}","n":2}}"#;
        let data = parse_export(json).unwrap();
        assert_eq!(data.len(), 1, "valores que não são texto são ignorados");
        let script = build_script(&data, "migration.json").unwrap();
        assert!(script.contains(r#""autosave":"{\"a\":1}""#));
        assert!(script.contains(r#"location.origin !== "https://simulador.latam-tools.com.br""#));
        assert!(script.contains(r#"fetch("/__desktop/migration-done")"#));
        for marker in ["__ORIGIN__", "__KEY__", "__SOURCE__", "__DONE__", "__DATA__"] {
            assert!(!script.contains(marker), "marcador {marker} sobrando");
        }
    }

    #[test]
    fn ignora_arquivo_vazio_invalido_ou_de_outra_origem() {
        assert!(parse_export("{").is_none());
        assert!(parse_export(r#"{"localStorage":{}}"#).is_none());
        assert!(parse_export(r#"{"origin":"https://outro.site","localStorage":{"a":"b"}}"#).is_none());
        assert!(build_script(&BTreeMap::new(), "x").is_none());
    }

    #[test]
    fn prefere_o_leveldb_e_usa_o_json_como_reserva() {
        let dir = std::env::temp_dir().join(format!("electron-profile-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        assert!(read_sources(&dir).is_none(), "sem nada para importar");

        std::fs::write(
            dir.join(MIGRATION_FILE),
            r#"{"origin":"https://simulador.latam-tools.com.br","localStorage":{"ro-set":"json"}}"#,
        )
        .unwrap();
        let (data, source) = read_sources(&dir).unwrap();
        assert_eq!((data["ro-set"].as_str(), source), ("json", "migration.json"));

        {
            let leveldb = dir.join("Local Storage").join("leveldb");
            let mut db = rusty_leveldb::DB::open(&leveldb, rusty_leveldb::Options::default()).unwrap();
            db.put(b"_https://simulador.latam-tools.com.br\x00\x01ro-set", b"\x01leveldb").unwrap();
            db.flush().unwrap();
        }
        let (data, source) = read_sources(&dir).unwrap();
        assert_eq!((data["ro-set"].as_str(), source), ("leveldb", "leveldb"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
