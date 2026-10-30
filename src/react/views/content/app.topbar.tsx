import { Fragment, useMemo, useState } from 'react';
import { Render, interpolate, parseStyle, normalizeStyle, identityKey } from '../render';
import { SelectButton } from '../../ui/select-button';
import { useTooltip } from '../../ui/tooltip';
import { Dialog } from '../../ui/dialog';
import { Button, Icon } from '../../ui/primitives';
import { LocaleSelect } from '../locale-select';
import { useViewportBand } from '../../ui/viewport';
import { useLocale, useRichText, useText } from '../../state/use-text';
import { entryLogs } from '../../../releases/entry-logs';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
const rich = useRichText();
const locale = useLocale();
const previewOptions = useMemo(() => [{ label: t('common.yes'), value: true }, { label: t('common.no'), value: false }], [t]);
const [menuOpen, setMenuOpen] = useState(false);
// Below desktop the language select moves into the menu sheet, where the row has the
// width its three self-names need; the topbar there is down to icons.
const compact = useViewportBand() !== 'desktop';
const previewTooltip = useTooltip({
  text: t('settings.previewsTooltip'),
  position: 'left', showDelay: 300, disabled: !vm.visibleSettings,
});
const closeMenu = () => setMenuOpen(false);
return <><Render tag="div" props={{"className": ["layout-topbar"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["pr-2 topbar-version"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.lastestVersion])}</Render>
<Render tag="button" props={{"aria-label": t('topbar.updates'),
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
"button": true}}>{t('topbar.references')}</Render>
<Render tag="div" props={{"className": ["flex align-items-center gap-2 ml-2"].filter(Boolean).join(' ')}}><Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.issuesReportUrl,
"className": "topbar-nav"}}><Render tag="button" props={{"aria-label": t('topbar.report'),
"className": ["ui-button-warning ui-button-raised px-2"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"name": "comment"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{t('topbar.report')}</Render></Render></Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.issuesBoardUrl,
"className": "topbar-nav"}}><Render tag="button" props={{"aria-label": t('topbar.follow'),
"className": ["ui-button-help ui-button-raised px-2"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"name": "list"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{t('topbar.follow')}</Render></Render></Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.discordUrl,
"className": "topbar-nav"}}><Render tag="button" props={{"aria-label": "Discord",
"className": ["ui-button-raised px-2"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: #5865f2; border-color: #5865f2"))),
"button": true}}><Render tag="app-icon" props={{"name": "discord"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{"Discord"}</Render></Render></Render></Render>
<Render tag="div" props={{"className": ["topbar-actions flex align-items-center gap-2"].filter(Boolean).join(' ')}}>
<Render tag="button" props={{"aria-label": t('topbar.mcpServer'),
"click": (event: any) => vm.action(() => { const $event = event; vm.showMcpDialog() }),
"className": ["ui-button-help ui-button-raised px-2 topbar-nav"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"aria-hidden": "true",
"name": "sparkles"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{"MCP"}</Render></Render>
<Render tag="button" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.openCustomItems() }),
"className": ["ui-button-success ui-button-raised px-2 topbar-nav"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"name": "box"}}></Render>
<Render tag="span" props={{"className": ["pl-1"].filter(Boolean).join(' ')}}>{t('topbar.myItems')}</Render></Render>
<Render tag="button" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.openItemSearch() }),
"aria-label": t('itemSearch.title'),
"className": ["ui-button-info ui-button-raised px-2 topbar-search"].filter(Boolean).join(' '),
"button": true}}><Render tag="app-icon" props={{"name": "search"}}></Render>
<Render tag="span" props={{"className": ["pl-1 topbar-label"].filter(Boolean).join(' ')}}>{t('itemSearch.title')}</Render></Render>
{!compact && <LocaleSelect />}
<Button icon="bars" aria-label={t('topbar.menu')} aria-haspopup="dialog" aria-expanded={menuOpen}
  className="ui-button-secondary ui-button-raised topbar-icon topbar-menu" onClick={() => setMenuOpen(true)} />
<Button icon="cog" aria-label={t('topbar.settings')} aria-haspopup="dialog" aria-expanded={vm.visibleSettings}
  className="ui-button-success ui-button-raised topbar-settings" onClick={() => vm.action(() => { vm.visibleSettings = true; })} />
</Render>
{/* Everything the compact topbar has no room for, as one list of full-width rows. */}
<Dialog header={t('topbar.menu')} visible={menuOpen} modal dismissableMask position="right" onVisibleChange={setMenuOpen}>
  <nav className="topbar-menu-list" aria-label={t('topbar.menu')}>
    <div className="topbar-menu-row topbar-menu-row--control">
      <Icon name="globe" aria-hidden="true" /><span>{t('locale.label')}</span>{compact && <LocaleSelect />}
    </div>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => vm.showUpdateDialog()); }}>
      <Icon name="bell" aria-hidden="true" /><span>{t('topbar.updates')}</span><span className="topbar-menu-meta">{vm.lastestVersion}</span>{vm.showUnreadVersion > 0 && <span className="topbar-menu-badge">{vm.showUnreadVersion}</span>}
    </button>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => vm.openCustomItems()); }}>
      <Icon name="box" aria-hidden="true" /><span>{t('topbar.myItems')}</span>
    </button>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => vm.showMcpDialog()); }}>
      <Icon name="sparkles" aria-hidden="true" /><span>{t('topbar.mcpServer')}</span>
    </button>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => vm.showReferenceDialog()); }}>
      <Icon name="list" aria-hidden="true" /><span>{t('topbar.references')}</span>
    </button>
    <a className="topbar-menu-row" href={vm.issuesReportUrl} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
      <Icon name="comment" aria-hidden="true" /><span>{t('topbar.report')}</span><Icon name="external-link" aria-hidden="true" className="topbar-menu-external" />
    </a>
    <a className="topbar-menu-row" href={vm.issuesBoardUrl} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
      <Icon name="list" aria-hidden="true" /><span>{t('topbar.follow')}</span><Icon name="external-link" aria-hidden="true" className="topbar-menu-external" />
    </a>
    <a className="topbar-menu-row" href={vm.discordUrl} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
      <Icon name="discord" aria-hidden="true" /><span>Discord</span><Icon name="external-link" aria-hidden="true" className="topbar-menu-external" />
    </a>
    <button type="button" className="topbar-menu-row" onClick={() => { closeMenu(); vm.action(() => { vm.visibleSettings = true; }); }}>
      <Icon name="cog" aria-hidden="true" /><span>{t('topbar.settings')}</span>
    </button>
  </nav>
