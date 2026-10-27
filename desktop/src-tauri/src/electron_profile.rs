//! Lê o `localStorage` direto do perfil do app Electron (`<perfil>\Local Storage\leveldb`).
//!
//! É o caminho principal da migração: funciona para qualquer versão Electron (inclusive a 0.1.0,
//! que nunca rodou a "ponte"), mesmo depois de o Electron ser desinstalado — o desinstalador do
//! electron-builder não apaga `%APPDATA%\RO Calc Optimizer`. Os dados do disco são sempre os mais
//! recentes (incluem o que o usuário alterou depois da última exportação da ponte).
//!
//! Formato do Chromium (DOMStorage em LevelDB):
//!   chave = "_" + origem + "\0" + codificação + nome da chave
//!   valor = codificação + bytes
//! onde a codificação é 0x01 (Latin-1) ou 0x00 (UTF-16LE).

use std::collections::BTreeMap;
use std::path::Path;

use rusty_leveldb::{LdbIterator, Options, DB};

/// Decodifica uma string no formato do DOMStorage do Chromium.
pub fn decode(bytes: &[u8]) -> Option<String> {
    let (&encoding, rest) = bytes.split_first()?;
    match encoding {
        0x01 => Some(rest.iter().map(|&b| b as char).collect()),
        0x00 if rest.len() % 2 == 0 => {
            let units: Vec<u16> = rest.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
            String::from_utf16(&units).ok()
        }
        _ => None,
    }
}

/// Entradas de `origin` no LevelDB em `leveldb_dir`. O banco é copiado para uma pasta temporária
/// (sem o LOCK), então funciona mesmo com o Electron aberto e nunca altera o perfil original.
pub fn read_local_storage(leveldb_dir: &Path, origin: &str) -> Option<BTreeMap<String, String>> {
    if !leveldb_dir.join("CURRENT").is_file() {
        return None;
    }
    static COPIES: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let n = COPIES.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let copy = std::env::temp_dir().join(format!("ro-calc-electron-ls-{}-{n}", std::process::id()));
    let _ = std::fs::remove_dir_all(&copy);
    std::fs::create_dir_all(&copy).ok()?;
    let result = (|| {
        for entry in std::fs::read_dir(leveldb_dir).ok()? {
            let entry = entry.ok()?;
            if entry.file_name() != "LOCK" && entry.file_type().ok()?.is_file() {
                std::fs::copy(entry.path(), copy.join(entry.file_name())).ok()?;
            }
        }
        let mut options = Options::default();
        options.create_if_missing = false;
        let mut db = DB::open(&copy, options).ok()?;
        let prefix = format!("_{origin}\0").into_bytes();
        let mut entries = BTreeMap::new();
        let mut iter = db.new_iter().ok()?;
        while let Some((key, value)) = iter.next() {
            let Some(name) = key.strip_prefix(prefix.as_slice()) else { continue };
            if let (Some(name), Some(value)) = (decode(name), decode(&value)) {
                entries.insert(name, value);
            }
        }
        Some(entries)
    })();
    let _ = std::fs::remove_dir_all(&copy);
    result.filter(|entries| !entries.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodifica_latin1_e_utf16() {
        assert_eq!(decode(b"\x01ro-set").as_deref(), Some("ro-set"));
        assert_eq!(decode(b"\x01\xe7\xe3o").as_deref(), Some("ção"));
        assert_eq!(decode(&[0x00, b'O', 0, b'k', 0, 0x0D, 0x26]).as_deref(), Some("Ok☍"));
        assert_eq!(decode(&[0x00, b'O']), None);
        assert_eq!(decode(b""), None);
        assert_eq!(decode(b"\x02x"), None);
    }

    #[test]
    fn le_um_banco_leveldb_como_o_do_chromium() {
        let dir = std::env::temp_dir().join(format!("ldb-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        {
            let mut db = DB::open(&dir, Options::default()).unwrap();
            db.put(b"VERSION", b"1").unwrap();
            db.put(b"META:https://simulador.latam-tools.com.br", b"x").unwrap();
            db.put(b"_https://simulador.latam-tools.com.br\x00\x01ro-set", b"\x01{\"a\":1}").unwrap();
            db.put(b"_https://simulador.latam-tools.com.br\x00\x01nome", &[0x00, 0x41, 0x00, 0xE7, 0x00]).unwrap();
            db.put(b"_https://outro.site\x00\x01ro-set", b"\x01outro").unwrap();
            db.flush().unwrap();
        }
        let data = read_local_storage(&dir, "https://simulador.latam-tools.com.br").unwrap();
        assert_eq!(data.len(), 2);
        assert_eq!(data["ro-set"], "{\"a\":1}");
        assert_eq!(data["nome"], "Aç");
        assert!(read_local_storage(&dir, "https://nada.com").is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
