import { Fragment } from 'react';
import { SkillFormulaSelector } from '../../ui/skill-formula-selector';
import { Render, displayPipe, interpolate, classNames, parseStyle, normalizeStyle, identityKey } from '../render';
import { useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
return <><Render tag="div" props={{"className": ["auto-cast-hud"].filter(Boolean).join(' ')}}>{(() => { let sharedDamagePopovers: any = vm["sharedDamagePopovers"];
let sharedSkillDetails: any = vm["sharedSkillDetails"];
let dpsCalcPanel: any = vm["dpsCalcPanel"];
let effectiveHitPanel: any = vm["effectiveHitPanel"];
let critRatePanel: any = vm["critRatePanel"]; return <><Render tag="div" props={{"className": ["hud-cards"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-card-col hud-card-col--result"].filter(Boolean).join(' ')}}><Render tag="app-ui-card" props={{"styleClass": "hud-card result-card"}}><Render tag="div" props={{"className": ["hud-hero-strip"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-hero-fig"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["cap2"].filter(Boolean).join(' ')}}>{"DPS"}</Render>
<Render tag="div" props={{"className": ["hud-hero-nums"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["pnum"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.simulation?.totalDps, ["1.0-0"], services)])}</Render>
{(() => { const __condition1 = (vm.isComparing && vm.simulation2);  return __condition1 ? <><><Render tag="span" props={{"className": ["vsarrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["pnum sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.simulation2.totalDps, ["1.0-0"], services)])}</Render></></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["hud-hero-fig"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["cap2 cap2--plain"].filter(Boolean).join(' ')}}>{t('skd.basicAttack')}</Render>
<Render tag="div" props={{"className": ["hud-hero-nums"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["hud-percycle"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.simulation?.basicAttackDps, ["1.0-0"], services)])}</Render>
{(() => { const __condition2 = (vm.isComparing && vm.simulation2);  return __condition2 ? <><><Render tag="span" props={{"className": ["vsarrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["hud-percycle sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.simulation2.basicAttackDps, ["1.0-0"], services)])}</Render></></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["hud-hero-fig"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["cap2 cap2--plain"].filter(Boolean).join(' ')}}>{t('ac.autoCasts')}</Render>
<Render tag="div" props={{"className": ["hud-hero-nums"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["hud-percycle"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.simulation?.autoCastDps, ["1.0-0"], services)])}</Render>
{(() => { const __condition3 = (vm.isComparing && vm.simulation2);  return __condition3 ? <><><Render tag="span" props={{"className": ["vsarrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["hud-percycle sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.simulation2.autoCastDps, ["1.0-0"], services)])}</Render></></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["hud-hero-divider"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["hud-hero-meta"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["hud-meta"].filter(Boolean).join(' ')}}>{t('ac.diesIn')}{' '}
<Render tag="b" props={{}}>{interpolate(["",""], [vm.formatTime(vm.simulation?.timeToKillSeconds)])}</Render>
{(() => { const __condition4 = (vm.isComparing && vm.simulation2);  return __condition4 ? <><><Render tag="span" props={{"className": ["vsarrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="b" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.formatTime(vm.simulation2.timeToKillSeconds)])}</Render></></> : null; })()}</Render></Render></Render>
<Render tag="div" props={{"className": ["probability-block"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["probability-title"].filter(Boolean).join(' ')}}>{t('ac.triggerBase')}</Render>
<Render tag="div" props={{"className": ["probability-flow"].filter(Boolean).join(' ')}}>{(() => { let headerEffectiveHit: any = vm["headerEffectiveHit"]; return <><Render tag="div" props={{"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"className": ["probability-step probability-step--help"].filter(Boolean).join(' '),
"tooltip": {text: t('ac.aspdTip'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}><Render tag="span" props={{}}>{t('combat.aspd')}</Render>
<Render tag="strong" props={{}}>{interpolate(["","/s"], [displayPipe("number", vm.simulation?.attacksPerSecond, ["1.2-2"], services)])}</Render></Render>
<Render tag="app-icon" props={{"name": "times"}}></Render>
<Render tag="div" props={{"role": "button",
"tabIndex": "0",
"click": (event: any) => vm.action(() => { const $event = event; vm.openEffectiveHit($event,effectiveHitPanel,headerEffectiveHit) }),
"className": ["probability-step probability-step--hit probability-step--help"].filter(Boolean).join(' '),
"activateWithKeys": true,
"reference": (value: any) => { headerEffectiveHit = value; vm["headerEffectiveHit"] = value; }}}><Render tag="span" props={{}}>{t('ac.effectiveHit')}</Render>
<Render tag="strong" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.simulation?.effectiveHitRate, ["1.1-1"], services)])}</Render></Render>
<Render tag="app-icon" props={{"name": "arrow-right"}}></Render>
<Render tag="div" props={{"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"className": ["probability-step probability-step--result probability-step--help"].filter(Boolean).join(' '),
"tooltip": {text: t('ac.onlyHits'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}><Render tag="span" props={{}}>{t('ac.eligibleAttacks')}</Render>
<Render tag="strong" props={{}}>{interpolate(["","/s"], [displayPipe("number", vm.simulation?.eligibleAttacksPerSecond, ["1.2-2"], services)])}</Render></Render></>; })()}</Render></Render></Render></Render></Render>
<Render tag="div" props={{"className": ["sources-head"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t((vm.sourceCount === 1) ? 'ac.oneSource' : 'ac.manySources', { n: vm.sourceCount })}</Render>
<SkillFormulaSelector value={vm.model?.skillFormulaVersion} onChange={value => vm.action(() => vm.skillFormulaVersionChange.emit(value))} />
<Render tag="button" props={{"type": "button",
"aria-pressed": vm.autoCompareEnabled,
"click": (event: any) => vm.action(() => { const $event = event; vm.toggleComparisonWithoutScroll($event) }),
"className": ["stats_compare_toggle auto-source-compare-toggle",(vm.autoCompareEnabled ? "stats_compare_toggle--on" : '')].filter(Boolean).join(' ')}}>{t(vm.autoCompareEnabled ? 'ac.comparing' : 'ac.compare')}</Render></Render>
{(() => { const __condition5 = vm.isComparing;  return __condition5 ? <><Render tag="div" props={{"role": "group",
"aria-label": t('ac.sourcesAria'),
"className": ["stats_side_switch auto-source-side-switch"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"aria-pressed": (vm.sourceSide === "current"),
"click": (event: any) => vm.action(() => { const $event = event; (vm.sourceSide = "current") }),
"className": ["stats_side",((vm.sourceSide === "current") ? "stats_side--active" : '')].filter(Boolean).join(' ')}}>{t('calc.sideMain')}</Render>
<Render tag="button" props={{"type": "button",
"aria-pressed": (vm.sourceSide === "compare"),
"click": (event: any) => vm.action(() => { const $event = event; (vm.sourceSide = "compare") }),
"className": ["stats_side stats_side--compare",((vm.sourceSide === "compare") ? "stats_side--active" : '')].filter(Boolean).join(' ')}}>{t('calc.sideCompare')}</Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["rot-rows auto-source-rows",(vm.showingComparisonSources ? "auto-source-rows--compare" : '')].filter(Boolean).join(' ')}}>{(vm.configurableSlots ?? []).map((__entry6: any, __index6: number, __array6: any[]) => { const slot = __entry6; return <Fragment key={identityKey(vm.trackSource(__index6, __entry6))}><>{(() => { const emptyConfiguredSource = (context: any) => {  return <><Render tag="div" props={{"className": ["rot-row auto-source-row auto-source-row--empty"].filter(Boolean).join(' ')}}>{(() => { let autoCastSkillPicker: any = vm["autoCastSkillPicker"]; return <><Render tag="img" props={{"src": displayPipe("iconUrl", slot.icon, ["skill"], services),
"alt": slot.name,
"className": ["rot-icon"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="div" props={{"className": ["rot-body"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["rot-line1"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-name"].filter(Boolean).join(' ')}}>{interpolate(["",""], [slot.name])}</Render>
<Render tag="span" props={{"className": ["rot-level rot-level--static"].filter(Boolean).join(' ')}}>{interpolate(["Nv. ",""], [slot.level])}</Render></Render>
<Render tag="div" props={{"className": ["rot-line2"].filter(Boolean).join(' ')}}>{t('ac.noSpell')}</Render></Render>
<Render tag="app-ui-dropdown" props={{"styleClass": "rot-add-dd auto-source-picker",
"panelStyleClass": "rot-add-dd-panel",
"optionLabel": "label",
"optionValue": "value",
"filterBy": "label,value",
"filterPlaceholder": t('ac.searchPlaceholder'),
"placeholder": t('ac.selectSkill'),
"options": vm.slotOptions(slot),
"filter": true,
"opened": (event: any) => vm.action(() => { const $event = event; vm.alignSkillPicker(autoCastSkillPicker) }),
"value": vm.selectedSkill(slot),
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.setSelectedSkill(slot,$event) }))(value); }),
"reference": (value: any) => { autoCastSkillPicker = value; vm["autoCastSkillPicker"] = value; },
"template_item": (context: any) => { const option = context["$implicit"]; return <><Render tag="div" props={{"className": ["rot-opt"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", option.icon, ["skill"], services),
"className": ["rot-icon"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="span" props={{}}>{interpolate(["",""], [option.label])}</Render></Render></>; }}}></Render></>; })()}</Render></>; }; return <>{(() => { const __condition7 = vm.configuredSourceFor(slot); const source = __condition7; return __condition7 ? <><Render tag="div" props={{"className": ["rot-row auto-source-row"].filter(Boolean).join(' ')}}>{(() => { let configuredIcon: any = vm["configuredIcon"];
let configuredInfo: any = vm["configuredInfo"]; return <><Render tag="img" props={{"data-auto-anchor": "details",
"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"data-auto-source": source.key,
"src": displayPipe("iconUrl", source.icon, ["skill"], services),
"alt": source.name,
"click": (event: any) => vm.action(() => { const $event = event; vm.openDetails(source,$event,sharedSkillDetails,configuredIcon) }),
"className": ["rot-icon rot-icon--btn"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"missingIcon": true,
"reference": (value: any) => { configuredIcon = value; vm["configuredIcon"] = value; }}}></Render>
<Render tag="div" props={{"className": ["rot-body"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["rot-line1"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-name"].filter(Boolean).join(' ')}}>{interpolate(["",""], [source.name])}</Render>
<Render tag="span" props={{"className": ["rot-level rot-level--static"].filter(Boolean).join(' ')}}>{interpolate(["",""], [source.level])}</Render></Render>
<Render tag="div" props={{"className": ["rot-line2"].filter(Boolean).join(' ')}}>{(source.meta ?? []).map((__entry8: any, __index8: number, __array8: any[]) => { const detail = __entry8;
const first = __index8 === 0; return <Fragment key={identityKey(vm.trackDetail(__index8, __entry8))}><>{(() => { const __condition9 = !(first);  return __condition9 ? <><Render tag="span" props={{"className": ["auto-source-sep"].filter(Boolean).join(' ')}}>{"•"}</Render></> : null; })()}
<Render tag="span" props={{"data-auto-source": source.key}}>{(() => { const configuredMetaText = (context: any) => {  return <>{(() => { const configuredPlainMeta = (context: any) => {  return <>{interpolate(["",""], [detail.text])}</>; }; return <>{(() => { const __condition10 = detail.origin;  return __condition10 ? <><Render tag="button" props={{"type": "button",
"tooltipStyleClass": "item_desc_tooltip auto_cast_origin_tooltip",
"tooltipPosition": "top",
"className": ["auto-source-origin"].filter(Boolean).join(' '),
"tooltip": {text: (source.result?.source?.sourceItemId ? displayPipe("itemDescTooltip", source.result.source.sourceItemId, [vm.items,vm.itemDescriptions.version], services) : vm.originTooltip(source,vm.itemDescriptions.version)), position: "top", className: "item_desc_tooltip auto_cast_origin_tooltip", showDelay: 350, hideDelay: 0, escape: false, disabled: false}}}>{interpolate(["",""], [detail.text])}</Render></> : configuredPlainMeta({}); })()}
</>; })()}</>; }; return <>{(() => { const __condition11 = detail.critical;  return __condition11 ? <><>{(() => { let configuredCrit: any = vm["configuredCrit"]; return <>{' '}{t('ac.critLabel')}{' '}
<Render tag="b" props={{"data-auto-anchor": "crit",
"role": "button",
"tabIndex": "0",
"data-auto-source": source.key,
"click": (event: any) => vm.action(() => { const $event = event; vm.openCrit(source,$event,critRatePanel,configuredCrit) }),
"className": ["rot-crit-val bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true,
"reference": (value: any) => { configuredCrit = value; vm["configuredCrit"] = value; }}}>{interpolate(["",""], [detail.text])}</Render>
{(() => { const __condition12 = ((detail.critical2 != null) && (detail.critical2 !== source.criticalRate));  return __condition12 ? <><><Render tag="span" props={{"className": ["rot-arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["rot-crit-sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", detail.critical2, ["1.1-1"], services)])}</Render></></> : null; })()}</>; })()}</></> : configuredMetaText({}); })()}
</>; })()}</Render></></Fragment>; })}</Render></Render>
<Render tag="span" props={{"className": ["rot-dmg auto-source-dmg"].filter(Boolean).join(' ')}}>{(() => { const singleDamageRange = (context: any) => {  return <><Render tag="span" props={{"className": ["auto-damage-range"].filter(Boolean).join(' ')}}>{interpolate([" "," – "," "], [displayPipe("number", source.damageMin, ["1.0-0"], services),displayPipe("number", source.damageMax, ["1.0-0"], services)])}
<Render tag="span" props={{"className": ["rot-tag rot-tag--flat"].filter(Boolean).join(' ')}}>{t('ac.damageTag')}</Render></Render></>; }; return <>{(() => { const __condition13 = source.damageRanges;  return __condition13 ? <><Render tag="span" props={{"className": ["rot-dmg-split"].filter(Boolean).join(' ')}}>{(source.damageRanges ?? []).map((__entry14: any, __index14: number, __array14: any[]) => { const range = __entry14; return <Fragment key={identityKey(vm.trackDamageRange(__index14, __entry14))}><>{(() => { let configuredDamage: any = vm["configuredDamage"]; return <><Render tag="span" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"data-auto-source": source.key,
"data-auto-anchor": ("damage-" + range.kind),
"click": (event: any) => vm.action(() => { const $event = event; vm.openDamage(source,range.kind,$event,sharedDamagePopovers,configuredDamage) }),
"className": ["rot-dmg-branch auto-damage-branch"].filter(Boolean).join(' '),
"tooltip": {text: t('rot.howDamage'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"reference": (value: any) => { configuredDamage = value; vm["configuredDamage"] = value; }}}>{interpolate([" ",""], [displayPipe("number", range.min, ["1.0-0"], services)])}
{(() => { const __condition15 = (range.max !== range.min);  return __condition15 ? <><>{interpolate([" – ",""], [displayPipe("number", range.max, ["1.0-0"], services)])}</></> : null; })()}</Render>
<Render tag="span" props={{"className": ["rot-tag rot-tag--sm",classNames(("rot-tag--" + range.kind))].filter(Boolean).join(' ')}}>{interpolate(["",""], [range.label])}</Render></>; })()}</></Fragment>; })}</Render></> : singleDamageRange({}); })()}

<Render tag="span" props={{"className": ["rot-dmg-main"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-dmg-figs"].filter(Boolean).join(' ')}}>{(() => { let configuredDps: any = vm["configuredDps"]; return <><Render tag="span" props={{"data-auto-anchor": "dps",
"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"data-auto-source": source.key,
"click": (event: any) => vm.action(() => { const $event = event; vm.openDps(source,$event,dpsCalcPanel,configuredDps) }),
"className": ["rot-dmg-val auto-dps-value"].filter(Boolean).join(' '),
"tooltip": {text: t('ac.howDps'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"reference": (value: any) => { configuredDps = value; vm["configuredDps"] = value; }}}>{interpolate(["",""], [displayPipe("number", source.dps, ["1.0-0"], services)])}</Render>
{(() => { const __condition16 = ((vm.isComparing && (source.dps2 != null)) && (source.dps2 !== source.dps));  return __condition16 ? <>{(() => { let configuredDps2: any = vm["configuredDps2"]; return <><Render tag="span" props={{"data-auto-anchor": "dps",
"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"data-auto-source": source.key,
"click": (event: any) => vm.action(() => { const $event = event; vm.openDps(source,$event,dpsCalcPanel,configuredDps2) }),
"className": ["rot-dmg-sim auto-dps-value"].filter(Boolean).join(' '),
"tooltip": {text: t('ac.howDps'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"reference": (value: any) => { configuredDps2 = value; vm["configuredDps2"] = value; }}}>{interpolate(["",""], [displayPipe("number", source.dps2, ["1.0-0"], services)])}</Render></>; })()}</> : null; })()}</>; })()}</Render>
<Render tag="span" props={{"className": ["rot-dmg-meta"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-tag rot-tag--dps"].filter(Boolean).join(' ')}}>{"DPS"}</Render>
<Render tag="span" props={{"className": ["rot-sep"].filter(Boolean).join(' ')}}>{"·"}</Render>
<Render tag="span" props={{"tooltipPosition": "top",
"className": ["rot-pct"].filter(Boolean).join(' '),
"tooltip": {text: vm.contributionTooltip(source), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}>{interpolate(["","%"], [displayPipe("number", source.contribution, ["1.1-1"], services)])}</Render></Render></Render></>; })()}</Render>
<Render tag="app-icon" props={{"data-auto-anchor": "details",
"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"name": "info-circle",
"data-auto-source": source.key,
"label": t('ac.detailsOf', { name: source.name }),
"click": (event: any) => vm.action(() => { const $event = event; vm.openDetails(source,$event,sharedSkillDetails,configuredInfo.nativeElement) }),
"className": ["rot-info"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"reference": (value: any) => { configuredInfo = value; vm["configuredInfo"] = value; }}}></Render>
<Render tag="app-icon" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"name": "times",
"label": t('ac.removeSkill', { name: slot.name }),
"click": (event: any) => vm.action(() => { const $event = event; vm.setSelectedSkill(slot) }),
"className": ["rot-remove"].filter(Boolean).join(' '),
"tooltip": {text: t('eq.remove'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}></Render></>; })()}</Render></> : emptyConfiguredSource({}); })()}
</>; })()}</></Fragment>; })}
{(vm.blockedSources ?? []).map((__entry17: any, __index17: number, __array17: any[]) => { const blocked = __entry17; return <Fragment key={identityKey(__entry17)}><Render tag="div" props={{"className": ["rot-row auto-source-row auto-source-row--empty auto-source-row--blocked"].filter(Boolean).join(' ')}}><Render tag="img" props={{"src": displayPipe("iconUrl", blocked.icon, ["skill"], services),
"alt": blocked.name,
"className": ["rot-icon"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="div" props={{"className": ["rot-body"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["rot-line1"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-name"].filter(Boolean).join(' ')}}>{interpolate(["",""], [blocked.name])}</Render></Render>
<Render tag="div" props={{"className": ["rot-line2"].filter(Boolean).join(' ')}}>{interpolate(["",""], [blocked.reason])}</Render></Render>
<Render tag="span" props={{"className": ["auto-source-blocked-label"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "lock"}}></Render>
{' '}{t('ac.unavailable')}</Render></Render></Fragment>; })}
{(vm.dpsSources ?? []).map((__entry18: any, __index18: number, __array18: any[]) => { const source = __entry18; return <Fragment key={identityKey(vm.trackSource(__index18, __entry18))}><Render tag="div" props={{"className": ["rot-row auto-source-row"].filter(Boolean).join(' ')}}>{(() => { let sourceIcon: any = vm["sourceIcon"];
let sourceDetailsAnchor: any = vm["sourceDetailsAnchor"]; return <><Render tag="img" props={{"data-auto-anchor": "details",
"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"data-auto-source": source.key,
"src": (source.isBasic ? vm.basicAttackIcon : displayPipe("iconUrl", source.icon, ["skill"], services)),
"alt": source.name,
"click": (event: any) => vm.action(() => { const $event = event; vm.openDetails(source,$event,sharedSkillDetails,sourceIcon) }),
"className": ["rot-icon rot-icon--btn"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"missingIcon": true,
"reference": (value: any) => { sourceIcon = value; vm["sourceIcon"] = value; }}}></Render>
<Render tag="div" props={{"className": ["rot-body"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["rot-line1"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-name"].filter(Boolean).join(' ')}}>{interpolate(["",""], [source.name])}</Render>
{(() => { const __condition19 = source.level;  return __condition19 ? <><Render tag="span" props={{"className": ["rot-level rot-level--static"].filter(Boolean).join(' ')}}>{interpolate(["",""], [source.level])}</Render></> : null; })()}</Render>
<Render tag="div" props={{"className": ["rot-line2"].filter(Boolean).join(' ')}}>{(source.meta ?? []).map((__entry20: any, __index20: number, __array20: any[]) => { const detail = __entry20;
const first = __index20 === 0; return <Fragment key={identityKey(vm.trackDetail(__index20, __entry20))}><>{(() => { const __condition21 = !(first);  return __condition21 ? <><Render tag="span" props={{"className": ["auto-source-sep"].filter(Boolean).join(' ')}}>{"•"}</Render></> : null; })()}
<Render tag="span" props={{"data-auto-source": source.key}}>{(() => { const sourceMetaText = (context: any) => {  return <>{(() => { const sourcePlainMeta = (context: any) => {  return <>{(() => { const sourcePlainText = (context: any) => {  return <>{interpolate(["",""], [(detail.text || detail)])}</>; }; return <>{(() => { const __condition22 = detail.origin;  return __condition22 ? <><Render tag="button" props={{"type": "button",
"tooltipStyleClass": "item_desc_tooltip auto_cast_origin_tooltip",
"tooltipPosition": "top",
"className": ["auto-source-origin"].filter(Boolean).join(' '),
"tooltip": {text: (source.result?.source?.sourceItemId ? displayPipe("itemDescTooltip", source.result.source.sourceItemId, [vm.items,vm.itemDescriptions.version], services) : vm.originTooltip(source,vm.itemDescriptions.version)), position: "top", className: "item_desc_tooltip auto_cast_origin_tooltip", showDelay: 350, hideDelay: 0, escape: false, disabled: false}}}>{interpolate(["",""], [detail.text])}</Render></> : sourcePlainText({}); })()}
</>; })()}</>; }; return <>{(() => { const __condition23 = detail.effectiveHit;  return __condition23 ? <><>{(() => { let sourceEffectiveHit: any = vm["sourceEffectiveHit"]; return <>{' '}{t('ac.effectiveHit')}{' '}
<Render tag="b" props={{"data-auto-anchor": "effective-hit",
"role": "button",
"tabIndex": "0",
"data-auto-source": source.key,
"click": (event: any) => vm.action(() => { const $event = event; vm.openEffectiveHit($event,effectiveHitPanel,sourceEffectiveHit) }),
"className": ["rot-crit-val bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true,
"reference": (value: any) => { sourceEffectiveHit = value; vm["sourceEffectiveHit"] = value; }}}>{interpolate(["","%"], [displayPipe("number", vm.displayedSimulation?.effectiveHitRate, ["1.1-1"], services)])}</Render></>; })()}</></> : sourcePlainMeta({}); })()}
</>; })()}</>; }; return <>{(() => { const __condition24 = detail.critical;  return __condition24 ? <><>{(() => { let sourceCrit: any = vm["sourceCrit"]; return <>{' '}{t('ac.critLabel')}{' '}
<Render tag="b" props={{"data-auto-anchor": "crit",
"role": "button",
"tabIndex": "0",
"data-auto-source": source.key,
"click": (event: any) => vm.action(() => { const $event = event; vm.openCrit(source,$event,critRatePanel,sourceCrit) }),
"className": ["rot-crit-val bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true,
"reference": (value: any) => { sourceCrit = value; vm["sourceCrit"] = value; }}}>{interpolate(["",""], [detail.text])}</Render>
{(() => { const __condition25 = ((detail.critical2 != null) && (detail.critical2 !== source.criticalRate));  return __condition25 ? <><><Render tag="span" props={{"className": ["rot-arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["rot-crit-sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", detail.critical2, ["1.1-1"], services)])}</Render></></> : null; })()}</>; })()}</></> : sourceMetaText({}); })()}
</>; })()}</Render></></Fragment>; })}</Render></Render>
<Render tag="span" props={{"className": ["rot-dmg auto-source-dmg"].filter(Boolean).join(' ')}}>{(() => { const singleSourceDamage = (context: any) => {  return <><Render tag="span" props={{"className": ["auto-damage-range"].filter(Boolean).join(' ')}}>{interpolate([" "," – "," "], [displayPipe("number", source.damageMin, ["1.0-0"], services),displayPipe("number", source.damageMax, ["1.0-0"], services)])}
<Render tag="span" props={{"className": ["rot-tag rot-tag--flat"].filter(Boolean).join(' ')}}>{t('ac.damageTag')}</Render></Render></>; }; return <>{(() => { const __condition26 = source.damageRanges;  return __condition26 ? <><Render tag="span" props={{"className": ["rot-dmg-split"].filter(Boolean).join(' ')}}>{(source.damageRanges ?? []).map((__entry27: any, __index27: number, __array27: any[]) => { const range = __entry27; return <Fragment key={identityKey(vm.trackDamageRange(__index27, __entry27))}><>{(() => { let sourceDamage: any = vm["sourceDamage"]; return <><Render tag="span" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"data-auto-source": source.key,
"data-auto-anchor": ("damage-" + range.kind),
"click": (event: any) => vm.action(() => { const $event = event; vm.openDamage(source,range.kind,$event,sharedDamagePopovers,sourceDamage) }),
"className": ["rot-dmg-branch auto-damage-branch"].filter(Boolean).join(' '),
"tooltip": {text: t('rot.howDamage'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"reference": (value: any) => { sourceDamage = value; vm["sourceDamage"] = value; }}}>{interpolate([" ",""], [displayPipe("number", range.min, ["1.0-0"], services)])}
{(() => { const __condition28 = (range.max !== range.min);  return __condition28 ? <><>{interpolate([" – ",""], [displayPipe("number", range.max, ["1.0-0"], services)])}</></> : null; })()}</Render>
<Render tag="span" props={{"className": ["rot-tag rot-tag--sm",classNames(("rot-tag--" + range.kind))].filter(Boolean).join(' ')}}>{interpolate(["",""], [range.label])}</Render></>; })()}</></Fragment>; })}</Render></> : singleSourceDamage({}); })()}

<Render tag="span" props={{"className": ["rot-dmg-main"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-dmg-figs"].filter(Boolean).join(' ')}}>{(() => { let sourceDps: any = vm["sourceDps"]; return <><Render tag="span" props={{"data-auto-anchor": "dps",
"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"data-auto-source": source.key,
"click": (event: any) => vm.action(() => { const $event = event; vm.openDps(source,$event,dpsCalcPanel,sourceDps) }),
"className": ["rot-dmg-val auto-dps-value"].filter(Boolean).join(' '),
"tooltip": {text: t('ac.howDps'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"reference": (value: any) => { sourceDps = value; vm["sourceDps"] = value; }}}>{interpolate(["",""], [displayPipe("number", source.dps, ["1.0-0"], services)])}</Render>
{(() => { const __condition29 = ((vm.isComparing && (source.dps2 != null)) && (source.dps2 !== source.dps));  return __condition29 ? <>{(() => { let sourceDps2: any = vm["sourceDps2"]; return <><Render tag="span" props={{"data-auto-anchor": "dps",
"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"data-auto-source": source.key,
"click": (event: any) => vm.action(() => { const $event = event; vm.openDps(source,$event,dpsCalcPanel,sourceDps2) }),
"className": ["rot-dmg-sim auto-dps-value"].filter(Boolean).join(' '),
"tooltip": {text: t('ac.howDps'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"reference": (value: any) => { sourceDps2 = value; vm["sourceDps2"] = value; }}}>{interpolate(["",""], [displayPipe("number", source.dps2, ["1.0-0"], services)])}</Render></>; })()}</> : null; })()}</>; })()}</Render>
<Render tag="span" props={{"className": ["rot-dmg-meta"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-tag rot-tag--dps"].filter(Boolean).join(' ')}}>{"DPS"}</Render>
<Render tag="span" props={{"className": ["rot-sep"].filter(Boolean).join(' ')}}>{"·"}</Render>
<Render tag="span" props={{"tooltipPosition": "top",
"className": ["rot-pct"].filter(Boolean).join(' '),
"tooltip": {text: vm.contributionTooltip(source), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}>{interpolate(["","%"], [displayPipe("number", source.contribution, ["1.1-1"], services)])}</Render></Render></Render></>; })()}</Render>
<Render tag="app-icon" props={{"data-auto-anchor": "details",
"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"name": "info-circle",
"data-auto-source": source.key,
"label": t('ac.detailsOf', { name: source.name }),
"click": (event: any) => vm.action(() => { const $event = event; vm.openDetails(source,$event,sharedSkillDetails,sourceDetailsAnchor.nativeElement) }),
"className": ["rot-info"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"reference": (value: any) => { sourceDetailsAnchor = value; vm["sourceDetailsAnchor"] = value; }}}></Render></>; })()}</Render></Fragment>; })}</Render>
<Render tag="app-battle-damage-popovers" props={{"breakdownClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdownClick.emit($event) }),
"reference": (value: any) => { sharedDamagePopovers = value; vm["sharedDamagePopovers"] = value; }}}></Render>
<Render tag="app-battle-skill-details" props={{"breakdownClick": (event: any) => vm.action(() => { const $event = event; vm.showBonusBreakdownClick.emit($event) }),
"elementTableClick": (event: any) => vm.action(() => { const $event = event; vm.elementTableClick.emit() }),
"reference": (value: any) => { sharedSkillDetails = value; vm["sharedSkillDetails"] = value; }}}></Render>
<Render tag="app-ui-popover" props={{"styleClass": "rot-details-panel auto-cast-dps-panel",
"reference": (value: any) => { dpsCalcPanel = value; vm["dpsCalcPanel"] = value; },
"handle": vm["dpsCalcPanel"]}}><Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{t('ac.dpsTitle')}</Render>
{(() => { const __condition30 = vm.activeSource;  return __condition30 ? <><Render tag="div" props={{"className": ["pstats one"].filter(Boolean).join(' ')}}>{(() => { const autoCastDpsCalculation = (context: any) => {  return <>{(() => { const standardAutoCastDps = (context: any) => {  return <>{(() => { const __condition31 = vm.autoCastDpsSteps; const steps = __condition31; return __condition31 ? <><>{(() => { const autoCastFlatMean = (context: any) => {  return <>{(() => { const __condition32 = !(vm.autoCastAlwaysCrit);  return __condition32 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.damageBeforeHit')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.avgBasicDamage, ["1.0-0"], services)])}</Render></Render></> : null; })()}</>; }; return <>{(() => { const __condition33 = vm.autoCastCritIsWeighted;  return __condition33 ? <><Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('ac.meanBetween')}</Render></> : null; })()}
{(() => { const __condition34 = vm.autoCastCritIsWeighted;  return __condition34 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.noCriMeanRow')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.avgBasicDamage, ["1.0-0"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition35 = (vm.autoCastCritIsWeighted || vm.autoCastAlwaysCrit);  return __condition35 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.criDamage')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.criDmg, ["1.0-0"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition36 = vm.autoCastCritIsWeighted;  return __condition36 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.criRate')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", steps.criRate, ["1.0-1"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition37 = vm.autoCastAlwaysCrit;  return __condition37 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.effectiveCriRate')}</Render>
<Render tag="span" props={{}}>{"100,0%"}</Render></Render></> : null; })()}
{(() => { const __condition38 = !(vm.autoCastAlwaysCrit);  return __condition38 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [t(vm.autoCastCritIsWeighted ? 'pop.accuracyNoCri' : 'pop.accuracy')])}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", steps.accuracy, ["1.0-1"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition39 = vm.autoCastCritIsWeighted;  return __condition39 ? <><><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.criPartRow', { rate: displayPipe("number", steps.criRate, ["1.0-1"], services) })}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.criPart, ["1.0-0"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.noCriPartRow', { rate: displayPipe("number", (100 - steps.criRate), ["1.0-1"], services) })}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.noCriPart, ["1.0-0"], services)])}</Render></Render></></> : autoCastFlatMean({}); })()}

<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.expectedPerHitTotal')}</Render>
<Render tag="span" props={{"className": ["orange"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", steps.totalDamage, ["1.0-0"], services)])}</Render></Render>
{(() => { const __condition40 = (steps.totalHit > 1);  return __condition40 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.timesHits')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.totalHit, ["1.0-0"], services)])}</Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.expectedPerActivationTotal')}</Render>
<Render tag="span" props={{"className": ["orange"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", steps.expectedDamagePerActivation, ["1.0-0"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('ac.activations')}</Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [vm.activeTriggerRateLabel])}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.triggerAttacksPerSecond, ["1.2-2"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.timesSourceChance')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.activeSource.result?.source?.chance, ["1.1-1"], services)])}</Render></Render>
{vm.activeSource.result?.source?.maxActivationsPerSecond != null && <Render tag="div" props={{ className: 'kv', title: vm.activeSource.info }}><Render tag="span" props={{}}>{t('ac.regenCeiling')}</Render><Render tag="span" props={{}}>{displayPipe('number', vm.activeSource.result.source.maxActivationsPerSecond, ['1.2-2'], services)}</Render></Render>}
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.activationsTotal')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.activationsPerSecond, ["1.2-2"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.timesExpectedPerActivation')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.expectedDamagePerActivation, ["1.0-0"], services)])}</Render></Render></>; })()}</></> : autoCastDpsFallback({}); })()}</>; };
const autoCastDpsFallback = (context: any) => {  return <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [vm.activeTriggerRateLabel])}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.triggerAttacksPerSecond, ["1.2-2"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.timesSourceChance')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.activeSource.result?.source?.chance, ["1.1-1"], services)])}</Render></Render>
{vm.activeSource.result?.source?.maxActivationsPerSecond != null && <Render tag="div" props={{ className: 'kv', title: vm.activeSource.info }}><Render tag="span" props={{}}>{t('ac.regenCeiling')}</Render><Render tag="span" props={{}}>{displayPipe('number', vm.activeSource.result.source.maxActivationsPerSecond, ['1.2-2'], services)}</Render></Render>}
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.activationsTotal')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.activationsPerSecond, ["1.2-2"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.timesExpectedPerActivation')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.expectedDamagePerActivation, ["1.0-0"], services)])}</Render></Render></>; }; return <>{(() => { const __condition41 = vm.activeSource.result?.source?.extraHitOutcomes?.length;  return __condition41 ? <><><Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('ac.extraShots')}</Render>
{(vm.fearBreezeDpsRows ?? []).map((__entry42: any, __index42: number, __array42: any[]) => { const row = __entry42; return <Fragment key={identityKey(__entry42)}><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t((row.extraHits === 1) ? 'ac.extraShotRowOne' : 'ac.extraShotRowMany', { hits: row.totalHits, chance: displayPipe("number", (row.chance * 100), ["1.0-1"], services), extra: row.extraHits })}</Render>
<Render tag="span" props={{}}>{interpolate(["","/s"], [displayPipe("number", row.extraHitsPerSecond, ["1.2-2"], services)])}</Render></Render></Fragment>; })}
<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.extraHitsTotal')}</Render>
<Render tag="span" props={{"className": ["orange"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.fearBreezeExtraHitsPerSecond, ["1.2-2"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.timesExpectedPerExtraHit')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", vm.fearBreezeDamagePerExtraHit, ["1.0-0"], services)])}</Render></Render></></> : standardAutoCastDps({}); })()}

</>; })()}</>; }; return <>{(() => { const __condition43 = vm.activeSource.isBasic;  return __condition43 ? <><>{(() => { const basicDpsFallback = (context: any) => {  return <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.expectedPerHit')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.expectedDamagePerActivation, ["1.0-0"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.timesAttacks')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.activationsPerSecond, ["1.2-2"], services)])}</Render></Render></>; }; return <>{(() => { const __condition44 = vm.basicDpsSteps; const steps = __condition44; return __condition44 ? <><>{(() => { const basicFlatMean = (context: any) => {  return <>{(() => { const __condition45 = !(vm.basicAlwaysCrit);  return __condition45 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.damageBeforeHit')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.avgBasicDamage, ["1.0-0"], services)])}</Render></Render></> : null; })()}</>; }; return <>{(() => { const __condition46 = vm.basicCritIsWeighted;  return __condition46 ? <><Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('ac.meanBetween')}</Render></> : null; })()}
{(() => { const __condition47 = vm.basicCritIsWeighted;  return __condition47 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.noCriMeanRow')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.avgBasicDamage, ["1.0-0"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition48 = (vm.basicCritIsWeighted || vm.basicAlwaysCrit);  return __condition48 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.criDamage')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.criDmg, ["1.0-0"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition49 = vm.basicCritIsWeighted;  return __condition49 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.criRate')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", steps.criRate, ["1.0-1"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition50 = vm.basicAlwaysCrit;  return __condition50 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.effectiveCriRate')}</Render>
<Render tag="span" props={{}}>{"100,0%"}
<Render tag="span" props={{"className": ["mut"].filter(Boolean).join(' ')}}>{interpolate([" (","% antes do limite)"], [displayPipe("number", vm.displayedSimulation?.criticalRate, ["1.1-1"], services)])}</Render></Render></Render></> : null; })()}
{(() => { const __condition51 = !(vm.basicAlwaysCrit);  return __condition51 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{vm.basicCritIsWeighted ? t('ac.hitNoCritOnly') : t('ss.hit')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", steps.accuracy, ["1.0-1"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition52 = vm.basicCritIsWeighted;  return __condition52 ? <><><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.criPartRow', { rate: displayPipe("number", steps.criRate, ["1.0-1"], services) })}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.criPart, ["1.0-0"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.noCriPartRow', { rate: displayPipe("number", (100 - steps.criRate), ["1.0-1"], services) })}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.noCriPart, ["1.0-0"], services)])}</Render></Render></></> : basicFlatMean({}); })()}

<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.expectedPerHitTotal')}</Render>
<Render tag="span" props={{"className": ["orange"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", steps.totalDamage, ["1.0-0"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.timesAttacks')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", steps.hitsPerSec, ["1.2-2"], services)])}</Render></Render></>; })()}</></> : basicDpsFallback({}); })()}
</>; })()}</></> : autoCastDpsCalculation({}); })()}

<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.dpsTotal')}</Render>
<Render tag="span" props={{"className": ["teal"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.currentDps, ["1.0-0"], services)])}
{(() => { const __condition53 = (vm.isComparing && (vm.activeSource.comparisonDps != null));  return __condition53 ? <><><Render tag="span" props={{"className": ["arr"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.activeSource.comparisonDps, ["1.0-0"], services)])}</Render></></> : null; })()}</Render></Render></>; })()}</Render></> : null; })()}</Render>
<Render tag="app-ui-popover" props={{"styleClass": "rot-details-panel auto-cast-effective-hit-panel",
"reference": (value: any) => { effectiveHitPanel = value; vm["effectiveHitPanel"] = value; },
"handle": vm["effectiveHitPanel"]}}><Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{t('ac.hitTitle')}</Render>
<Render tag="div" props={{"className": ["mut-note"].filter(Boolean).join(' ')}}>{t('ac.critNeverMiss')}</Render>
{(() => { const __condition54 = vm.effectiveHitBreakdown; const hit = __condition54; return __condition54 ? <><Render tag="div" props={{"className": ["pstats one"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.effectiveCriRate')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", hit.critical, ["1.1-1"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.noCriPart')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", hit.normalOpportunity, ["1.1-1"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.normalHit')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", hit.normal, ["1.1-1"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.noCriHitting')}</Render>
<Render tag="span" props={{}}>{interpolate(["","% × ","% = ","%"], [displayPipe("number", hit.normalOpportunity, ["1.1-1"], services),displayPipe("number", hit.normal, ["1.1-1"], services),displayPipe("number", hit.normalContribution, ["1.1-1"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('ac.effectiveHitTotal')}</Render>
<Render tag="span" props={{"className": ["teal"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", hit.total, ["1.1-1"], services)])}</Render></Render></Render></> : null; })()}</Render>
<Render tag="app-ui-popover" props={{"reference": (value: any) => { critRatePanel = value; vm["critRatePanel"] = value; },
"handle": vm["critRatePanel"]}}><Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{t('skd.critTitle')}</Render>
<Render tag="div" props={{"className": ["graph-hint"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("max-width: 330px")))}}>{t('skd.critNote')}</Render>
{(() => { const __condition55 = vm.critRate; const c = __condition55; return __condition55 ? <><><Render tag="div" props={{"className": ["pstats one tight"].filter(Boolean).join(' ')}}>{(vm.critRateRows ?? []).map((__entry56: any, __index56: number, __array56: any[]) => { const row = __entry56; return <Fragment key={identityKey(vm.trackByCritStep(__index56, __entry56))}><Render tag="div" props={{"className": ["kv",((row.step.kind === "total") ? "total" : ''),((row.step.kind === "subtotal") ? "crit-sub" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{(() => { const __condition57 = (row.step.kind === "add");  return __condition57 ? <><Render tag="span" props={{"className": ["crit-op"].filter(Boolean).join(' ')}}>{"+"}</Render></> : null; })()}
{(() => { const __condition58 = (row.step.kind === "subtract");  return __condition58 ? <><Render tag="span" props={{"className": ["crit-op"].filter(Boolean).join(' ')}}>{"−"}</Render></> : null; })()}
{(() => { const __condition59 = (row.step.kind === "multiply");  return __condition59 ? <><Render tag="span" props={{"className": ["crit-op"].filter(Boolean).join(' ')}}>{"×"}</Render></> : null; })()}
{(() => { const __condition60 = ((row.step.kind === "subtotal") || (row.step.kind === "total"));  return __condition60 ? <><Render tag="span" props={{"className": ["crit-op"].filter(Boolean).join(' ')}}>{"="}</Render></> : null; })()}
{interpolate([" "," "], [row.step.label])}
{(() => { const __condition61 = row.step.detail;  return __condition61 ? <><Render tag="span" props={{"className": ["crit-detail"].filter(Boolean).join(' ')}}>{interpolate(["",""], [row.step.detail])}</Render></> : null; })()}</Render>
<Render tag="span" props={{}}>{(() => { const critPlain = (context: any) => {  return <><Render tag="span" props={{"className": ["v"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.critStepText(row.step,row.step.value)])}</Render></>; }; return <>{(() => { const __condition62 = vm.isCritBreakdownClickable(row.step);  return __condition62 ? <><Render tag="span" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"click": (event: any) => vm.action(() => { const $event = event; vm.openCritBreakdown(row.step) }),
"className": ["v bonus_clickable"].filter(Boolean).join(' '),
"tooltip": {text: t('ac.whichItems'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}>{interpolate(["",""], [vm.critStepText(row.step,row.step.value)])}</Render></> : critPlain({}); })()}

{(() => { const __condition63 = (row.sim !== null);  return __condition63 ? <><><Render tag="span" props={{"className": ["arr"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.critStepText(row.step,row.sim)])}</Render></></> : null; })()}</>; })()}</Render></Render></Fragment>; })}</Render>
{(() => { const __condition64 = c.isCapped;  return __condition64 ? <><Render tag="div" props={{"className": ["mut-note"].filter(Boolean).join(' ')}}>{t('skd.critCapped', { excess: displayPipe("number", (c.total - 100), ["1.0-0"], services) })}</Render></> : null; })()}
{(() => { const __condition65 = vm.activeSource?.isBasic;  return __condition65 ? <><Render tag="div" props={{"className": ["mut-note"].filter(Boolean).join(' ')}}>{t('ac.critScopeNote')}</Render></> : null; })()}</></> : null; })()}</Render></>; })()}</Render></>;
}
