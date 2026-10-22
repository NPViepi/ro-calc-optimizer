//! Importa o `localStorage` (autosave, builds salvas) exportado pela última versão Electron.
//!
//! O WebView2 do Tauri guarda os dados em `%LOCALAPPDATA%\<identifier>\EBWebView` e não lê o
//! perfil do Electron (`%APPDATA%\RO Calc Optimizer`). A versão Electron "ponte"
//! (desktop/src/tauri-bridge.js) grava `%APPDATA%\RO Calc Optimizer\migration.json`; aqui
//! geramos um script de inicialização que restaura essas chaves uma única vez, antes do app
//! carregar. Chaves que já existirem no Tauri não são sobrescritas.

use tauri::{AppHandle, Manager};

use crate::site_server::SITE_ORIGIN;

/// Pasta de dados do Electron (`app.getPath('userData')`, que usa o productName).
const ELECTRON_DATA_DIR: &str = "RO Calc Optimizer";
const MIGRATION_FILE: &str = "migration.json";
/// Marca no localStorage do Tauri: a importação já foi feita.
const MIGRATED_KEY: &str = "roDesktop:migratedFromElectron";

const TEMPLATE: &str = r#"(() => {
  if (location.origin !== __ORIGIN__) return;
  try {
    if (localStorage.getItem(__KEY__) !== null) return;
    const data = __DATA__;
    for (const [key, value] of Object.entries(data)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
    localStorage.setItem(__KEY__, new Date().toISOString());
  } catch (error) {
    console.error('[migração Electron → Tauri]', error);
  }
})();"#;

pub fn import_script(app: &AppHandle) -> Option<String> {
    let file = app.path().data_dir().ok()?.join(ELECTRON_DATA_DIR).join(MIGRATION_FILE);
    let text = std::fs::read_to_string(file).ok()?;
    build_script(&text)
}

/// Formato do arquivo: `{ "version": 1, "origin": "...", "exportedAt": "...", "localStorage": { chave: valor } }`.
pub fn build_script(json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    if value.get("origin").and_then(|o| o.as_str()).is_some_and(|o| o != SITE_ORIGIN) {
        return None;
    }
    let data: serde_json::Map<String, serde_json::Value> = value
        .get("localStorage")?
        .as_object()?
        .iter()
        .filter(|(_, v)| v.is_string())
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    if data.is_empty() {
        return None;
    }
    Some(
        TEMPLATE
            .replace("__ORIGIN__", &serde_json::to_string(SITE_ORIGIN).ok()?)
            .replace("__KEY__", &serde_json::to_string(MIGRATED_KEY).ok()?)
            .replace("__DATA__", &serde_json::to_string(&data).ok()?),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gera_script_com_as_chaves() {
        let json = r#"{"version":1,"origin":"https://simulador.latam-tools.com.br","localStorage":{"autosave":"{\"a\":1}","n":2}}"#;
        let script = build_script(json).unwrap();
        assert!(script.contains(r#""autosave":"{\"a\":1}""#));
        assert!(!script.contains("\"n\":2"), "valores que não são texto são ignorados");
        assert!(script.contains(r#"location.origin !== "https://simulador.latam-tools.com.br""#));
        assert!(!script.contains("__"));
    }

    #[test]
    fn ignora_arquivo_vazio_invalido_ou_de_outra_origem() {
        assert!(build_script("{").is_none());
        assert!(build_script(r#"{"localStorage":{}}"#).is_none());
        assert!(build_script(r#"{"origin":"https://outro.site","localStorage":{"a":"b"}}"#).is_none());
    }
}
