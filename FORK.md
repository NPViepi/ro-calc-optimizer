# Fork desktop: como funciona

Este repositório é um fork do Simulador RO LATAM. Ele adiciona um app desktop (Electron) e
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
npm start             # gera o build web e abre o app
```

## Lançar uma versão (com auto-update)

```bash
# ajuste "version" em desktop/package.json, faça commit, depois:
git tag desktop-v0.2.0
git push origin desktop-v0.2.0
```

O workflow *Desktop release* gera o instalador do Windows e publica na aba Releases.
Os apps já instalados baixam a versão nova sozinhos e instalam ao fechar.

## Como o app carrega o site

O Electron serve o build local em `https://simulador.latam-tools.com.br`, interceptando só
esse domínio. Assim, links de compartilhamento, CORS e chamadas às APIs funcionam como no site,
sem modificar o código do upstream. Rotas de servidor (`/mcp`, `/api/`) são buscadas na internet.

## Otimizador de build (desktop)

O app desktop mostra o botão **Otimizar build** no canto da tela. O código fica em
`src/optimizer/` e não altera nenhum arquivo do upstream:

- `desktop/scripts/build-optimizer.mjs` empacota o painel (`optimizer/panel.js`) e o motor
  num Web Worker (`optimizer/worker.js`), e roda junto com `npm run web`.
- `desktop/src/main.js` injeta o painel no `index.html` ao servir a página.
- O painel lê a build atual (o autosave do app) e devolve links `/s/<token>/`, o mesmo formato
  de compartilhamento do simulador: **Aplicar** abre a build otimizada, **Comparar** abre a atual
  com a otimizada na coluna de comparação.

- **Modos:** *Heurístico* (rápido, sem garantia) e *Exato* (DFS que prova o ótimo quando
  termina, com Parar/Retomar por checkpoint). Detalhes, podas e garantias em
  `src/optimizer/exact/README.md`.

Testes: `pnpm vitest run src/optimizer`.
