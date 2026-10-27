# Fork desktop: como funciona

Este repositório é um fork do Simulador RO LATAM. Ele adiciona um app desktop (Tauri; antes Electron) e
continua recebendo as atualizações do projeto original (upstream).

## Branches

| Branch    | Papel                                                         |
|-----------|---------------------------------------------------------------|
| `main`    | Espelho do upstream. **Nunca faça commit nela.**              |
| `desktop` | Branch padrão do fork. Seus commits vão aqui.                 |

Atualizações: `upstream/main` → `main` (automático) → PR para `desktop` (você revisa e faz merge).

## Regras para evitar conflitos

1. Código seu fica em pastas suas: `desktop/` (wrapper) e, futuramente, `optimizer/`.
2. Evite editar arquivos do upstream (`src/`, `tools/`, `worker/`, `package.json`, `README.md`...).
   Se precisar, faça mudanças pequenas e isoladas.
3. Integre as atualizações com **merge**, nunca rebase ou squash.
4. Não adicione fragmentos em `release-notes/`: eles alimentam as "Novidades" do upstream.

## Configuração inicial (uma vez)

1. **Settings ▸ General ▸ Default branch** → `desktop`.
2. **Settings ▸ Secrets and variables ▸ Actions**
   - Variable `UPSTREAM_REPO` = `dono/repositorio` do projeto original.
   - Secret `SYNC_TOKEN` (recomendado): fine-grained token só deste repositório, com
     *Contents*, *Pull requests* e *Workflows* em read/write.
3. **Actions** → desative os workflows do upstream *Deploy to Cloudflare* (roda a cada
   push na `main`) e *Deploy to Firebase Hosting on PR* (roda em todo PR). Use
   "Disable workflow" na interface, sem apagar os arquivos, para não gerar conflitos.
4. **Actions ▸ Sync upstream ▸ Run workflow** para testar.

## Rodar o app desktop

```bash
pnpm install          # dependências do app web (na raiz)
cd desktop
npm install
npm run tauri:dev     # Tauri: gera o build web e abre o app (tauri:dev:fast pula o build web)
npm start             # Electron (versão antiga, mantida até o fim da migração)
```

O app Tauri precisa do [Rust](https://rustup.rs) (toolchain MSVC) e do WebView2 (já vem no
Windows 10/11). Testes do servidor local: `npm run test:rust`.

## Lançar uma versão (com auto-update)

```bash
# ajuste "version" em desktop/package.json, faça commit, depois:
git tag desktop-v0.2.0
git push origin desktop-v0.2.0
```

O workflow *Desktop release* gera o instalador do Windows (Tauri) e cria um **rascunho** na aba
Releases, junto com o `latest.json` assinado. Revise e clique em **Publish release**: só então os
apps já instalados baixam a versão nova sozinhos e instalam ao fechar.

Chave do updater: já configurada (minisign `81DB9BD41B454CBB`). A pública está em
`desktop/src-tauri/updater.pub` e em `plugins.updater.pubkey` (`tauri.conf.json`); a privada fica
fora do repositório (`%USERPROFILE%\.tauri\ro-calc-optimizer.key`) e nos secrets
`TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. **Guarde um backup da chave
privada e da senha:** sem elas, os apps instalados nunca mais aceitam uma atualização.
Para gerar de novo (no PowerShell): `npx.cmd tauri signer generate -w "$env:USERPROFILE\.tauri\ro-calc-optimizer.key"`.

## Migração Electron → Tauri

Enquanto houver usuários na versão Electron, cada release também leva a versão Electron
"ponte" (job `electron-bridge`):

1. O Electron antigo atualiza para a ponte pelo `latest.yml`, como sempre.
2. A ponte (`desktop/src/tauri-bridge.js`) exporta o `localStorage` para
   `%APPDATA%\RO Calc Optimizer\migration.json` e oferece o instalador do Tauri.
3. O instalador do Tauri remove o Electron (`desktop/src-tauri/windows/hooks.nsh`).
4. No primeiro start, o Tauri restaura o `localStorage` lendo direto o LevelDB do perfil do
   Electron (`%APPDATA%\RO Calc Optimizer\Local Storage\leveldb`, que o desinstalador não apaga);
   o `migration.json` é só reserva (`desktop/src-tauri/src/migration.rs` e `electron_profile.rs`).
   Assim, quem instalar o Tauri direto da 0.1.0, sem passar pela ponte, também leva as builds.

Limpeza (fase 4), quando ninguém mais usar o Electron: remover `electron`, `electron-builder`,
`electron-updater`, `src/main.js`, `src/preload.js`, `src/site-files.js`, `src/tauri-bridge.js`,
`electron-builder.yml`, `test/site-files.test.js` e o job `electron-bridge`.

## Como o app carrega o site

O app serve o build local em `https://simulador.latam-tools.com.br`, interceptando só
esse domínio (Tauri: evento `WebResourceRequested` do WebView2, em
`desktop/src-tauri/src/webview2.rs`; só funciona no Windows). Assim, links de compartilhamento, CORS e chamadas às APIs funcionam como no site,
sem modificar o código do upstream. Rotas de servidor (`/mcp`, `/api/`) são buscadas na internet.

## Otimizador de build (desktop)

O app desktop mostra o botão **Otimizar build** no canto da tela. O código fica em
`src/optimizer/` e não altera nenhum arquivo do upstream:

- `desktop/scripts/build-optimizer.mjs` empacota o painel (`optimizer/panel.js`) e o motor
  num Web Worker (`optimizer/worker.js`), e roda junto com `npm run web`.
- `desktop/src-tauri/src/site_server.rs` (e `desktop/src/main.js` no Electron) injeta o painel
  no `index.html` ao servir a página.
- O painel lê a build atual (o autosave do app) e devolve links `/s/<token>/`, o mesmo formato
  de compartilhamento do simulador: **Aplicar** abre a build otimizada, **Comparar** abre a atual
  com a otimizada na coluna de comparação.

- **Modos:** *Heurístico* (rápido, sem garantia) e *Exato* (DFS que prova o ótimo quando
  termina, com Parar/Retomar por checkpoint). Detalhes, podas e garantias em
  `src/optimizer/exact/README.md`.

Testes: `pnpm vitest run src/optimizer`.
