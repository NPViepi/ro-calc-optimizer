import { Fragment } from 'react';
import { Render, interpolate, identityKey } from '../render';
export function Content({vm, services}: {vm: any; services: any}) {
return <><Render tag="div" props={{"className": ["eq-grid"].filter(Boolean).join(' ')}}>{(() => { const __condition1 = vm.compareCount;  return __condition1 ? <><Render tag="div" props={{"className": ["eq-grid__ribbon"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["eq-ribbon"].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "right",
"className": ["eq-ribbon__text"].filter(Boolean).join(' '),
"tooltip": {text: vm.ribbonTitle, position: "right", className: '', showDelay: 350, hideDelay: 0, escape: true, disabled: false}}}>{interpolate(["⇄ ",""], [vm.ribbonText])}</Render>
<Render tag="button" props={{"type": "button",
"aria-label": "Limpar comparação",
"tooltipPosition": "right",
"click": (event: any) => vm.action(() => { const $event = event; vm.onClearComparison() }),
"className": ["eq-ribbon__clear"].filter(Boolean).join(' '),
"tooltip": {text: "Limpar comparação", position: "right", className: '', showDelay: 350, hideDelay: 0, escape: true, disabled: false}}}>{" ✕ "}</Render></Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["eq-grid__columns"].filter(Boolean).join(' ')}}>{(vm.columns ?? []).map((__entry2: any, __index2: number, __array2: any[]) => { const column = __entry2; return <Fragment key={identityKey(vm.trackIndex(__index2, __entry2))}><Render tag="div" props={{"className": ["eq-grid__column"].filter(Boolean).join(' ')}}>{(column ?? []).map((__entry3: any, __index3: number, __array3: any[]) => { const group = __entry3; return <Fragment key={identityKey(vm.trackGroup(__index3, __entry3))}><><Render tag="div" props={{"className": ["eq-grid__group"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["eq-grid__group-label"].filter(Boolean).join(' ')}}>{interpolate(["",""], [group.label])}</Render>
<Render tag="span" props={{"className": ["eq-grid__rule"].filter(Boolean).join(' ')}}></Render></Render>
{(group.slots ?? []).map((__entry4: any, __index4: number, __array4: any[]) => { const slot = __entry4; return <Fragment key={identityKey(vm.trackSlot(__index4, __entry4))}><Render tag="app-equipment-slot-card" props={{"descriptor": slot,
"items": vm.items,
"lists": vm.lists,
"model": vm.model,
"model2": vm.model2,
"derivation": vm.derivations[slot.key],
"compareDerivation": vm.compareDerivations[slot.key],
"occupiedBy": vm.occupiedBy(slot),
"mainBlockedNote": vm.mainBlockedNote(slot),
"comparing": vm.comparing,
"color": vm.colorOf(slot),
"colorHint": vm.showsColorHint(slot),
"showAmmo": !(vm.hiddenMap.ammu),
"revision": vm.cardRevision,
"pickField": (event: any) => vm.action(() => { const $event = event; vm.onPickField($event) }),
"clearSlot": (event: any) => vm.action(() => { const $event = event; vm.onClearSlot(slot) }),
"toggleCompare": (event: any) => vm.action(() => { const $event = event; vm.onToggleCompare(slot) }),
"clearCompare": (event: any) => vm.action(() => { const $event = event; vm.onClearCompareSlot(slot) }),
"swapCompare": (event: any) => vm.action(() => { const $event = event; vm.onSwapCompare(slot) }),
"pickColor": (event: any) => vm.action(() => { const $event = event; vm.onPickColor(slot,$event) })}}></Render></Fragment>; })}</></Fragment>; })}</Render></Fragment>; })}</Render></Render></>;
}
