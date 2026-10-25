import { Fragment, useRef, useState } from 'react';
import { Icon } from '../../ui/primitives';
import { IconName } from '../../../app/ui/icon-names';
import { Render, displayPipe, interpolate, classNames, parseStyle, normalizeStyle, identityKey } from '../render';
import { sanitizeHtml } from '../../ui/sanitize-html';
import { PanelSearch } from '../../ui/panel-search';
import { useViewportBand } from '../../ui/viewport';
type Pane = 'build' | 'equip' | 'result';
const PANES: { key: Pane; label: string; icon: IconName }[] = [
  { key: 'build', label: 'Build', icon: 'pencil' },
  { key: 'equip', label: 'Equip.', icon: 'shield' },
  { key: 'result', label: 'Resultado', icon: 'bolt' },
];
/**
 * Below the two-column width the calculator shows one pane at a time. A tablet gets the
 * build (equipment included) and the result; a phone splits equipment into its own tab.
 * Desktop never shows this bar; responsive.css decides which buttons each band shows.
 */
function PaneSwitcher({ pane, onPane }: { pane: Pane; onPane: (pane: Pane) => void }) {
  // A tablet has no Equip. tab: the equipment pane left over from a phone width is part of the build.
  const lit = useViewportBand() !== 'phone' && pane === 'equip' ? 'build' : pane;
  return <nav className="calc-panes" aria-label="Painéis do simulador">
    {PANES.map(entry => <button key={entry.key} type="button" aria-pressed={lit === entry.key}
      className={`calc-panes__tab calc-panes__tab--${entry.key}`}
      onClick={() => onPane(entry.key)}><Icon name={entry.icon} aria-hidden="true" /><span>{entry.label}</span></button>)}
  </nav>;
}
export function Content({vm, services}: {vm: any; services: any}) {
const [pane, setPane] = useState<Pane>('build');
// Summary groups folded on a phone, by title; wider screens always show every group.
const [foldedGroups, setFoldedGroups] = useState<Record<string, boolean>>({});
const toggleGroup = (title: string) => setFoldedGroups(folded => ({ ...folded, [title]: !folded[title] }));
const shell = useRef<HTMLElement | null>(null);
const choosePane = (next: Pane) => {
  setPane(next);
  // A pane starts at its top, not at the scroll offset of the one it replaced.
  // The shell's scroll-margin-top (responsive.css) clears the topbar and the switcher.
  const margin = shell.current ? parseFloat(getComputedStyle(shell.current).scrollMarginTop) || 0 : 0;
  const top = shell.current ? shell.current.getBoundingClientRect().top + window.scrollY - margin : 0;
  if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top) });
};
return <>{(() => { const reductionPop = (context: any) => { const cats = context["cats"];
const sources = context["sources"];
const target = context["target"]; return <><Render tag="div" props={{"className": ["reduction-pop"].filter(Boolean).join(' ')}}>{(() => { const __condition1 = !(cats?.length);  return __condition1 ? <><Render tag="div" props={{"className": ["reduction-empty"].filter(Boolean).join(' ')}}>{"Sem reduções de dano vs jogadores."}</Render></> : null; })()}
{(cats ?? []).map((__entry2: any, __index2: number, __array2: any[]) => { const cat = __entry2; return <Fragment key={identityKey(__entry2)}><Render tag="div" props={{"className": ["reduction-cat"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["reduction-cat-title"].filter(Boolean).join(' ')}}>{interpolate(["",""], [cat.label])}</Render>
{(cat.rows ?? []).map((__entry3: any, __index3: number, __array3: any[]) => { const row = __entry3; return <Fragment key={identityKey(__entry3)}><Render tag="div" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.openReductionRow(row,target) }),
"className": ["reduction-row",(vm.reductionRowClickable(row,sources) ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"activateWithKeys": true}}><Render tag="span" props={{"className": ["reduction-row-label"].filter(Boolean).join(' ')}}>{interpolate(["",""], [row.label])}</Render>
<Render tag="span" props={{"className": ["reduction-val",((row.percent < 0) ? "neg" : '')].filter(Boolean).join(' ')}}>{interpolate(["","%"], [row.percent])}</Render></Render></Fragment>; })}</Render></Fragment>; })}</Render></>; }; return <><Render tag="app-ui-toast" props={{}}></Render>
<Render tag="app-ui-block" props={{"blocked": (vm.isInProcessingPreset && !(vm.isBooting))}}></Render>

<Render tag="app-ui-confirm-dialog" props={{"position": "top",
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "25vw"})))}}></Render>
<Render tag="app-item-search" props={{"items": vm.items,
"selectedCharacter": vm.selectedCharacter,
"className": vm.selectedClassLabel,
"currentLevel": vm.model.level,
"equipableItems": vm.equipableItems,
"offensiveSkills": vm.offensiveSkills,
"onClassChanged": vm.onClassChanged$}}></Render>
<Render tag="app-custom-item-studio" props={{"items": vm.items,
"currentModel": vm.model,
"currentMonster": vm.monsterDataMap[vm.selectedMonster],
"saved": (event: any) => vm.action(() => { const $event = event; vm.onCustomItemSaved($event) }),
"deleted": (event: any) => vm.action(() => { const $event = event; vm.onCustomItemDeleted($event) }),
"reference": (value: any) => { vm.customStudio = value; }}}></Render>
<Render tag="app-ui-dialog" props={{"header": "",
"modal": true,
"visible": vm.isShowMonsterEle,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.isShowMonsterEle = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "92vw","max-width": "1600px","height": "85dvh","min-height": "min(500px, calc(100dvh - 2.5rem))"})))}}><Render tag="app-elemental-table" props={{"monsterMap": vm.monsterDataMap,
"groupMonsterList": vm.groupMonsterList,
"allSelectedMonsterIds": vm.allSelectedMonsterIds}}></Render></Render>
<Render tag="app-ui-dialog" props={{"header": vm.bonusBreakdownTitle,
"visible": vm.isShowBonusBreakdown,
"modal": true,
"dismissableMask": true,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.isShowBonusBreakdown = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "420px","max-width": "92vw"})))}}>{(() => { const __condition4 = vm.bonusBreakdownNote;  return __condition4 ? <><Render tag="div" props={{"className": ["bonus_breakdown_note"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.bonusBreakdownNote])}</Render></> : null; })()}
{(() => { const __condition5 = vm.bonusBreakdownCalc;  return __condition5 ? <><Render tag="div" props={{"className": ["bonus_breakdown_calc"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["bonus_breakdown_calc_title"].filter(Boolean).join(' ')}}>{"Cálculo"}</Render>
<Render tag="ul" props={{"className": ["bonus_breakdown_list"].filter(Boolean).join(' ')}}>{(vm.bonusBreakdownCalc.rows ?? []).map((__entry6: any, __index6: number, __array6: any[]) => { const r = __entry6; return <Fragment key={identityKey(__entry6)}><Render tag="li" props={{"className": ["flex align-items-center justify-content-between py-1 px-1",(r.emphasis ? "calc_total" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["flex align-items-center gap-2 text_ellips"].filter(Boolean).join(' ')}}>{(() => { const __condition7 = r.icon;  return __condition7 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", r.icon, [r.iconType], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
<Render tag="span" props={{}}>{interpolate(["",""], [r.label])}</Render>
{(() => { const __condition8 = r.hint;  return __condition8 ? <><Render tag="span" props={{"className": ["calc_hint"].filter(Boolean).join(' ')}}>{interpolate(["",""], [r.hint])}</Render></> : null; })()}</Render>
{(() => { const __condition9 = r.display;  return __condition9 ? <><Render tag="span" props={{"className": ["font-semibold ml-2"].filter(Boolean).join(' ')}}>{interpolate(["",""], [r.display])}</Render></> : null; })()}</Render></Fragment>; })}</Render>
{(() => { const __condition10 = vm.bonusBreakdownCalc.note;  return __condition10 ? <><Render tag="div" props={{"className": ["bonus_breakdown_calc_note"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.bonusBreakdownCalc.note])}</Render></> : null; })()}
{(() => { const __condition11 = vm.bonusBreakdownCalc.link; const link = __condition11; return __condition11 ? <><Render tag="a" props={{"target": "_blank",
"rel": "noopener noreferrer",
"href": link.url,
"className": ["bonus_breakdown_calc_link"].filter(Boolean).join(' ')}}>{interpolate([""," "], [link.label])}
<Render tag="app-icon" props={{"name": "external-link"}}></Render></Render></> : null; })()}</Render></> : null; })()}
{(() => { const __condition12 = ((vm.bonusBreakdownRows.length === 0) && !(vm.bonusBreakdownCalc));  return __condition12 ? <><Render tag="div" props={{"className": ["p-2 text-center"].filter(Boolean).join(' ')}}>{" Sem contribuição de itens, consumíveis, buffs ou habilidades — este valor vem de atributos base/classe. "}</Render></> : null; })()}
{(() => { const __condition13 = vm.bonusBreakdownRows.length;  return __condition13 ? <><Render tag="ul" props={{"className": ["bonus_breakdown_list"].filter(Boolean).join(' ')}}>{(vm.bonusBreakdownRows ?? []).map((__entry14: any, __index14: number, __array14: any[]) => { const r = __entry14; return <Fragment key={identityKey(__entry14)}><Render tag="li" props={{"className": ["flex align-items-center justify-content-between py-2 px-1"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["flex align-items-center gap-2 text_ellips"].filter(Boolean).join(' ')}}>{(() => { const __condition15 = r.icon;  return __condition15 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", r.icon, [r.iconType], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
<Render tag="span" props={{}}>{interpolate(["",""], [r.label])}</Render></Render>
<Render tag="span" props={{"tooltipPosition": "left",
"className": [classNames(interpolate([""," font-semibold ml-2"], [vm.bonusBreakdownValueClass])),(r.tooltip ? "bonus_tip" : '')].filter(Boolean).join(' '),
"tooltip": {text: r.tooltip, position: "left", className: '', showDelay: 150, hideDelay: 0, escape: true, disabled: false}}}>{interpolate(["",""], [r.display])}</Render></Render></Fragment>; })}</Render></> : null; })()}</Render>
<Render tag="app-ui-dialog" props={{"header": vm.aspdCurveTitle,
"visible": vm.isShowAspdCurve,
"modal": true,
"dismissableMask": true,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.isShowAspdCurve = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "560px","max-width": "92vw"})))}}>{(() => { const __condition16 = vm.isShowAspdCurve;  return __condition16 ? <><Render tag="app-aspd-curve" props={{"aspd": (vm.totalSummary?.calc?.totalAspd || 0),
"aspd2": (vm.isEnableCompare ? vm.totalSummary2?.calc?.totalAspd : null)}}></Render></> : null; })()}</Render>
<PaneSwitcher pane={pane} onPane={choosePane} />
<Render tag="div" props={{"className": ["grid grid-nogutter calc-shell"].filter(Boolean).join(' '),
"data-pane": pane,
"reference": (element: any) => { shell.current = element; }}}><Render tag="div" props={{"className": ["ui-fluid col-7 editor_col calc-col calc-col--build"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["stats_stack"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["char_band"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["build_actions"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"icon": "upload",
"label": "Importar",
"tooltipPosition": "bottom",
"tooltipStyleClass": "build_action_tip",
"disabled": (vm.isInProcessingPreset || vm.replayBusy),
"click": (event: any) => vm.action(() => { const $event = event; vm.openReplayImport() }),
"className": ["ui-button-info"].filter(Boolean).join(' '),
"tooltip": {text: "Carregar classe, atributos e equipamentos de uma gravação .rrf", position: "bottom", className: "build_action_tip", showDelay: 350, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "folder-open",
"label": "Simulações",
"click": (event: any) => vm.action(() => { const $event = event; vm.openSavesDialog() }),
"className": ["ui-button-help"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "file-o",
"label": "Limpar",
"tooltipPosition": "bottom",
"tooltipStyleClass": "build_action_tip",
"disabled": vm.isInProcessingPreset,
"click": (event: any) => vm.action(() => { const $event = event; vm.clearAll() }),
"className": ["ui-button-danger"].filter(Boolean).join(' '),
"tooltip": {text: "Limpar todos os campos e começar do zero", position: "bottom", className: "build_action_tip", showDelay: 350, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "save",
"aria-label": "Salvar",
"tooltipPosition": "bottom",
"tooltipStyleClass": "build_action_tip",
"disabled": vm.isInProcessingPreset,
"click": (event: any) => vm.action(() => { const $event = event; vm.openSaveDialog() }),
"className": ["ui-button-success ui-button-icon-only"].filter(Boolean).join(' '),
"tooltip": {text: "Salvar simulação", position: "bottom", className: "build_action_tip", showDelay: 350, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "share-alt",
"aria-label": "Link",
"tooltipPosition": "bottom",
"tooltipStyleClass": "build_action_tip",
"disabled": vm.isInProcessingPreset,
"click": (event: any) => vm.action(() => { const $event = event; vm.openShareDialog() }),
"className": ["ui-button-success ui-button-icon-only"].filter(Boolean).join(' '),
"tooltip": {text: "Gerar link para compartilhar", position: "bottom", className: "build_action_tip", showDelay: 350, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render></Render>
<Render tag="div" props={{"className": ["dropdown-joblist char_class"].filter(Boolean).join(' ')}}><Render tag="app-ui-dropdown" props={{"inputId": "character",
"filterBy": "label",
"placeholder": "Classe",
"scrollHeight": "350px",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": vm.characterList,
"filter": true,
"disabled": vm.isInProcessingPreset,
"value": vm.model.class,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.class = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onClassChange() }))({value, originalEvent: event}); }),
"template_selectedItem": (context: any) => { const job = context["$implicit"]; return <>{(() => { const __condition17 = vm.model.class;  return __condition17 ? <><Render tag="div" props={{"className": ["flex gap-2 py-0 align-items-center"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", job.icon, ["job"], services),
"error": (event: any) => vm.action(() => { const $event = event; vm.onCharSpriteError($event,job.icon) }),
"className": ["job_img"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["text_ellips"].filter(Boolean).join(' ')}}>{interpolate(["",""], [job.label])}</Render></Render></> : null; })()}</>; },
"template_item": (context: any) => { const job = context["$implicit"]; return <><Render tag="div" props={{"className": ["flex gap-2 py-0"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", job.icon, ["job"], services),
"error": (event: any) => vm.action(() => { const $event = event; vm.onCharSpriteError($event,job.icon) }),
"className": ["job_img"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["text_ellips"].filter(Boolean).join(' ')}}>{interpolate(["",""], [job.label])}</Render></Render></>; }}}>
</Render></Render>
<Render tag="div" props={{"className": ["char_levels",(vm.isEditingCompareStats ? "char_levels--compare" : '')].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["ui-inputgroup joined_field"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["ui-inputgroup-addon joined_caption char_addon",(vm.otherStatsText("level") ? "char_addon--other" : '')].filter(Boolean).join(' '),
"tooltip": {text: (vm.otherStatsText("level") ? ((("Nível - " + vm.statsOtherLabel) + ": ") + vm.otherStatsText("level")) : ""), position: 'right', className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{"NV"}
{(() => { const __condition18 = vm.otherStatsText("level");  return __condition18 ? <><Render tag="span" props={{"className": ["char_addon_other"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.otherStatsText("level")])}</Render></> : null; })()}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "level",
"panelStyleClass": "joined-dropdown-panel",
"filterBy": "label",
"scrollHeight": "350px",
"autoDisplayFirst": false,
"options": vm.levelList,
"filter": true,
"resetFilterOnHide": true,
"value": vm.statsModel["level"],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.statsModel["level"] = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onStatsLevelChange() }))({value, originalEvent: event}); })}}></Render></Render>
<Render tag="div" props={{"className": ["ui-inputgroup joined_field"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["ui-inputgroup-addon joined_caption char_addon",(vm.otherStatsText("jobLevel") ? "char_addon--other" : '')].filter(Boolean).join(' '),
"tooltip": {text: (vm.otherStatsText("jobLevel") ? ((("Nível de classe - " + vm.statsOtherLabel) + ": ") + vm.otherStatsText("jobLevel")) : ""), position: 'right', className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{"JOB"}
{(() => { const __condition19 = vm.otherStatsText("jobLevel");  return __condition19 ? <><Render tag="span" props={{"className": ["char_addon_other"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.otherStatsText("jobLevel")])}</Render></> : null; })()}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "jobLevel",
"panelStyleClass": "joined-dropdown-panel",
"filterBy": "label",
"scrollHeight": "350px",
"autoDisplayFirst": false,
"options": vm.jobList,
"filter": true,
"resetFilterOnHide": true,
"value": vm.statsModel["jobLevel"],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.statsModel["jobLevel"] = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onStatsJobLevelChange() }))({value, originalEvent: event}); })}}></Render></Render></Render>
<Render tag="div" props={{"className": ["char_points"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["char_point_box"].filter(Boolean).join(' '),
"tooltip": {text: vm.pointsHint, position: 'right', className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}><Render tag="span" props={{"className": ["char_point_label"].filter(Boolean).join(' ')}}>{"Atributos"}</Render>
<Render tag="span" props={{"className": ["char_point_row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["char_point_value",((vm.availablePoints < 0) ? "char_point_neg" : '')].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.availablePoints, [], services)])}</Render>
{(() => { const __condition20 = vm.isCompareStats;  return __condition20 ? <><Render tag="span" props={{"className": ["char_point_value char_point_value--compare",((vm.availablePoints2 < 0) ? "char_point_neg" : '')].filter(Boolean).join(' ')}}>{interpolate(["⇄ ",""], [displayPipe("number", vm.availablePoints2, [], services)])}</Render></> : null; })()}</Render></Render>
<Render tag="div" props={{"hidden": !(vm.isAllowTraitStat),
"className": ["char_point_box"].filter(Boolean).join(' '),
"tooltip": {text: vm.traitPointsHint, position: 'right', className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}><Render tag="span" props={{"className": ["char_point_label"].filter(Boolean).join(' ')}}>{"Talentos"}</Render>
<Render tag="span" props={{"className": ["char_point_row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["char_point_value",((vm.availableTraitPoints < 0) ? "char_point_neg" : '')].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.availableTraitPoints, [], services)])}</Render>
{(() => { const __condition21 = vm.isCompareStats;  return __condition21 ? <><Render tag="span" props={{"className": ["char_point_value char_point_value--compare",((vm.availableTraitPoints2 < 0) ? "char_point_neg" : '')].filter(Boolean).join(' ')}}>{interpolate(["⇄ ",""], [displayPipe("number", vm.availableTraitPoints2, [], services)])}</Render></> : null; })()}</Render></Render></Render></Render>
<Render tag="div" props={{"className": ["stats_row"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["attr_cell",(vm.isEditingCompareStats ? "attr_cell--compare" : '')].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["stats_compare_bar"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"aria-pressed": vm.isCompareStats,
"disabled": vm.isInProcessingPreset,
"click": (event: any) => vm.action(() => { const $event = event; vm.toggleStatsCompare() }),
"className": ["stats_compare_toggle",(vm.isCompareStats ? "stats_compare_toggle--on" : '')].filter(Boolean).join(' '),
"tooltip": {text: (vm.isCompareStats ? "Parar de comparar nível, atributos e talentos" : "Comparar nível, atributos e talentos com outra distribuição"), position: 'right', className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{interpolate([" ⇄ "," "], [(vm.isCompareStats ? "Comparando" : "Comparar atributos")])}</Render>
{(() => { const __condition22 = vm.isCompareStats;  return __condition22 ? <><Render tag="div" props={{"role": "group",
"aria-label": "Build em edição",
"className": ["stats_side_switch"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"aria-pressed": (vm.statsSide === "main"),
"click": (event: any) => vm.action(() => { const $event = event; (vm.statsSide = "main") }),
"className": ["stats_side",((vm.statsSide === "main") ? "stats_side--active" : '')].filter(Boolean).join(' ')}}>{" Principal "}</Render>
<Render tag="button" props={{"type": "button",
"aria-pressed": (vm.statsSide === "compare"),
"click": (event: any) => vm.action(() => { const $event = event; (vm.statsSide = "compare") }),
"className": ["stats_side stats_side--compare",((vm.statsSide === "compare") ? "stats_side--active" : '')].filter(Boolean).join(' ')}}>{" Comparação "}</Render></Render></> : null; })()}</Render>
<Render tag="div" props={{"className": ["attr_grid"].filter(Boolean).join(' ')}}><Render tag="app-status-input" props={{"label": "FOR",
"dropdownList": vm.mainStatusList,
"value": vm.statsModel["str"],
"otherValue": vm.otherStatsValue("str"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobStr || 0) + (vm.totalSummary?.str || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobStr") + (vm.totalSummary2?.str || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["str"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "FOR","keys": vm.statBreakdownKeys("str"),"valueClass": "summary_value"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "FOR","keys": vm.statBreakdownKeys("str"),"valueClass": "summary_value","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "POD",
"badgeSeverity": "danger",
"disabled": !(vm.isAllowTraitStat),
"dropdownList": vm.traitStatusList,
"value": vm.statsModel["pow"],
"otherValue": vm.otherStatsValue("pow"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobPow || 0) + (vm.totalSummary?.pow || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobPow") + (vm.totalSummary2?.pow || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["pow"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "POD","keys": vm.statBreakdownKeys("pow"),"valueClass": "summary_stat_yellow"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "POD","keys": vm.statBreakdownKeys("pow"),"valueClass": "summary_stat_yellow","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "AGI",
"dropdownList": vm.mainStatusList,
"value": vm.statsModel["agi"],
"otherValue": vm.otherStatsValue("agi"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobAgi || 0) + (vm.totalSummary?.agi || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobAgi") + (vm.totalSummary2?.agi || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["agi"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "AGI","keys": vm.statBreakdownKeys("agi"),"valueClass": "summary_value"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "AGI","keys": vm.statBreakdownKeys("agi"),"valueClass": "summary_value","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "STA",
"badgeSeverity": "danger",
"disabled": !(vm.isAllowTraitStat),
"dropdownList": vm.traitStatusList,
"value": vm.statsModel["sta"],
"otherValue": vm.otherStatsValue("sta"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobSta || 0) + (vm.totalSummary?.sta || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobSta") + (vm.totalSummary2?.sta || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["sta"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "STA","keys": vm.statBreakdownKeys("sta"),"valueClass": "summary_stat_yellow"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "STA","keys": vm.statBreakdownKeys("sta"),"valueClass": "summary_stat_yellow","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "VIT",
"dropdownList": vm.mainStatusList,
"value": vm.statsModel["vit"],
"otherValue": vm.otherStatsValue("vit"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobVit || 0) + (vm.totalSummary?.vit || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobVit") + (vm.totalSummary2?.vit || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["vit"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "VIT","keys": vm.statBreakdownKeys("vit"),"valueClass": "summary_value"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "VIT","keys": vm.statBreakdownKeys("vit"),"valueClass": "summary_value","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "SAB",
"badgeSeverity": "danger",
"disabled": !(vm.isAllowTraitStat),
"dropdownList": vm.traitStatusList,
"value": vm.statsModel["wis"],
"otherValue": vm.otherStatsValue("wis"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobWis || 0) + (vm.totalSummary?.wis || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobWis") + (vm.totalSummary2?.wis || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["wis"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "SAB","keys": vm.statBreakdownKeys("wis"),"valueClass": "summary_stat_yellow"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "SAB","keys": vm.statBreakdownKeys("wis"),"valueClass": "summary_stat_yellow","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "INT",
"dropdownList": vm.mainStatusList,
"value": vm.statsModel["int"],
"otherValue": vm.otherStatsValue("int"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobInt || 0) + (vm.totalSummary?.int || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobInt") + (vm.totalSummary2?.int || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["int"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "INT","keys": vm.statBreakdownKeys("int"),"valueClass": "summary_value"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "INT","keys": vm.statBreakdownKeys("int"),"valueClass": "summary_value","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "FEI",
"badgeSeverity": "danger",
"disabled": !(vm.isAllowTraitStat),
"dropdownList": vm.traitStatusList,
"value": vm.statsModel["spl"],
"otherValue": vm.otherStatsValue("spl"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobSpl || 0) + (vm.totalSummary?.spl || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobSpl") + (vm.totalSummary2?.spl || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["spl"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "FEI","keys": vm.statBreakdownKeys("spl"),"valueClass": "summary_stat_yellow"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "FEI","keys": vm.statBreakdownKeys("spl"),"valueClass": "summary_stat_yellow","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "DES",
"dropdownList": vm.mainStatusList,
"value": vm.statsModel["dex"],
"otherValue": vm.otherStatsValue("dex"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobDex || 0) + (vm.totalSummary?.dex || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobDex") + (vm.totalSummary2?.dex || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["dex"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "DES","keys": vm.statBreakdownKeys("dex"),"valueClass": "summary_value"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "DES","keys": vm.statBreakdownKeys("dex"),"valueClass": "summary_value","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "CON",
"badgeSeverity": "danger",
"disabled": !(vm.isAllowTraitStat),
"dropdownList": vm.traitStatusList,
"value": vm.statsModel["con"],
"otherValue": vm.otherStatsValue("con"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobCon || 0) + (vm.totalSummary?.con || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobCon") + (vm.totalSummary2?.con || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["con"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "CON","keys": vm.statBreakdownKeys("con"),"valueClass": "summary_stat_yellow"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "CON","keys": vm.statBreakdownKeys("con"),"valueClass": "summary_stat_yellow","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "SOR",
"dropdownList": vm.mainStatusList,
"value": vm.statsModel["luk"],
"otherValue": vm.otherStatsValue("luk"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobLuk || 0) + (vm.totalSummary?.luk || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobLuk") + (vm.totalSummary2?.luk || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["luk"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "SOR","keys": vm.statBreakdownKeys("luk"),"valueClass": "summary_value"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "SOR","keys": vm.statBreakdownKeys("luk"),"valueClass": "summary_value","compare": true}) })}}></Render>
<Render tag="app-status-input" props={{"label": "CRV",
"badgeSeverity": "danger",
"disabled": !(vm.isAllowTraitStat),
"dropdownList": vm.traitStatusList,
"value": vm.statsModel["crt"],
"otherValue": vm.otherStatsValue("crt"),
"otherLabel": vm.statsOtherLabel,
"extraValue": ((vm.model.jobCrt || 0) + (vm.totalSummary?.crt || 0)),
"compareExtraValue": (vm.isComparing ? (vm.compareJobBonus("jobCrt") + (vm.totalSummary2?.crt || 0)) : null),
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.statsModel["crt"] = $event);vm.onStatsBaseChange() }),
"extraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "CRV","keys": vm.statBreakdownKeys("crt"),"valueClass": "summary_stat_yellow"}) }),
"compareExtraClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown({"label": "CRV","keys": vm.statBreakdownKeys("crt"),"valueClass": "summary_stat_yellow","compare": true}) })}}></Render></Render></Render>
<Render tag="div" props={{"className": ["summary_cell"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["stats_summary"].filter(Boolean).join(' ')}}>{(() => { let reductionPanel: any = vm["reductionPanel"];
let sustainPanel: any = vm["sustainPanel"]; return <>{(() => { const __condition23 = vm.isCalculating;  return __condition23 ? <><Render tag="div" props={{"className": ["loading_block"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "spinner",
"style": normalizeStyle(Object.assign({}, parseStyle("font-size: 2rem")))}}></Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["ss_headline"].filter(Boolean).join(' ')}}>{(vm.statsSummary.headline ?? []).map((__entry24: any, __index24: number, __array24: any[]) => { const item = __entry24; return <Fragment key={identityKey(vm.trackByLabel(__index24, __entry24))}><Render tag="span" props={{"className": ["ss_headline_item"].filter(Boolean).join(' ')}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.onSummaryClick(item) }),
"className": ["ss_headline_value",classNames(item.valueClass),(item.clickable ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"tooltip": {text: item.tooltip, position: 'right', className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": item.clickable}}>{interpolate(["",""], [item.text])}</Render>
{(() => { const __condition25 = item.compare;  return __condition25 ? <><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.onSummaryClick(item,true) }),
"className": ["ss_headline_delta",classNames(item.compare.deltaClass),(item.compareClickable ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"tooltip": {text: item.compareTooltip, position: 'right', className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": item.compareClickable}}>{interpolate(["→ "," ",""], [item.compare.text,item.compare.deltaText])}</Render></> : null; })()}</Render></Fragment>; })}</Render>
<Render tag="div" props={{"className": ["ss_grid"].filter(Boolean).join(' ')}}>{(vm.statsSummary.columns ?? []).map((__entry26: any, __index26: number, __array26: any[]) => { const column = __entry26; return <Fragment key={identityKey(vm.trackByIndex(__index26, __entry26))}><Render tag="div" props={{"className": ["ss_col"].filter(Boolean).join(' ')}}>{(column ?? []).map((__entry27: any, __index27: number, __array27: any[]) => { const group = __entry27; return <Fragment key={identityKey(vm.trackByTitle(__index27, __entry27))}><><Render tag="div" props={{"className": ["ss_group_header"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [group.title])}</Render>
<button type="button" className="ss_group_toggle" aria-expanded={!foldedGroups[group.title]}
  aria-label={`${foldedGroups[group.title] ? 'Expandir' : 'Recolher'} ${group.title}`} onClick={() => toggleGroup(group.title)}>
  <Icon name={foldedGroups[group.title] ? 'chevron-down' : 'chevron-up'} aria-hidden="true" /></button>
{(() => { const __condition28 = group.showReduction;  return __condition28 ? <><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; reductionPanel.toggle($event) }),
"className": ["reduction-label ss_reduction bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true}}><Render tag="app-icon" props={{"name": "shield"}}></Render>
{" Redução de dano "}</Render></> : null; })()}
{(() => { const __condition29 = group.showSustain;  return __condition29 ? <><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; sustainPanel.toggle($event) }),
"className": ["sustain-label ss_reduction bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true}}><Render tag="app-icon" props={{"name": "heart"}}></Render>
{" Cura e regen. "}</Render></> : null; })()}</Render>
{(group.rows ?? []).map((__entry30: any, __index30: number, __array30: any[]) => { const row = __entry30; return <Fragment key={identityKey(vm.trackByLabel(__index30, __entry30))}><><Render tag="span" props={{"className": ["ss_label", (foldedGroups[group.title] ? "ss_folded" : '')].filter(Boolean).join(' ')}}>{interpolate(["",""], [row.label])}</Render>
<Render tag="span" props={{"className": ["ss_value", (foldedGroups[group.title] ? "ss_folded" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "top",
"click": (event: any) => vm.action(() => { const $event = event; vm.onSummaryClick(row) }),
"className": ["ss_value_text",classNames(row.valueClass),(row.clickable ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"tooltip": {text: row.tooltip, position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": row.clickable}}>{interpolate(["",""], [row.text])}
{(() => { const __condition31 = row.note;  return __condition31 ? <><Render tag="span" props={{"tooltip": {text: "Mais CRIT à distância, que só vale no ataque básico", position: 'right', className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{"*"}</Render></> : null; })()}
{(() => { const __condition32 = row.suffix;  return __condition32 ? <><Render tag="span" props={{"className": ["ss_suffix"].filter(Boolean).join(' ')}}>{interpolate(["",""], [row.suffix])}</Render></> : null; })()}</Render>
{(() => { const __condition33 = row.compare;  return __condition33 ? <><Render tag="span" props={{"tooltipPosition": "top",
"click": (event: any) => vm.action(() => { const $event = event; vm.onSummaryClick(row,true) }),
"className": ["ss_delta",classNames(row.compare.deltaClass),(row.compareClickable ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"tooltip": {text: row.compareTooltip, position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": row.compareClickable}}>{interpolate(["→ "," ",""], [row.compare.text,row.compare.deltaText])}</Render></> : null; })()}</Render></></Fragment>; })}</></Fragment>; })}</Render></Fragment>; })}</Render>
<Render tag="app-ui-popover" props={{"styleClass": "reduction-panel",
"reference": (value: any) => { reductionPanel = value; vm["reductionPanel"] = value; },
"handle": vm["reductionPanel"]}}>{reductionPop({"cats": vm.selfReductionCategories,"sources": vm.bonusBreakdownSources,"target": false})}</Render>
<Render tag="app-ui-popover" props={{"styleClass": "reduction-panel",
"reference": (value: any) => { sustainPanel = value; vm["sustainPanel"] = value; },
"handle": vm["sustainPanel"]}}><Render tag="div" props={{"className": ["sustain-pop"].filter(Boolean).join(' ')}}>{(vm.statsSummary.sustain ?? []).map((__entry34: any, __index34: number, __array34: any[]) => { const row = __entry34; return <Fragment key={identityKey(vm.trackByLabel(__index34, __entry34))}><Render tag="div" props={{"className": ["sustain-row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["sustain-row-label"].filter(Boolean).join(' ')}}>{interpolate(["",""], [row.label])}</Render>
<Render tag="span" props={{"className": ["ss_value"].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "top",
"click": (event: any) => vm.action(() => { const $event = event; vm.onSummaryClick(row) }),
"className": ["ss_value_text",classNames(row.valueClass),(row.clickable ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"tooltip": {text: row.tooltip, position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": row.clickable}}>{interpolate(["",""], [row.text])}</Render>
{(() => { const __condition35 = row.compare;  return __condition35 ? <><Render tag="span" props={{"tooltipPosition": "top",
"click": (event: any) => vm.action(() => { const $event = event; vm.onSummaryClick(row,true) }),
"className": ["ss_delta",classNames(row.compare.deltaClass),(row.compareClickable ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"tooltip": {text: row.compareTooltip, position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": row.compareClickable}}>{interpolate(["→ "," ",""], [row.compare.text,row.compare.deltaText])}</Render></> : null; })()}</Render></Render></Fragment>; })}</Render></Render></>; })()}</Render></Render></Render></Render>
<Render tag="app-equipment-grid" props={{"items": vm.items,
"mapEnchant": vm.mapEnchant,
"model": vm.model,
"model2": vm.model2,
"lists": vm.slotLists,
"compareItemNames": vm.compareItemNames,
"showCompareItemMap": vm.showCompareItemMap,
"headSlotOccupiedBy": vm.headSlotOccupiedBy,
"hiddenMap": vm.hiddenMap,
"isLeftWeaponShown": vm.isLeftWeaponShown,
"revision": vm.equipRevision,
"selectItem": (event: any) => vm.action(() => { const $event = event; vm.onSelectItem($event.itemType,$event.itemId,$event.refine) }),
"clearItem": (event: any) => vm.action(() => { const $event = event; vm.onClearItem($event) }),
"selectGrade": (event: any) => vm.action(() => { const $event = event; vm.onSelectGrade($event.itemType,$event.itemId,$event.grade) }),
"optionChange": (event: any) => vm.action(() => { const $event = event; vm.onOptionChange() }),
"propertyAtkChange": (event: any) => vm.action(() => { const $event = event; vm.onPropertyAtkChange() }),
"compareItemChange": (event: any) => vm.action(() => { const $event = event; vm.onCompareItemChange() }),
"compareSlotsChange": (event: any) => vm.action(() => { const $event = event; vm.onListItemComparingChange($event) }),
"slotColorChange": (event: any) => vm.action(() => { const $event = event; vm.onSlotColorChange() })}}></Render></Render>
<Render tag="div" props={{"className": ["ui-fluid col-5 calc-col calc-col--result"].filter(Boolean).join(' ')}}><Render tag="app-ui-accordion" props={{"multiple": true,
"activeIndex": vm.rightAccordionActiveIndices,
"tabOpened": (event: any) => vm.action(() => { const $event = event; vm.onRightAccordionOpen($event) }),
"tabClosed": (event: any) => vm.action(() => { const $event = event; vm.onRightAccordionClose($event) })}}><Render tag="app-ui-accordion-tab" props={{"header": "Consumíveis",
"className": ["consumable"].filter(Boolean).join(' ')}}><PanelSearch label="consumíveis" labels={[...vm.consumableList, ...vm.consumableList2.flat(), ...vm.aspdPotionList, ...vm.aspdPotionList2].map((option: any) => option.label)}>{matches => <Render tag="div" props={{"className": ["calc-panel consumable-panel"].filter(Boolean).join(' ')}}>{(() => { const consumableOption = (context: any) => { const option = context["$implicit"]; return <><Render tag="div" props={{"className": ["calc-option-row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "right",
"tooltipStyleClass": "item_desc_tooltip",
"className": ["calc-option-main"].filter(Boolean).join(' '),
"tooltip": {text: vm.itemDescTooltip(option?.value), position: "right", className: "item_desc_tooltip", showDelay: 500, hideDelay: 0, escape: false, disabled: false}}}>{(() => { const __condition36 = option;  return __condition36 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", option.value, ["item"], services),
"className": ["calc-option-icon"].filter(Boolean).join(' '),
"missingIcon": true}}></Render></> : null; })()}
<Render tag="span" props={{"className": ["text_ellips"].filter(Boolean).join(' ')}}>{interpolate(["",""], [option?.label])}</Render></Render>
{(() => { const __condition37 = (option && vm.items?.[option.value]?.custom);  return __condition37 ? <><Render tag="button" props={{"type": "button",
"tooltipPosition": "top",
"aria-label": ("Editar item customizado: " + option.label),
"click": (event: any) => vm.action(() => { const $event = event; vm.editCustomConsumable(option.value,$event) }),
"className": ["ui-tag consumable-custom-tag"].filter(Boolean).join(' '),
"tooltip": {text: "Item customizado. Clique para editar.", position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{"Customizado"}</Render></> : null; })()}</Render></>; }; return <>
<Render tag="section" props={{"hidden": !vm.consumableList.some((option: any) => matches(option.label)), "className": ["calc-panel-section consumable-stack"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Itens acumuláveis"}</Render>
<Render tag="button" props={{"type": "button",
"icon": "plus",
"label": "Criar item",
"aria-label": "Criar item consumível",
"click": (event: any) => vm.action(() => { const $event = event; vm.openCreateConsumable() }),
"className": ["ui-button-text ui-button-sm consumable-create"].filter(Boolean).join(' '),
"button": true}}></Render></Render>
<Render tag="app-ui-listbox" props={{"options": vm.consumableList.filter((option: any) => matches(option.label)),
"multiple": true,
"metaKeySelection": false,
"value": vm.model.consumables,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.consumables = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onConsumableChange() }))({value, originalEvent: event}); }),
"template_item": (context: any) => { const item = context["$implicit"]; return <>{consumableOption({"$implicit": item})}</>; }}}></Render></Render>
<Render tag="div" props={{"className": ["consumable-side"].filter(Boolean).join(' ')}}><Render tag="section" props={{"hidden": !vm.consumableList2.flat().some((option: any) => matches(option.label)), "className": ["calc-panel-section consumable-food"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Comidas de atributo"}</Render></Render>
{(vm.consumableList2 ?? []).map((__entry38: any, __index38: number, __array38: any[]) => { const con = __entry38;
const i = __index38; if (!con.some((option: any) => matches(option.label))) return null; return <Fragment key={identityKey(__entry38)}><Render tag="div" props={{"className": ["joined_field consumable-picker-field consumable-food-field"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["joined_caption calc-select-label"].filter(Boolean).join(' ')}}>{interpolate(["",""], [["FOR","AGI","VIT","INT","DES","SOR"][i]])}</Render>
<Render tag="app-ui-dropdown" props={{"placeholder": "Nenhuma",
"scrollHeight": "300px",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": con,
"filter": true,
"optionFilter": (option: any) => matches(option.label),
"showClear": true,
"value": vm.model.consumables2[i],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.consumables2[i] = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onConsumableChange() }))({value, originalEvent: event}); }),
"template_selectedItem": (context: any) => { const option = context["$implicit"]; return <>{consumableOption({"$implicit": option})}</>; },
"template_item": (context: any) => { const option = context["$implicit"]; return <>{consumableOption({"$implicit": option})}</>; }}}>
</Render></Render></Fragment>; })}</Render>
<Render tag="section" props={{"hidden": ![...vm.aspdPotionList, ...vm.aspdPotionList2].some((option: any) => matches(option.label)), "className": ["calc-panel-section consumable-aspd"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Velocidade de ataque"}</Render></Render>
<Render tag="div" props={{"className": ["consumable-aspd-grid"].filter(Boolean).join(' ')}}><Render tag="div" props={{"hidden": !vm.aspdPotionList.some((option: any) => matches(option.label))}}><Render tag="span" props={{"className": ["calc-field-label"].filter(Boolean).join(' ')}}>{"Poção principal"}</Render>
<Render tag="div" props={{"className": ["joined_field consumable-picker-field consumable-aspd-field"].filter(Boolean).join(' ')}}><Render tag="app-ui-dropdown" props={{"placeholder": "Nenhuma",
"scrollHeight": "300px",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": vm.aspdPotionList,
"filter": true,
"optionFilter": (option: any) => matches(option.label),
"showClear": true,
"value": vm.model.aspdPotion,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.aspdPotion = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onConsumableChange() }))({value, originalEvent: event}); }),
"template_selectedItem": (context: any) => { const option = context["$implicit"]; return <>{consumableOption({"$implicit": option})}</>; },
"template_item": (context: any) => { const option = context["$implicit"]; return <>{consumableOption({"$implicit": option})}</>; }}}>
</Render></Render></Render>
<Render tag="div" props={{"hidden": !vm.aspdPotionList2.some((option: any) => matches(option.label))}}><Render tag="span" props={{"className": ["calc-field-label"].filter(Boolean).join(' ')}}>{"Efeitos adicionais"}</Render>
<Render tag="app-ui-listbox" props={{"options": vm.aspdPotionList2.filter((option: any) => matches(option.label)),
"multiple": true,
"metaKeySelection": false,
"value": vm.model.aspdPotions,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.aspdPotions = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onConsumableChange() }))({value, originalEvent: event}); }),
"template_item": (context: any) => { const item = context["$implicit"]; return <>{consumableOption({"$implicit": item})}</>; }}}></Render></Render></Render></Render></Render></>; })()}</Render>}</PanelSearch></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "Habilidades",
"className": ["select_skill"].filter(Boolean).join(' ')}}><PanelSearch label="habilidades e buffs" labels={[...vm.activeSkills, ...vm.passiveSkills, ...vm.skillBuffs].filter((skill: any) => vm.isSkillVisible(skill)).map((skill: any) => skill.label)}>{matches => <Render tag="div" props={{"className": ["calc-panel skill-panel"].filter(Boolean).join(' ')}}>{(() => { const sharedSkillRow = (context: any) => { const skill = context["skill"];
const i = context["index"]; return <><Render tag="div" props={{"className": ["skill-control-row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "top",
"tooltipStyleClass": "item_desc_tooltip",
"className": ["skill-control-label"].filter(Boolean).join(' '),
"tooltip": {text: vm.buffTooltip(skill,((skill.inputType === "dropdown") ? vm.model.skillBuffs[i] : undefined)), position: "top", className: "item_desc_tooltip", showDelay: 400, hideDelay: 0, escape: false, disabled: false}}}>{skill.preview && <span className="skill_icon" aria-hidden="true" />}{(() => { const __condition39 = skill.icon && !skill.preview;  return __condition39 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", skill.icon, ["skill"], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
{(() => { const __condition40 = skill.icon;  return __condition40 ? <><Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": interpolate(["https://www.divine-pride.net/database/skill/",""], [skill.icon]),
"className": ["skill_label_text skill_link"].filter(Boolean).join(' ')}}>{interpolate(["",""], [skill.label])}</Render></> : null; })()}
{(() => { const __condition41 = !(skill.icon);  return __condition41 ? <><Render tag="span" props={{"className": ["skill_label_text"].filter(Boolean).join(' ')}}>{interpolate(["",""], [skill.label])}</Render></> : null; })()}</Render>
{skill.inputType === "dropdown" && <><Render tag="app-ui-dropdown" props={{"scrollHeight": "380px",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": skill.dropdown,
"styleClass": (vm.model.skillBuffs[i] ? "" : "skill-dropdown-empty"),
"value": vm.model.skillBuffs[i],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.skillBuffs[i] = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onSkillBuffChange(i) }))({value, originalEvent: event}); })}}></Render></>}
{!["dropdown"].includes(skill.inputType) && <><Render tag="app-ui-select-button" props={{"options": skill.dropdown,
"value": vm.model.skillBuffs[i],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.skillBuffs[i] = $event);vm.onSkillBuffChange(i) }))(value); })}}></Render></>}</Render></>; };
const activeSkillRow = (context: any) => { const skill = context["skill"];
const i = context["index"]; return <><Render tag="div" props={{"className": ["skill-control-row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "top",
"tooltipStyleClass": "item_desc_tooltip",
"className": ["skill-control-label"].filter(Boolean).join(' '),
"tooltip": {text: vm.buffTooltip(skill,((skill.inputType === "dropdown") ? vm.model.activeSkills[i] : undefined)), position: "top", className: "item_desc_tooltip", showDelay: 400, hideDelay: 0, escape: false, disabled: false}}}>{skill.preview && <span className="skill_icon" aria-hidden="true" />}{(() => { const __condition42 = skill.icon && !skill.preview;  return __condition42 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", skill.icon, [(skill.iconType || "skill")], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
{(() => { const __condition43 = skill.icon;  return __condition43 ? <><Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": interpolate(["https://www.divine-pride.net/database/","/",""], [((skill.iconType === "item") ? "item" : "skill"),skill.icon]),
"className": ["skill_label_text skill_link"].filter(Boolean).join(' ')}}>{interpolate(["",""], [skill.label])}</Render></> : null; })()}
{(() => { const __condition44 = !(skill.icon);  return __condition44 ? <><Render tag="span" props={{"className": ["skill_label_text"].filter(Boolean).join(' ')}}>{interpolate(["",""], [skill.label])}</Render></> : null; })()}</Render>
{skill.inputType === "dropdown" && <><Render tag="app-ui-dropdown" props={{"scrollHeight": "380px",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": skill.dropdown,
"styleClass": (vm.model.activeSkills[i] ? "" : "skill-dropdown-empty"),
"value": vm.model.activeSkills[i],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.activeSkills[i] = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onSkillClassChange(i) }))({value, originalEvent: event}); }),
"template_selectedItem": (context: any) => { const option = context["$implicit"]; return <><Render tag="div" props={{"className": ["flex align-items-center gap-1"].filter(Boolean).join(' ')}}>{(() => { const __condition45 = option?.icon;  return __condition45 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", option.icon, ["skill"], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
<Render tag="span" props={{}}>{interpolate(["",""], [option?.label])}</Render></Render></>; },
"template_item": (context: any) => { const option = context["$implicit"]; return <><Render tag="div" props={{"tooltipPosition": "left",
"tooltipStyleClass": "item_desc_tooltip",
"className": ["flex align-items-center gap-1"].filter(Boolean).join(' '),
"tooltip": {text: vm.skillOptionTooltip(option), position: "left", className: "item_desc_tooltip", showDelay: 400, hideDelay: 0, escape: false, disabled: false}}}>{(() => { const __condition46 = option.icon;  return __condition46 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", option.icon, ["skill"], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
<Render tag="span" props={{}}>{interpolate(["",""], [option.label])}</Render></Render></>; }}}>
</Render></>}
{!["dropdown"].includes(skill.inputType) && <><Render tag="app-ui-select-button" props={{"options": skill.dropdown,
"value": vm.model.activeSkills[i],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.activeSkills[i] = $event);vm.onSkillClassChange(i) }))(value); })}}></Render></>}</Render></>; }; return <>

{(() => { const __condition47 = vm.hasActiveSkillEffects && vm.activeSkills.some((skill: any) => !skill.isDebuff && (vm.isSkillVisible(skill) && matches(skill.label)));  return __condition47 ? <><Render tag="section" props={{"className": ["calc-panel-section"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Habilidades e efeitos ativos"}</Render></Render>
{(vm.activeSkills ?? []).map((__entry48: any, __index48: number, __array48: any[]) => { const skill = __entry48;
const i = __index48; return <Fragment key={identityKey(__entry48)}><>{(() => { const __condition49 = !(skill.isDebuff) && (vm.isSkillVisible(skill) && matches(skill.label));  return __condition49 ? <>{activeSkillRow({"skill": skill,"index": i})}</> : null; })()}</></Fragment>; })}</Render></> : null; })()}
<Render tag="section" props={{"hidden": (!vm.passiveSkills.some((skill: any) => (vm.isSkillVisible(skill) && matches(skill.label)))),
"className": ["calc-panel-section"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Aprenda para ganhar bônus"}</Render></Render>
{(vm.passiveSkills ?? []).map((__entry50: any, __index50: number, __array50: any[]) => { const skill = __entry50;
const i = __index50; if (!(vm.isSkillVisible(skill) && matches(skill.label))) return null; return <Fragment key={identityKey(__entry50)}><Render tag="div" props={{"className": ["skill-control-row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "top",
"tooltipStyleClass": "item_desc_tooltip",
"className": ["skill-control-label"].filter(Boolean).join(' '),
"tooltip": {text: vm.buffTooltip(skill), position: "top", className: "item_desc_tooltip", showDelay: 400, hideDelay: 0, escape: false, disabled: false}}}>{(() => { const __condition51 = skill.icon;  return __condition51 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", skill.icon, ["skill"], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
{(() => { const __condition52 = skill.icon;  return __condition52 ? <><Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": interpolate(["https://www.divine-pride.net/database/skill/",""], [skill.icon]),
"className": ["skill_label_text skill_link"].filter(Boolean).join(' ')}}>{interpolate(["",""], [skill.label])}</Render></> : null; })()}
{(() => { const __condition53 = !(skill.icon);  return __condition53 ? <><Render tag="span" props={{"className": ["skill_label_text"].filter(Boolean).join(' ')}}>{interpolate(["",""], [skill.label])}</Render></> : null; })()}</Render>
{skill.inputType === "dropdown" && <><Render tag="app-ui-dropdown" props={{"scrollHeight": "380px",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": skill.dropdown,
"styleClass": (vm.model.passiveSkills[i] ? "" : "skill-dropdown-empty"),
"value": vm.model.passiveSkills[i],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.passiveSkills[i] = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onSkillClassChange() }))({value, originalEvent: event}); })}}></Render></>}
{!["dropdown"].includes(skill.inputType) && <><Render tag="app-ui-select-button" props={{"options": skill.dropdown,
"value": vm.model.passiveSkills[i],
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.model.passiveSkills[i] = $event);vm.onSkillClassChange() }))(value); })}}></Render></>}</Render></Fragment>; })}</Render>
<Render tag="section" props={{"hidden": !vm.skillBuffs.some((skill: any) => !skill.isDebuff && (vm.isSkillVisible(skill) && matches(skill.label))), "className": ["calc-panel-section"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Buffs"}</Render></Render>
{(vm.skillBuffs ?? []).map((__entry54: any, __index54: number, __array54: any[]) => { const skill = __entry54;
const i = __index54; return <Fragment key={identityKey(__entry54)}><>{(() => { const __condition55 = !(skill.isDebuff) && (vm.isSkillVisible(skill) && matches(skill.label));  return __condition55 ? <>{sharedSkillRow({"skill": skill,"index": i})}</> : null; })()}</></Fragment>; })}</Render>
{(() => { const __condition56 = vm.hasSkillDebuffs && [...vm.skillBuffs, ...vm.activeSkills].some((skill: any) => skill.isDebuff && (vm.isSkillVisible(skill) && matches(skill.label)));  return __condition56 ? <><Render tag="section" props={{"className": ["calc-panel-section"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Debuffs no monstro"}</Render></Render>
{(vm.skillBuffs ?? []).map((__entry57: any, __index57: number, __array57: any[]) => { const skill = __entry57;
const i = __index57; return <Fragment key={identityKey(__entry57)}><>{(() => { const __condition58 = skill.isDebuff && (vm.isSkillVisible(skill) && matches(skill.label));  return __condition58 ? <>{sharedSkillRow({"skill": skill,"index": i})}</> : null; })()}</></Fragment>; })}
{(vm.activeSkills ?? []).map((__entry59: any, __index59: number, __array59: any[]) => { const skill = __entry59;
const i = __index59; return <Fragment key={identityKey(__entry59)}><>{(() => { const __condition60 = skill.isDebuff && (vm.isSkillVisible(skill) && matches(skill.label));  return __condition60 ? <>{activeSkillRow({"skill": skill,"index": i})}</> : null; })()}</></Fragment>; })}</Render></> : null; })()}</>; })()}</Render>}</PanelSearch></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "PVP"}}><Render tag="div" props={{"className": ["grid grid-nogutter battle_summary"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-selectors-row"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-selectors-col"].filter(Boolean).join(' ')}}><Render tag="app-ui-select-button" props={{"optionLabel": "label",
"optionValue": "value",
"options": vm.pvpModeOptions,
"value": vm.pvpMode,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.pvpMode = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.calculatePvp() }))({value, originalEvent: event}); }),
"template_item": (context: any) => { const item = context["$implicit"]; return <><Render tag="span" props={{"tooltipPosition": "top",
"tooltipStyleClass": "item_desc_tooltip",
"style": normalizeStyle(Object.assign({}, parseStyle("display: block; width: 100%; text-align: center"))),
"tooltip": {text: item.tooltip, position: "top", className: "item_desc_tooltip", showDelay: 300, hideDelay: 0, escape: false, disabled: false}}}>{interpolate(["",""], [item.label])}</Render></>; }}}></Render></Render>
<Render tag="div" props={{"className": ["hud-selectors-col"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["ui-inputgroup"].filter(Boolean).join(' ')}}><Render tag="app-ui-dropdown" props={{"inputId": "pvpTargetHud",
"optionLabel": "name",
"optionValue": "id",
"filterBy": "name",
"filterPlaceholder": "Buscar alvo",
"scrollHeight": "400px",
"placeholder": "Selecione um alvo salvo",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": vm.pvpTargets,
"filter": true,
"showClear": true,
"value": vm.selectedPvpTargetId,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.selectedPvpTargetId = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.calculatePvp() }))({value, originalEvent: event}); })}}></Render></Render></Render></Render></Render>
{(() => { const __condition61 = (vm.pvpTargets.length === 0);  return __condition61 ? <><Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="p" props={{"className": ["pvp-empty-message"].filter(Boolean).join(' ')}}>{" Nenhuma simulação salva pode ser usada como alvo ainda. Monte a build do oponente, use "}
<Render tag="b" props={{}}>{"Salvar"}</Render>
{" na barra superior e ela aparecerá aqui. Simulações salvas antes desta atualização precisam ser salvas de novo para virarem alvo de PVP. "}</Render></Render></> : null; })()}
{(() => { const __condition62 = vm.pvpSummary;  return __condition62 ? <><Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-battle-hud" props={{"totalSummary": vm.pvpSummary,
"totalSummary2": vm.pvpSummary2,
"isEnableCompare": vm.isEnableCompare,
"isCalculating": vm.isCalculating,
"isInProcessingPreset": vm.isInProcessingPreset,
"selectedChances": vm.selectedChances,
"chanceList": vm.chanceList,
"chanceList2": vm.chanceList2,
"selectedChances2": vm.selectedChances2,
"model": vm.model,
"showLeftWeapon": vm.showLeftWeapon,
"selectedMonster": 0,
"selectedMonsterName": vm.selectedPvpTarget?.name,
"spriteUrlOverride": vm.pvpTargetSpriteUrl,
"spriteFallbackUrl": vm.pvpTargetFallbackSprite,
"compareItemNames": vm.compareItemNames,
"compareStats": vm.isCompareStats,
"canBreakdownFn": vm.canBreakdown,
"reductionCategories": vm.targetReductionCategories,
"reductionSources": vm.pvpTargetSources,
"rotationView": vm.rotationViewPvp,
"rotationView2": vm.rotationViewPvp2,
"rotation": vm.model.rotation,
"atkSkills": vm.atkSkills,
"isShowSelectableSkillLevel": vm.isShowSelectableSkillLevel,
"selectedChancesChange": (event: any) => vm.action(() => { const $event = event; (vm.selectedChances = $event);vm.onSelecteChance($event) }),
"selectedChances2Change": (event: any) => vm.action(() => { const $event = event; (vm.selectedChances2 = $event);vm.onSelecteChance($event) }),
"rotationChange": (event: any) => vm.action(() => { const $event = event; vm.onRotationChange($event) }),
"skillFormulaVersionChange": (event: any) => vm.action(() => vm.onSkillFormulaVersionChange(event)),
"stackChange": (event: any) => vm.action(() => { const $event = event; vm.onSkillStackChange($event) }),
"optimizeClick": (event: any) => vm.action(() => { const $event = event; vm.onOptimizeRotation() }),
"showElementTableClick": (event: any) => vm.action(() => { const $event = event; vm.onShowElementalTableClick() }),
"showBonusBreakdownClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown($event) }),
"reductionRowClick": (event: any) => vm.action(() => { const $event = event; vm.openReductionRow($event,true) })}}></Render></Render></> : null; })()}</Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "Batalha"}}><Render tag="div" props={{"className": ["grid grid-nogutter battle_summary"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-selectors-row"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-selectors-col"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["joined_field battle-target-field"].filter(Boolean).join(' ')}}><Render tag="app-ui-dropdown" props={{"inputId": "monsterOpponentHud",
"filterBy": "label,searchVal",
"filterPlaceholder": "Buscar por nome ou ID (ex: 21361)",
"scrollHeight": "400px",
"placeholder": "Monstro",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": vm.groupMonsterList,
"filter": true,
"group": true,
"value": vm.selectedMonster,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.selectedMonster = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onMonsterChange() }))({value, originalEvent: event}); }),
"template_group": (context: any) => { const group = context["$implicit"]; return <><Render tag="div" props={{"className": ["flex align-items-center font-bold dropdown_monster_group_label"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [group.label])}</Render></Render></>; }}}></Render></Render></Render></Render></Render>
<Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-battle-hud" props={{"totalSummary": vm.totalSummary,
"totalSummary2": vm.totalSummary2,
"isEnableCompare": vm.isEnableCompare,
"isCalculating": vm.isCalculating,
"isInProcessingPreset": vm.isInProcessingPreset,
"selectedChances": vm.selectedChances,
"chanceList": vm.chanceList,
"chanceList2": vm.chanceList2,
"selectedChances2": vm.selectedChances2,
"model": vm.model,
"showLeftWeapon": vm.showLeftWeapon,
"selectedMonster": vm.selectedMonster,
"selectedMonsterName": vm.selectedMonsterName,
"isRelieveTarget": vm.isRelieveTarget,
"relieveLevelOptions": vm.relieveLevelOptions,
"relieveLevel": vm.relieveLevel,
"betelgeuseHp": vm.betelgeuseHp,
"betelgeuseHpOptions": vm.betelgeuseHpOptions,
"incomingReductionClick": (step: any) => vm.action(() => vm.showBonusBreakdown({ label: step.label, keys: step.keys, valueClass: "summary_stat_def2", sources: vm.bonusBreakdownSources, itemMap: vm.equipItemIdItemTypeMap })),
"betelgeuseHpChange": (value: number) => vm.action(() => { vm.betelgeuseHp = value; vm.onBetelgeuseHpChange() }),
"compareItemNames": vm.compareItemNames,
"compareStats": vm.isCompareStats,
"rotationView": vm.rotationView,
"rotationView2": vm.rotationView2,
"rotation": vm.model.rotation,
"atkSkills": vm.atkSkills,
"isShowSelectableSkillLevel": vm.isShowSelectableSkillLevel,
"canBreakdownFn": vm.canBreakdown,
"selectedChancesChange": (event: any) => vm.action(() => { const $event = event; (vm.selectedChances = $event);vm.onSelecteChance($event) }),
"selectedChances2Change": (event: any) => vm.action(() => { const $event = event; (vm.selectedChances2 = $event);vm.onSelecteChance($event) }),
"relieveLevelChange": (event: any) => vm.action(() => { const $event = event; (vm.relieveLevel = $event);vm.onRelieveLevelChange() }),
"rotationChange": (event: any) => vm.action(() => { const $event = event; vm.onRotationChange($event) }),
"skillFormulaVersionChange": (event: any) => vm.action(() => vm.onSkillFormulaVersionChange(event)),
"stackChange": (event: any) => vm.action(() => { const $event = event; vm.onSkillStackChange($event) }),
"optimizeClick": (event: any) => vm.action(() => { const $event = event; vm.onOptimizeRotation() }),
"showElementTableClick": (event: any) => vm.action(() => { const $event = event; vm.onShowElementalTableClick() }),
"showBonusBreakdownClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown($event) })}}></Render></Render></Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "Auto-conjuração"}}><Render tag="div" props={{"className": ["grid grid-nogutter battle_summary"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="div" props={{"role": "status",
"className": ["auto-cast-beta-alert"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["auto-cast-beta-copy"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"aria-hidden": "true",
"name": "info-circle"}}></Render>
<Render tag="div" props={{"className": ["auto-cast-beta-text"].filter(Boolean).join(' ')}}><Render tag="b" props={{}}>{"Auto-conjuração está em teste beta."}</Render>
<Render tag="span" props={{}}>{"Encontrou dano, chance ou ativações diferentes do jogo? Conte para a gente."}</Render></Render></Render>
<Render tag="div" props={{"className": ["auto-cast-beta-actions"].filter(Boolean).join(' ')}}><Render tag="a" props={{"icon": "comment",
"label": "Bug ou sugestão",
"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.autoCastIssuesReportUrl,
"className": ["ui-button-sm ui-button-success"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "upload",
"label": "Fórmula ou cálculo",
"click": (event: any) => vm.action(() => { const $event = event; vm.openAutoCastFormulaReport() }),
"className": ["ui-button-sm ui-button-warning"].filter(Boolean).join(' '),
"button": true}}></Render></Render></Render></Render>
<Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-selectors-row"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-selectors-col"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["joined_field battle-target-field"].filter(Boolean).join(' ')}}><Render tag="app-ui-dropdown" props={{"inputId": "monsterOpponentAutoCast",
"filterBy": "label,searchVal",
"filterPlaceholder": "Buscar por nome ou ID (ex: 21361)",
"scrollHeight": "400px",
"placeholder": "Monstro",
"autoDisplayFirst": false,
"resetFilterOnHide": true,
"options": vm.groupMonsterList,
"filter": true,
"group": true,
"value": vm.selectedMonster,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.selectedMonster = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onMonsterChange() }))({value, originalEvent: event}); }),
"template_group": (context: any) => { const group = context["$implicit"]; return <><Render tag="div" props={{"className": ["flex align-items-center font-bold dropdown_monster_group_label"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [group.label])}</Render></Render></>; }}}></Render></Render></Render></Render></Render>
{(() => { const __condition63 = (vm.chanceList?.length || (vm.isComparing && vm.chanceList2?.length));  return __condition63 ? <><Render tag="div" props={{"className": ["col-12 auto-cast-shared-block"].filter(Boolean).join(' ')}}><Render tag="app-battle-effects" props={{"chanceList": vm.chanceList,
"selectedChances": vm.selectedChances,
"chanceList2": vm.chanceList2,
"selectedChances2": vm.selectedChances2,
"isComparing": vm.isComparing,
"selectedChancesChange": (event: any) => vm.action(() => { const $event = event; (vm.selectedChances = $event);vm.onSelecteChance($event) }),
"selectedChances2Change": (event: any) => vm.action(() => { const $event = event; (vm.selectedChances2 = $event);vm.onSelecteChance($event) })}}></Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["col-12 auto-cast-shared-block"].filter(Boolean).join(' ')}}><Render tag="app-battle-monster-card" props={{"totalSummary": vm.totalSummary,
"incomingReductionClick": (step: any) => vm.action(() => vm.showBonusBreakdown({ label: step.label, keys: step.keys, valueClass: "summary_stat_def2", sources: vm.bonusBreakdownSources, itemMap: vm.equipItemIdItemTypeMap })),
"selectedMonster": vm.selectedMonster,
"selectedMonsterName": vm.selectedMonsterName,
"isInProcessingPreset": vm.isInProcessingPreset,
"isRelieveTarget": vm.isRelieveTarget,
"relieveLevelOptions": vm.relieveLevelOptions,
"relieveLevel": vm.relieveLevel,
"betelgeuseHp": vm.betelgeuseHp,
"betelgeuseHpOptions": vm.betelgeuseHpOptions,
"betelgeuseHpChange": (value: number) => vm.action(() => { vm.betelgeuseHp = value; vm.onBetelgeuseHpChange() }),
"relieveLevelChange": (event: any) => vm.action(() => { const $event = event; (vm.relieveLevel = $event);vm.onRelieveLevelChange() }),
"showElementTableClick": (event: any) => vm.action(() => { const $event = event; vm.onShowElementalTableClick() })}}></Render></Render>
<Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-auto-cast-hud" props={{"simulation": vm.autoCastSimulation,
"simulation2": vm.autoCastSimulation2,
"model": vm.model,
"model2": vm.model2,
"items": vm.items,
"summary": vm.totalSummary,
"summary2": vm.totalSummary2,
"isComparing": vm.isComparing,
"autoCompareEnabled": vm.isCompareAutoCast,
"skillFormulaVersionChange": (event: any) => vm.action(() => vm.onSkillFormulaVersionChange(event)),
"selectionChange": (event: any) => vm.action(() => { const $event = event; vm.onAutoCastSelectionChange($event) }),
"compareToggle": (event: any) => vm.action(() => { const $event = event; vm.toggleAutoCastCompare($event) }),
"showBonusBreakdownClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown($event) }),
"elementTableClick": (event: any) => vm.action(() => { const $event = event; vm.onShowElementalTableClick() })}}></Render></Render></Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "Bônus de Habilidade / Multiplicadores"}}><Render tag="app-misc-detail" props={{"elementTable": vm.elementTable,
"raceTable": vm.raceTable,
"sizeTable": vm.sizeTable,
"classTable": vm.classTable,
"atkTypeTable": vm.atkTypeTable,
"skillMultiplierTable": vm.skillMultiplierTable,
"skillTooltip": vm.skillTooltip,
"isComparing": vm.isComparing,
"valueClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown($event) })}}></Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "Resumo de Penetração"}}><Render tag="app-misc-detail" props={{"elementTable": [],
"raceTable": vm.peneRaceTable,
"sizeTable": [],
"classTable": vm.peneClassTable,
"skillMultiplierTable": [],
"isPene": true,
"isComparing": vm.isComparing,
"valueClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdown($event) })}}></Render></Render>
{(() => { const __condition64 = false;  return __condition64 ? <><Render tag="app-ui-accordion-tab" props={{"header": "Resumo"}}><Render tag="div" props={{"className": ["grid grid-nogutter"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("overflow: auto")))}}><Render tag="div" props={{"className": ["col-6 json_display"].filter(Boolean).join(' ')}}><Render tag="pre" props={{"dangerouslySetInnerHTML": {__html: sanitizeHtml(displayPipe("prettyjson", vm.modelSummary, [[true,3]], services) ?? '')}}}></Render>
{(() => { const __condition65 = vm.isEnableCompare;  return __condition65 ? <><Render tag="pre" props={{"dangerouslySetInnerHTML": {__html: sanitizeHtml(displayPipe("prettyjson", vm.model2, [[true,3]], services) ?? '')}}}></Render></> : null; })()}</Render>
<Render tag="div" props={{"className": ["col-6 json_display"].filter(Boolean).join(' ')}}><Render tag="pre" props={{"dangerouslySetInnerHTML": {__html: sanitizeHtml(displayPipe("prettyjson", vm.totalSummary, [[true,3]], services) ?? '')}}}></Render></Render></Render></Render></> : null; })()}
{(() => { const __condition66 = false;  return __condition66 ? <><Render tag="app-ui-accordion-tab" props={{"header": "Resumo de Equipamentos"}}><Render tag="div" props={{"className": ["grid grid-nogutter"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-6 json_display"].filter(Boolean).join(' ')}}><Render tag="pre" props={{"dangerouslySetInnerHTML": {__html: sanitizeHtml(displayPipe("prettyjson", vm.itemSummary, [[true,3]], services) ?? '')}}}></Render></Render>
<Render tag="div" props={{"className": ["col-6 json_display"].filter(Boolean).join(' ')}}><Render tag="pre" props={{"dangerouslySetInnerHTML": {__html: sanitizeHtml(displayPipe("prettyjson", vm.itemSummary2, [[true,3]], services) ?? '')}}}></Render></Render></Render></Render></> : null; })()}
<Render tag="app-ui-accordion-tab" props={{"header": "Descrições dos Itens"}}><Render tag="div" props={{"className": ["item-description-panel"].filter(Boolean).join(' ')}}><Render tag="aside" props={{"className": ["item-description-sidebar"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Servidor"}</Render></Render>
<Render tag="div" props={{"className": ["item-description-server"].filter(Boolean).join(' ')}}><Render tag="app-ui-dropdown" props={{"optionLabel": "label",
"optionValue": "value",
"styleClass": "w-full",
"options": vm.shopServerOptions,
"value": vm.selectedShopServer,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.selectedShopServer = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onSelectShopServer() }))({value, originalEvent: event}); })}}></Render></Render>
{(() => { const __condition67 = (vm.isEnableCompare && vm.equipCompareItems?.length);  return __condition67 ? <><Render tag="div" props={{"className": ["item_label_compare"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading item-description-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Comparação"}</Render></Render>
<Render tag="app-ui-listbox" props={{"styleClass": "item-description-list",
"options": vm.equipCompareItems,
"metaKeySelection": false,
"value": vm.selectedCompareItemDesc,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.selectedCompareItemDesc = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onSelectItemDescription(true) }))({value, originalEvent: event}); }),
"template_item": (context: any) => { const item = context["$implicit"]; return <><Render tag="div" props={{"className": ["flex gap-1 item_template"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", item.id, ["item"], services),
"className": ["item_img"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["text_ellips"].filter(Boolean).join(' ')}}>{interpolate(["",""], [item.label])}</Render></Render></>; }}}></Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["calc-section-heading item-description-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Equipamentos"}</Render></Render>
<Render tag="app-ui-listbox" props={{"styleClass": "item-description-list",
"options": vm.equipItems,
"metaKeySelection": false,
"value": vm.selectedItemDesc,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.selectedItemDesc = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onSelectItemDescription() }))({value, originalEvent: event}); }),
"template_item": (context: any) => { const item = context["$implicit"]; return <><Render tag="div" props={{"className": [classNames(interpolate(["flex gap-1 item_template item_label_",""], [item.value]))].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background-color: var(--border-radius)")))}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", item.id, ["item"], services),
"className": ["item_img"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["text_ellips"].filter(Boolean).join(' ')}}>{interpolate(["",""], [item.label])}</Render></Render></>; }}}></Render></Render>
<Render tag="section" props={{"className": ["item-description-card"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["item-description-content"].filter(Boolean).join(' ')}}>{(() => { const __condition68 = !(vm.itemId);  return __condition68 ? <><Render tag="div" props={{"className": ["item-description-empty"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "arrow-circle-left",
"style": normalizeStyle(Object.assign({}, parseStyle("font-size: 2.5rem")))}}></Render>
<Render tag="p" props={{"className": ["mt-3 mb-0"].filter(Boolean).join(' ')}}><span className="where-beside">Selecione um item na lista ao lado para ver seus bônus e descrição.</span><span className="where-above">Selecione um item na lista acima para ver seus bônus e descrição.</span></Render></Render></> : null; })()}
{(() => { const __condition69 = vm.itemId;  return __condition69 ? <><><Render tag="div" props={{"className": ["item-description-meta"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", vm.itemId, ["item"], services),
"className": ["item-description-icon"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="div" props={{"className": ["item-description-links"].filter(Boolean).join(' ')}}>{(() => { const __condition70 = vm.items[vm.itemId]?.custom;  return __condition70 ? <><Render tag="span" props={{}}>{interpolate(["Item personalizado · ID ",""], [vm.itemId])}</Render></> : null; })()}
{(() => { const __condition71 = !(vm.items[vm.itemId]?.custom);  return __condition71 ? <><Render tag="a" props={{"target": "_blank",
"rel": "noopener noreferrer",
"href": vm.divinePrideItemUrl}}>{interpolate(["Item ID: ",""], [vm.itemId])}</Render></> : null; })()}
{(() => { const __condition72 = !(vm.items[vm.itemId]?.custom);  return __condition72 ? <><Render tag="a" props={{"target": "_blank",
"rel": "noopener noreferrer",
"href": vm.marketItemUrl}}><Render tag="app-icon" props={{"name": "shopping-cart"}}></Render>
{" Mercado"}</Render></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["item-description-bonuses"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["calc-section-heading"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"Bônus calculados"}</Render></Render>
{(() => { const __condition73 = vm.itemBonusRows.length;  return __condition73 ? <><Render tag="ul" props={{"className": ["bonus_breakdown_list mt-2"].filter(Boolean).join(' ')}}>{(vm.itemBonusRows ?? []).map((__entry74: any, __index74: number, __array74: any[]) => { const r = __entry74; return <Fragment key={identityKey(__entry74)}><Render tag="li" props={{"className": ["flex align-items-center justify-content-between py-1 px-1"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["flex align-items-center gap-2", r.note ? "min-w-0" : "text_ellips"].filter(Boolean).join(' ')}}>{(() => { const __condition75 = r.icon;  return __condition75 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", r.icon, ["skill"], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
<Render tag="span" props={{}}>{interpolate(["",""], [r.label])}{r.note ? <Render tag="small" props={{"className": "block text-color-secondary"}}>{r.note}</Render> : null}</Render></Render>
<Render tag="span" props={{"className": ["font-semibold ml-2 item_bonus_value"].filter(Boolean).join(' ')}}>{interpolate(["",""], [r.display])}</Render></Render></Fragment>; })}</Render></> : null; })()}
{(() => { const __condition76 = !(vm.itemBonusRows.length);  return __condition76 ? <><Render tag="div" props={{"className": ["px-1 py-2"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("opacity: 0.7")))}}>{"Sem bônus."}</Render></> : null; })()}</Render>
<Render tag="div" props={{"dangerouslySetInnerHTML": {__html: sanitizeHtml(vm.itemDescription ?? '')},
"className": ["item-description-text"].filter(Boolean).join(' ')}}></Render></></> : null; })()}</Render></Render></Render></Render></Render></Render></Render>
<Render tag="app-ui-dialog" props={{"header": "Trocar de classe",
"visible": vm.showClassSwitch,
"modal": true,
"closable": true,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.showClassSwitch = $event) }),
"closed": (event: any) => vm.action(() => { const $event = event; vm.onClassSwitchHide() }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "520px","max-width": "92vw"}))),
"template_footer": (context: any) => {  return <><Render tag="button" props={{"label": "Cancelar",
"click": (event: any) => vm.action(() => { const $event = event; vm.cancelClassSwitch() }),
"className": ["ui-button-text"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="button" props={{"icon": "file",
"label": "Começar do zero",
"click": (event: any) => vm.action(() => { const $event = event; vm.confirmClassSwitch(false) }),
"className": ["ui-button-outlined"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="button" props={{"icon": "check",
"label": "Manter a build",
"click": (event: any) => vm.action(() => { const $event = event; vm.confirmClassSwitch(true) }),
"className": ["ui-button-success"].filter(Boolean).join(' '),
"button": true}}></Render></>; }}}>{(() => { const __condition77 = vm.pendingClassSwitch; const swap = __condition77; return __condition77 ? <><>{(() => { const noLosses = (context: any) => {  return <><Render tag="p" props={{"className": ["mb-0 class_switch_note"].filter(Boolean).join(' ')}}>{interpolate([" Todos os equipamentos atuais podem ser usados por ",". As habilidades que a classe nova não tem e os talentos, quando ela não os usa, ficam de fora. "], [swap.toLabel])}</Render></>; }; return <><Render tag="p" props={{"className": ["mt-0 mb-3"].filter(Boolean).join(' ')}}>{" Trocando de "}
<Render tag="b" props={{}}>{interpolate(["",""], [swap.fromLabel])}</Render>
{" para "}
<Render tag="b" props={{}}>{interpolate(["",""], [swap.toLabel])}</Render>
{". "}</Render>
{(() => { const __condition78 = swap.losses.length; const lost = __condition78; return __condition78 ? <><Render tag="div" props={{"className": ["class_switch_losses"].filter(Boolean).join(' ')}}><Render tag="p" props={{"className": ["m-0 mb-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-2"].filter(Boolean).join(' ')}}></Render>
{interpolate([" ",", porque "," não pode ",": "], [((lost === 1) ? "Este item será removido" : (("Estes " + lost) + " itens serão removidos")),swap.toLabel,((lost === 1) ? "usá-lo" : "usá-los")])}</Render>
<Render tag="ul" props={{"className": ["class_switch_loss_list"].filter(Boolean).join(' ')}}>{(swap.losses ?? []).map((__entry79: any, __index79: number, __array79: any[]) => { const loss = __entry79; return <Fragment key={identityKey(__entry79)}><Render tag="li" props={{}}><Render tag="span" props={{"className": ["class_switch_loss_slot"].filter(Boolean).join(' ')}}>{interpolate(["",""], [loss.slotLabel])}</Render>
<Render tag="span" props={{"className": ["class_switch_loss_item"].filter(Boolean).join(' ')}}>{interpolate(["",""], [loss.itemName])}</Render>
{(() => { const __condition80 = (loss.reason === "offHand");  return __condition80 ? <><Render tag="span" props={{"className": ["class_switch_loss_note"].filter(Boolean).join(' ')}}>{interpolate([""," não usa duas armas"], [swap.toLabel])}</Render></> : null; })()}</Render></Fragment>; })}</Render>
<Render tag="p" props={{"className": ["m-0 mt-2 class_switch_note"].filter(Boolean).join(' ')}}>{"Cartas, encantos e refino desses itens saem junto. O resto da build continua como está."}</Render></Render></> : noLosses({}); })()}
</>; })()}</></> : null; })()}
</Render>
<Render tag="app-ui-dialog" props={{"header": "Importar build",
"visible": vm.showReplayImport,
"modal": true,
"dismissableMask": true,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.showReplayImport = $event) }),
"closed": (event: any) => vm.action(() => { const $event = event; vm.onImportDialogHide() }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "480px"})))}}>{(() => { const importChoice = (context: any) => {  return <><Render tag="div" props={{"className": ["import_summary"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["import_summary_title"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.pendingImportClassLabel])}</Render>
<Render tag="div" props={{"className": ["import_summary_meta"].filter(Boolean).join(' ')}}>{interpolate([" "," · Nv "," / Job "," · "," equipamentos "], [((vm.pendingImport.source === "replay") ? ("Replay" + (vm.pendingImport.summary?.player ? (" de " + vm.pendingImport.summary.player) : "")) : "Link"),vm.pendingImport.model.level,vm.pendingImport.model.jobLevel,vm.pendingImportEquipCount])}</Render></Render>
<Render tag="div" props={{"className": ["import_choices"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"icon": "refresh",
"label": "Substituir simulação atual",
"click": (event: any) => vm.action(() => { const $event = event; vm.pickImportMode("replace") }),
"className": ["ui-button-sm import_choice"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="p" props={{"className": ["import_choice_note"].filter(Boolean).join(' ')}}>{"A build atual, as habilidades e as comparações são trocadas pela importada."}</Render>
<Render tag="button" props={{"type": "button",
"icon": "arrows-h",
"label": "Importar como comparação",
"disabled": !(vm.canImportAsComparison),
"click": (event: any) => vm.action(() => { const $event = event; vm.pickImportMode("compare") }),
"className": ["ui-button-sm ui-button-warning ui-button-outlined import_choice"].filter(Boolean).join(' '),
"button": true}}></Render>
{(() => { const __condition81 = vm.canImportAsComparison;  return __condition81 ? <><Render tag="p" props={{"className": ["import_choice_note"].filter(Boolean).join(' ')}}>{" ⚠️ Substitui qualquer comparação existente: todos os equipamentos, o nível, os atributos e os talentos da build importada entram como comparação. As habilidades continuam as da simulação atual. "}</Render></> : null; })()}
{(() => { const __condition82 = !(vm.canImportAsComparison);  return __condition82 ? <><Render tag="p" props={{"className": ["import_choice_note"].filter(Boolean).join(' ')}}>{interpolate([" Disponível só para a mesma classe da simulação atual (","). "], [vm.classLabel(vm.model.class)])}</Render></> : null; })()}</Render>
<Render tag="div" props={{"className": ["flex justify-content-end mt-3"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"label": "Cancelar",
"click": (event: any) => vm.action(() => { const $event = event; vm.pickImportMode(null) }),
"className": ["ui-button-sm ui-button-text"].filter(Boolean).join(' '),
"button": true}}></Render></Render></>; }; return <>{(() => { const __condition83 = !(vm.pendingImport);  return __condition83 ? <><><Render tag="div" props={{"dragover": (event: any) => vm.action(() => { const $event = event; vm.onReplayDragOver($event) }),
"dragleave": (event: any) => vm.action(() => { const $event = event; vm.onReplayDragLeave($event) }),
"drop": (event: any) => vm.action(() => { const $event = event; vm.onReplayDrop($event) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.replayInput.click() }),
"className": ["replay-dropzone",(vm.replayDragOver ? "dragover" : '')].filter(Boolean).join(' '),
"activateWithKeys": true}}>{(() => { let replayInput: any = vm["replayInput"]; return <><Render tag="app-icon" props={{"name": "upload",
"className": ["replay-dropzone-icon"].filter(Boolean).join(' ')}}></Render>
<Render tag="p" props={{"className": ["m-0 replay-dropzone-drag"].filter(Boolean).join(' ')}}>{"Arraste um arquivo "}
<Render tag="b" props={{}}>{".rrf"}</Render>
{" aqui"}</Render>
<Render tag="p" props={{"className": ["my-2 text-sm replay-dropzone-drag"].filter(Boolean).join(' ')}}>{"ou"}</Render>
<Render tag="button" props={{"type": "button",
"icon": "folder-open",
"label": "Selecionar arquivo",
"click": (event: any) => vm.action(() => { const $event = event; $event.stopPropagation();replayInput.click() }),
"className": ["ui-button-sm ui-button-outlined"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="input" props={{"type": "file",
"accept": ".rrf",
"hidden": true,
"change": (event: any) => vm.action(() => { const $event = event; vm.onReplayInputChange($event) }),
"reference": (value: any) => { replayInput = value; vm["replayInput"] = value; }}}></Render></>; })()}</Render>
<Render tag="div" props={{"className": ["import_divider"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"ou cole um link"}</Render></Render>
<Render tag="div" props={{"className": ["import_link"].filter(Boolean).join(' ')}}><Render tag="input" props={{"type": "text",
"placeholder": "Link do simulador (também aceita link curto)",
"autocomplete": "off",
"disabled": vm.replayBusy,
"keydown": (event: any) => vm.action(() => { const $event = event; if (event.key?.toLowerCase() === "enter") { vm.importShareLink() } }),
"value": vm.importLinkText,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.importLinkText = $event) }))(value); }),
"className": ["import_link_input"].filter(Boolean).join(' '),
"inputText": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "link",
"label": "Importar link",
"disabled": (vm.replayBusy || !(vm.importLinkText.trim())),
"click": (event: any) => vm.action(() => { const $event = event; vm.importShareLink() }),
"className": ["ui-button-sm import_link_button"].filter(Boolean).join(' '),
"button": true}}></Render></Render>
{(() => { const __condition84 = vm.replayBusy;  return __condition84 ? <><Render tag="div" props={{"className": ["mt-3 text-center"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "spinner",
"className": ["mr-2"].filter(Boolean).join(' ')}}></Render>
{"Lendo build…"}</Render></> : null; })()}
<Render tag="p" props={{"className": ["mt-3 mb-0 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("opacity: 0.7")))}}>{" Importa classe, nível, atributos base (FOR/AGI/VIT/INT/DES/SOR) e equipamentos (refino, grau, cartas e encantos) do replay. Os "}
<Render tag="b" props={{}}>{"talentos (POD/STA/SAB/FEI/CON/CRV)"}</Render>
{" vêm junto quando a gravação os traz: eles chegam num pacote que o servidor manda a cada troca de mapa, então basta que o personagem entre num mapa depois de começar a gravar. Se a gravação não os trouxer, o simulador avisa e eles ficam para ajustar à mão. Itens fora do banco de dados são ignorados. "}</Render>
<Render tag="p" props={{"className": ["mt-2 mb-0 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("opacity: 0.7")))}}>{" Um "}
<Render tag="b" props={{}}>{"link"}</Render>
{" traz a simulação inteira, exceto a comparação que estiver salva nele. "}</Render></></> : importChoice({}); })()}
</>; })()}</Render>
<Render tag="app-ui-dialog" props={{"header": "Salvar simulação",
"visible": vm.showSaveDialog,
"modal": true,
"dismissableMask": true,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.showSaveDialog = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "380px","max-width": "92vw"}))),
"template_footer": (context: any) => {  return <><Render tag="button" props={{"label": "Cancelar",
"click": (event: any) => vm.action(() => { const $event = event; (vm.showSaveDialog = false) }),
"className": ["ui-button-text"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="button" props={{"icon": "save",
"label": "Salvar",
"click": (event: any) => vm.action(() => { const $event = event; vm.confirmSave() }),
"className": ["ui-button-success"].filter(Boolean).join(' '),
"button": true}}></Render></>; }}}><Render tag="div" props={{"className": ["flex flex-column gap-2 pt-2"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "saveSimName"}}>{"Nome da simulação"}</Render>
<Render tag="input" props={{"id": "saveSimName",
"type": "text",
"placeholder": "Ex.: Rune Knight Nv 200",
"value": vm.saveName,
"onModelChange": (value: string) => vm.action(() => { vm.saveName = value }),
"keyup": (event: any) => vm.action(() => { const $event = event; if (event.key?.toLowerCase() === "enter") { vm.confirmSave() } }),
"inputText": true}}></Render></Render>
</Render>
<Render tag="app-ui-dialog" props={{"visible": vm.showSavesDialog,
"modal": true,
"dismissableMask": true,
"contentStyle": {"padding-top": "1rem"},
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.showSavesDialog = $event) }),
"styleClass": "saves-dialog",
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "900px","max-width": "95vw"}))),
"template_header": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center justify-content-between"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("width: 100%")))}}><Render tag="span" props={{"className": ["text-xl font-medium"].filter(Boolean).join(' ')}}>{"Simulações salvas"}</Render>
<Render tag="button" props={{"icon": "plus",
"label": "Nova simulação",
"click": (event: any) => vm.action(() => { const $event = event; vm.newSimulation() }),
"className": ["ui-button-sm ui-button-outlined mr-3"].filter(Boolean).join(' '),
"button": true}}></Render></Render></>; }}}>
{(() => { const __condition85 = (vm.savedSims.length === 0);  return __condition85 ? <><Render tag="div" props={{"className": ["p-5 text-center"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("opacity: 0.7")))}}>{" Nenhuma simulação salva ainda. Monte sua build e use "}
<Render tag="b" props={{}}>{"Salvar"}</Render>
{" na barra superior. "}</Render></> : null; })()}
{(() => { const __condition86 = vm.savedSims.length;  return __condition86 ? <><Render tag="div" props={{"className": ["grid"].filter(Boolean).join(' ')}}>{(vm.savedSims ?? []).map((__entry87: any, __index87: number, __array87: any[]) => { const sim = __entry87; return <Fragment key={identityKey(__entry87)}><Render tag="div" props={{"className": ["col-12 sm:col-6 lg:col-4 p-2"].filter(Boolean).join(' ')}}><Render tag="div" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.loadSavedSim(sim) }),
"className": ["border_default px-3 py-2 flex flex-column align-items-center gap-1 cursor-pointer"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("height: 100%"))),
"activateWithKeys": true}}><Render tag="img" props={{"src": vm.charSpriteUrl(sim.preset),
"alt": sim.name,
"error": (event: any) => vm.action(() => { const $event = event; vm.onCharSpriteError($event,sim.classId) }),
"style": normalizeStyle(Object.assign({}, parseStyle("height: 175px; object-fit: contain; image-rendering: pixelated")))}}></Render>
<Render tag="div" props={{"className": ["text-center"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("width: 100%")))}}><Render tag="div" props={{"className": ["font-semibold overflow-hidden text-overflow-ellipsis white-space-nowrap"].filter(Boolean).join(' ')}}>{interpolate(["",""], [sim.name])}</Render>
<Render tag="div" props={{"className": ["text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("opacity: 0.7")))}}>{interpolate([""," · Nv ","/",""], [vm.classLabel(sim.classId),sim.preset.level,sim.preset.jobLevel])}</Render></Render>
<Render tag="div" props={{"className": ["flex gap-2 justify-content-center mt-auto"].filter(Boolean).join(' ')}}><Render tag="button" props={{"icon": "upload",
"label": "Carregar",
"click": (event: any) => vm.action(() => { const $event = event; $event.stopPropagation();vm.loadSavedSim(sim) }),
"className": ["ui-button-sm ui-button-success"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="button" props={{"icon": "trash",
"aria-label": "Excluir",
"click": (event: any) => vm.action(() => { const $event = event; vm.deleteSavedSim(sim,$event) }),
"className": ["ui-button-sm ui-button-danger ui-button-outlined"].filter(Boolean).join(' '),
"button": true}}></Render></Render></Render></Render></Fragment>; })}</Render></> : null; })()}</Render>
<Render tag="app-ui-dialog" props={{"header": "Compartilhar simulação",
"visible": vm.showShareDialog,
"modal": true,
"dismissableMask": true,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.showShareDialog = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "480px","max-width": "94vw"})))}}><Render tag="p" props={{"className": ["mt-0 mb-2 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("opacity: 0.8")))}}>{"Link com a simulação embutida — quem abrir verá exatamente esta build."}</Render>
<Render tag="div" props={{"className": ["ui-inputgroup"].filter(Boolean).join(' ')}}><Render tag="input" props={{"type": "text",
"readOnly": true,
"value": (vm.shareShortening ? "Encurtando o link…" : vm.shareUrl),
"focus": (event: any) => event.target.select(),
"inputText": true}}></Render>
<Render tag="button" props={{"aria-label": "Copiar link",
"icon": (vm.shareShortening ? "spinner" : "copy"),
"disabled": vm.shareShortening,
"click": (event: any) => vm.action(() => { const $event = event; vm.copyShareUrl() }),
"className": ["ui-button-success"].filter(Boolean).join(' '),
"button": true}}></Render></Render></Render></>; })()}</>;
}
