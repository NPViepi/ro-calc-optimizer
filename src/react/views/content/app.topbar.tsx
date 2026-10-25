import { Fragment, useState } from 'react';
import { Render, interpolate, parseStyle, normalizeStyle, identityKey } from '../render';
import { SelectButton } from '../../ui/select-button';
import { useTooltip } from '../../ui/tooltip';
import { Dialog } from '../../ui/dialog';
import { Button, Icon } from '../../ui/primitives';
export function Content({vm, services}: {vm: any; services: any}) {
const [menuOpen, setMenuOpen] = useState(false);
const previewTooltip = useTooltip({
  text: 'Exibe itens e habilidades ainda não disponíveis no LATAM e permite testar o rebalanceamento. Em Não, oculta as prévias, desativa seus buffs, remove seus ataques da rotação e volta às fórmulas LATAM. Itens já equipados são mantidos. A escolha fica salva neste navegador.',
  position: 'left', showDelay: 300, disabled: !vm.visibleSettings,
});
const closeMenu = () => setMenuOpen(false);
return <><Render tag="div" props={{"className": ["layout-topbar"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["pr-2 topbar-version"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.lastestVersion])}</Render>
<Render tag="button" props={{"aria-label": "Novidades",
"click": (event: any) => vm.action(() => { const $event = event; vm.showUpdateDialog() }),
"className": ["ui-button-text ui-button-info topbar-bell"].filter(Boolean).join(' '),
"button": true}}>{(() => { const __condition1 = (vm.showUnreadVersion > 0);  return __condition1 ? <><Render tag="app-icon" props={{"severity": "danger",
"name": "bell",
"value": interpolate(["",""], [vm.showUnreadVersion]),
"className": ["text-xl"].filter(Boolean).join(' '),
"badge": true}}></Render></> : null; })()}
{(() => { const __condition2 = (vm.showUnreadVersion === 0);  return __condition2 ? <><Render tag="app-icon" props={{"severity": "danger",
"name": "bell",
"className": ["text-xl"].filter(Boolean).join(' ')}}></Render></> : null; })()}</Render>
<Render tag="button" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.showReferenceDialog() }),
"className": ["pl-2 ui-button-text ui-button-info ui-button-raised topbar-nav"].filter(Boolean).join(' '),
"button": true}}>{"Referências"}</Render>
<Render tag="div" props={{"className": ["flex align-items-center gap-2 ml-2"].filter(Boolean).join(' ')}}><Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.issuesReportUrl,
"className": "topbar-nav"}}><Render tag="button" props={{"aria-label": "Reportar",
"className": ["ui-button-warning ui-button-raised px-2"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"name": "comment"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{"Reportar"}</Render></Render></Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.issuesBoardUrl,
"className": "topbar-nav"}}><Render tag="button" props={{"aria-label": "Acompanhar",
"className": ["ui-button-help ui-button-raised px-2"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"name": "list"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{"Acompanhar"}</Render></Render></Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.discordUrl,
"className": "topbar-nav"}}><Render tag="button" props={{"aria-label": "Discord",
"className": ["ui-button-raised px-2"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: #5865f2; border-color: #5865f2"))),
"button": true}}><Render tag="app-icon" props={{"name": "discord"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{"Discord"}</Render></Render></Render></Render>
<Render tag="div" props={{"className": ["topbar-actions flex align-items-center gap-2"].filter(Boolean).join(' ')}}>
<Render tag="button" props={{"aria-label": "Servidor MCP",
"click": (event: any) => vm.action(() => { const $event = event; vm.showMcpDialog() }),
"className": ["ui-button-help ui-button-raised px-2 topbar-nav"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"aria-hidden": "true",
"name": "sparkles"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{"MCP"}</Render></Render>
<Render tag="button" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.openCustomItems() }),
"className": ["ui-button-success ui-button-raised px-2 topbar-nav"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"name": "box"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{"Meus itens"}</Render></Render>
<Render tag="button" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.openItemSearch() }),
"aria-label": "Buscar itens",
"className": ["ui-button-info ui-button-raised px-2 topbar-search"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"name": "search"}}></Render>
<Render tag="span" props={{"className": ["pl-1 topbar-label"].filter(Boolean).join(' ')}}>{"Buscar itens"}</Render></Render>
<Button icon="save" aria-label="Salvar simulação" className="ui-button-success ui-button-raised topbar-icon topbar-phone"
  onClick={() => vm.action(() => vm.openBuildSave())} />
<Button icon="share-alt" aria-label="Gerar link para compartilhar" className="ui-button-success ui-button-raised topbar-icon topbar-phone"
  onClick={() => vm.action(() => vm.openBuildShare())} />
<Button icon="bars" aria-label="Menu" aria-haspopup="dialog" aria-expanded={menuOpen}
  className="ui-button-secondary ui-button-raised topbar-icon topbar-menu" onClick={() => setMenuOpen(true)} />
<Button icon="cog" aria-label="Configurações" aria-haspopup="dialog" aria-expanded={vm.visibleSettings}
  className="ui-button-success ui-button-raised topbar-settings" onClick={() => vm.action(() => { vm.visibleSettings = true; })} />
</Render>
{/* Everything the compact topbar has no room for, as one list of full-width rows. */}
<Dialog header="Menu" visible={menuOpen} modal dismissableMask position="right" onVisibleChange={setMenuOpen}>
  <nav className="topbar-menu-list" aria-label="Menu">
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => vm.showUpdateDialog()); }}>
      <Icon name="bell" aria-hidden="true" /><span>Novidades</span><span className="topbar-menu-meta">{vm.lastestVersion}</span>{vm.showUnreadVersion > 0 && <span className="topbar-menu-badge">{vm.showUnreadVersion}</span>}
    </button>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => vm.openCustomItems()); }}>
      <Icon name="box" aria-hidden="true" /><span>Meus itens</span>
    </button>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => vm.showMcpDialog()); }}>
      <Icon name="sparkles" aria-hidden="true" /><span>Servidor MCP</span>
    </button>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => vm.showReferenceDialog()); }}>
      <Icon name="list" aria-hidden="true" /><span>Referências</span>
    </button>
    <a className="topbar-menu-row" href={vm.issuesReportUrl} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
      <Icon name="comment" aria-hidden="true" /><span>Reportar</span><Icon name="external-link" aria-hidden="true" className="topbar-menu-external" />
    </a>
    <a className="topbar-menu-row" href={vm.issuesBoardUrl} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
      <Icon name="list" aria-hidden="true" /><span>Acompanhar</span><Icon name="external-link" aria-hidden="true" className="topbar-menu-external" />
    </a>
    <a className="topbar-menu-row" href={vm.discordUrl} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
      <Icon name="discord" aria-hidden="true" /><span>Discord</span><Icon name="external-link" aria-hidden="true" className="topbar-menu-external" />
    </a>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => { vm.visibleSettings = true; }); }}>
      <Icon name="cog" aria-hidden="true" /><span>Configurações</span>
    </button>
  </nav>
