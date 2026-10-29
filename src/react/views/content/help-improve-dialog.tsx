import { Fragment } from 'react';
import { Render, interpolate, parseStyle, normalizeStyle, identityKey } from '../render';
import { useRichText, useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
const rich = useRichText();
return <><Render tag="app-ui-dialog" props={{"visible": vm.visible,
"modal": true,
"contentStyle": {"maxHeight": "75vh"},
"visibleChange": (event: any) => vm.action(() => { const $event = event; (!($event) && vm.onHide()) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle(vm.dialogStyle))),
"template_header": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center gap-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "heart-fill",
"className": ["text-xl"].filter(Boolean).join(' ')}}></Render>
<Render tag="span" props={{"className": ["text-xl font-medium"].filter(Boolean).join(' ')}}>{t('hi.title')}</Render></Render></>; },
"template_footer": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center justify-content-end w-full"].filter(Boolean).join(' ')}}><Render tag="button" props={{"label": t('ui.dialog.close'),
"click": (event: any) => vm.action(() => { const $event = event; vm.onHide() }),
"className": ["ui-button-text"].filter(Boolean).join(' '),
"button": true}}></Render></Render></>; }}}>
<Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{rich('hi.intro')}</Render>
<Render tag="p" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{rich('hi.goal')}</Render>
<Render tag="div" props={{"className": ["flex align-items-start gap-2 mb-3 p-3 border-round"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{rich('hi.rule1')}
<Render tag="br" props={{}}></Render>
{rich('hi.rule2')}</Render></Render>
<Render tag="p" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{rich('hi.effort')}</Render>
<Render tag="app-ui-accordion" props={{}}><Render tag="app-ui-accordion-tab" props={{"header": t('hi.tab1')}}><Render tag="ul" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{rich('hi.tab1Item1')}</Render>
<Render tag="li" props={{}}>{rich('hi.tab1Item2')}</Render>
<Render tag="li" props={{}}>{rich('hi.tab1Item3')}</Render>
<Render tag="li" props={{}}>{rich('hi.tab1Item4')}</Render></Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.browikiUrl}}>{t('hi.browikiLink')}</Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": t('hi.tab2')}}><Render tag="div" props={{"className": ["flex align-items-start gap-2 mb-3 p-2 border-round"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{rich('hi.tab2Warning')}</Render></Render>
<Render tag="ul" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{rich('hi.tab2Item1')}</Render>
<Render tag="li" props={{}}>{rich('hi.tab2Item2')}</Render></Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": t('hi.tab3')}}><Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{rich('hi.tab3Intro')}</Render>
<Render tag="ol" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{rich('hi.step1')}</Render>
<Render tag="li" props={{}}>{rich('hi.step2')}</Render>
<Render tag="li" props={{}}>{rich('hi.step3')}</Render>
<Render tag="li" props={{}}>{rich('hi.step4')}</Render>
<Render tag="li" props={{}}>{rich('hi.step5')}</Render>
<Render tag="li" props={{}}>{rich('hi.step6')}</Render>
<Render tag="li" props={{}}>{rich('hi.step7')}</Render>
<Render tag="li" props={{}}>{rich('hi.step8')}</Render></Render>
<Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{rich('hi.extra')}</Render>
<Render tag="ul" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{rich('hi.extraItem1')}</Render>
<Render tag="li" props={{}}>{rich('hi.extraItem2')}</Render>
<Render tag="li" props={{}}>{rich('hi.extraItem3')}</Render></Render></Render></Render>
{(() => { const __condition1 = !(vm.sentId);  return __condition1 ? <><Render tag="div" props={{"tabIndex": "0",
"dragover": (event: any) => vm.action(() => { const $event = event; vm.onDragOver($event) }),
"dragleave": (event: any) => vm.action(() => { const $event = event; vm.onDragLeave($event) }),
"drop": (event: any) => vm.action(() => { const $event = event; vm.onDrop($event) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.replayInput.click() }),
"keydown": (event: any) => vm.action(() => { const $event = event; if (event.key?.toLowerCase() === "enter") { vm.replayInput.click() } }),
"className": ["replay-dropzone mt-3",(vm.dragOver ? "dragover" : '')].filter(Boolean).join(' ')}}>{(() => { let replayInput: any = vm["replayInput"]; return <><Render tag="app-icon" props={{"name": "upload",
"className": ["replay-dropzone-icon"].filter(Boolean).join(' ')}}></Render>
<Render tag="p" props={{"className": ["m-0 replay-dropzone-drag"].filter(Boolean).join(' ')}}>{rich('hi.dropzone')}</Render>
<Render tag="p" props={{"className": ["my-2 text-sm replay-dropzone-drag"].filter(Boolean).join(' ')}}>{t('hi.or')}</Render>
<Render tag="button" props={{"type": "button",
"icon": "folder-open",
"label": t('hi.pickFile'),
"click": (event: any) => vm.action(() => { const $event = event; $event.stopPropagation();replayInput.click() }),
"className": ["ui-button-sm ui-button-outlined"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="input" props={{"type": "file",
"accept": ".rrf",
"hidden": true,
"change": (event: any) => vm.action(() => { const $event = event; vm.onInputChange($event) }),
"reference": (value: any) => { replayInput = value; vm["replayInput"] = value; }}}></Render></>; })()}</Render></> : null; })()}
{(() => { const __condition2 = vm.parsing;  return __condition2 ? <><Render tag="div" props={{"className": ["mt-3 text-center"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "spinner",
"className": ["mr-2"].filter(Boolean).join(' ')}}></Render>
{t('hi.parsing')}</Render></> : null; })()}
{(() => { const __condition3 = vm.rejected; const bad = __condition3; return __condition3 ? <><Render tag="div" props={{"className": ["mt-3 p-3 border-round line-height-3"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--red-100); color: var(--red-900)")))}}><Render tag="div" props={{"className": ["flex align-items-start gap-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "times-circle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{}}><Render tag="b" props={{}}>{t('hi.rejected')}</Render>
<Render tag="div" props={{"className": ["mt-1"].filter(Boolean).join(' ')}}>{vm.rejectionMessage}</Render></Render></Render></Render></> : null; })()}
{(() => { const __condition4 = vm.accepted; const good = __condition4; return __condition4 ? <><>{(() => { const __condition5 = !(vm.sentId);  return __condition5 ? <><Render tag="div" props={{"className": ["mt-3"].filter(Boolean).join(' ')}}><Render tag="h3" props={{"className": ["mt-0 mb-2 text-lg"].filter(Boolean).join(' ')}}>{t('hi.confirmTitle')}</Render>
<Render tag="div" props={{"className": ["submission-summary p-3 border-round surface-100"].filter(Boolean).join(' ')}}><Render tag="div" props={{}}><Render tag="span" props={{}}>{t('hi.player')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [(good.summary.player || "—")])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('misc.class')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.className])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('hi.level')}</Render>
<Render tag="b" props={{}}>{interpolate([""," / ",""], [good.summary.baseLevel,good.summary.jobLevel])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('hi.map')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [(good.summary.map || "—")])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('hi.duration')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [vm.formatDuration(good.summary.durationMs)])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('calc.skills')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.learnedSkillCount])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('calc.equipments')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.equippedCount])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('hi.equipChanges')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.equipChangeCount])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('hi.damageEvents')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.damageEvents])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{t('hi.dummyHits')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.dummyHits])}</Render></Render>
{(() => { const __condition6 = good.summary.skippedItems.length;  return __condition6 ? <><Render tag="div" props={{}}><Render tag="span" props={{}}>{t('hi.skippedItems')}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.skippedItems.length])}</Render></Render></> : null; })()}
{(() => { const __condition7 = vm.importedTraits; const imported = __condition7; return __condition7 ? <><Render tag="div" props={{}}><Render tag="span" props={{}}>{t('calc.traitPoints')}</Render>
<Render tag="b" props={{}}>{(vm.traitKeys ?? []).map((__entry8: any, __index8: number, __array8: any[]) => { const key = __entry8;
const last = __index8 === __array8.length - 1; return <Fragment key={identityKey(__entry8)}><>{interpolate([""," ",""], [vm.traitLabels[key],imported[key]])}
{(() => { const __condition9 = !(last);  return __condition9 ? <><Render tag="span" props={{}}>{" · "}</Render></> : null; })()}</></Fragment>; })}</Render></Render></> : null; })()}</Render>
{(() => { const __condition10 = good.warnings.length;  return __condition10 ? <><Render tag="div" props={{"className": ["mt-2 p-2 border-round line-height-3"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}>{(() => { const __condition11 = good.warnings.includes("external-buffs");  return __condition11 ? <><Render tag="div" props={{}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-1"].filter(Boolean).join(' ')}}></Render>
{rich('hi.warnExternalBuffs')}</Render></> : null; })()}
{(() => { const __condition12 = good.warnings.includes("no-equip-change");  return __condition12 ? <><Render tag="div" props={{}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-1"].filter(Boolean).join(' ')}}></Render>
{t('hi.warnNoEquipChange')}</Render></> : null; })()}
{(() => { const __condition13 = good.warnings.includes("many-unknown-items");  return __condition13 ? <><Render tag="div" props={{}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-1"].filter(Boolean).join(' ')}}></Render>
{t('hi.warnUnknownItems')}</Render></> : null; })()}</Render></> : null; })()}
{(() => { const __condition14 = good.needsTraits;  return __condition14 ? <><Render tag="div" props={{"className": ["mt-3"].filter(Boolean).join(' ')}}><Render tag="h3" props={{"className": ["mt-0 mb-1 text-lg"].filter(Boolean).join(' ')}}>{t('hi.traitsTitle')}</Render>
<Render tag="p" props={{"className": ["mt-0 mb-2 line-height-3 text-sm"].filter(Boolean).join(' ')}}>{rich('hi.traitsNote1')}
<Render tag="span" props={{"className": ["font-italic"].filter(Boolean).join(' ')}}>{t('hi.traitsExample')}</Render>
{rich('hi.traitsNote2')}</Render>
<Render tag="div" props={{"className": ["trait-grid"].filter(Boolean).join(' ')}}>{(vm.traitKeys ?? []).map((__entry15: any, __index15: number, __array15: any[]) => { const key = __entry15; return <Fragment key={identityKey(__entry15)}><Render tag="app-status-input" props={{"label": vm.traitLabels[key],
"dropdownList": vm.traitStatusList,
"value": vm.traits[key],
"showExtra": false,
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.traits[key] = $event) })}}></Render></Fragment>; })}</Render>
{(() => { const __condition16 = vm.traitsUntouched;  return __condition16 ? <><Render tag="div" props={{"className": ["mt-2 p-2 border-round line-height-3 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-1"].filter(Boolean).join(' ')}}></Render>
{t('hi.traitsZero')}</Render></> : null; })()}</Render></> : null; })()}
<Render tag="h3" props={{"className": ["mt-3 mb-2 text-lg"].filter(Boolean).join(' ')}}>{t('hi.aboutYou')}</Render>
<Render tag="div" props={{"className": ["grid"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-6"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "helpImproveNick",
"className": ["block mb-1 text-sm"].filter(Boolean).join(' ')}}>{t('hi.nick')}</Render>
<Render tag="input" props={{"id": "helpImproveNick",
"maxLength": "40",
"placeholder": t('hi.nickPlaceholder'),
"value": vm.nick,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.nick = $event) }))(value); }),
"className": ["w-full"].filter(Boolean).join(' '),
"inputText": true}}></Render></Render>
<Render tag="div" props={{"className": ["col-6"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "helpImproveDiscord",
"className": ["block mb-1 text-sm"].filter(Boolean).join(' ')}}>{"Discord"}</Render>
<Render tag="input" props={{"id": "helpImproveDiscord",
"maxLength": "60",
"placeholder": t('hi.discordPlaceholder'),
"value": vm.discord,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.discord = $event) }))(value); }),
"className": ["w-full"].filter(Boolean).join(' '),
"inputText": true}}></Render></Render>
<Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "helpImproveNotes",
"className": ["block mb-1 text-sm"].filter(Boolean).join(' ')}}>{t('hi.notes')}</Render>
<Render tag="textarea" props={{"appInputTextarea": "",
"id": "helpImproveNotes",
"rows": "3",
"maxLength": "1000",
"placeholder": t('hi.notesPlaceholder'),
"value": vm.notes,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.notes = $event) }))(value); }),
"className": ["w-full"].filter(Boolean).join(' ')}}></Render></Render></Render>
<Render tag="div" props={{"className": ["mt-2 flex align-items-start gap-2 p-2 border-round surface-100 line-height-3"].filter(Boolean).join(' ')}}><Render tag="app-ui-checkbox" props={{"inputId": "helpImproveConsent",
"binary": true,
"value": vm.consent,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.consent = $event) }))(value); })}}></Render>
<Render tag="label" props={{"htmlFor": "helpImproveConsent",
"className": ["text-sm"].filter(Boolean).join(' ')}}>{rich('hi.consent')}</Render></Render>
{(() => { const __condition17 = vm.sendError;  return __condition17 ? <><Render tag="div" props={{"className": ["mt-2 p-2 border-round line-height-3"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--red-100); color: var(--red-900)")))}}>{interpolate([" "," "], [vm.sendError])}</Render></> : null; })()}
<Render tag="div" props={{"className": ["mt-3 flex justify-content-end"].filter(Boolean).join(' ')}}><Render tag="button" props={{"disabled": !(vm.canSend),
"icon": (vm.sending ? "spinner" : "send"),
"label": t(vm.sending ? 'hi.sending' : 'hi.send'),
"click": (event: any) => vm.action(() => { const $event = event; vm.send() }),
"className": ["ui-button-success"].filter(Boolean).join(' '),
"button": true}}></Render></Render></Render></> : null; })()}</></> : null; })()}
{(() => { const __condition18 = vm.sentId;  return __condition18 ? <><Render tag="div" props={{"className": ["mt-3 p-3 border-round line-height-3"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--green-100); color: var(--green-900)")))}}><Render tag="div" props={{"className": ["flex align-items-start gap-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "check-circle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{}}><Render tag="b" props={{}}>{t('hi.received')}</Render>
<Render tag="div" props={{"className": ["mt-1"].filter(Boolean).join(' ')}}>{t('hi.receivedNote')}</Render>
<Render tag="div" props={{"className": ["mt-1 text-sm"].filter(Boolean).join(' ')}}>{t('hi.submissionCode')}
<Render tag="code" props={{}}>{interpolate(["",""], [vm.sentId])}</Render></Render>
<Render tag="button" props={{"icon": "plus",
"label": t('hi.sendAnother'),
"click": (event: any) => vm.action(() => { const $event = event; vm.startAnother() }),
"className": ["ui-button-sm ui-button-text mt-2"].filter(Boolean).join(' '),
"button": true}}></Render></Render></Render></Render></> : null; })()}
</Render></>;
}
