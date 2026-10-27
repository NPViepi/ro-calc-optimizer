//! Serve o build web local "fingindo" ser o site oficial (https://simulador.latam-tools.com.br).
//!
//! Porte do `protocol.handle('https')` do Electron (desktop/src/main.js). Assim, sem alterar
//! nada no código do upstream:
//!   - links de compartilhamento (que usam location.origin) apontam para o site real;
//!   - chamadas a APIs externas (encurtador, assets, issues) têm a mesma origem do site,
//!     então CORS e restrições de domínio continuam funcionando.
//! Rotas que só existem no servidor (/mcp, /api) são repassadas para a internet.
//!
//! Este módulo só decide a resposta; quem a entrega ao WebView2 é `webview2.rs`.

use std::path::{Path, PathBuf};
use tauri::Url;

use crate::site_files::resolve_site_file;

pub const SITE_HOST: &str = "simulador.latam-tools.com.br";
pub const SITE_ORIGIN: &str = "https://simulador.latam-tools.com.br";
pub const SITE_URL: &str = "https://simulador.latam-tools.com.br/";
const REMOTE_PREFIXES: [&str; 2] = ["/mcp", "/api/"];
/// Painel do otimizador (src/optimizer), empacotado por scripts/build-optimizer.mjs.
const OPTIMIZER_PANEL: &str = "/optimizer/panel.js";

pub struct SiteResponse {
    pub status: u16,
    pub reason: &'static str,
    pub content_type: String,
    pub no_store: bool,
    pub body: Vec<u8>,
}

/// `true` se a URL é do site (será servida localmente ou repassada às rotas remotas).
pub fn is_internal(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str() == Some(SITE_HOST)
}

/// Resposta local para a requisição, ou `None` para deixar o WebView2 buscar na internet.
pub fn respond(web_root: &Path, method: &str, uri: &str, accept: &str) -> Option<SiteResponse> {
    let url = Url::parse(uri).ok()?;
    if !is_internal(&url) || !method.eq_ignore_ascii_case("GET") {
        return None;
    }
    // `url.path()` vem com percent-encoding, como `URL.pathname` no Node.
    let pathname = url.path();
    if REMOTE_PREFIXES.iter().any(|prefix| pathname.starts_with(prefix)) {
        return None;
    }
    if pathname == crate::migration::DONE_PATH {
        crate::migration::mark_done();
        return Some(SiteResponse { status: 204, reason: "No Content", content_type: "text/plain".into(), no_store: true, body: Vec::new() });
    }
    #[cfg(debug_assertions)]
    if pathname == "/__desktop/selfcheck" {
        let report = url.query_pairs().find(|(k, _)| k == "r").map(|(_, v)| v.into_owned()).unwrap_or_default();
        eprintln!("[selfcheck] {report}");
        return Some(SiteResponse { status: 204, reason: "No Content", content_type: "text/plain".into(), no_store: true, body: Vec::new() });
    }
    let accepts_html = accept.contains("text/html");
    Some(match resolve_site_file(web_root, pathname, accepts_html) {
        Some(file) if file.file_name().is_some_and(|name| name == "index.html") => serve_index(web_root, &file),
        Some(file) => serve_file(&file),
        None => not_found(),
    })
}

/// index.html com o painel do otimizador injetado — o HTML do upstream não é alterado no disco.
fn serve_index(web_root: &Path, file: &Path) -> SiteResponse {
    let Ok(mut html) = std::fs::read_to_string(file) else { return not_found() };
    if web_root.join(OPTIMIZER_PANEL.trim_start_matches('/')).is_file() {
        html = html.replacen(
            "</body>",
            &format!("<script type=\"module\" src=\"{OPTIMIZER_PANEL}\"></script></body>"),
            1,
        );
    }
    SiteResponse {
        status: 200,
        reason: "OK",
        content_type: "text/html; charset=utf-8".into(),
        no_store: true,
        body: html.into_bytes(),
    }
}

fn serve_file(file: &PathBuf) -> SiteResponse {
    let Ok(body) = std::fs::read(file) else { return not_found() };
    let mime = mime_guess::from_path(file).first_or_octet_stream();
    let textual = mime.type_() == mime_guess::mime::TEXT
        || matches!(mime.subtype().as_str(), "javascript" | "json" | "manifest+json");
    let content_type = if textual { format!("{mime}; charset=utf-8") } else { mime.to_string() };
    SiteResponse { status: 200, reason: "OK", content_type, no_store: false, body }
}

fn not_found() -> SiteResponse {
    SiteResponse {
        status: 404,
        reason: "Not Found",
        content_type: "text/plain; charset=utf-8".into(),
        no_store: true,
        body: b"Not found".to_vec(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn web_root(with_panel: bool) -> PathBuf {
        let unique = format!(
            "server-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let root = std::env::temp_dir().join(unique);
        fs::create_dir_all(root.join("optimizer")).unwrap();
        fs::write(root.join("index.html"), "<html><body></body></html>").unwrap();
        fs::write(root.join("main.js"), "export {}").unwrap();
        if with_panel {
            fs::write(root.join("optimizer").join("panel.js"), "").unwrap();
            fs::write(root.join("optimizer").join("worker.js"), "").unwrap();
        }
        root
    }

    #[test]
    fn rotas_do_servidor_e_outros_dominios_vao_para_a_rede() {
        let root = web_root(false);
        assert!(respond(&root, "GET", "https://simulador.latam-tools.com.br/mcp", "*/*").is_none());
        assert!(respond(&root, "GET", "https://simulador.latam-tools.com.br/api/x", "*/*").is_none());
        assert!(respond(&root, "POST", "https://simulador.latam-tools.com.br/", "text/html").is_none());
        assert!(respond(&root, "GET", "https://short.latam-tools.com.br/x", "*/*").is_none());
    }

    #[test]
    fn index_recebe_o_painel_quando_ele_existe() {
        let root = web_root(true);
        let page = respond(&root, "GET", SITE_URL, "text/html").unwrap();
        let html = String::from_utf8(page.body).unwrap();
        assert!(html.contains("<script type=\"module\" src=\"/optimizer/panel.js\"></script></body>"));
        assert!(page.no_store);

        let share = respond(&root, "GET", "https://simulador.latam-tools.com.br/s/abc.def/", "text/html").unwrap();
        assert_eq!(share.status, 200);
        assert!(share.content_type.starts_with("text/html"));
    }

    #[test]
    fn index_sem_painel_fica_intacto() {
        let root = web_root(false);
        let page = respond(&root, "GET", SITE_URL, "text/html").unwrap();
        assert_eq!(page.body, b"<html><body></body></html>");
    }

    #[test]
    fn arquivos_com_mime_correto() {
        let root = web_root(true);
        let js = respond(&root, "GET", "https://simulador.latam-tools.com.br/main.js?v=1", "*/*").unwrap();
        assert!(js.content_type.contains("javascript"), "{}", js.content_type);
        let worker = respond(&root, "GET", "https://simulador.latam-tools.com.br/optimizer/worker.js", "*/*").unwrap();
        assert_eq!(worker.status, 200);
        let missing = respond(&root, "GET", "https://simulador.latam-tools.com.br/assets/x.json", "*/*").unwrap();
        assert_eq!(missing.status, 404);
    }
}
