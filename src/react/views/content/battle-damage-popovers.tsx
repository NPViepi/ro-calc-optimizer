import { Fragment } from 'react';
import { Render, displayPipe, interpolate, parseStyle, normalizeStyle, identityKey } from '../render';
import { useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
return <>{(() => { const graphCluster = (context: any) => { const c = context["c"];
const sim = context["sim"]; return <><Render tag="div" props={{"className": ["graph-col"].filter(Boolean).join(' ')}}>{(() => { const __condition1 = c.inputs.length;  return __condition1 ? <><Render tag="div" props={{"className": ["graph-inputs"].filter(Boolean).join(' ')}}>{(c.inputs ?? []).map((__entry2: any, __index2: number, __array2: any[]) => { const inp = __entry2; return <Fragment key={identityKey(__entry2)}><Render tag="div" props={{"pointerdown": (event: any) => vm.action(() => { const $event = event; vm.openFormulaDetailOnPointerDown(inp,!(!(sim)),$event) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.openFormulaNode(inp,!(!(sim))) }),
"className": ["graph-input",(vm.isNodeClickable(inp) ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"activateWithKeys": vm.isNodeClickable(inp)}}><Render tag="span" props={{}}>{interpolate(["",""], [inp.label])}</Render>
<Render tag="span" props={{"className": [(sim ? "sim" : '')].filter(Boolean).join(' ')}}>{interpolate(["","","",""], [((inp.showSign && (inp.value > 0)) ? "+" : ""),displayPipe("number", inp.value, [], services),((inp.unit === "percent") ? "%" : "")])}</Render></Render></Fragment>; })}</Render></> : null; })()}
<Render tag="div" props={{"pointerdown": (event: any) => vm.action(() => { const $event = event; vm.openFormulaDetailOnPointerDown(c.stage,!(!(sim)),$event) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.openFormulaNode(c.stage,!(!(sim))) }),
"className": ["graph-stage",(vm.isNodeClickable(c.stage) ? "bonus_clickable" : '')].filter(Boolean).join(' '),
"activateWithKeys": vm.isNodeClickable(c.stage)}}><Render tag="span" props={{}}>{interpolate(["",""], [c.stage.label])}</Render>
<Render tag="span" props={{"className": [(sim ? "sim" : '')].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", c.stage.value, [], services)])}</Render></Render></Render></>; };
const graphRow = (context: any) => { const clusters = context["clusters"];
const sim = context["sim"]; return <><Render tag="div" props={{"className": ["graph-row"].filter(Boolean).join(' ')}}>{(clusters ?? []).map((__entry3: any, __index3: number, __array3: any[]) => { const c = __entry3;
const last = __index3 === __array3.length - 1; return <Fragment key={identityKey(__entry3)}><>{graphCluster({"c": c,"sim": sim})}
{(() => { const __condition4 = !(last);  return __condition4 ? <><Render tag="div" props={{"className": ["graph-arrow"].filter(Boolean).join(' ')}}>{"→"}</Render></> : null; })()}</></Fragment>; })}</Render></>; };
const formulaBranch = (context: any) => { const graph = context["graph"];
const graph2 = context["graph2"];
const flat = context["flat"];
const compare = context["compare"]; return <>{(() => { const flatBranch = (context: any) => {  return <><Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('pop.damage')}</Render>
{graphRow({"clusters": graph.max,"sim": compare})}
{(() => { const __condition5 = (vm.isComparing && graph2?.max?.length);  return __condition5 ? <><><Render tag="div" props={{"className": ["cmp-castbar-label"].filter(Boolean).join(' ')}}>{t('pop.compare')}</Render>
{graphRow({"clusters": graph2.max,"sim": true})}</></> : null; })()}</>; }; return <>{(() => { const __condition6 = !(flat);  return __condition6 ? <><><Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('pop.minDamage')}</Render>
{graphRow({"clusters": graph.min,"sim": compare})}
{(() => { const __condition7 = (vm.isComparing && graph2?.min?.length);  return __condition7 ? <><><Render tag="div" props={{"className": ["cmp-castbar-label"].filter(Boolean).join(' ')}}>{t('pop.compare')}</Render>
{graphRow({"clusters": graph2.min,"sim": true})}</></> : null; })()}
<Render tag="div" props={{"className": ["psec"].filter(Boolean).join(' ')}}>{t('pop.maxDamage')}</Render>
{graphRow({"clusters": graph.max,"sim": compare})}
{(() => { const __condition8 = (vm.isComparing && graph2?.max?.length);  return __condition8 ? <><><Render tag="div" props={{"className": ["cmp-castbar-label"].filter(Boolean).join(' ')}}>{t('pop.compare')}</Render>
{graphRow({"clusters": graph2.max,"sim": true})}</></> : null; })()}</></> : flatBranch({}); })()}
</>; })()}</>; };
let formulaPanel: any = vm["formulaPanel"];
let noCriPanel: any = vm["noCriPanel"];
let meanPanel: any = vm["meanPanel"];
let basicPanel: any = vm["basicPanel"]; return <>


<Render tag="app-ui-popover" props={{"reference": (value: any) => { formulaPanel = value; vm["formulaPanel"] = value; },
"handle": vm["formulaPanel"]}}>{(() => { const combinedFormula = (context: any) => {  return <>{(() => { const noFormula = (context: any) => {  return <><Render tag="div" props={{"className": ["mut-note"].filter(Boolean).join(' ')}}>{t('pop.noFormula')}</Render></>; }; return <><Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{t('pop.howDamage')}</Render>
<Render tag="div" props={{"className": ["graph-hint"].filter(Boolean).join(' ')}}>{t('pop.clickHint')}</Render>
{(() => { const __condition9 = vm.formulaGraph; const graph = __condition9; return __condition9 ? <><><Render tag="div" props={{"className": ["formula-trace-scroll"].filter(Boolean).join(' ')}}>{formulaBranch({"graph": graph,"graph2": vm.formulaGraph2,"flat": vm.damageIsFlat})}</Render></></> : noFormula({}); })()}
</>; })()}</>; }; return <>{(() => { const __condition10 = vm.formulaPart; const part = __condition10; return __condition10 ? <><><Render tag="button" props={{"type": "button",
"click": (event: any) => vm.action(() => { const $event = event; vm.closeFormulaPart() }),
"className": ["graph-back"].filter(Boolean).join(' ')}}>{t('pop.back')}</Render>
<Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{interpolate(["",""], [part.label])}</Render>
<Render tag="div" props={{"className": ["graph-hint"].filter(Boolean).join(' ')}}>{t('pop.clickHint')}</Render>
{(() => { const __condition11 = (part.hits > 1);  return __condition11 ? <><Render tag="div" props={{"className": ["mut-note"].filter(Boolean).join(' ')}}>{t('pop.hitsTotal', { hits: part.hits, damage: displayPipe("number", part.min, [], services) + ((part.max !== part.min) ? ' – ' + displayPipe("number", part.max, [], services) : '') })}</Render></> : null; })()}
<Render tag="div" props={{"className": ["formula-trace-scroll"].filter(Boolean).join(' ')}}>{formulaBranch({"graph": part.graph,"flat": (part.min === part.max),"compare": part.compare})}</Render></></> : combinedFormula({}); })()}
</>; })()}</Render>
<Render tag="app-ui-popover" props={{"reference": (value: any) => { noCriPanel = value; vm["noCriPanel"] = value; },
"handle": vm["noCriPanel"]}}>{(() => { const noNoCriFormula = (context: any) => {  return <><Render tag="div" props={{"className": ["mut-note"].filter(Boolean).join(' ')}}>{t('pop.noFormula')}</Render></>; }; return <><Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{t('pop.howNoCri')}</Render>
<Render tag="div" props={{"className": ["graph-hint"].filter(Boolean).join(' ')}}>{t('pop.clickHint')}</Render>
{(() => { const __condition13 = vm.noCriGraph; const graph = __condition13; return __condition13 ? <><><Render tag="div" props={{"className": ["formula-trace-scroll"].filter(Boolean).join(' ')}}>{formulaBranch({"graph": graph,"graph2": vm.noCriGraph2,"flat": vm.noCriIsFlat})}</Render></></> : noNoCriFormula({}); })()}
</>; })()}</Render>
<Render tag="app-ui-popover" props={{"reference": (value: any) => { meanPanel = value; vm["meanPanel"] = value; },
"handle": vm["meanPanel"]}}><Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.meanTitle])}</Render>
<Render tag="div" props={{"className": ["graph-hint"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("max-width: 320px")))}}>{t('pop.meanNote')}</Render>
{(() => { const __condition14 = vm.mean; const m = __condition14; return __condition14 ? <><><Render tag="div" props={{"className": ["pstats one tight"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [t(vm.weightedCrit ? 'pop.noCriMeanRow' : 'pop.meanRow')])}</Render>
<Render tag="span" props={{"className": ["v"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", m.avgBasicDamage, ["1.0-0"], services)])}</Render></Render>
{(() => { const __condition15 = vm.weightedCrit;  return __condition15 ? <><><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.criDamage')}</Render>
<Render tag="span" props={{"className": ["v"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", m.criDmg, ["1.0-0"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.criRate')}</Render>
<Render tag="span" props={{"className": ["v"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", m.criRate, ["1.0-1"], services)])}</Render></Render></></> : null; })()}
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [t(vm.weightedCrit ? 'pop.accuracyNoCri' : 'pop.accuracy')])}</Render>
<Render tag="span" props={{"className": ["v"].filter(Boolean).join(' ')}}>{interpolate(["","%"], [displayPipe("number", m.accuracy, ["1.0-1"], services)])}</Render></Render></Render>
<Render tag="div" props={{"className": ["pstats one"].filter(Boolean).join(' ')}}>{(() => { const plainMean = (context: any) => {  return <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.timesAccuracy')}</Render>
<Render tag="span" props={{}}>{interpolate(["","%"], [displayPipe("number", m.accuracy, ["1.0-1"], services)])}</Render></Render></>; }; return <>{(() => { const __condition16 = vm.weightedCrit;  return __condition16 ? <><><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.criPart')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", m.criPart, ["1.0-0"], services)])}</Render></Render>
<Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.noCriPart')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [displayPipe("number", m.noCriPart, ["1.0-0"], services)])}</Render></Render></></> : plainMean({}); })()}

<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.avgPerHit')}</Render>
<Render tag="span" props={{"className": ["teal"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", m.avgDamagePerHit, ["1.0-0"], services)])}</Render></Render>
{(() => { const __condition17 = (m.totalHit > 1);  return __condition17 ? <><Render tag="div" props={{"className": ["kv"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.timesHits')}</Render>
<Render tag="span" props={{}}>{interpolate(["",""], [m.totalHit])}</Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["kv total"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('pop.avgPerUse')}</Render>
<Render tag="span" props={{"className": ["orange"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", m.damagePerUse, ["1.0-0"], services)])}
{(() => { const __condition18 = vm.mean2; const sim = __condition18; return __condition18 ? <><><Render tag="span" props={{"className": ["arr"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"className": ["sim"].filter(Boolean).join(' ')}}>{interpolate(["",""], [displayPipe("number", sim.damagePerUse, ["1.0-0"], services)])}</Render></></> : null; })()}</Render></Render></>; })()}</Render></></> : null; })()}</Render>
<Render tag="app-ui-popover" props={{"styleClass": "rot-details-panel",
"reference": (value: any) => { basicPanel = value; vm["basicPanel"] = value; },
"handle": vm["basicPanel"]}}>{(() => { const noBasicFormula = (context: any) => {  return <><Render tag="div" props={{"className": ["mut-note"].filter(Boolean).join(' ')}}>{t('pop.noBasicFormula')}</Render></>; }; return <><Render tag="div" props={{"className": ["ptitle"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.basicTitle])}</Render>
<Render tag="div" props={{"className": ["graph-hint"].filter(Boolean).join(' ')}}>{t('pop.clickHint')}</Render>
{(() => { const __condition19 = vm.basicGraph; const graph = __condition19; return __condition19 ? <><><Render tag="div" props={{"className": ["formula-trace-scroll"].filter(Boolean).join(' ')}}>{formulaBranch({"graph": graph,"graph2": vm.basicGraph2,"flat": vm.basicGraphIsFlat})}</Render></></> : noBasicFormula({}); })()}
</>; })()}</Render></>; })()}</>;
}
