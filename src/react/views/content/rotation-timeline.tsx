import { Fragment } from 'react';
import { Render, displayPipe, interpolate, classNames, normalizeStyle, identityKey } from '../render';
import { useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
return <><Render tag="div" props={{"className": ["tl"].filter(Boolean).join(' ')}}>{(vm.charts ?? []).map((__entry1: any, __index1: number, __array1: any[]) => { const chart = __entry1;
const ci = __index1; return <Fragment key={identityKey(vm.trackByIndex(__index1, __entry1))}><Render tag="div" props={{"className": ["tl-chart",(chart.isCompare ? "tl-chart--cmp" : '')].filter(Boolean).join(' ')}}>{(() => { const __condition2 = chart.title;  return __condition2 ? <><Render tag="div" props={{"className": ["tl-title",(chart.isCompare ? "tl-title--cmp" : '')].filter(Boolean).join(' ')}}>{interpolate(["",""], [chart.title])}</Render></> : null; })()}
{(chart.lanes ?? []).map((__entry3: any, __index3: number, __array3: any[]) => { const lane = __entry3;
const li = __index3; return <Fragment key={identityKey(vm.trackByIndex(__index3, __entry3))}><Render tag="div" props={{"className": ["tl-lane-row"].filter(Boolean).join(' ')}}>{(() => { const __condition4 = lane.isBasic;  return __condition4 ? <><Render tag="img" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"src": vm.basicAttackIcon,
"alt": lane.name,
"click": (event: any) => vm.action(() => { const $event = event; vm.iconClick.emit({"index": li,"event": $event}) }),
"className": ["tl-icon"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true}}></Render></> : null; })()}
{(() => { const __condition5 = !(lane.isBasic);  return __condition5 ? <><Render tag="img" props={{"role": "button",
"tabIndex": "0",
"tooltipPosition": "top",
"src": displayPipe("iconUrl", lane.icon, ["skill"], services),
"alt": lane.name,
"click": (event: any) => vm.action(() => { const $event = event; vm.iconClick.emit({"index": li,"event": $event}) }),
"className": ["tl-icon"].filter(Boolean).join(' '),
"tooltip": {text: t('tl.skillDetails'), position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"activateWithKeys": true,
"missingIcon": true}}></Render></> : null; })()}
<Render tag="div" props={{"className": ["tl-track",(lane.invalid ? "tl-track--invalid" : '')].filter(Boolean).join(' ')}}>{(lane.blocks ?? []).map((__entry6: any, __index6: number, __array6: any[]) => { const block = __entry6; return <Fragment key={identityKey(vm.trackByIndex(__index6, __entry6))}><Render tag="div" props={{"tooltipPosition": "top",
"className": ["tl-block",classNames(("tl-block--" + block.kind)),(block.isFullHeight ? "tl-block--full" : '')].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["left"]: block.leftPercent == null ? null : String(block.leftPercent) + "%"},{["width"]: block.widthPercent == null ? null : String(block.widthPercent) + "%"})),
"tooltip": {text: block.tooltip, position: "top", className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false}}}>{(() => { const __condition7 = block.label;  return __condition7 ? <><Render tag="span" props={{"className": ["tl-block-label"].filter(Boolean).join(' ')}}>{interpolate(["",""], [block.label])}</Render></> : null; })()}</Render></Fragment>; })}</Render></Render></Fragment>; })}
<Render tag="div" props={{"className": ["tl-axis"].filter(Boolean).join(' ')}}>{(chart.ticks ?? []).map((__entry8: any, __index8: number, __array8: any[]) => { const tick = __entry8; return <Fragment key={identityKey(vm.trackByIndex(__index8, __entry8))}><Render tag="span" props={{"className": ["tl-tick",(tick.isCycleEnd ? "tl-tick--end" : ''),classNames(("tl-anchor-" + tick.anchor))].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["left"]: tick.leftPercent == null ? null : String(tick.leftPercent) + "%"}))}}>{interpolate(["",""], [tick.label])}</Render></Fragment>; })}</Render></Render></Fragment>; })}
<Render tag="div" props={{"className": ["tl-legend"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["tl-key"].filter(Boolean).join(' ')}}><Render tag="i" props={{"className": ["tl-sw tl-sw--fixa"].filter(Boolean).join(' ')}}></Render>
{t('tl.fixedCast')}</Render>
<Render tag="span" props={{"className": ["tl-key"].filter(Boolean).join(' ')}}><Render tag="i" props={{"className": ["tl-sw tl-sw--variavel"].filter(Boolean).join(' ')}}></Render>
{t('tl.variableCast')}</Render>
<Render tag="span" props={{"className": ["tl-key"].filter(Boolean).join(' ')}}><Render tag="i" props={{"className": ["tl-sw tl-sw--pos"].filter(Boolean).join(' ')}}></Render>
{t('tl.afterCast')}</Render>
<Render tag="span" props={{"className": ["tl-key"].filter(Boolean).join(' ')}}><Render tag="i" props={{"className": ["tl-sw tl-sw--recarga"].filter(Boolean).join(' ')}}></Render>
{t('tl.cooldown')}</Render>
<Render tag="span" props={{"className": ["tl-key"].filter(Boolean).join(' ')}}><Render tag="i" props={{"className": ["tl-sw tl-sw--aspd"].filter(Boolean).join(' ')}}></Render>
{t('tl.aspdWait')}</Render></Render>
{(() => { const __condition9 = (vm.charts.length > 1);  return __condition9 ? <><Render tag="p" props={{"className": ["tl-note"].filter(Boolean).join(' ')}}>{t('tl.twoChartsNote')}</Render></> : null; })()}</Render></>;
}
