import { Button } from '../../ui/primitives';
import { Fragment } from 'react';
import { Render, displayPipe, interpolate, classNames, normalizeStyle, identityKey } from '../render';
export function Content({vm, services}: {vm: any; services: any}) {
return <>{(() => { const rowTpl = (context: any) => { const row = context["$implicit"];
const i = context["i"]; return <><div className="picker__item"><Render tag="button" props={{"type": "button",
"tabIndex": "-1",
"tooltipPosition": "right",
"tooltipStyleClass": "item_desc_tooltip",
"data-index": i,
"mouseenter": (event: any) => vm.action(() => { const $event = event; vm.hover(i) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.choose(i) }),
"className": ["picker__row",((vm.active === i) ? "picker__row--active" : ''),(vm.isSelected(row) ? "picker__row--selected" : ''),(row.create ? "picker__row--create" : ''),(row.section ? "picker__row--section" : '')].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["height"]: vm.rowHeight == null ? null : String(vm.rowHeight) + "px"})),
"tooltip": {text: (vm.items ? displayPipe("itemDescTooltip", row.value, [vm.items,vm.itemDescriptions.version], services) : ""), position: "right", className: "item_desc_tooltip", showDelay: 350, hideDelay: 0, escape: false, disabled: false}}}>{(() => { const __condition1 = vm.showIcons;  return __condition1 ? <><Render tag="span" props={{"className": ["picker__icon"].filter(Boolean).join(' ')}}>{(() => { const __condition2 = row.icon;  return __condition2 ? <><Render tag="img" props={{"alt": "",
"loading": "lazy",
"src": displayPipe("iconUrl", row.icon, ["item"], services),
"missingIcon": true}}></Render></> : null; })()}</Render></> : null; })()}
<Render tag="span" props={{"className": ["picker__label",(!(!(row.elementClass)) ? "picker__label--tag" : ''),classNames(row.elementClass)].filter(Boolean).join(' ')}}>{interpolate(["",""], [row.label])}</Render>
{(() => { const __condition3 = row.preRelease;  return __condition3 ? <><Render tag="span" props={{"tooltipPosition": "top",
"className": ["pre_release_tag"].filter(Boolean).join(' '),
"tooltip": {text: "Prévia: item ainda não lançado no LATAM — nome e descrição em inglês, do kRO/iRO (divine-pride).", position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{"Prévia"}</Render></> : null; })()}
{(() => { const __condition4 = row.group;  return __condition4 ? <><Render tag="span" props={{"className": ["picker__chevron"].filter(Boolean).join(' ')}}>{"›"}</Render></> : null; })()}</Render></div></>; }; return <><Render tag="div" props={{"tabIndex": "-1",
"appTrapFocus": "",
"appTrapFocusAutoCapture": "",
"keydown": (event: any) => vm.action(() => { const $event = event; vm.onKeyDown($event) }),
"className": ["picker",(vm.virtualise ? "picker--virtual" : '')].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["width"]: vm.pinnedWidth == null ? null : String(vm.pinnedWidth) + "px"}))}}><Render tag="div" props={{"className": ["picker__title"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.title])}
{vm.canSearch && <Button icon="search" label="Buscar itens" className="ui-button-text ui-button-sm picker__search"
  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }} onClick={() => vm.action(() => vm.openSearch())} />}</Render>
