# Design system do simulador

A interface usa React 19, hooks e primitivas locais em `src/react/ui`. Os serviços
compartilhados vêm de `ServicesProvider`; a composição dos controles
usados pelos fluxos preserva os elementos e classes existentes. Não há biblioteca
de controles de terceiros. O tema escuro/verde e a escala de **14px** são fixos.
As antigas preferências de aparência não são lidas nem removidas do armazenamento.

## Estilos e ícones

- `_tokens.css`: paleta e variáveis públicas, como `--surface-ground`,
  `--surface-card`, `--surface-border`, `--text-color`, `--primary-color`,
  `--font-family`, `--border-radius` e `--focus-ring`.
  As medidas de controles e sombras usam `--ui-control-padding`,
  `--ui-button-padding-inline`, `--ui-trigger-width`, `--ui-overlay-shadow`
  e `--ui-dialog-shadow`.
- `_controls.css`: dimensões, estados e estrutura dos controles `ui-*`.
- `_utilities.css`: apenas as utilidades de layout usadas pelo app, incluindo
  variantes responsivas (`sm:`, `md:`, `lg:`, `xl:`) e classes escolhidas em runtime.
  Ao adicionar uma classe dinâmica, inclua suas variantes aqui explicitamente.
- `src/assets/icons/ui`: um SVG por ícone; os ícones são autorais, exceto pelo
  símbolo oficial do Discord (origem em `THIRD_PARTY_NOTICES.md`). Adicione o nome à união
  `IconName` em `icon-names.ts` e use `<Icon name="save" />`. O ícone herda
  `currentColor` e usa `1em`; `label="Salvar"` dá nome acessível a uma imagem
  informativa. Ícones decorativos ficam ocultos de leitores de tela. Em botões,
  dê o nome acessível ao botão. Sprites do jogo continuam usando os formatadores existentes.

