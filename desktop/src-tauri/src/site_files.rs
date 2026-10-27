//! Qual arquivo do build web responde a cada caminho do site.
//! Porte de `desktop/src/site-files.js` (mesmas regras e mesmos casos de teste).

use std::path::{Path, PathBuf};

/// Extensão como `path.extname` do Node: vazia para `/rota`, `/.oculto` e `..`;
/// `.def` para `/s/abc.def/` (barras finais são ignoradas).
fn extname(decoded: &str) -> &str {
    let trimmed = decoded.trim_end_matches(['/', '\\']);
    let base = trimmed.rsplit(['/', '\\']).next().unwrap_or("");
    if base == ".." {
        return "";
    }
    match base.rfind('.') {
        Some(pos) if pos > 0 => &base[pos..],
        _ => "",
    }
}

/// Rotas da SPA: links de compartilhamento `/s/<token>/` e qualquer caminho sem arquivo.
/// O token pode conter "." (o codec troca "+" por "."), então "ter extensão" não serve para
/// distinguir arquivo de rota: `/s/abc.def/` não é um arquivo `.def`.
pub fn is_spa_route(decoded: &str, accepts_html: bool) -> bool {
    decoded.starts_with("/s/") || accepts_html || extname(decoded).is_empty()
}

/// `decodeURIComponent`: falha em sequências `%` inválidas ou UTF-8 inválido.
fn decode_uri_component(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = input.get(i + 1..i + 3)?;
            if !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
                return None;
            }
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// Caminho dentro de `web_root` para `decoded`, resolvendo `.` e `..` sem tocar no disco.
/// `None` se o caminho sair da pasta do site (ou tiver partes que o Windows interpretaria
/// como unidade/fluxo, como `C:`).
fn join_inside(web_root: &Path, decoded: &str) -> Option<PathBuf> {
    let mut parts: Vec<&str> = Vec::new();
    for part in decoded.split(['/', '\\']) {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            p if p.contains(':') || p.contains('\0') => return None,
            p => parts.push(p),
        }
    }
    let mut file = web_root.to_path_buf();
    file.extend(parts);
    Some(file)
}

/// Arquivo local para `pathname`, ou `None` (404).
/// `accepts_html`: a requisição é uma navegação de página (cabeçalho Accept com text/html).
pub fn resolve_site_file(web_root: &Path, pathname: &str, accepts_html: bool) -> Option<PathBuf> {
    let decoded = decode_uri_component(pathname)?;
    let file = join_inside(web_root, &decoded)?;
    if file.is_file() {
        return Some(file);
    }
    if is_spa_route(&decoded, accepts_html) {
        return Some(web_root.join("index.html"));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn web_root() -> PathBuf {
        let unique = format!(
            "site-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let root = std::env::temp_dir().join(unique);
        fs::create_dir_all(root.join("optimizer")).unwrap();
        fs::write(root.join("index.html"), "<html></html>").unwrap();
        fs::write(root.join("optimizer").join("panel.js"), "").unwrap();
        root
    }

    #[test]
    fn link_de_compartilhamento_com_ponto_no_token_abre_o_app() {
        let root = web_root();
        let index = root.join("index.html");
        assert_eq!(resolve_site_file(&root, "/s/N4IgzglgNjBiB7AT.gWwK4wIYDUC/", false), Some(index.clone()));
        assert_eq!(resolve_site_file(&root, "/s/abc.def.", false), Some(index));
    }

    #[test]
    fn arquivos_existentes_sao_servidos() {
        let root = web_root();
        assert_eq!(
            resolve_site_file(&root, "/optimizer/panel.js", false),
            Some(root.join("optimizer").join("panel.js"))
        );
    }

    #[test]
    fn rotas_sem_extensao_e_navegacoes_caem_no_index() {
        let root = web_root();
        let index = root.join("index.html");
        assert_eq!(resolve_site_file(&root, "/qualquer/rota", false), Some(index.clone()));
        assert_eq!(resolve_site_file(&root, "/pagina.v2", true), Some(index));
    }

    #[test]
    fn arquivo_inexistente_com_extensao_e_404() {
        let root = web_root();
        assert_eq!(resolve_site_file(&root, "/assets/nao-existe.json", false), None);
    }

    #[test]
    fn nao_sai_da_pasta_do_site() {
        let root = web_root();
        assert_eq!(resolve_site_file(&root, "/%2e%2e/%2e%2e/etc/passwd", false), None);
        assert_eq!(resolve_site_file(&root, "/..%5c..%5cwindows%5cwin.ini", false), None);
        assert_eq!(resolve_site_file(&root, "/C:/windows/win.ini", false), None);
    }

    #[test]
    fn percent_encoding_invalido_e_404() {
        let root = web_root();
        assert_eq!(resolve_site_file(&root, "/%E0%A4%A", false), None);
    }

    #[test]
    fn extname_como_node() {
        assert_eq!(extname("/s/abc.def/"), ".def");
        assert_eq!(extname("/pagina.v2"), ".v2");
        assert_eq!(extname("/.oculto"), "");
        assert_eq!(extname("/rota"), "");
        assert_eq!(extname("/a."), ".");
    }
}