<Render tag="div" props={{"className": ["picker__filter"].filter(Boolean).join(' ')}}>{(() => { let filter: any = vm["filter"]; return <><Render tag="input" props={{"type": "text",
"data-focus-initial": true,
"placeholder": "Filtrar…",
"value": vm.query,
"input": (event: any) => vm.action(() => { const $event = event; vm.onQuery(filter.value) }),
"className": ["picker__input"].filter(Boolean).join(' '),
"reference": (value: any) => { filter = value; vm["filter"] = value; }}}></Render>
{vm.query && <Button icon="times" aria-label="Limpar busca" className="ui-button-text ui-button-sm"
  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}
  onClick={() => vm.action(() => { vm.onQuery(''); filter?.focus(); })} />}</>; })()}</Render>
{(() => { const __condition5 = vm.breadcrumb.length;  return __condition5 ? <><Render tag="div" props={{"className": ["picker__crumbs"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"click": (event: any) => vm.action(() => { const $event = event; vm.goToLevel(-(1)) }),
"className": ["picker__crumb"].filter(Boolean).join(' ')}}>{"Todos"}</Render>
{(vm.breadcrumb ?? []).map((__entry6: any, __index6: number, __array6: any[]) => { const node = __entry6;
const i = __index6; return <Fragment key={identityKey(__entry6)}><><Render tag="span" props={{"className": ["picker__crumb-sep"].filter(Boolean).join(' ')}}>{"›"}</Render>
<Render tag="button" props={{"type": "button",
"disabled": (i === (vm.breadcrumb.length - 1)),
"click": (event: any) => vm.action(() => { const $event = event; vm.goToLevel(i) }),
"className": ["picker__crumb"].filter(Boolean).join(' ')}}>{interpolate(["",""], [node.label])}</Render></></Fragment>; })}</Render></> : null; })()}
{(() => { const __condition7 = vm.createKind;  return __condition7 ? <><Render tag="button" props={{"type": "button",
"tabIndex": "-1",
"mouseenter": (event: any) => vm.action(() => { const $event = event; vm.hover(-(2)) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.choose(-(2)) }),
"className": ["picker__row picker__row--create",((vm.active === -(2)) ? "picker__row--active" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["picker__icon"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", 512, ["item"], services),
"missingIcon": true}}></Render></Render>
<Render tag="span" props={{"className": ["picker__label"].filter(Boolean).join(' ')}}>{"Criar item personalizado"}</Render></Render></> : null; })()}
{(() => { const __condition8 = vm.clearable;  return __condition8 ? <><Render tag="button" props={{"type": "button",
"tabIndex": "-1",
"mouseenter": (event: any) => vm.action(() => { const $event = event; vm.hover(-(1)) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.choose(-(1)) }),
"className": ["picker__row picker__row--none",((vm.active === -(1)) ? "picker__row--active" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["picker__label picker__label--none"].filter(Boolean).join(' ')}}>{"Nenhum"}</Render></Render></> : null; })()}
{(() => { const __condition9 = (vm.rows.length && vm.virtualise);  return __condition9 ? <><Render tag="app-virtual-list" props={{"items": vm.rows,
"trackBy": vm.trackRow,
"itemSize": vm.rowHeight,
"className": ["picker__list"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["height"]: vm.viewportHeight == null ? null : String(vm.viewportHeight) + "px"})),
"template_item": (context: any) => { const row = context["$implicit"];
const i = context["index"]; return <>{rowTpl({"$implicit": row,"i": i})}</>; },
"reference": (value: any) => { vm.viewport = value; }}}></Render></> : null; })()}
{(() => { const __condition10 = (vm.rows.length && !(vm.virtualise));  return __condition10 ? <><Render tag="div" props={{"className": ["picker__list picker__list--plain"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["maxHeight"]: vm.viewportHeight == null ? null : String(vm.viewportHeight) + "px"}))}}>{(vm.rows ?? []).map((__entry11: any, __index11: number, __array11: any[]) => { const row = __entry11;
const i = __index11; return <Fragment key={identityKey(vm.trackRow(__index11, __entry11))}><>{rowTpl({"$implicit": row,"i": i})}</></Fragment>; })}</Render></> : null; })()}
{(() => { const __condition12 = !(vm.rows.length);  return __condition12 ? <><Render tag="div" props={{"className": ["picker__note"].filter(Boolean).join(' ')}}>{"Nada encontrado."}</Render></> : null; })()}
{(() => { const __condition13 = vm.capped;  return __condition13 ? <><Render tag="div" props={{"className": ["picker__note"].filter(Boolean).join(' ')}}>{interpolate(["Mais de "," resultados — refine a busca."], [vm.rows.length])}</Render></> : null; })()}</Render>
</>; })()}</>;
}