Mantenha cores e dimensões nos tokens/estilos compartilhados. Alterações em
controles comuns devem passar pelas comparações visuais. A atribuição dos valores
iniciais de estilos fica em [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Controles disponíveis

| Uso | API |
| --- | --- |
| Botões e texto | `appButton`, `appInputText`, `appInputTextarea`, `appBadge` |
| Seleção | `app-ui-dropdown`, `app-ui-multi-select`, `app-ui-cascade-select`, `app-ui-listbox`, `app-ui-select-button` |
| Booleanos | `app-ui-checkbox`, `app-ui-input-switch` |
| Conteúdo | `app-ui-card`, `app-ui-tag`, `app-ui-chip`, `app-ui-accordion`, `app-ui-accordion-tab` |
| Tabelas | `app-ui-table`, `appSelectableRow`, templates `header`, `body`, `emptymessage` |
| Sobreposições | `app-ui-dialog`, `app-ui-popover`, `appTooltip`, `app-ui-toast`, `app-ui-confirm-dialog`, `app-ui-block` |

Controles recebem `value` e callbacks de mudança. Escrever um valor pelo pai
não dispara uma ação do usuário. Opções aceitam primitivos, `{label, value}`, ou
objetos com `optionLabel`/`optionValue`. Valores `0` e `false` são seleções
válidas. Com `optionLabel` e sem `optionValue`, o valor é o próprio objeto.
Não recrie as opções sem necessidade.

```tsx
<Select inputId="server" ariaLabel="Servidor" options={servers}
  optionLabel="label" optionValue="id" filter showClear
  value={serverId} onChange={setServerId}
  renderItem={server => server.label} />
```

Seletores oferecem busca, limpeza, opções desabilitadas, grupos e navegação por
setas/Home/End/Enter/Tab. Listas grandes podem usar `virtualScroll` e
`virtualScrollItemSize`. Menus em cascata usam `optionGroupChildren` por nível.
Templates pertencem ao componente que os recebe; não substitua seu DOM interno
nem consulte propriedades privadas para reposicionar uma sobreposição.

## Sobreposições e notificações

`Portal` usa `createPortal`; `LayerManager` mantém ordem visual, Escape e descarte.
Cada sobreposição registra um fechamento; Escape alcança somente a última.
`ScrollLocks` mantém locks por elemento: fechar um seletor aninhado
não libera o diálogo. Destruir um pai fecha seus descendentes ancorados e libera
os locks. Diálogos prendem e restauram foco por `trapFocus`; seletores devolvem foco ao
gatilho ao confirmar ou fechar por Escape. Os pickers de equipamento mantêm
sua apresentação própria e registram seus portais com `LayerManager.register` e cleanup do React.

Portais preservam escopos públicos dos componentes de origem através de classes
`ui-scope-app-*` no wrapper local, sem depender dos atributos privados do Angular.
Estilos de funcionalidade usam seletores explícitos como
`:is(app-item-search, .ui-scope-app-item-search) .ui-listbox`. Regras do próprio
host usam somente o elemento, para não deslocar o wrapper do portal. Use
`panelClassName` para modificadores específicos de um seletor; ancestrais como
`.joined_field` não existem dentro do portal.

`Dialog` usa `visible` e `onVisibleChange`, `header`, `modal`, `style`, `contentStyle` e
props `header`/`footer`. O evento `closed` também ocorre quando o pai fecha
o diálogo. Popovers oferecem `show`, `toggle`, `hide` e `align`.

`appTooltip` aceita `showDelay`, `tooltipPosition`, `tooltipStyleClass` e
`escape`. HTML passa pelo sanitizador DOM compartilhado com allowlist. Descrições de itens usam
`item_desc_tooltip`: têm período de travessia de 150ms, rolagem interna e limites
da janela. Somente tooltips visíveis entram na pilha de Escape.
Tooltips e popovers fecham quando a página ou um painel externo rola. A rolagem
dentro da descrição ou de um overlay filho continua funcionando sem fechar o pai.
As setas dos popovers acompanham o gatilho, inclusive quando o posicionador local desloca ou
inverte a posição para caber na janela.

Injete `UiMessageService` para `add({severity, summary, detail, life, sticky})`
e `clear(key)`. `UiConfirmationService.confirm({message, accept, reject})`
resolve uma confirmação uma única vez; fechamento/cancelamento chama `reject`.

## Verificação

```bash
pnpm test
pnpm typecheck
pnpm lint:check
pnpm build
pnpm e2e
```

Playwright usa um contexto de navegador novo em cada teste, preservando os dados
do navegador usado no desenvolvimento. No Windows usa o Chrome instalado; em
outros ambientes, instale Chromium com `pnpm exec playwright install chromium`.
`PLAYWRIGHT_CHANNEL` permite escolher outro canal. `UI_TEST_URL` aponta para um
servidor já em execução; sem essa variável o runner inicia o dev server.

No CI a suíte roda em `windows-latest` a cada pull request (`e2e.yml`).
`pnpm e2e:ci` executa todos os testes com as comparações de imagem desligadas,
porque as referências carregam o Chrome e as fontes de uma máquina só. A
comparação de `appearance.spec.ts` roda em seguida apenas como aviso: registra a
diferença e publica o relatório, sem reprovar a pull request. Conferir uma mudança
visual segue sendo trabalho local.

`appearance.spec.ts` compara estados reais no mesmo navegador/plataforma. As
referências partiram do pós-pull (`150eff06`) e foram revistas para incorporar
os ajustes solicitados de espaçamento da barra superior e foco, após corrigir
altura/tipografia dos diálogos e paginação vazia. A suíte espera os sprites
visíveis carregarem e usa um frame fixo do monstro (ver `e2e/fixtures/README.md`),
mantendo a imagem e suas dimensões. Somente os glifos e a remoção do botão
de configurações são excluídos da comparação. Para renovar referências após uma
mudança visual intencional, rode `pnpm e2e:update` e revise cada imagem; não
atualize snapshots para encobrir regressões.

A busca de itens usa os mesmos seletores React: múltipla seleção para tipos e
habilidades, dropdown pesquisável para cada bônus e `SelectButton` Sim/Não para
o modo de correspondência. O catálogo explícito em `src/app/core/item-search.ts`
é conferido contra o motor e o banco em `item-search.spec.ts`. Ao adicionar um
bônus ou família de script, inclua a opção com rótulo em português e seu matcher;
a cobertura deve falhar enquanto essa opção estiver ausente. A descrição
selecionada acompanha as atualizações de `DescriptionStore`. O botão Equipar usa
as mesmas opções e o mesmo fluxo de atualização dos chips do equipamento. Nos
pickers de itens, Buscar itens abre a busca completa com o tipo selecionado e
preserva o destino de origem, incluindo a comparação. O seletor de destino só
aparece quando houver mais de uma opção. Os filtros usam duas colunas, e o botão
para adicionar bônus fica junto ao último campo. A lista e a descrição têm
rolagens independentes; a paginação permanece fora da área rolável da lista.

`interactions.spec.ts` exercita
formulários, overlays, buscas e os fluxos de simulação. Vitest cobre identidade
de seleção, notificações e os ciclos de vida de tooltips/locks/Escape.

A suíte inclui 18 capturas de referência no Chrome/Windows. Os cenários de
interação incluem salvar/carregar/importar/compartilhar simulações, importação
de replay, seleção virtual, cascatas, paginação e destruição de overlays aninhados.
O manifesto, o lockfile, o grafo instalado e os bundles produzidos foram conferidos
sem as três dependências removidas. Os 56 nomes de ícones têm SVGs correspondentes.
