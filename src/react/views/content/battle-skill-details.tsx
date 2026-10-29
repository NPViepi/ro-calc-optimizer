import { Fragment } from 'react';
import { Render, displayPipe, interpolate, parseStyle, normalizeStyle, identityKey } from '../render';
import { sanitizeHtml } from '../../ui/sanitize-html';
import { useRichText, useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
const rich = useRichText();
return <>{(() => { let detailsPanel: any = vm["detailsPanel"];
let critRatePanel: any = vm["critRatePanel"];
let damagePopovers: any = vm["damagePopovers"]; return <><Render tag="app-ui-popover" props={{"styleClass": "rot-details-panel shared-skill-details",
"reference": (value: any) => { detailsPanel = value; vm["detailsPanel"] = value; },
"handle": vm["detailsPanel"]}}>{(() => { const skillDetails = (context: any) => {  return <><Render tag="div" props={{"className": ["cap2 pd-cap"].filter(Boolean).join(' ')}}>{t('skd.damageCap')}</Render>
<Render tag="div" props={{"className": ["pd-dmg"].filter(Boolean).join(' ')}}><Render tag="span" props={{"role": "button",
"tabIndex": "0",
"click": (event: any) => vm.action(() => { const $event = event; vm.openDamage((vm.skillIsCritWeighted ? "cri" : "flat"),$event) }),
"className": ["pd-dmg-val"].filter(Boolean).join(' '),
"activateWithKeys": true}}>{interpolate(["",""], [displayPipe("number", vm.skillDamageMin, ["1.0-0"], services)])}
{(() => { const __condition1 = (vm.skillDamageMax !== vm.skillDamageMin);  return __condition1 ? <><Render tag="span" props={{}}>{interpolate([" – ",""], [displayPipe("number", vm.skillDamageMax, ["1.0-0"], services)])}</Render></> : null; })()}</Render></Render>
{(() => { const __condition2 = vm.skillIsCritWeighted;  return __condition2 ? <><Render tag="div" props={{"className": ["pd-dmg-cap"].filter(Boolean).join(' ')}}>{t('skd.withCrit')}</Render></> : null; })()}
<Render tag="div" props={{"className": ["pstats one tight"].filter(Boolean).join(' ')}}>{(() => { const __condition3 = vm.dmg?.skillCanCri;  return __condition3 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('skd.noCriDamage')}</Render>
<Render tag="span" props={{"role": "button",
"tabIndex": "0",
"click": (event: any) => vm.action(() => { const $event = event; vm.openDamage("nocri",$event) }),
"className": ["v bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true}}>{interpolate(["",""], [displayPipe("number", vm.dmg?.skillMinDamageNoCri, ["1.0-0"], services)])}
{(() => { const __condition4 = (vm.dmg?.skillMaxDamageNoCri !== vm.dmg?.skillMinDamageNoCri);  return __condition4 ? <><>{interpolate([" – ",""], [displayPipe("number", vm.dmg?.skillMaxDamageNoCri, ["1.0-0"], services)])}</></> : null; })()}</Render></Render></> : null; })()}
{(() => { const __condition5 = vm.dmg?.skillCanCri;  return __condition5 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('skd.criRate')}</Render>
<Render tag="span" props={{"role": "button",
"tabIndex": "0",
"click": (event: any) => vm.action(() => { const $event = event; vm.openCrit($event) }),
"className": ["v bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.skillCriRateToMonster, ["1.0-1"], services)])}</Render></Render></> : null; })()}
{(() => { const __condition6 = vm.dmg?.skillCanCri;  return __condition6 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('skd.criDamage')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.skillCriDmgToMonster, ["1.0-1"], services)])}</Render></Render></> : null; })()}</Render>
<Render tag="div" props={{"className": ["cap2 pd-cap"].filter(Boolean).join(' ')}}>{t('skd.skillCap')}</Render>
<Render tag="table" props={{"className": ["ptable"].filter(Boolean).join(' ')}}>{(() => { const __condition7 = vm.isComparing;  return __condition7 ? <><Render tag="thead" props={{}}><Render tag="tr" props={{}}><Render tag="td" props={{"className": ["corner"].filter(Boolean).join(' ')}}></Render>
<Render tag="th" props={{}}>{t('skd.current')}</Render>
<Render tag="th" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{t('skd.simulated')}</Render></Render></Render></> : null; })()}
<Render tag="tbody" props={{}}><Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.skillBase')}</Render>
<Render tag="td" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.calcSkill?.baseSkillDamage, [], services)])}</Render>
{(() => { const __condition8 = vm.isComparing;  return __condition8 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.summary2?.calcSkill?.baseSkillDamage, [], services)])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.skillBonus')}</Render>
<Render tag="td" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.skillBonusFromEquipment, [], services)])}</Render>
{(() => { const __condition9 = vm.isComparing;  return __condition9 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.dmg2?.skillBonusFromEquipment, [], services)])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{interpolate(["",""], [(vm.dmg?.skillTotalPeneLabel || t('skd.pene'))])}</Render>
<Render tag="td" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.skillTotalPene, [], services)])}</Render>
{(() => { const __condition10 = vm.isComparing;  return __condition10 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.dmg2?.skillTotalPene, [], services)])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{interpolate(["",""], [(vm.dmg?.skillTotalPeneResLabel || t('skd.peneRes'))])}</Render>
<Render tag="td" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.skillTotalPeneRes, [], services)])}</Render>
{(() => { const __condition11 = vm.isComparing;  return __condition11 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.dmg2?.skillTotalPeneRes, [], services)])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('combat.aspd')}</Render>
<Render tag="td" props={{}}>{t('skd.hitsPerSecValue', { value: displayPipe("number", vm.summary?.calc?.hitPerSecs, [], services) })}</Render>
{(() => { const __condition12 = vm.isComparing;  return __condition12 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{t('skd.hitsPerSecValue', { value: displayPipe("number", vm.summary2?.calc?.hitPerSecs, [], services) })}</Render></> : null; })()}</Render>
{(() => { const __condition13 = (vm.calcSkill?.dmgType !== "Magical");  return __condition13 ? <><Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.sizePenalty')}</Render>
<Render tag="td" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.skillSizePenalty, [], services)])}</Render>
{(() => { const __condition14 = vm.isComparing;  return __condition14 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.dmg2?.skillSizePenalty, [], services)])}</Render></> : null; })()}</Render></> : null; })()}
{(() => { const __condition15 = (vm.calcSkill?.dmgType !== "Magical");  return __condition15 ? <><Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.hit')}</Render>
<Render tag="td" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.skillAccuracy, [], services)])}</Render>
{(() => { const __condition16 = vm.isComparing;  return __condition16 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.dmg2?.skillAccuracy, [], services)])}</Render></> : null; })()}</Render></> : null; })()}</Render></Render>
{(() => { const __condition17 = vm.calcSkill && !vm.calcSkill.timingUnknown;  return __condition17 ? <><><Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('skd.castDelay')}</Render>
<Render tag="table" props={{"className": ["ptable cast"].filter(Boolean).join(' ')}}><Render tag="thead" props={{}}><Render tag="tr" props={{}}><Render tag="th" props={{}}>{t('skd.level')}</Render>
<Render tag="th" props={{}}>{t('skd.fixedCast')}</Render>
<Render tag="th" props={{}}>{t('skd.variableCast')}</Render>
<Render tag="th" props={{}}>{t('skd.afterCast')}</Render>
<Render tag="th" props={{}}>{t('skd.cooldown')}</Render></Render></Render>
<Render tag="tbody" props={{}}><Render tag="tr" props={{}}><Render tag="th" props={{}}>{interpolate(["",""], [vm.calcSkill?.skillLevel])}</Render>
<Render tag="td" props={{}}>{interpolate(["","s"], [displayPipe("number", vm.calcSkill?.reducedFct, ["1.0-3"], services)])}</Render>
<Render tag="td" props={{}}>{interpolate(["","s"], [displayPipe("number", vm.calcSkill?.reducedVct, ["1.0-3"], services)])}</Render>
<Render tag="td" props={{}}>{interpolate(["","s"], [displayPipe("number", vm.calcSkill?.reducedAcd, ["1.0-3"], services)])}</Render>
<Render tag="td" props={{}}>{interpolate(["","s"], [displayPipe("number", vm.calcSkill?.reducedCd, ["1.0-3"], services)])}</Render></Render></Render></Render>
<Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('skd.castDelayBase')}</Render>
<Render tag="table" props={{"className": ["ptable cast"].filter(Boolean).join(' ')}}><Render tag="thead" props={{}}><Render tag="tr" props={{}}><Render tag="th" props={{}}>{t('skd.level')}</Render>
<Render tag="th" props={{}}>{t('skd.fixedCast')}</Render>
<Render tag="th" props={{}}>{t('skd.variableCast')}</Render>
<Render tag="th" props={{}}>{t('skd.afterCast')}</Render>
<Render tag="th" props={{}}>{t('skd.cooldown')}</Render></Render></Render>
<Render tag="tbody" props={{}}><Render tag="tr" props={{"className": ["base"].filter(Boolean).join(' ')}}><Render tag="th" props={{}}>{interpolate(["",""], [vm.calcSkill?.skillLevel])}</Render>
<Render tag="td" props={{}}>{interpolate(["","s"], [displayPipe("number", vm.calcSkill?.clientFct, ["1.0-3"], services)])}</Render>
<Render tag="td" props={{}}>{interpolate(["","s"], [displayPipe("number", vm.calcSkill?.clientVct, ["1.0-3"], services)])}</Render>
<Render tag="td" props={{}}>{interpolate(["","s"], [displayPipe("number", vm.calcSkill?.clientAcd, ["1.0-3"], services)])}</Render>
<Render tag="td" props={{}}>{interpolate(["","s"], [displayPipe("number", vm.calcSkill?.clientCd, ["1.0-3"], services)])}</Render></Render></Render></Render></></> : null; })()}</>; }; return <>{vm.calcSkill?.timingUnknown && <p className="pd-note">{t('skd.timingUnknown')}</p>}<Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{interpolate(["",""], [t(vm.entry?.isBasic ? 'skd.basicAttack' : 'tl.skillDetails')])}</Render>
{(() => { const __condition18 = vm.entry; const e = __condition18; return __condition18 ? <><Render tag="div" props={{"className": ["pd-head"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": (e.isBasic ? vm.basicAttackIcon : displayPipe("iconUrl", e.icon, ["skill"], services)),
"className": ["pd-icon"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="span" props={{"className": ["pd-name"].filter(Boolean).join(' ')}}>{interpolate(["",""], [e.name])}
{(() => { const __condition19 = e.levelLabel;  return __condition19 ? <><Render tag="span" props={{}}>{interpolate([" ",""], [e.levelLabel])}</Render></> : null; })()}</Render>
{(() => { const __condition20 = !(e.isBasic);  return __condition20 ? <><><Render tag="span" props={{"className": ["pd-sep"].filter(Boolean).join(' ')}}>{"·"}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [e.dmgTypeLabel])}</Render>
{(() => { const __condition21 = e.element;  return __condition21 ? <><><Render tag="span" props={{"className": ["pd-sep"].filter(Boolean).join(' ')}}>{"·"}</Render>
<Render tag="app-ui-tag" props={{"icon": "search",
"tooltipPosition": "top",
"value": displayPipe("monsterTerm", e.element, ["element"], services),
"styleClass": vm.elementTagClass(e.element),
"click": (event: any) => vm.action(() => { const $event = event; vm.elementTableClick.emit() }),
"className": ["el-tag-clickable"].filter(Boolean).join(' '),
"tooltip": {text: t('skd.elementTable'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}></Render></></> : null; })()}
{(() => { const __condition22 = (e.propertyMultiplier != null);  return __condition22 ? <><Render tag="span" props={{}}>{interpolate(["×",""], [displayPipe("number", e.propertyMultiplier, ["1.2-2"], services)])}</Render></> : null; })()}</></> : null; })()}</Render></> : null; })()}
{(() => { const __condition23 = vm.description; const desc = __condition23; return __condition23 ? <><><Render tag="div" props={{"role": "button",
"tabIndex": "0",
"aria-expanded": vm.descriptionExpanded,
"click": (event: any) => vm.action(() => { const $event = event; (vm.descriptionExpanded = !(vm.descriptionExpanded)) }),
"className": ["pd-desc-toggle"].filter(Boolean).join(' '),
"activateWithKeys": true}}><Render tag="app-icon" props={{"name": (vm.descriptionExpanded ? "chevron-down" : "chevron-right")}}></Render>
<Render tag="span" props={{}}>{t('skd.description')}</Render></Render>
{(() => { const __condition24 = vm.descriptionExpanded;  return __condition24 ? <><Render tag="div" props={{"dangerouslySetInnerHTML": {__html: sanitizeHtml(desc ?? '')},
"className": ["pd-desc"].filter(Boolean).join(' ')}}></Render></> : null; })()}</></> : null; })()}
{(() => { const __condition25 = vm.entry?.isBasic;  return __condition25 ? <><><Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('pop.damage')}</Render>
<Render tag="div" props={{"className": ["pstats one tight"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('skd.basic')}</Render>
<Render tag="span" props={{"role": "button",
"tabIndex": "0",
"click": (event: any) => vm.action(() => { const $event = event; vm.openDamage("flat",$event) }),
"className": ["v bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true}}>{interpolate([""," – ",""], [displayPipe("number", vm.dmg?.basicMinDamage, [], services),displayPipe("number", vm.dmg?.basicMaxDamage, [], services)])}
{(() => { const __condition26 = vm.isComparing;  return __condition26 ? <><><Render tag="span" props={{"className": ["arr"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate([""," – ",""], [displayPipe("number", vm.dmg2?.basicMinDamage, [], services),displayPipe("number", vm.dmg2?.basicMaxDamage, [], services)])}</Render></></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('skd.hit')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.accuracy, ["1.0-1"], services)])}
{(() => { const __condition27 = vm.isComparing;  return __condition27 ? <><><Render tag="span" props={{"className": ["arr"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.dmg2?.accuracy, ["1.0-1"], services)])}</Render></></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('skd.criRate')}</Render>
<Render tag="span" props={{"role": "button",
"tabIndex": "0",
"click": (event: any) => vm.action(() => { const $event = event; vm.openCrit($event) }),
"className": ["v bonus_clickable"].filter(Boolean).join(' '),
"activateWithKeys": true}}>{interpolate(["","%"], [displayPipe("number", vm.dmg?.criRateToMonster, ["1.0-1"], services)])}
{(() => { const __condition28 = vm.isComparing;  return __condition28 ? <><><Render tag="span" props={{"className": ["arr"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.dmg2?.criRateToMonster, ["1.0-1"], services)])}</Render></></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('skd.criDamage')}</Render>
<Render tag="span" props={{}}>{interpolate([""," – ",""], [displayPipe("number", vm.dmg?.criMinDamage, [], services),displayPipe("number", vm.dmg?.criMaxDamage, [], services)])}
{(() => { const __condition29 = vm.isComparing;  return __condition29 ? <><><Render tag="span" props={{"className": ["arr"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate([""," – ",""], [displayPipe("number", vm.dmg2?.criMinDamage, [], services),displayPipe("number", vm.dmg2?.criMaxDamage, [], services)])}</Render></></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{"DPS"}</Render>
<Render tag="span" props={{"className": ["teal"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.dmg?.basicDps, ["1.0-0"], services)])}
{(() => { const __condition30 = vm.isComparing;  return __condition30 ? <><><Render tag="span" props={{"className": ["arr"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.dmg2?.basicDps, ["1.0-0"], services)])}</Render></></> : null; })()}</Render></Render></Render></></> : skillDetails({}); })()}

{(() => { const __condition31 = vm.autoCast; const a = __condition31; return __condition31 ? <><><Render tag="div" props={{"className": ["cap2 pd-cap"].filter(Boolean).join(' ')}}>{t('skd.autoCastCap')}</Render>
<Render tag="table" props={{"className": ["ptable"].filter(Boolean).join(' ')}}>{(() => { const __condition32 = vm.autoCast2;  return __condition32 ? <><Render tag="thead" props={{}}><Render tag="tr" props={{}}><Render tag="td" props={{"className": ["corner"].filter(Boolean).join(' ')}}></Render>
<Render tag="th" props={{}}>{t('skd.current')}</Render>
<Render tag="th" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{t('calc.sideCompare')}</Render></Render></Render></> : null; })()}
<Render tag="tbody" props={{}}><Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.source')}</Render>
<Render tag="td" props={{}}>{interpolate(["",""], [a.sourceName])}</Render>
{(() => { const __condition33 = vm.autoCast2;  return __condition33 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.autoCast2.sourceName])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.trigger')}</Render>
<Render tag="td" props={{}}>{interpolate(["",""], [a.triggerLabel])}</Render>
{(() => { const __condition34 = vm.autoCast2;  return __condition34 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.autoCast2.triggerLabel])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.chance')}</Render>
<Render tag="td" props={{}}>{interpolate(["","%"], [displayPipe("number", a.chance, ["1.1-1"], services)])}</Render>
{(() => { const __condition35 = vm.autoCast2;  return __condition35 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.autoCast2.chance, ["1.1-1"], services)])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.activationsPerSec')}</Render>
<Render tag="td" props={{}}>{interpolate(["",""], [displayPipe("number", a.activationsPerSecond, ["1.2-2"], services)])}</Render>
{(() => { const __condition36 = vm.autoCast2;  return __condition36 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.autoCast2.activationsPerSecond, ["1.2-2"], services)])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.expectedPerActivation')}</Render>
<Render tag="td" props={{}}>{interpolate(["",""], [displayPipe("number", a.expectedDamagePerActivation, ["1.0-0"], services)])}</Render>
{(() => { const __condition37 = vm.autoCast2;  return __condition37 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.autoCast2.expectedDamagePerActivation, ["1.0-0"], services)])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{"DPS"}</Render>
<Render tag="td" props={{}}>{interpolate(["",""], [displayPipe("number", a.dps, ["1.0-0"], services)])}</Render>
{(() => { const __condition38 = vm.autoCast2;  return __condition38 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", vm.autoCast2.dps, ["1.0-0"], services)])}</Render></> : null; })()}</Render>
<Render tag="tr" props={{}}><Render tag="th" props={{"scope": "row"}}>{t('skd.contribution')}</Render>
<Render tag="td" props={{}}>{interpolate(["","%"], [displayPipe("number", a.contribution, ["1.1-1"], services)])}</Render>
{(() => { const __condition39 = vm.autoCast2;  return __condition39 ? <><Render tag="td" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", vm.autoCast2.contribution, ["1.1-1"], services)])}</Render></> : null; })()}</Render></Render></Render></></> : null; })()}
{(() => { const __condition40 = vm.optimizeInfo; const info = __condition40; return __condition40 ? <><><Render tag="div" props={{"className": ["cap2 pd-cap"].filter(Boolean).join(' ')}}>{t('skd.optimizeCap')}</Render>
<Render tag="div" props={{"className": ["optimize-bottleneck",(info.isOptimized ? "is-optimized" : '')].filter(Boolean).join(' ')}}>{interpolate(["",""], [info.headline])}</Render>
{(info.components ?? []).map((__entry41: any, __index41: number, __array41: any[]) => { const c = __entry41; return <Fragment key={identityKey(__entry41)}><Render tag="div" props={{"className": ["optimize-component",((!(info.isOptimized) && (c.key === info.bottleneck)) ? "is-bottleneck" : '')].filter(Boolean).join(' ')}}>{(() => { const optimizeHint = (context: any) => {  return <>{interpolate(["",""], [c.hint])}</>; }; return <><Render tag="b" props={{}}>{interpolate(["",""], [c.label])}
{(() => { const __condition42 = !(c.hideSeconds);  return __condition42 ? <><Render tag="span" props={{}}>{interpolate([" ","s"], [displayPipe("number", c.seconds, ["1.0-3"], services)])}</Render></> : null; })()}</Render>
{" — "}
{(() => { const __condition43 = c.doneText;  return __condition43 ? <><Render tag="span" props={{"className": ["optimize-done"].filter(Boolean).join(' ')}}>{interpolate(["",""], [c.doneText])}</Render></> : optimizeHint({}); })()}
</>; })()}</Render></Fragment>; })}
{(() => { const __condition44 = info.whatIf; const w = __condition44; return __condition44 ? <><Render tag="div" props={{"className": ["optimize-whatif"].filter(Boolean).join(' ')}}>{rich('skd.whatIf', { dps: displayPipe("number", w.newDps, ["1.0-0"], services), gain: ((w.gainPercent >= 0) ? "+" : "") + displayPipe("number", w.gainPercent, ["1.0-1"], services) })}</Render></> : null; })()}</></> : null; })()}</>; })()}</Render>
<Render tag="app-ui-popover" props={{"reference": (value: any) => { critRatePanel = value; vm["critRatePanel"] = value; },
"handle": vm["critRatePanel"]}}><Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{t('skd.critTitle')}</Render>
<Render tag="div" props={{"className": ["graph-hint"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("max-width: 330px")))}}>{t('skd.critNote')}</Render>
{(() => { const __condition45 = vm.critRate; const c = __condition45; return __condition45 ? <><><Render tag="div" props={{"className": ["pstats one tight"].filter(Boolean).join(' ')}}>{(vm.critRateRows ?? []).map((__entry46: any, __index46: number, __array46: any[]) => { const row = __entry46; return <Fragment key={identityKey(vm.trackByCritStep(__index46, __entry46))}><Render tag="div" props={{"className": ["kv",((row.step.kind === "total") ? "total" : ''),((row.step.kind === "subtotal") ? "crit-sub" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{(() => { const __condition47 = (row.step.kind === "add");  return __condition47 ? <><Render tag="span" props={{"className": ["crit-op"].filter(Boolean).join(' ')}}>{"+"}</Render></> : null; })()}
{(() => { const __condition48 = (row.step.kind === "subtract");  return __condition48 ? <><Render tag="span" props={{"className": ["crit-op"].filter(Boolean).join(' ')}}>{"−"}</Render></> : null; })()}
{(() => { const __condition49 = (row.step.kind === "multiply");  return __condition49 ? <><Render tag="span" props={{"className": ["crit-op"].filter(Boolean).join(' ')}}>{"×"}</Render></> : null; })()}
{(() => { const __condition50 = ((row.step.kind === "subtotal") || (row.step.kind === "total"));  return __condition50 ? <><Render tag="span" props={{"className": ["crit-op"].filter(Boolean).join(' ')}}>{"="}</Render></> : null; })()}
{interpolate([" ",""], [row.step.label])}
{(() => { const __condition51 = row.step.detail;  return __condition51 ? <><Render tag="span" props={{"className": ["crit-detail"].filter(Boolean).join(' ')}}>{interpolate(["",""], [row.step.detail])}</Render></> : null; })()}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; vm.openCritBreakdown(row.step) }),
"className": ["v",(row.step.keys?.length ? "bonus_clickable" : '')].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.critStepText(row.step,row.step.value)])}</Render></Render></Fragment>; })}</Render>
{(() => { const __condition52 = c.isCapped;  return __condition52 ? <><Render tag="div" props={{"className": ["mut-note"].filter(Boolean).join(' ')}}>{t('skd.critCapped', { excess: displayPipe("number", (c.total - 100), ["1.0-0"], services) })}</Render></> : null; })()}</></> : null; })()}</Render>
<Render tag="app-battle-damage-popovers" props={{"breakdownClick": (event: any) => vm.action(() => { const $event = event; vm.breakdownClick.emit($event) }),
"reference": (value: any) => { damagePopovers = value; vm["damagePopovers"] = value; }}}></Render></>; })()}</>;
}