</Dialog>
<Dialog header="Configurações" visible={vm.visibleSettings} modal dismissableMask position="right"
  onVisibleChange={visible => vm.action(() => { vm.visibleSettings = visible; })}>
  {/* A tap opens the tip from the label only; on Sim / Não it just picks. */}
  <div {...previewTooltip.triggerProps} className="flex align-items-center justify-content-between gap-3"
    onClick={event => { if (!(event.target as HTMLElement).closest('[role=group]')) previewTooltip.triggerProps.onClick?.(event); }}>
    <span className="settings-preview-label" tabIndex={0}>Prévias</span>
    <SelectButton ariaLabel="Mostrar prévias" options={vm.previewOptions} value={vm.showPreviews}
      onChange={value => vm.action(() => vm.setShowPreviews(value))} />
  </div>
  {previewTooltip.tooltip}
</Dialog>
<Render tag="app-ui-dialog" props={{"header": "Informações adicionais",
"modal": true,
"visible": vm.visibleInfo,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleInfo = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "50vw"})))}}><Render tag="div" props={{"className": ["card flex flex-column align-items-center gap-2 flex-wrap"].filter(Boolean).join(' ')}}><Render tag="ul" props={{}}>{(vm.infos ?? []).map((__entry3: any, __index3: number, __array3: any[]) => { const info = __entry3; return <Fragment key={identityKey(__entry3)}><Render tag="li" props={{}}>{interpolate(["",""], [info])}</Render></Fragment>; })}</Render>
<Render tag="div" props={{"className": ["flex gap-2 flex-wrap justify-content-center"].filter(Boolean).join(' ')}}>{" Reportar problema "}
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.issuesReportUrl}}><Render tag="app-ui-chip" props={{"label": "Reportar",
"icon": "comment"}}></Render></Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.issuesBoardUrl}}><Render tag="app-ui-chip" props={{"label": "Acompanhar",
"icon": "list"}}></Render></Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.discordUrl}}><Render tag="app-ui-chip" props={{"label": "Discord",
"icon": "discord"}}></Render></Render></Render></Render></Render>
<Render tag="app-ui-dialog" props={{"modal": true,
"visible": vm.visibleUpdate,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleUpdate = $event) }),
"closed": (event: any) => vm.action(() => { const $event = event; vm.onHideUpdateDialog() }),
"style": normalizeStyle(Object.assign({}, normalizeStyle(vm.updateDialogStyle))),
"template_header": (context: any) => {  return <><Render tag="div" props={{"className": ["flex"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["text-xl mr-3 font-medium"].filter(Boolean).join(' ')}}>{"NOVIDADES"}</Render></Render></>; }}}>
{vm.visibleUpdate && vm.updatesLoading ? <p role="status">Carregando novidades…</p> : null}
{vm.visibleUpdate && vm.updatesError ? <p role="alert">Não foi possível carregar as novidades. <button type="button" onClick={() => vm.action(() => vm.showUpdateDialog())}>Tentar novamente</button></p> : null}
{(vm.visibleUpdate ? vm.updates : []).map((__entry4: any, __index4: number, __array4: any[]) => { const update = __entry4;
const i = __index4; return <Fragment key={identityKey(__entry4)}><Render tag="div" props={{"style": normalizeStyle(Object.assign({}, normalizeStyle({"color": (((i + 1) > vm.showUnreadVersion) ? "var(--gray-300)" : "white")})))}}><Render tag="div" props={{"className": ["grid grid-nogutter"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["ui-col-12"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("display: flex; align-content: center; justify-content: center; align-items: center")))}}><Render tag="span" props={{"className": ["pr-2"].filter(Boolean).join(' ')}}>{interpolate(["",""], [update.v])}</Render>
<Render tag="span" props={{}}>{interpolate([""," "], [update.date])}</Render>
<Render tag="span" props={{}}>{(() => { const __condition5 = ((vm.unreadVersion === -(1)) || (vm.unreadVersion > i));  return __condition5 ? <><Render tag="button" props={{"icon": "eye",
"click": (event: any) => vm.action(() => { const $event = event; vm.onReadUpdateClick(update.v) }),
"className": ["ui-button-text ui-button-primary"].filter(Boolean).join(' '),
"button": true}}></Render></> : null; })()}
{(() => { const __condition6 = !(((vm.unreadVersion === -(1)) || (vm.unreadVersion > i)));  return __condition6 ? <><Render tag="app-icon" props={{"name": "eye-slash",
"className": ["ml-2"].filter(Boolean).join(' ')}}></Render></> : null; })()}</Render></Render></Render>
<Render tag="ul" props={{"className": ["mt-0"].filter(Boolean).join(' ')}}>{(update.logs ?? []).map((__entry7: any, __index7: number, __array7: any[]) => { const log = __entry7; return <Fragment key={identityKey(__entry7)}><Render tag="li" props={{}}>{interpolate(["",""], [log])}</Render></Fragment>; })}</Render></Render></Fragment>; })}
<Render tag="div" props={{"className": ["mt-3 text-center"].filter(Boolean).join(' ')}}><Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"className": ["changelog-original-link"].filter(Boolean).join(' '),
"href": vm.originalChangelogUrl}}>{"Histórico original (pré-fork) →"}</Render></Render></Render>
<Render tag="app-ui-dialog" props={{"modal": true,
"visible": vm.visibleMcp,
"contentStyle": {"maxHeight": "75vh"},
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleMcp = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "46rem","maxWidth": "95vw"}))),
"template_header": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center gap-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "sparkles",
"className": ["text-xl"].filter(Boolean).join(' ')}}></Render>
<Render tag="span" props={{"className": ["text-xl font-medium"].filter(Boolean).join(' ')}}>{"Conecte sua IA ao simulador"}</Render>
<Render tag="app-ui-chip" props={{"label": "Experimental",
"styleClass": "text-sm"}}></Render></Render></>; }}}>
<Render tag="div" props={{"className": ["flex align-items-start gap-2 mb-3 p-2 border-round"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}><Render tag="b" props={{}}>{"Recurso altamente experimental."}</Render>
{" Acabou de sair do forno, pode mudar, sair do ar ou responder besteira sem aviso. Trate como curiosidade, não como fonte final — na dúvida, confira o resultado aqui no simulador. "}</Render></Render>
<Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{" O simulador tem um servidor "}
<Render tag="b" props={{}}>{"MCP"}</Render>
{" aberto: você conecta uma IA (Claude, ChatGPT e outras) e ela passa a usar o mesmo motor de cálculo desta página — os mesmos itens, monstros e fórmulas. Os números que ela responder são idênticos aos daqui. "}</Render>
<Render tag="p" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{" O caminho mais simples é "}
<Render tag="b" props={{}}>{"colar o link da sua build"}</Render>
{": monte tudo aqui, clique em "}
<Render tag="b" props={{}}>{"Link"}</Render>
{" na barra de cima e cole o endereço na conversa. A IA lê a build inteira — classe, níveis, atributos e cada peça com refino, cartas e encantamentos — e devolve outro link com o que ela sugerir, já pronto para abrir de volta no simulador. O link encurtado também funciona. "}</Render>
<Render tag="div" props={{"className": ["flex align-items-center gap-2 mb-3 p-2 border-round surface-100"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "link"}}></Render>
<Render tag="code" props={{"className": ["flex-1 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("word-break: break-all")))}}>{interpolate(["",""], [vm.mcpUrl])}</Render>
<Render tag="button" props={{"icon": (vm.mcpUrlCopied ? "check" : "copy"),
"label": (vm.mcpUrlCopied ? "Copiado" : "Copiar"),
"click": (event: any) => vm.action(() => { const $event = event; vm.copyMcpUrl() }),
"className": ["ui-button-sm",(vm.mcpUrlCopied ? "ui-button-success" : '')].filter(Boolean).join(' '),
"button": true}}></Render></Render>
<Render tag="h3" props={{"className": ["mt-0 mb-2 text-lg"].filter(Boolean).join(' ')}}>{"O que dá para pedir"}</Render>
<Render tag="p" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{"Também é possível criar "}
<Render tag="b" props={{}}>{"um ou até 20 itens personalizados de uma vez"}</Render>
{". Peça, por exemplo: “Crie uma espada e duas cartas que formem um conjunto”. A IA devolverá um link; abri-lo neste navegador adiciona o lote em "}
<Render tag="b" props={{}}>{"Meus itens"}</Render>
{". O link carrega os itens sem salvar nada no servidor."}</Render>
<Render tag="div" props={{"className": ["flex flex-column gap-2 mb-3"].filter(Boolean).join(' ')}}>{(vm.mcpExamples ?? []).map((__entry8: any, __index8: number, __array8: any[]) => { const example = __entry8; return <Fragment key={identityKey(__entry8)}><Render tag="div" props={{"className": ["p-2 border-round surface-50"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["flex align-items-center gap-2 font-medium"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": example.icon}}></Render>
<Render tag="span" props={{}}>{interpolate(["",""], [example.title])}</Render></Render>
<Render tag="p" props={{"className": ["my-1 font-italic text-primary"].filter(Boolean).join(' ')}}>{interpolate(["“","”"], [example.prompt])}</Render>
<Render tag="small" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{interpolate(["",""], [example.note])}</Render></Render></Fragment>; })}</Render>
<Render tag="h3" props={{"className": ["mt-0 mb-2 text-lg"].filter(Boolean).join(' ')}}>{"Como conectar"}</Render>
<Render tag="app-ui-accordion" props={{}}><Render tag="app-ui-accordion-tab" props={{"header": "Claude"}}><Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="b" props={{}}>{"Claude.ai / Claude Desktop"}</Render></Render>
<Render tag="ol" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{"Configurações → "}
<Render tag="b" props={{}}>{"Conectores"}</Render>
{"."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Adicionar conector personalizado"}</Render>
{"."}</Render>
<Render tag="li" props={{}}>{"Cole a URL acima e salve. Não precisa de login nem de chave."}</Render></Render>
<Render tag="p" props={{"className": ["mb-1 line-height-3"].filter(Boolean).join(' ')}}><Render tag="b" props={{}}>{"Claude Code"}</Render>
{", pelo terminal:"}</Render>
<Render tag="pre" props={{"className": ["p-2 border-round surface-100 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("white-space: pre-wrap; word-break: break-all")))}}>{interpolate(["claude mcp add --transport http ro-calc ",""], [vm.mcpUrl])}</Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "ChatGPT"}}><Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{" Conectores personalizados ficam no "}
<Render tag="b" props={{}}>{"modo desenvolvedor"}</Render>
{", hoje em beta e disponível nos planos "}
<Render tag="b" props={{}}>{"Plus e Pro"}</Render>
{". "}</Render>
<Render tag="ol" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{"Configurações → "}
<Render tag="b" props={{}}>{"Conectores"}</Render>
{" → "}
<Render tag="b" props={{}}>{"Configurações avançadas"}</Render>
{"."}</Render>
<Render tag="li" props={{}}>{"Ative o "}
<Render tag="b" props={{}}>{"modo desenvolvedor"}</Render>
{"."}</Render>
<Render tag="li" props={{}}>{"Volte em Conectores e crie um conector personalizado com a URL acima."}</Render>
<Render tag="li" props={{}}>{"Em autenticação, escolha "}
<Render tag="b" props={{}}>{"sem autenticação"}</Render>
{"."}</Render></Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "Dúvidas comuns"}}><Render tag="ul" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}><Render tag="b" props={{}}>{"Precisa pagar ou criar conta?"}</Render>
{" Não. O servidor é público e só lê dados — ele não altera nada."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Minha build vai para algum lugar?"}</Render>
{" Só o que você mandar para a IA. O servidor não guarda nada."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"A IA erra a conta?"}</Render>
{" Ela não faz a conta: quem calcula é o simulador. Se um número parecer estranho, abra o link que ela devolve e confira aqui."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Item “fora do banco de dados”?"}</Render>
{" Existe no LATAM mas ainda não foi cadastrado aqui, então não entra nos cálculos. Avise no Discord que a gente adiciona."}</Render></Render></Render></Render>
<Render tag="div" props={{"className": ["mt-3 flex gap-2 flex-wrap justify-content-center align-items-center"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Deu problema?"}</Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.discordUrl}}><Render tag="app-ui-chip" props={{"label": "Discord",
"icon": "discord"}}></Render></Render></Render></Render>
<Render tag="app-help-improve" props={{"visible": vm.visibleHelpImprove,
"appVersion": vm.lastestVersion,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleHelpImprove = $event) })}}></Render>
<Render tag="app-ui-dialog" props={{"header": "Referências",
"modal": true,
"visible": vm.visibleReference,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleReference = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "50vw","height": "70vh"})))}}><Render tag="ul" props={{}}>{(vm.references ?? []).map((__entry9: any, __index9: number, __array9: any[]) => { const reference = __entry9; return <Fragment key={identityKey(__entry9)}><Render tag="li" props={{}}><Render tag="span" props={{}}>{interpolate(["[ por "," ]"], [reference.writer])}</Render>
<Render tag="span" props={{"className": ["mx-2"].filter(Boolean).join(' ')}}>{interpolate(["",""], [reference.label])}</Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": interpolate(["",""], [reference.link])}}>{"Link"}</Render></Render></Fragment>; })}</Render></Render></Render></>;
}
