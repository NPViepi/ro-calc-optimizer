fn main() {
    // `bundle.resources` aponta para ../web (gerada por `npm run web`) e o tauri-build falha se a
    // pasta não existir. Em `cargo test`/`cargo check` (perfil debug, ex.: o passo de testes do CI)
    // o build web não é necessário: cria uma pasta vazia. Em release a pasta precisa existir de
    // verdade — `tauri build` roda o `npm run web` (beforeBuildCommand) antes.
    let web = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../web");
    if !web.exists() && std::env::var("PROFILE").as_deref() != Ok("release") {
        std::fs::create_dir_all(&web).expect("criar desktop/web vazia");
    }
    tauri_build::build()
}
