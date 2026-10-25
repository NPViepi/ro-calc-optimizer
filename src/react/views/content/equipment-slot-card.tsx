import { Fragment } from 'react';
import { Render, displayPipe, interpolate, parseStyle, normalizeStyle, identityKey } from '../render';
export function Content({vm, services}: {vm: any; services: any}) {
return <>{(() => { const body = (context: any) => { const rows = context["rows"];
const entry = context["entry"];
const compare = context["compare"]; return <><Render tag="div" props={{"className": ["eq-card__body"].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "top",
"tooltipStyleClass": "item_desc_tooltip",
"className": ["eq-card__icon",(compare ? "eq-card__icon--compare" : '')].filter(Boolean).join(' '),
"tooltip": {text: (entry ? displayPipe("itemDescTooltip", entry.id, [vm.items,vm.itemDescriptions.version], services) : ""), position: "top", className: "item_desc_tooltip", showDelay: 350, hideDelay: 0, escape: false, disabled: false}}}>{(() => { const __condition1 = entry;  return __condition1 ? <><Render tag="img" props={{"alt": "",
"loading": "lazy",
"src": displayPipe("iconUrl", entry.id, ["item"], services),
"missingIcon": true}}></Render></> : null; })()}</Render>
<Render tag="div" props={{"className": ["eq-card__chips"].filter(Boolean).join(' ')}}>{(rows ?? []).map((__entry2: any, __index2: number, __array2: any[]) => { const row = __entry2; return <Fragment key={identityKey(vm.trackIndex(__index2, __entry2))}><Render tag="div" props={{"className": ["eq-card__line"].filter(Boolean).join(' ')}}>{(row ?? []).map((__entry3: any, __index3: number, __array3: any[]) => { const view = __entry3; return <Fragment key={identityKey(vm.trackChip(__index3, __entry3))}><Render tag="app-equipment-chip" props={{"view": view,
"items": vm.items,
"compare": compare,
"pick": (event: any) => vm.action(() => { const $event = event; vm.onChipPick(view,$event,compare) }),
"edit": (event: any) => vm.action(() => { const $event = event; vm.onChipEdit($event) }),
"clear": (event: any) => vm.action(() => { const $event = event; vm.onChipClear(view,compare) })}}></Render></Fragment>; })}</Render></Fragment>; })}</Render></Render></>; }; return <><Render tag="div" props={{"className": ["eq-card",(!(!(vm.color)) ? "eq-card--tinted" : '')].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["--slot-color-rgb"]: vm.color?.rgb}))}}><Render tag="div" props={{"className": ["eq-card__head"].filter(Boolean).join(' ')}}>{(() => { let colorAnchor: any = vm["colorAnchor"]; return <><Render tag="button" props={{"type": "button",
"tooltipPosition": "top",
"aria-label": vm.colorTitle,
"click": (event: any) => vm.action(() => { const $event = event; vm.onPickColor(colorAnchor) }),
"activateWithKeys": vm.colorable,
"className": ["eq-card__color",(!(vm.colorable) ? "eq-card__color--idle" : '')].filter(Boolean).join(' '),
"tooltip": {text: vm.colorTitle, position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"reference": (value: any) => { colorAnchor = value; vm["colorAnchor"] = value; }}}><Render tag="span" props={{"className": ["eq-card__color-dot",(!(vm.color) ? "eq-card__color-dot--empty" : '')].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["background"]: vm.color?.hex}))}}></Render></Render>
{(() => { const __condition4 = ((vm.colorHint && vm.colorable) && !(vm.hintDismissed));  return __condition4 ? <><Render tag="span" props={{"className": ["eq-card__color-hint"].filter(Boolean).join(' ')}}>{"Marque este slot com uma cor"}</Render></> : null; })()}
<Render tag="span" props={{"className": ["eq-card__label"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.descriptor.label])}</Render>
{(() => { const __condition5 = vm.item?.preRelease;  return __condition5 ? <><Render tag="span" props={{"tooltipPosition": "top",
"className": ["pre_release_tag"].filter(Boolean).join(' '),
"tooltip": {text: "Prévia: item ainda não lançado no LATAM — nome e descrição em inglês, do kRO/iRO (divine-pride).", position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{"Prévia"}</Render></> : null; })()}
<Render tag="span" props={{"className": ["eq-card__spacer"].filter(Boolean).join(' ')}}></Render>
{(() => { const __condition6 = vm.comparable;  return __condition6 ? <><Render tag="button" props={{"type": "button",
"tooltipPosition": "top",
"aria-pressed": vm.comparingHere,
"click": (event: any) => vm.action(() => { const $event = event; vm.onToggleCompare() }),
"className": ["eq-card__compare",(vm.comparingHere ? "eq-card__compare--on" : ''),(!(!(vm.occupiedBy)) ? "eq-card__compare--locked" : '')].filter(Boolean).join(' '),
"tooltip": {text: vm.compareTitle, position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{(() => { const __condition7 = vm.occupiedBy;  return __condition7 ? <><Render tag="app-icon" props={{"name": "lock",
"style": normalizeStyle(Object.assign({}, parseStyle("font-size: 11px")))}}></Render></> : null; })()}
{(() => { const __condition8 = !(vm.occupiedBy);  return __condition8 ? <><Render tag="span" props={{"aria-hidden": "true"}}>{"⇄"}</Render></> : null; })()}
{interpolate([" "," "], [(vm.comparingHere ? "Comparando" : "Comparar")])}</Render></> : null; })()}
{(() => { const __condition9 = vm.hasContent;  return __condition9 ? <><Render tag="button" props={{"type": "button",
"aria-label": "Limpar slot",
"tooltipPosition": "top",
"click": (event: any) => vm.action(() => { const $event = event; vm.clearSlot.emit() }),
"className": ["eq-card__clear"].filter(Boolean).join(' '),
"tooltip": {text: "Limpar slot", position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{" ✕ "}</Render></> : null; })()}</>; })()}</Render>
{(() => { const __condition10 = vm.occupiedBy;  return __condition10 ? <><Render tag="div" props={{"className": ["eq-card__occupied"].filter(Boolean).join(' ')}}>{interpolate([""," (ocupado)"], [vm.occupiedBy])}</Render></> : null; })()}
{(() => { const __condition11 = !(vm.occupiedBy);  return __condition11 ? <><>{body({"rows": vm.mainRows,"entry": vm.item,"compare": false})}
{(() => { const __condition12 = vm.compareRows.length;  return __condition12 ? <><Render tag="div" props={{"className": ["eq-card__compare-row"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["eq-card__compare-actions"].filter(Boolean).join(' ')}}>{(() => { const __condition13 = vm.canSwap;  return __condition13 ? <><Render tag="button" props={{"type": "button",
"aria-label": "Inverter: trocar este item pelo comparado",
"tooltipPosition": "left",
"click": (event: any) => vm.action(() => { const $event = event; vm.swapCompare.emit() }),
"className": ["eq-card__clear eq-card__clear--compare"].filter(Boolean).join(' '),
"tooltip": {text: "Inverter: o item comparado passa a ser o da build, e o da build passa a ser o comparado", position: "left", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{" ⇅ "}</Render></> : null; })()}
{(() => { const __condition14 = vm.hasCompareContent;  return __condition14 ? <><Render tag="button" props={{"type": "button",
"aria-label": "Limpar a comparação deste slot",
"tooltipPosition": "left",
"click": (event: any) => vm.action(() => { const $event = event; vm.clearCompare.emit() }),
"className": ["eq-card__clear eq-card__clear--compare"].filter(Boolean).join(' '),
"tooltip": {text: "Limpar a comparação deste slot", position: "left", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{" ✕ "}</Render></> : null; })()}</Render>
{body({"rows": vm.compareRows,"entry": vm.compareItem,"compare": true})}</Render></> : null; })()}</></> : null; })()}</Render>
</>; })()}</>;
}