</Dialog>
<Dialog header={t('topbar.settings')} visible={vm.visibleSettings} modal dismissableMask position="right"
  onVisibleChange={visible => vm.action(() => { vm.visibleSettings = visible; })}>
  {/* A tap opens the tip from the label only; on the yes / no buttons it just picks. */}
  <div {...previewTooltip.triggerProps} className="flex align-items-center justify-content-between gap-3"
    onClick={event => { if (!(event.target as HTMLElement).closest('[role=group]')) previewTooltip.triggerProps.onClick?.(event); }}>
    <span className="settings-preview-label" tabIndex={0}>{t('settings.previews')}</span>
    <SelectButton ariaLabel={t('settings.showPreviews')} options={previewOptions} value={vm.showPreviews}
      onChange={value => vm.action(() => vm.setShowPreviews(value))} />
  </div>
  {previewTooltip.tooltip}
</Dialog>
<Render tag="app-ui-dialog" props={{"modal": true,
"visible": vm.visibleUpdate,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleUpdate = $event) }),
"closed": (event: any) => vm.action(() => { const $event = event; vm.onHideUpdateDialog() }),
"style": normalizeStyle(Object.assign({}, normalizeStyle(vm.updateDialogStyle))),
"template_header": (context: any) => {  return <><Render tag="div" props={{"className": ["flex"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["text-xl mr-3 font-medium"].filter(Boolean).join(' ')}}>{t('updates.title')}</Render></Render></>; }}}>
{vm.visibleUpdate && vm.updatesLoading ? <p role="status">{t('updates.loading')}</p> : null}
{vm.visibleUpdate && vm.updatesError ? <p role="alert">{t('updates.error')} <button type="button" onClick={() => vm.action(() => vm.showUpdateDialog())}>{t('updates.retry')}</button></p> : null}
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
<Render tag="ul" props={{"className": ["mt-0"].filter(Boolean).join(' ')}}>{entryLogs(update, locale).map((__entry7: any, __index7: number, __array7: any[]) => { const log = __entry7; return <Fragment key={identityKey(__entry7)}><Render tag="li" props={{}}>{interpolate(["",""], [log])}</Render></Fragment>; })}</Render></Render></Fragment>; })}
<Render tag="div" props={{"className": ["mt-3 text-center"].filter(Boolean).join(' ')}}><Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"className": ["changelog-original-link"].filter(Boolean).join(' '),
"href": vm.originalChangelogUrl}}>{t('updates.originalHistory')}</Render></Render></Render>
<Render tag="app-ui-dialog" props={{"modal": true,
"visible": vm.visibleMcp,
"contentStyle": {"maxHeight": "75vh"},
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleMcp = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "46rem","maxWidth": "95vw"}))),
"template_header": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center gap-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "sparkles",
"className": ["text-xl"].filter(Boolean).join(' ')}}></Render>
<Render tag="span" props={{"className": ["text-xl font-medium"].filter(Boolean).join(' ')}}>{t('mcp.title')}</Render>
<Render tag="app-ui-chip" props={{"label": t('mcp.experimental'),
"styleClass": "text-sm"}}></Render></Render></>; }}}>
<Render tag="div" props={{"className": ["flex align-items-start gap-2 mb-3 p-2 border-round"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{rich('mcp.warning')}</Render></Render>
<Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{rich('mcp.intro')}</Render>
<Render tag="p" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{rich('mcp.shareLink')}</Render>
<Render tag="div" props={{"className": ["flex align-items-center gap-2 mb-3 p-2 border-round surface-100"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "link"}}></Render>
<Render tag="code" props={{"className": ["flex-1 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("word-break: break-all")))}}>{interpolate(["",""], [vm.mcpUrl])}</Render>
<Render tag="button" props={{"icon": (vm.mcpUrlCopied ? "check" : "copy"),
"label": (vm.mcpUrlCopied ? t('common.copied') : t('common.copy')),
"click": (event: any) => vm.action(() => { const $event = event; vm.copyMcpUrl() }),
"className": ["ui-button-sm",(vm.mcpUrlCopied ? "ui-button-success" : '')].filter(Boolean).join(' '),
"button": true}}></Render></Render>
<Render tag="h3" props={{"className": ["mt-0 mb-2 text-lg"].filter(Boolean).join(' ')}}>{t('mcp.whatToAsk')}</Render>
<Render tag="p" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{rich('mcp.customItems')}</Render>
<Render tag="div" props={{"className": ["flex flex-column gap-2 mb-3"].filter(Boolean).join(' ')}}>{(vm.mcpExamples ?? []).map((__entry8: any, __index8: number, __array8: any[]) => { const example = __entry8; return <Fragment key={identityKey(__entry8)}><Render tag="div" props={{"className": ["p-2 border-round surface-50"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["flex align-items-center gap-2 font-medium"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": example.icon}}></Render>
<Render tag="span" props={{}}>{t(example.title)}</Render></Render>
<Render tag="p" props={{"className": ["my-1 font-italic text-primary"].filter(Boolean).join(' ')}}>{interpolate(["“","”"], [t(example.prompt)])}</Render>
<Render tag="small" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{t(example.note)}</Render></Render></Fragment>; })}</Render>
<Render tag="h3" props={{"className": ["mt-0 mb-2 text-lg"].filter(Boolean).join(' ')}}>{t('mcp.howToConnect')}</Render>
<Render tag="app-ui-accordion" props={{}}><Render tag="app-ui-accordion-tab" props={{"header": "Claude"}}><Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="b" props={{}}>{"Claude.ai / Claude Desktop"}</Render></Render>
<Render tag="ol" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{rich('mcp.claudeStep1')}</Render>
<Render tag="li" props={{}}>{rich('mcp.claudeStep2')}</Render>
<Render tag="li" props={{}}>{t('mcp.claudeStep3')}</Render></Render>
<Render tag="p" props={{"className": ["mb-1 line-height-3"].filter(Boolean).join(' ')}}>{rich('mcp.claudeCodeStep')}</Render>
<Render tag="pre" props={{"className": ["p-2 border-round surface-100 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("white-space: pre-wrap; word-break: break-all")))}}>{interpolate(["claude mcp add --transport http ro-calc ",""], [vm.mcpUrl])}</Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "ChatGPT"}}><Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{rich('mcp.chatgptIntro')}</Render>
<Render tag="ol" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{rich('mcp.chatgptStep1')}</Render>
<Render tag="li" props={{}}>{rich('mcp.chatgptStep2')}</Render>
<Render tag="li" props={{}}>{t('mcp.chatgptStep3')}</Render>
<Render tag="li" props={{}}>{rich('mcp.chatgptStep4')}</Render></Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": t('mcp.faq')}}><Render tag="ul" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{rich('mcp.faqAccount')}</Render>
<Render tag="li" props={{}}>{rich('mcp.faqBuild')}</Render>
<Render tag="li" props={{}}>{rich('mcp.faqMath')}</Render>
<Render tag="li" props={{}}>{rich('mcp.faqMissingItem')}</Render></Render></Render></Render>
<Render tag="div" props={{"className": ["mt-3 flex gap-2 flex-wrap justify-content-center align-items-center"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('mcp.trouble')}</Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.discordUrl}}><Render tag="app-ui-chip" props={{"label": "Discord",
"icon": "discord"}}></Render></Render></Render></Render>
<Render tag="app-help-improve" props={{"visible": vm.visibleHelpImprove,
"appVersion": vm.lastestVersion,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleHelpImprove = $event) })}}></Render>
<Render tag="app-ui-dialog" props={{"header": t('topbar.references'),
"modal": true,
"visible": vm.visibleReference,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visibleReference = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "50vw","height": "70vh"})))}}><Render tag="ul" props={{}}>{(vm.references ?? []).map((__entry9: any, __index9: number, __array9: any[]) => { const reference = __entry9; return <Fragment key={identityKey(__entry9)}><Render tag="li" props={{}}><Render tag="span" props={{}}>{t('topbar.referenceWriter', { writer: reference.writer })}</Render>
<Render tag="span" props={{"className": ["mx-2"].filter(Boolean).join(' ')}}>{reference.labelKey ? t(reference.labelKey) : reference.label}</Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": interpolate(["",""], [reference.link])}}>{t('topbar.referenceLink')}</Render></Render></Fragment>; })}</Render></Render></Render></>;
}
