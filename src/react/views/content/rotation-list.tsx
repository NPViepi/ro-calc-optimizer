import { Fragment } from 'react';
import { SkillFormulaSelector } from '../../ui/skill-formula-selector';
import { Render, displayPipe, interpolate, classNames, identityKey } from '../render';
import { useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
return <><Render tag="div" props={{"className": ["rot"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["rot-head"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["cap2"].filter(Boolean).join(' ')}}>{t('rot.cap')}
{(() => { const __condition1 = vm.rotation.length;  return __condition1 ? <><>{interpolate([" · ",""], [t((vm.rotation.length === 1) ? 'rot.oneSkill' : 'rot.manySkills', { n: vm.rotation.length })])}</></> : null; })()}</Render>
<Render tag="span" props={{"className": ["rot-head-actions"].filter(Boolean).join(' ')}}><SkillFormulaSelector value={vm.skillFormulaVersion} disabled={vm.isInProcessingPreset} onChange={value => vm.action(() => vm.skillFormulaVersionChange.emit(value))} /><Render tag="button" props={{"type": "button",
"icon": "trash",
"label": t('calc.clear'),
"tooltipPosition": "top",
"disabled": (!(vm.entries.length) || vm.isInProcessingPreset),
"click": (event: any) => vm.action(() => { const $event = event; vm.clearClick.emit() }),
"className": ["rot-clear"].filter(Boolean).join(' '),
"tooltip": {text: t('rot.clearTooltip'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "sort-alt",
"label": t('rot.optimize'),
"tooltipPosition": "top",
"disabled": !(vm.canOptimize),
"click": (event: any) => vm.action(() => { const $event = event; vm.optimizeClick.emit() }),
"className": ["rot-optimize"].filter(Boolean).join(' '),
"tooltip": {text: t('rot.optimizeTooltip'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render></Render></Render>
{(() => { const __condition2 = (!(vm.entries.length) && (vm.addingAt === null));  return __condition2 ? <><Render tag="div" props={{"className": ["rot-empty"].filter(Boolean).join(' ')}}><Render tag="p" props={{"className": ["rot-empty-text"].filter(Boolean).join(' ')}}>{t('rot.empty')}</Render>
<Render tag="button" props={{"type": "button",
"label": t('rot.addSkill'),
"icon": "plus",
"click": (event: any) => vm.action(() => { const $event = event; vm.startAdding() }),
"button": true}}></Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["rot-rows"].filter(Boolean).join(' ')}}>{(vm.entries ?? []).map((__entry3: any, __index3: number, __array3: any[]) => { const entry = __entry3;
const i = __index3; return <Fragment key={identityKey(vm.trackByIndex(__index3, __entry3))}><Render tag="div" props={{"className": ["rot-row"].filter(Boolean).join(' ')}}>{(() => { const skillIcon = (context: any) => {  return <><Render tag="img" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"src": displayPipe("iconUrl", entry.icon, ["skill"], services),
"alt": entry.name,
"click": (event: any) => vm.action(() => { const $event = event; vm.detailsClick.emit({"index": i,"event": $event}) }),
"className": ["rot-icon rot-icon--btn"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"missingIcon": true}}></Render></>; }; return <><Render tag="app-icon" props={{"role": "button",
"name": "bars",
"tabIndex": ((vm.entries.length > 1) ? 0 : null),
"label": t('rot.reorderLabel', { name: entry.name }),
"reordered": (event: any) => vm.action(() => { const $event = event; vm.onDrop($event) }),
"keydown": (event: any) => vm.action(() => { const $event = event; if (event.key?.toLowerCase() === "arrowup") { vm.moveBy(i,-(1),$event) };if (event.key?.toLowerCase() === "arrowdown") { vm.moveBy(i,1,$event) } }),
"className": ["rot-handle",((vm.entries.length < 2) ? "rot-handle--idle" : '')].filter(Boolean).join(' '),
"reorderIndex": i,
"reorderDisabled": (vm.entries.length < 2)}}></Render>
<Render tag="span" props={{"className": ["rot-step"].filter(Boolean).join(' ')}}>{interpolate(["",""], [(i + 1)])}</Render>
{(() => { const __condition4 = entry.isBasic;  return __condition4 ? <><Render tag="img" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"src": vm.basicAttackIcon,
"alt": entry.name,
"click": (event: any) => vm.action(() => { const $event = event; vm.detailsClick.emit({"index": i,"event": $event}) }),
"className": ["rot-icon rot-icon--btn"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}></Render></> : skillIcon({}); })()}

<Render tag="div" props={{"className": ["rot-body"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["rot-line1"].filter(Boolean).join(' ')}}>{(() => { const levelText = (context: any) => {  return <>{(() => { const __condition5 = entry.levelLabel;  return __condition5 ? <><Render tag="span" props={{"className": ["rot-level rot-level--static"].filter(Boolean).join(' ')}}>{interpolate(["",""], [entry.levelLabel])}</Render></> : null; })()}</>; }; return <><Render tag="span" props={{"tooltipPosition": "top",
"className": ["rot-name"].filter(Boolean).join(' '),
"tooltip": {text: entry.name, position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}>{interpolate(["",""], [entry.name])}</Render>
{(() => { const __condition6 = (entry.levelList.length > 1);  return __condition6 ? <><Render tag="app-ui-dropdown" props={{"styleClass": "rot-level-dd",
"optionLabel": "label",
"optionValue": "value",
"options": entry.levelList,
"value": entry.value,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.changeLevel(i,$event.value) }))({value, originalEvent: event}); }),
"template_selectedItem": (context: any) => {  return <><Render tag="span" props={{"className": ["rot-level"].filter(Boolean).join(' ')}}>{interpolate(["",""], [entry.levelLabel])}</Render></>; }}}></Render></> : levelText({}); })()}

{(() => { const __condition7 = entry.stackOptions.length;  return __condition7 ? <><Render tag="div" props={{"className": ["rot-stack"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('rot.stack')}</Render>
<Render tag="app-ui-dropdown" props={{"styleClass": "rot-stack-dd",
"optionLabel": "label",
"optionValue": "value",
"options": entry.stackOptions,
"value": entry.stackCount,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.stackChange.emit({"index": entry.index,"stack": $event.value}) }))({value, originalEvent: event}); })}}></Render></Render></> : null; })()}
{(() => { const __condition8 = (entry.occurrence > 0);  return __condition8 ? <><Render tag="span" props={{"className": ["rot-repeat"].filter(Boolean).join(' ')}}>{t('rot.occurrence', { n: entry.occurrence + 1 })}</Render></> : null; })()}</>; })()}</Render>
<Render tag="div" props={{"className": ["rot-line2"].filter(Boolean).join(' ')}}>{(() => { const __conditionND1 = entry.showsDamage;  return __conditionND1 ? <><Render tag="span" props={{}}>{interpolate(["",""], [entry.dmgTypeLabel])}</Render>
<Render tag="app-ui-tag" props={{"icon": "search",
"tooltipPosition": "top",
"value": displayPipe("monsterTerm", entry.element, ["element"], services),
"styleClass": vm.elementTagClass(entry.element),
"click": (event: any) => vm.action(() => { const $event = event; (vm.isInProcessingPreset ? null : vm.elementTableClick.emit()) }),
"className": ["el-tag-clickable"].filter(Boolean).join(' '),
"tooltip": {text: t('skd.elementTable'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}></Render>
<Render tag="span" props={{"className": ["rot-mult"].filter(Boolean).join(' ')}}>{interpolate(["×",""], [displayPipe("number", entry.propertyMultiplier, ["1.2-2"], services)])}</Render>
{(() => { const __condition9 = entry.canCrit;  return __condition9 ? <><Render tag="span" props={{"className": ["rot-crit"].filter(Boolean).join(' ')}}>{' '}{t('rot.critLabel')}{' '}
<Render tag="b" props={{"tabIndex": "0",
"role": "button",
"click": (event: any) => vm.action(() => { const $event = event; vm.critBreakdownClick.emit({"index": i,"event": $event}) }),
"className": ["rot-crit-val bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true}}>{interpolate(["","%"], [displayPipe("number", entry.critRate, ["1.1-1"], services)])}</Render>
{(() => { const __condition10 = entry.critConditional;  return __condition10 ? <><Render tag="span" props={{"tooltipPosition": "top",
"className": ["rot-crit-cond"].filter(Boolean).join(' '),
"tooltip": {text: t('rot.critConditional'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}>{"*"}</Render></> : null; })()}
{(() => { const __condition11 = vm.compareOf(i); const sim = __condition11; return __condition11 ? <><>{(() => { const __condition12 = (sim.critRate !== entry.critRate);  return __condition12 ? <><><Render tag="span" props={{"className": ["rot-arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"tabIndex": "0",
"role": "button",
"click": (event: any) => vm.action(() => { const $event = event; vm.critBreakdownClick.emit({"index": i,"event": $event}) }),
"className": ["rot-crit-sim bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true}}>{interpolate(["","%"], [displayPipe("number", sim.critRate, ["1.1-1"], services)])}</Render></></> : null; })()}</></> : null; })()}</Render></> : null; })()}
{(() => { const __condition13 = (!(entry.canCrit) && !(entry.isMagic));  return __condition13 ? <><Render tag="span" props={{"className": ["rot-crit rot-crit--none"].filter(Boolean).join(' ')}}>{t('rot.noCrit')}</Render></> : null; })()}</> : (entry.requireTxt ? null : <Render tag="span" props={{"className": ["rot-nodmg"].filter(Boolean).join(' ')}}>{t('rot.noDamage')}</Render>); })()}
{(() => { const __condition14 = entry.requireTxt;  return __condition14 ? <><Render tag="span" props={{"className": ["rot-require"].filter(Boolean).join(' ')}}>{t('rot.requires', { what: entry.requireTxt })}</Render></> : null; })()}</Render>
{(() => { const __condition15 = entry.stalled;  return __condition15 ? <><Render tag="div" props={{"className": ["rot-stall"].filter(Boolean).join(' ')}}>{t('rot.stalled', { seconds: displayPipe("number", entry.lane.cdWait, ["1.2-2"], services) })}</Render></> : null; })()}</Render>
{(() => { const __conditionND2 = entry.showsDamage;  return __conditionND2 ? <><Render tag="span" props={{"className": ["rot-dmg"].filter(Boolean).join(' ')}}>{(() => { const __condition16 = entry.hasDamageSpread;  return __condition16 ? <><Render tag="span" props={{"className": ["rot-dmg-split"].filter(Boolean).join(' ')}}>{(entry.damageRanges ?? []).map((__entry17: any, __index17: number, __array17: any[]) => { const range = __entry17; return <Fragment key={identityKey(__entry17)}><><Render tag="span" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"tooltipStyleClass": "auto_cast_tip",
"click": (event: any) => vm.action(() => { const $event = event; vm.damageClick.emit({"index": i,"event": $event,"branch": range.kind}) }),
"className": ["rot-dmg-branch"].filter(Boolean).join(' '),
"tooltip": {text: t('rot.howDamage'), position: "top", className: "auto_cast_tip", showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}>{interpolate(["",""], [displayPipe("number", range.min, ["1.0-0"], services)])}
{(() => { const __condition18 = (range.max !== range.min);  return __condition18 ? <><>{interpolate([" – ",""], [displayPipe("number", range.max, ["1.0-0"], services)])}</></> : null; })()}</Render>
<Render tag="span" props={{"tooltipPosition": "top",
"className": ["rot-tag rot-tag--sm",classNames(("rot-tag--" + range.kind))].filter(Boolean).join(' '),
"tooltip": {text: vm.rangeTagTooltip(range), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}>{interpolate(["",""], [range.label])}</Render></></Fragment>; })}</Render></> : null; })()}
<Render tag="span" props={{"className": ["rot-dmg-main"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["rot-dmg-figs"].filter(Boolean).join(' ')}}><Render tag="span" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"click": (event: any) => vm.action(() => { const $event = event; vm.damageClick.emit({"index": i,"event": $event,"branch": "mean"}) }),
"className": ["rot-dmg-val"].filter(Boolean).join(' '),
"tooltip": {text: vm.damageTooltip(entry), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}>{interpolate(["",""], [displayPipe("number", entry.damage, ["1.0-0"], services)])}</Render>
{(() => { const __condition19 = vm.compareOf(i); const sim = __condition19; return __condition19 ? <><>{(() => { const __condition20 = (sim.damage !== entry.damage);  return __condition20 ? <><Render tag="span" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"click": (event: any) => vm.action(() => { const $event = event; vm.damageClick.emit({"index": i,"event": $event,"branch": "mean"}) }),
"className": ["rot-dmg-sim"].filter(Boolean).join(' '),
"tooltip": {text: vm.compareDamageTooltip(entry), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}>{interpolate(["",""], [displayPipe("number", sim.damage, ["1.0-0"], services)])}</Render></> : null; })()}</></> : null; })()}</Render>
<Render tag="span" props={{"className": ["rot-dmg-meta"].filter(Boolean).join(' ')}}>{(() => { const __condition21 = entry.hasDamageSpread;  return __condition21 ? <><Render tag="span" props={{"tooltipPosition": "top",
"className": ["rot-tag rot-tag--mean"].filter(Boolean).join(' '),
"tooltip": {text: vm.meanTagTooltip(entry), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}>{t('rot.mean')}</Render></> : null; })()}
{(() => { const __condition22 = vm.showsContribution;  return __condition22 ? <><><Render tag="span" props={{"className": ["rot-sep"].filter(Boolean).join(' ')}}>{"·"}</Render>
<Render tag="span" props={{"tooltipPosition": "top",
"className": ["rot-pct"].filter(Boolean).join(' '),
"tooltip": {text: vm.contributionTooltip(entry), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}>{interpolate(["","%"], [displayPipe("number", entry.contributionPercent, ["1.1-1"], services)])}</Render></></> : null; })()}</Render></Render></Render></> : null; })()}
<Render tag="app-icon" props={{"role": "button",
"tabIndex": "0",
"label": t('tl.skillDetails'),
"tooltipPosition": "top",
"name": "info-circle",
"click": (event: any) => vm.action(() => { const $event = event; vm.detailsClick.emit({"index": i,"event": $event}) }),
"className": ["rot-info"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}></Render>
<Render tag="app-icon" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"name": "times",
"label": t('rot.removeLabel', { name: entry.name }),
"click": (event: any) => vm.action(() => { const $event = event; vm.remove(i) }),
"className": ["rot-remove"].filter(Boolean).join(' '),
"tooltip": {text: t('eq.remove'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}></Render>
{/* The drag handle's tap equivalent: touch screens show these instead of asking for a drag. */}
{(() => { const __conditionMove = vm.entries.length > 1;  return __conditionMove ? <><Render tag="button" props={{"type": "button",
"aria-label": t('rot.moveUp', { name: entry.name }),
"disabled": i === 0,
"click": (event: any) => vm.action(() => { const $event = event; vm.moveBy(i,-(1),$event) }),
"className": ["rot-move"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "chevron-up"}}></Render></Render>
<Render tag="button" props={{"type": "button",
"aria-label": t('rot.moveDown', { name: entry.name }),
"disabled": i === vm.entries.length - 1,
"click": (event: any) => vm.action(() => { const $event = event; vm.moveBy(i,1,$event) }),
"className": ["rot-move"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "chevron-down"}}></Render></Render></> : null; })()}</>; })()}</Render></Fragment>; })}</Render>
{(() => { const __condition23 = (vm.addingAt !== null);  return __condition23 ? <><Render tag="div" props={{"className": ["rot-row rot-row--adding"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"aria-hidden": "true",
"name": "bars",
"className": ["rot-handle rot-handle--spacer"].filter(Boolean).join(' ')}}></Render>
<Render tag="span" props={{"className": ["rot-step"].filter(Boolean).join(' ')}}>{interpolate(["",""], [(vm.addingAt + 1)])}</Render>
<Render tag="app-ui-dropdown" props={{"styleClass": "rot-add-dd",
"panelStyleClass": "rot-add-dd-panel",
"optionLabel": "label",
"optionValue": "value",
"filterBy": "label,value",
"filterPlaceholder": t('rot.searchPlaceholder'),
"placeholder": t('rot.skillPlaceholder'),
"options": vm.skillOptions,
"filter": true,
"autoFocus": true,
"closed": (event: any) => vm.action(() => { const $event = event; (vm.pendingValue ? null : vm.cancelAdding()) }),
"value": vm.pendingValue,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.commitAdding($event.value) }))({value, originalEvent: event}); }),
"template_item": (context: any) => { const option = context["$implicit"]; return <><Render tag="div" props={{"className": ["rot-opt"].filter(Boolean).join(' ')}}>{(() => { const __condition24 = option.isBasic;  return __condition24 ? <><Render tag="img" props={{"alt": "",
"aria-hidden": "true",
"src": vm.basicAttackIcon,
"className": ["rot-icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
{(() => { const __condition25 = !(option.isBasic);  return __condition25 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", option.icon, ["skill"], services),
"className": ["rot-icon"].filter(Boolean).join(' '),
"missingIcon": true}}></Render></> : null; })()}
<Render tag="span" props={{}}>{interpolate(["",""], [option.label])}</Render>
{(() => { const __condition26 = vm.isInRotation(option.value);  return __condition26 ? <><Render tag="span" props={{"className": ["rot-opt-flag"].filter(Boolean).join(' ')}}>{t('rot.inRotation')}</Render></> : null; })()}</Render></>; }}}></Render>
<Render tag="app-icon" props={{"role": "button",
"tabIndex": "0",
"label": t('calc.cancel'),
"name": "times",
"click": (event: any) => vm.action(() => { const $event = event; vm.cancelAdding() }),
"className": ["rot-remove"].filter(Boolean).join(' '),
"activateWithKeys": true}}></Render></Render></> : null; })()}
{(() => { const __condition27 = (vm.entries.length && (vm.addingAt === null));  return __condition27 ? <><Render tag="div" props={{"className": ["rot-addline"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"icon": "plus",
"label": t('rot.addSkill'),
"tooltipPosition": "top",
"disabled": vm.isFull,
"click": (event: any) => vm.action(() => { const $event = event; vm.startAdding() }),
"className": ["rot-add"].filter(Boolean).join(' '),
"tooltip": {text: (vm.isFull ? t('rot.full', { max: vm.maxLength }) : t('rot.repeatHint')), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render>{vm.isFull && <span className="rot-full-note">{t('rot.full', { max: vm.maxLength })}</span>}</Render></> : null; })()}
<Render tag="span" props={{"aria-live": "polite",
"className": ["sr-only"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.moveAnnouncement])}</Render></Render></>;
}
