import { Fragment } from 'react';
import { Render, interpolate, normalizeStyle, identityKey } from '../render';
import { useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
return <><Render tag="div" props={{"tabIndex": "-1",
"appTrapFocus": "",
"appTrapFocusAutoCapture": "",
"keydown": (event: any) => vm.action(() => { const $event = event; vm.onKeyDown($event) }),
"className": ["cpicker"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["cpicker__title"].filter(Boolean).join(' ')}}>{t('slotColor.title')}</Render>
<Render tag="button" props={{"type": "button",
"data-focus-initial": true,
"click": (event: any) => vm.action(() => { const $event = event; vm.choose(null) }),
"className": ["cpicker__row cpicker__row--none",(!(vm.value) ? "cpicker__row--selected" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["cpicker__dot cpicker__dot--none"].filter(Boolean).join(' ')}}></Render>
<Render tag="span" props={{"className": ["cpicker__label"].filter(Boolean).join(' ')}}>{t('slotColor.none')}</Render></Render>
{(vm.colors ?? []).map((__entry1: any, __index1: number, __array1: any[]) => { const color = __entry1; return <Fragment key={identityKey(vm.trackColor(__index1, __entry1))}><Render tag="div" props={{"className": ["cpicker__entry"].filter(Boolean).join(' ')}}>{(() => { const __condition2 = (vm.editing !== color.id);  return __condition2 ? <><><Render tag="button" props={{"type": "button",
"click": (event: any) => vm.action(() => { const $event = event; vm.choose(color.id) }),
"className": ["cpicker__row",((vm.value === color.id) ? "cpicker__row--selected" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["cpicker__dot"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["background"]: color.hex}))}}></Render>
<Render tag="span" props={{"className": ["cpicker__label"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.labelOf(color)])}</Render></Render>
<Render tag="button" props={{"type": "button",
"tooltipPosition": "right",
"aria-label": t('slotColor.rename', { name: vm.labelOf(color) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.startRename(color,$event) }),
"className": ["cpicker__rename"].filter(Boolean).join(' '),
"tooltip": {text: t('slotColor.renameHint'), position: "right", className: '', showDelay: 400, hideDelay: 0, escape: true, disabled: false}}}>{" ✎ "}</Render></></> : null; })()}
{(() => { const __condition3 = (vm.editing === color.id);  return __condition3 ? <><Render tag="div" props={{"className": ["cpicker__edit"].filter(Boolean).join(' ')}}>{(() => { let rename: any = vm["rename"]; return <><Render tag="span" props={{"className": ["cpicker__dot"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, {["background"]: color.hex}))}}></Render>
<Render tag="input" props={{"type": "text",
"maxLength": vm.maxLabel,
"placeholder": vm.defaultLabelOf(color),
"keydown": (event: any) => vm.action(() => { const $event = event; vm.onRenameKeyDown(color,$event) }),
"blur": (event: any) => vm.action(() => { const $event = event; vm.commitRename(color) }),
"value": vm.draft,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft = $event) }))(value); }),
"className": ["cpicker__input"].filter(Boolean).join(' '),
"reference": (value: any) => { rename = value; vm["rename"] = value; }}}></Render></>; })()}</Render></> : null; })()}</Render></Fragment>; })}</Render></>;
}
