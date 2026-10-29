import { Fragment } from 'react';
import { Render, displayPipe, interpolate, classNames, normalizeStyle, identityKey } from '../render';
import { sanitizeHtml } from '../../ui/sanitize-html';
import { useRichText, useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
const rich = useRichText();
return <><Render tag="app-ui-dialog" props={{"visible": vm.visible,
"modal": true,
"dismissableMask": true,
"contentStyle": {"overflow": "hidden","display": "flex","flex-direction": "column"},
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.visible = $event) }),
"closed": (event: any) => vm.action(() => { const $event = event; vm.closePickers() }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "min(94vw, 1100px)","height": "93vh"}))),
"template_header": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center gap-2"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", 512, ["item"], services),
"className": ["item_img"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="strong" props={{}}>{interpolate(["",""], [(vm.libraryMode ? t('cis.myItems') : (vm.draft.id ? t('cis.editItem') : t('cis.createItem')))])}</Render></Render></>; },
"template_footer": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center flex-wrap gap-2"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"icon": "sparkles",
"label": t('cis.mcpAgent'),
"click": (event: any) => vm.action(() => { const $event = event; (vm.mcpVisible = true) }),
"className": ["ui-button-text ui-button-sm mr-auto"].filter(Boolean).join(' '),
"button": true}}></Render>
{(() => { const __condition1 = !(vm.libraryMode);  return __condition1 ? <><Render tag="button" props={{"type": "button",
"label": t('cis.myItems'),
"click": (event: any) => vm.action(() => { const $event = event; vm.openLibrary() }),
"className": ["ui-button-outlined"].filter(Boolean).join(' '),
"button": true}}></Render></> : null; })()}
{(() => { const __condition2 = !(vm.libraryMode);  return __condition2 ? <><Render tag="button" props={{"type": "button",
"disabled": (vm.diagnostics.length > 0),
"label": (vm.context ? t('cis.saveAndEquip') : t('cis.saveItem')),
"click": (event: any) => vm.action(() => { const $event = event; vm.save() }),
"button": true}}></Render></> : null; })()}</Render></>; }}}>
{(() => { const __condition3 = vm.libraryMode;  return __condition3 ? <><Render tag="div" props={{"className": ["studio-library"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["flex flex-wrap gap-2 mb-3"].filter(Boolean).join(' ')}}><Render tag="input" props={{"type": "search",
"placeholder": t('cis.searchNameId'),
"aria-label": t('cis.searchMyItems'),
"value": vm.libraryQuery,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.libraryQuery = $event) }))(value); }),
"className": ["flex-1"].filter(Boolean).join(' '),
"inputText": true}}></Render>
<Render tag="app-ui-dropdown" props={{"filterBy": "label",
"ariaLabel": t('cis.filterCategory'),
"options": vm.libraryKindOptions,
"filter": true,
"value": vm.libraryKind,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.libraryKind = $event) }))(value); })}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "plus",
"label": t('cis.newItem'),
"click": (event: any) => vm.action(() => { const $event = event; vm.openCreate() }),
"button": true}}></Render></Render>
<Render tag="div" props={{"className": ["flex flex-wrap gap-2 mb-3"].filter(Boolean).join(' ')}}>{(() => { let importFile: any = vm["importFile"]; return <><Render tag="button" props={{"type": "button",
"icon": "download",
"label": t('cis.exportJson'),
"click": (event: any) => vm.action(() => { const $event = event; vm.exportJson() }),
"className": ["ui-button-outlined ui-button-sm"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "upload",
"label": t('cis.importJson'),
"click": (event: any) => vm.action(() => { const $event = event; importFile.click() }),
"className": ["ui-button-outlined ui-button-sm"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="input" props={{"type": "file",
"hidden": true,
"accept": "application/json,.json",
"change": (event: any) => vm.action(() => { const $event = event; vm.importJson($event) }),
"reference": (value: any) => { importFile = value; vm["importFile"] = value; }}}></Render></>; })()}</Render>
<Render tag="div" props={{"className": ["studio-library-list"].filter(Boolean).join(' ')}}><Render tag="app-ui-table" props={{"styleClass": "ui-datatable-sm",
"currentPageReportTemplate": t('itemSearch.resultCount'),
"value": vm.libraryItems,
"paginator": true,
"rows": 10,
"showCurrentPageReport": true,
"template_header": (context: any) => {  return <><Render tag="tr" props={{}}><Render tag="th" props={{}}>{t('cis.secItem')}</Render>
<Render tag="th" props={{"className": ["studio-actions-column"].filter(Boolean).join(' ')}}>{t('cis.actions')}</Render></Render></>; },
"template_body": (context: any) => { const item = context["$implicit"]; return <><Render tag="tr" props={{}}><Render tag="td" props={{"tooltipStyleClass": "item_desc_tooltip",
"tooltipPosition": "top",
"tooltip": {text: vm.descriptionTooltip(item), position: "top", className: "item_desc_tooltip", showDelay: 350, hideDelay: 0, escape: false, disabled: false}}}><Render tag="div" props={{"className": ["flex align-items-center gap-2"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", item.iconItemId, ["item"], services),
"className": ["item_img"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="div" props={{"className": ["studio-item-name"].filter(Boolean).join(' ')}}><Render tag="strong" props={{}}>{interpolate(["",""], [item.name])}</Render>
<Render tag="small" props={{"className": ["block text-color-secondary"].filter(Boolean).join(' ')}}>{interpolate([""," · ID ",""], [vm.kindLabels[item.kind],item.id])}</Render></Render></Render></Render>
<Render tag="td" props={{"className": ["studio-actions-column"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["flex justify-content-end gap-1"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"icon": "pencil",
"aria-label": t('cis.edit'),
"click": (event: any) => vm.action(() => { const $event = event; vm.edit(item) }),
"className": ["ui-button-text ui-button-sm"].filter(Boolean).join(' '),
"tooltip": {text: t('cis.edit'), position: 'right', className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "copy",
"aria-label": t('cis.duplicate'),
"click": (event: any) => vm.action(() => { const $event = event; vm.duplicate(item) }),
"className": ["ui-button-text ui-button-sm"].filter(Boolean).join(' '),
"tooltip": {text: t('cis.duplicate'), position: 'right', className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "share-alt",
"aria-label": t('cis.share'),
"click": (event: any) => vm.action(() => { const $event = event; vm.share(item) }),
"className": ["ui-button-text ui-button-sm"].filter(Boolean).join(' '),
"tooltip": {text: t('cis.share'), position: 'right', className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "trash",
"aria-label": t('cis.delete'),
"click": (event: any) => vm.action(() => { const $event = event; vm.remove(item) }),
"className": ["ui-button-text ui-button-danger ui-button-sm"].filter(Boolean).join(' '),
"tooltip": {text: t('cis.delete'), position: 'right', className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render></Render></Render></Render></>; },
"template_emptymessage": (context: any) => {  return <><Render tag="tr" props={{}}><Render tag="td" props={{"colSpan": "2",
"className": ["text-center text-color-secondary py-5"].filter(Boolean).join(' ')}}>{t('cis.noItems')}</Render></Render></>; }}}>

</Render></Render>
{(() => { const __condition4 = vm.copied;  return __condition4 ? <><Render tag="p" props={{"className": ["text-color-secondary"].filter(Boolean).join(' ')}}>{t('cis.linkCopied')}</Render></> : null; })()}</Render></> : null; })()}
{(() => { const __condition5 = !(vm.libraryMode);  return __condition5 ? <><Render tag="div" props={{"className": ["studio-mobile-toggle mb-3"].filter(Boolean).join(' ')}}><Render tag="app-ui-select-button" props={{"ariaLabelledBy": "studio-mobile-label",
"options": vm.mobileViews,
"value": vm.mobileView,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.mobileView = $event) }))(value); })}}></Render>
<Render tag="span" props={{"id": "studio-mobile-label",
"className": ["ui-sr-only"].filter(Boolean).join(' ')}}>{t('cis.editorOrPreview')}</Render></Render></> : null; })()}
{(() => { const __condition6 = !(vm.libraryMode);  return __condition6 ? <><Render tag="div" props={{"className": ["studio-workspace",((vm.mobileView === "preview") ? "studio-show-preview" : '')].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["studio-main"].filter(Boolean).join(' ')}}><Render tag="app-ui-select-button" props={{"ariaLabelledBy": "studio-sections-label",
"options": vm.availableSections,
"value": vm.section,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.section = $event) }))(value); })}}></Render>
<Render tag="span" props={{"id": "studio-sections-label",
"className": ["ui-sr-only"].filter(Boolean).join(' ')}}>{t('cis.itemSections')}</Render>
<Render tag="div" props={{"className": ["studio-editor-scroll mt-3"].filter(Boolean).join(' ')}}>{(() => { const __condition7 = (vm.section === "item");  return __condition7 ? <><Render tag="div" props={{}}>{(() => { let importSource: any = vm["importSource"]; return <><Render tag="label" props={{"htmlFor": "studio-import-script"}}>{t('cis.importFrom')}</Render>
<Render tag="div" props={{"focusout": (event: any) => vm.action(() => { const $event = event; vm.closeImportOutside($event,importSource) }),
"className": ["studio-source mt-2 mb-3"].filter(Boolean).join(' '),
"reference": (value: any) => { importSource = value; vm["importSource"] = value; }}}><Render tag="input" props={{"id": "studio-import-script",
"type": "search",
"placeholder": t('cis.searchItemByNameId'),
"focus": (event: any) => vm.action(() => { const $event = event; (vm.importOpen = true) }),
"value": vm.importQuery,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.importQuery = $event) }))(value); }),
"inputText": true}}></Render>
{(() => { const __condition8 = vm.importedBackup;  return __condition8 ? <><Render tag="button" props={{"type": "button",
"label": t('cis.undoImport'),
"click": (event: any) => vm.action(() => { const $event = event; vm.undoImport() }),
"className": ["ui-button-text ui-button-sm"].filter(Boolean).join(' '),
"button": true}}></Render></> : null; })()}
{(() => { const __condition9 = (vm.importOpen && vm.importQuery);  return __condition9 ? <><Render tag="div" props={{"className": ["studio-source-results surface-overlay border-1 surface-border border-round"].filter(Boolean).join(' ')}}>{(vm.sourceResults ?? []).map((__entry10: any, __index10: number, __array10: any[]) => { const source = __entry10; return <Fragment key={identityKey(__entry10)}><Render tag="button" props={{"type": "button",
"click": (event: any) => vm.action(() => { const $event = event; vm.importScript(source) }),
"className": ["ui-button-text w-full justify-content-start"].filter(Boolean).join(' '),
"button": true}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", (source.iconItemId || source.id), ["item"], services),
"className": ["item_img mr-2"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="span" props={{"className": ["text-left"].filter(Boolean).join(' ')}}>{interpolate(["",""], [source.name])}
<Render tag="small" props={{"className": ["block text-color-secondary"].filter(Boolean).join(' ')}}>{interpolate(["#"," · "," "," ",""], [source.id,vm.sourceCategory(source),(source.custom ? t('cis.sourceMine') : (source.preRelease ? t('cis.sourcePreview') : "")),((displayPipe("json", source.script, [], services) === "{}") ? t('cis.sourceNoBonus') : "")])}</Render></Render></Render></Fragment>; })}
{(() => { const __condition11 = !(vm.sourceResults.length);  return __condition11 ? <><Render tag="span" props={{"className": ["block p-3 text-color-secondary"].filter(Boolean).join(' ')}}>{t('cis.noScript')}</Render></> : null; })()}</Render></> : null; })()}</Render>
<Render tag="div" props={{"className": ["studio-fields ui-fluid"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["studio-wide"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "studio-name"}}>{t('cis.name')}</Render>
<Render tag="input" props={{"id": "studio-name",
"placeholder": t('cis.itemName'),
"value": vm.draft.name,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.name = $event);vm.validate() }))(value); }),
"inputText": true}}></Render></Render>
<Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-kind"}}>{t('cis.type')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-kind",
"filterBy": "label",
"options": vm.kindOptions,
"filter": true,
"value": vm.draft.kind,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.selectKind($event) }))(value); })}}></Render></Render>
{(() => { const __condition12 = (vm.draft.kind === "weapon");  return __condition12 ? <><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-weapon-type"}}>{t('cis.weaponType')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-weapon-type",
"optionLabel": "label",
"optionValue": "id",
"filterBy": "label",
"options": vm.weaponSubtypes,
"filter": true,
"value": vm.draft.itemSubTypeId,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.itemSubTypeId = $event);vm.onSubtypeChange() }))(value); })}}></Render></Render></> : null; })()}
{(() => { const __condition13 = (vm.draft.kind === "ammo");  return __condition13 ? <><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-ammo-type"}}>{t('cis.condAmmoType')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-ammo-type",
"optionLabel": "label",
"optionValue": "id",
"filterBy": "label",
"options": vm.ammoSubtypes,
"filter": true,
"value": vm.draft.itemSubTypeId,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.itemSubTypeId = $event);vm.onSubtypeChange() }))(value); })}}></Render></Render></> : null; })()}
<Render tag="div" props={{}}>{(() => { let iconPicker: any = vm["iconPicker"]; return <><Render tag="label" props={{"htmlFor": "studio-icon"}}>{t('cis.icon')}</Render>
<Render tag="button" props={{"id": "studio-icon",
"type": "button",
"click": (event: any) => vm.action(() => { const $event = event; iconPicker.toggle($event) }),
"className": ["studio-icon-trigger ui-button-outlined w-full justify-content-start gap-2"].filter(Boolean).join(' '),
"button": true}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", vm.previewIcon, ["item"], services),
"className": ["item_img"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="span" props={{}}>{t('cis.pickIcon')}</Render></Render>
<Render tag="app-ui-popover" props={{"styleClass": "studio-icon-panel",
"reference": (value: any) => { iconPicker = value; vm["iconPicker"] = value; },
"handle": vm["iconPicker"]}}><Render tag="div" props={{"className": ["studio-icon-picker"].filter(Boolean).join(' ')}}><Render tag="strong" props={{"className": ["block mb-2"].filter(Boolean).join(' ')}}>{t('cis.iconsOf', { kind: vm.kindLabels[vm.draft.kind] })}</Render>
<Render tag="input" props={{"type": "search",
"placeholder": t('cis.searchNameId'),
"aria-label": t('cis.searchIcons'),
"value": vm.iconQuery,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.iconQuery = $event);vm.filterIconOptions() }))(value); }),
"className": ["w-full mb-2"].filter(Boolean).join(' '),
"inputText": true}}></Render>
<Render tag="button" props={{"type": "button",
"label": t('cis.autoIcon'),
"click": (event: any) => vm.action(() => { const $event = event; vm.selectIcon();iconPicker.hide() }),
"className": ["ui-button-text ui-button-sm mb-2"].filter(Boolean).join(' '),
"button": true}}></Render>
{(() => { const __condition14 = vm.iconFilteredOptions.length;  return __condition14 ? <><Render tag="div" props={{"scroll": (event: any) => vm.action(() => { const $event = event; vm.loadMoreIcons($event) }),
"className": ["studio-icon-viewport"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["studio-icon-grid"].filter(Boolean).join(' ')}}>{(vm.visibleIcons ?? []).map((__entry15: any, __index15: number, __array15: any[]) => { const option = __entry15; return <Fragment key={identityKey(vm.trackIcon(__index15, __entry15))}><Render tag="button" props={{"type": "button",
"tooltipPosition": "top",
"aria-label": t('cis.useIconOf', { name: option.name }),
"click": (event: any) => vm.action(() => { const $event = event; vm.selectIcon(option.id);iconPicker.hide() }),
"className": ["studio-icon-option",((vm.previewIcon === option.id) ? "studio-icon-option--selected" : '')].filter(Boolean).join(' '),
"tooltip": {text: ((option.name + " · ID ") + option.id), position: "top", className: '', showDelay: 350, hideDelay: 0, escape: true, disabled: false}}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", option.id, ["item"], services),
"error": (event: any) => vm.action(() => { const $event = event; vm.iconLoadFailed(option.id) }),
"missingIcon": true}}></Render></Render></Fragment>; })}</Render></Render></> : null; })()}
{(() => { const __condition16 = !(vm.iconFilteredOptions.length);  return __condition16 ? <><Render tag="span" props={{"className": ["text-color-secondary text-sm"].filter(Boolean).join(' ')}}>{t('cis.noIcons')}</Render></> : null; })()}</Render></Render></>; })()}</Render>
{(() => { const __condition17 = (vm.draft.kind === "card");  return __condition17 ? <><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-card-position"}}>{t('cis.cardPosition')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-card-position",
"placeholder": t('cis.anyPosition'),
"options": vm.cardPositions,
"autoDisplayFirst": false,
"value": vm.draft.compositionPos,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.compositionPos = $event);vm.validate() }))(value); })}}></Render></Render></> : null; })()}
{(() => { const __condition18 = vm.isEquipment(vm.draft.kind);  return __condition18 ? <><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-level"}}>{t('cis.itemLevel')}</Render>
<Render tag="input" props={{"id": "studio-level",
"type": "number",
"min": "0",
"max": "5",
"value": vm.draft.itemLevel,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.itemLevel = $event);vm.validate() }))(value); }),
"inputText": true}}></Render></Render></> : null; })()}
{(() => { const __condition19 = (vm.draft.kind === "weapon");  return __condition19 ? <><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-atk"}}>{t('cis.baseAtk')}</Render>
<Render tag="input" props={{"id": "studio-atk",
"type": "number",
"min": "0",
"value": vm.draft.attack,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.attack = $event);vm.validate() }))(value); }),
"inputText": true}}></Render></Render></> : null; })()}
{(() => { const __condition20 = (vm.draft.kind === "weapon");  return __condition20 ? <><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-matk"}}>{t('cis.baseMatk')}</Render>
<Render tag="input" props={{"id": "studio-matk",
"type": "number",
"min": "0",
"value": vm.draft.baseMatk,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.baseMatk = $event);vm.validate() }))(value); }),
"inputText": true}}></Render></Render></> : null; })()}
{(() => { const __condition21 = vm.isEquipment(vm.draft.kind);  return __condition21 ? <><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-def"}}>{t('cis.baseDef')}</Render>
<Render tag="input" props={{"id": "studio-def",
"type": "number",
"min": "0",
"value": vm.draft.defense,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.defense = $event);vm.validate() }))(value); }),
"inputText": true}}></Render></Render></> : null; })()}
<Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-weight"}}>{t('cis.weight')}</Render>
<Render tag="input" props={{"id": "studio-weight",
"type": "number",
"min": "0",
"value": vm.draft.weight,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.weight = $event);vm.validate() }))(value); }),
"inputText": true}}></Render></Render>
{(() => { const __condition22 = ((vm.draft.kind === "ammo") || vm.isEquipment(vm.draft.kind));  return __condition22 ? <><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-element"}}>{t('cis.elementProperty')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-element",
"placeholder": t('cis.neutral'),
"filterBy": "label",
"options": vm.elements,
"autoDisplayFirst": false,
"showClear": true,
"filter": true,
"value": vm.draft.propertyAtk,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.propertyAtk = $event);vm.validate() }))(value); }),
"template_item": (context: any) => { const element = context["$implicit"]; return <><Render tag="app-ui-tag" props={{"value": element.label,
"styleClass": ("property_" + element.value)}}></Render></>; },
"template_selectedItem": (context: any) => { const element = context["$implicit"]; return <><Render tag="app-ui-tag" props={{"value": element.label,
"styleClass": ("property_" + element.value)}}></Render></>; }}}>
</Render></Render></> : null; })()}
{(() => { const __condition23 = vm.isEquipment(vm.draft.kind);  return __condition23 ? <><Render tag="div" props={{"className": ["studio-wide"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "studio-classes"}}>{t('cis.allowedClasses')}</Render>
<Render tag="app-ui-multi-select" props={{"inputId": "studio-classes",
"optionLabel": "label",
"optionValue": "value",
"filterBy": "label",
"defaultLabel": t('cis.allClasses'),
"selectedItemsLabel": t('cis.selectedClasses'),
"options": vm.classes,
"filter": true,
"showToggleAll": false,
"value": vm.draft.usableClass,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.usableClass = $event);vm.validate() }))(value); }),
"template_item": (context: any) => { const job = context["$implicit"]; return <><Render tag="div" props={{"className": ["flex align-items-center gap-2"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", job.icon, ["job"], services),
"className": ["job_img"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="span" props={{}}>{interpolate(["",""], [job.label])}</Render></Render></>; }}}></Render></Render></> : null; })()}</Render>
{(() => { const __condition24 = ((((((vm.draft.kind === "headUpper") || (vm.draft.kind === "headMiddle")) || (vm.draft.kind === "headLower")) || (vm.draft.kind === "costumeUpper")) || (vm.draft.kind === "costumeMiddle")) || (vm.draft.kind === "costumeLower"));  return __condition24 ? <><Render tag="div" props={{"className": ["flex flex-wrap align-items-center gap-3 mt-3"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{t('cis.occupies')}</Render>
{["Upper","Middle","Lower"].map((__entry25: any, __index25: number, __array25: any[]) => { const location = __entry25; return <Fragment key={identityKey(__entry25)}><Render tag="app-ui-checkbox" props={{"binary": true,
"label": t((location === "Upper") ? 'itemSlot.headUpper' : ((location === "Middle") ? 'itemSlot.headMiddle' : 'itemSlot.headLower')),
"value": vm.headOccupancy.includes(location),
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.toggleHeadLocation(location,$event) }))(value); })}}></Render></Fragment>; })}</Render></> : null; })()}
{(() => { const __condition26 = vm.isEquipment(vm.draft.kind);  return __condition26 ? <><Render tag="div" props={{"className": ["flex flex-wrap gap-3 mt-3 ui-fluid"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["flex align-items-center gap-2 skill-control-row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"id": "studio-refinable-label"}}>{t('cis.refinable')}</Render>
<Render tag="app-ui-select-button" props={{"ariaLabelledBy": "studio-refinable-label",
"options": vm.yesNoOptions,
"value": vm.draft.isRefinable,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.isRefinable = $event);vm.validate() }))(value); }),
"className": ["w-5rem"].filter(Boolean).join(' ')}}></Render></Render>
<Render tag="div" props={{"className": ["flex align-items-center gap-2 skill-control-row"].filter(Boolean).join(' ')}}><Render tag="span" props={{"id": "studio-gradable-label"}}>{t('cis.gradable')}</Render>
<Render tag="app-ui-select-button" props={{"ariaLabelledBy": "studio-gradable-label",
"options": vm.yesNoOptions,
"value": vm.draft.canGrade,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.draft.canGrade = $event);vm.validate() }))(value); }),
"className": ["w-5rem"].filter(Boolean).join(' ')}}></Render></Render></Render></> : null; })()}</>; })()}</Render></> : null; })()}
{(() => { const __condition27 = ((vm.section === "sockets") && vm.isEquipment(vm.draft.kind));  return __condition27 ? <><Render tag="div" props={{}}><Render tag="div" props={{"className": ["studio-fields ui-fluid"].filter(Boolean).join(' ')}}><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-card-count"}}>{t('cis.cards')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-card-count",
"options": vm.cardCounts,
"value": vm.draft.cardCapacity,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.changeCapacity("cardCapacity",$event) }))(value); })}}></Render></Render>
<Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-enchant-count"}}>{t('cis.enchants')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-enchant-count",
"options": vm.enchantCounts,
"value": vm.draft.enchantCapacity,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.changeCapacity("enchantCapacity",$event) }))(value); })}}></Render></Render>
<Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-ba-count"}}>{t('cis.randomOptions')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-ba-count",
"options": vm.baCounts,
"value": vm.draft.baCapacity,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.changeCapacity("baCapacity",$event) }))(value); })}}></Render></Render></Render>
<Render tag="div" props={{"aria-label": t('cis.sharedPositions'),
"className": ["studio-sockets"].filter(Boolean).join(' ')}}>{[0,1,2,3].map((__entry28: any, __index28: number, __array28: any[]) => { const n = __entry28; return <Fragment key={identityKey(__entry28)}><Render tag="span" props={{"aria-label": t((n < vm.draft.cardCapacity) ? 'cis.typeCard' : ((n < (vm.draft.cardCapacity + vm.draft.enchantCapacity)) ? 'cis.typeEnchant' : 'cis.socketFree')),
"className": [((n < (vm.draft.cardCapacity + vm.draft.enchantCapacity)) ? "studio-socket-filled" : '')].filter(Boolean).join(' ')}}>{interpolate(["",""], [((n < vm.draft.cardCapacity) ? "C" : ((n < (vm.draft.cardCapacity + vm.draft.enchantCapacity)) ? "E" : "+"))])}</Render></Fragment>; })}</Render>
<Render tag="p" props={{"className": ["text-color-secondary text-sm"].filter(Boolean).join(' ')}}>{t('cis.socketsNote')}</Render>
{(() => { const __condition29 = vm.capacityNotice;  return __condition29 ? <><Render tag="p" props={{"className": ["text-color-secondary text-sm"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.capacityNotice])}</Render></> : null; })()}
{(vm.attachmentRows ?? []).map((__entry30: any, __index30: number, __array30: any[]) => { const row = __entry30; return <Fragment key={identityKey(__entry30)}><>{(() => { const __condition31 = row.views.length;  return __condition31 ? <><Render tag="div" props={{"className": ["mt-4"].filter(Boolean).join(' ')}}><Render tag="span" props={{"className": ["block mb-2"].filter(Boolean).join(' ')}}>{interpolate(["",""], [row.label])}</Render>
<Render tag="div" props={{"className": ["flex flex-wrap gap-2"].filter(Boolean).join(' ')}}>{(row.views ?? []).map((__entry32: any, __index32: number, __array32: any[]) => { const view = __entry32; return <Fragment key={identityKey(__entry32)}><Render tag="app-equipment-chip" props={{"view": view,
"items": vm.items,
"pick": (event: any) => vm.action(() => { const $event = event; vm.pickAttachment(row.field,view,$event) }),
"clear": (event: any) => vm.action(() => { const $event = event; vm.setAttachment(row.field,view.chip.index,null) })}}></Render></Fragment>; })}</Render></Render></> : null; })()}</></Fragment>; })}</Render></> : null; })()}
{(() => { const __condition33 = (vm.section === "bonuses");  return __condition33 ? <><Render tag="div" props={{}}><Render tag="div" props={{"className": ["flex align-items-center justify-content-between gap-2"].filter(Boolean).join(' ')}}><Render tag="app-ui-select-button" props={{"ariaLabelledBy": "studio-mode-label",
"options": vm.modes,
"value": vm.mode,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.setMode($event) }))(value); })}}></Render>
<Render tag="button" props={{"type": "button",
"icon": "question-circle",
"aria-label": t('cis.scriptHelp'),
"click": (event: any) => vm.action(() => { const $event = event; (vm.scriptHelpVisible = true) }),
"className": ["ui-button-text ui-button-rounded"].filter(Boolean).join(' '),
"tooltip": {text: t('cis.scriptHelp'), position: 'right', className: '', showDelay: 0, hideDelay: 0, escape: true, disabled: false},
"button": true}}></Render></Render>
<Render tag="span" props={{"id": "studio-mode-label",
"className": ["ui-sr-only"].filter(Boolean).join(' ')}}>{t('cis.scriptMode')}</Render>
{(() => { const __condition34 = (vm.mode === "visual");  return __condition34 ? <><Render tag="div" props={{"className": ["mt-3"].filter(Boolean).join(' ')}}>{(vm.rules ?? []).map((__entry35: any, __index35: number, __array35: any[]) => { const rule = __entry35;
const i = __index35; return <Fragment key={identityKey(__entry35)}><Render tag="div" props={{"className": ["studio-rule surface-card border-1 surface-border border-round p-3 mb-3"].filter(Boolean).join(' ')}}>{(() => { const preservedRule = (context: any) => {  return <><Render tag="strong" props={{"className": ["studio-preserved-title"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.bonusLabel(rule.key)])}</Render></>; }; return <>{(() => { const __condition36 = !(rule.readOnly);  return __condition36 ? <><><Render tag="app-ui-dropdown" props={{"optionLabel": "label",
"optionValue": "key",
"filterBy": "label,key",
"placeholder": t('cis.bonusPlaceholder'),
"ariaLabel": t('cis.bonusPlaceholder'),
"options": vm.bonusKeys,
"filter": true,
"value": rule.key,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (rule.key = $event);vm.writeRules() }))(value); })}}></Render>
<Render tag="input" props={{"type": "number",
"step": "any",
"placeholder": t('cis.bonusValue'),
"aria-label": t('cis.bonusValue'),
"value": rule.value,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (rule.value = $event);vm.writeRules() }))(value); }),
"inputText": true}}></Render></></> : preservedRule({}); })()}

<Render tag="button" props={{"type": "button",
"icon": "times",
"aria-label": t('cis.removeRule'),
"click": (event: any) => vm.action(() => { const $event = event; vm.removeRule(i) }),
"className": ["ui-button-text ui-button-danger"].filter(Boolean).join(' '),
"button": true}}></Render>
{(() => { const __condition37 = rule.readOnly;  return __condition37 ? <><Render tag="div" props={{"className": ["studio-wide"].filter(Boolean).join(' ')}}><Render tag="p" props={{"className": ["text-sm mt-0"].filter(Boolean).join(' ')}}>{interpolate(["",""], [rule.description])}</Render>
<Render tag="small" props={{"className": ["block text-color-secondary mb-2"].filter(Boolean).join(' ')}}>{t('cis.importedRuleKept')}</Render>
<Render tag="button" props={{"type": "button",
"label": t('cis.editJson'),
"click": (event: any) => vm.action(() => { const $event = event; vm.setMode("json") }),
"className": ["ui-button-outlined ui-button-sm"].filter(Boolean).join(' '),
"button": true}}></Render></Render></> : null; })()}
{(() => { const __condition38 = !(rule.readOnly);  return __condition38 ? <><Render tag="div" props={{"className": ["studio-wide"].filter(Boolean).join(' ')}}><Render tag="small" props={{"className": ["block text-color-secondary mb-2"].filter(Boolean).join(' ')}}>{(rule.conditions.length ? t('cis.allConditionsNote') : t('cis.condNone'))}</Render>
{(rule.conditions ?? []).map((__entry39: any, __index39: number, __array39: any[]) => { const condition = __entry39;
const j = __index39; return <Fragment key={identityKey(__entry39)}><>{(() => { const __condition40 = vm.conditionHelp(condition.kind); const help = __condition40; return __condition40 ? <><Render tag="div" props={{"className": ["studio-condition mb-2"].filter(Boolean).join(' ')}}><Render tag="app-ui-dropdown" props={{"options": vm.conditionOptions,
"ariaLabel": t('cis.conditionAria', { n: j + 1, bonus: i + 1 }),
"value": condition.kind,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; vm.changeCondition(condition,$event) }))(value); })}}></Render>
<Render tag="div" props={{"className": ["ui-fluid"].filter(Boolean).join(' ')}}>{help.input === "select" && <><Render tag="app-ui-dropdown" props={{"filterBy": "label,value",
"options": help.options,
"autoDisplayFirst": false,
"filter": true,
"virtualScroll": true,
"virtualScrollItemSize": 38,
"placeholder": help.valueLabel,
"ariaLabel": help.valueLabel,
"value": condition.value,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (condition.value = $event);vm.writeRules() }))(value); }),
"template_item": (context: any) => { const option = context["$implicit"]; return <><Render tag="div" props={{"className": ["flex align-items-center gap-2"].filter(Boolean).join(' ')}}>{(() => { const __condition41 = option.icon;  return __condition41 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", option.icon, [option.iconType], services),
"className": [classNames(((option.iconType === "job") ? "job_img" : "item_img"))].filter(Boolean).join(' '),
"missingIcon": true}}></Render></> : null; })()}
<Render tag="span" props={{}}>{interpolate(["",""], [option.label])}</Render></Render></>; }}}></Render></>}
{help.input === "item" && <>{(() => { let conditionItem: any = vm["conditionItem"]; return <><Render tag="button" props={{"type": "button",
"aria-label": t('cis.pickRequiredItem'),
"click": (event: any) => vm.action(() => { const $event = event; vm.pickConditionItem(condition,conditionItem) }),
"className": ["ui-button-outlined justify-content-start"].filter(Boolean).join(' '),
"button": true,
"reference": (value: any) => { conditionItem = value; vm["conditionItem"] = value; }}}>{(() => { const __condition42 = condition.value;  return __condition42 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", condition.value, ["item"], services),
"className": ["item_img mr-2"].filter(Boolean).join(' '),
"missingIcon": true}}></Render></> : null; })()}
<Render tag="span" props={{}}>{interpolate(["",""], [vm.conditionItemName(condition)])}</Render></Render></>; })()}</>}
{help.input === "number" && <><Render tag="input" props={{"type": "number",
"min": "0",
"step": "1",
"placeholder": t('cis.valueExample', { label: help.valueLabel, example: help.example }),
"aria-label": help.valueLabel,
"value": condition.value,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (condition.value = $event);vm.writeRules() }))(value); }),
"inputText": true}}></Render></>}
{help.input === "date" && <><Render tag="input" props={{"type": "date",
"aria-label": help.valueLabel,
"value": condition.value,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (condition.value = $event);vm.writeRules() }))(value); }),
"inputText": true}}></Render></>}
{help.input === "text" && <><Render tag="input" props={{"placeholder": t('cis.valueExample', { label: help.valueLabel, example: help.example }),
"aria-label": help.valueLabel,
"value": condition.value,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (condition.value = $event);vm.writeRules() }))(value); }),
"inputText": true}}></Render></>}
{(() => { const __condition43 = help.extraLabel;  return __condition43 ? <><Render tag="input" props={{"type": "number",
"min": "1",
"step": "1",
"placeholder": t('cis.valueExample', { label: help.extraLabel, example: help.extraExample }),
"aria-label": help.extraLabel,
"value": condition.extra,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (condition.extra = $event);vm.writeRules() }))(value); }),
"className": ["mt-2"].filter(Boolean).join(' '),
"inputText": true}}></Render></> : null; })()}</Render>
<Render tag="button" props={{"type": "button",
"icon": "times",
"aria-label": t('cis.removeConditionAria', { n: j + 1, bonus: i + 1 }),
"click": (event: any) => vm.action(() => { const $event = event; vm.removeCondition(rule,j) }),
"className": ["ui-button-text ui-button-danger ui-button-sm"].filter(Boolean).join(' '),
"button": true}}></Render>
{(() => { const __condition44 = help.help;  return __condition44 ? <><Render tag="small" props={{"className": ["studio-wide text-color-secondary"].filter(Boolean).join(' ')}}>{interpolate(["",""], [help.help])}</Render></> : null; })()}</Render></> : null; })()}</></Fragment>; })}
<Render tag="button" props={{"type": "button",
"icon": "plus",
"label": t('cis.addCondition'),
"click": (event: any) => vm.action(() => { const $event = event; vm.addCondition(rule) }),
"className": ["ui-button-text ui-button-sm"].filter(Boolean).join(' '),
"button": true}}></Render></Render></> : null; })()}</>; })()}</Render></Fragment>; })}
{(() => { const __condition45 = ((vm.draft.script?.["autoCast"]?.length || vm.draft.script?.["autoCastEffect"]?.length) || vm.draft.script?.["autoCastPending"]?.length);  return __condition45 ? <><Render tag="p" props={{"className": ["text-sm text-color-secondary"].filter(Boolean).join(' ')}}>{t('cis.autoCastNote')}</Render></> : null; })()}
<Render tag="button" props={{"type": "button",
"icon": "plus",
"label": t('cis.addRule'),
"click": (event: any) => vm.action(() => { const $event = event; vm.addRule() }),
"className": ["ui-button-outlined ui-button-sm"].filter(Boolean).join(' '),
"button": true}}></Render></Render></> : null; })()}
{(() => { const __condition46 = (vm.mode === "json");  return __condition46 ? <><Render tag="div" props={{"className": ["mt-3"].filter(Boolean).join(' ')}}><Render tag="button" props={{"type": "button",
"icon": "align-left",
"label": t('cis.formatJson'),
"click": (event: any) => vm.action(() => { const $event = event; vm.formatJson() }),
"className": ["ui-button-outlined ui-button-sm"].filter(Boolean).join(' '),
"button": true}}></Render>
<Render tag="div" props={{"className": ["studio-json-editor json_display mt-2"].filter(Boolean).join(' ')}}>{(() => { let scriptHighlight: any = vm["scriptHighlight"];
let scriptInput: any = vm["scriptInput"]; return <><Render tag="pre" props={{"aria-hidden": "true",
"dangerouslySetInnerHTML": {__html: sanitizeHtml(displayPipe("prettyjson", (vm.rawScript + "\n"), [[false,0,"raw"]], services) ?? '')},
"className": ["studio-json-highlight"].filter(Boolean).join(' '),
"reference": (value: any) => { scriptHighlight = value; vm["scriptHighlight"] = value; }}}></Render>
<Render tag="textarea" props={{"wrap": "off",
"spellcheck": "false",
"autocapitalize": "off",
"autocomplete": "off",
"aria-label": t('cis.scriptJson'),
"scroll": (event: any) => vm.action(() => { const $event = event; (scriptHighlight.scrollTop = scriptInput.scrollTop);(scriptHighlight.scrollLeft = scriptInput.scrollLeft) }),
"value": vm.rawScript,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.rawScript = $event);vm.onRawScript() }))(value); }),
"inputText": true,
"reference": (value: any) => { scriptInput = value; vm["scriptInput"] = value; }}}></Render></>; })()}</Render></Render></> : null; })()}</Render></> : null; })()}</Render></Render>
<Render tag="aside" props={{"className": ["studio-preview surface-card border-1 surface-border border-round p-3"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["flex align-items-center gap-2 mb-3"].filter(Boolean).join(' ')}}><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", vm.previewIcon, ["item"], services),
"className": ["item_img"].filter(Boolean).join(' '),
"missingIcon": true}}></Render>
<Render tag="div" props={{"className": ["studio-item-name"].filter(Boolean).join(' ')}}><Render tag="small" props={{"className": ["text-color-secondary"].filter(Boolean).join(' ')}}>{t('cis.itemPreviewCap')}</Render>
<Render tag="strong" props={{"className": ["block text-lg"].filter(Boolean).join(' ')}}>{(vm.draft.name || t('cis.newItem'))}</Render>
<Render tag="span" props={{"className": ["text-color-secondary text-sm"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.kindLabels[vm.draft.kind]])}</Render></Render></Render>
<Render tag="div" props={{"className": ["flex flex-wrap gap-2 mb-3 text-sm"].filter(Boolean).join(' ')}}>{(() => { const __condition47 = vm.draft.attack;  return __condition47 ? <><Render tag="span" props={{}}>{t('cis.previewAtk', { value: vm.draft.attack })}</Render></> : null; })()}
{(() => { const __condition48 = vm.draft.baseMatk;  return __condition48 ? <><Render tag="span" props={{}}>{t('cis.previewMatk', { value: vm.draft.baseMatk })}</Render></> : null; })()}
{(() => { const __condition49 = vm.draft.defense;  return __condition49 ? <><Render tag="span" props={{}}>{t('cis.previewDef', { value: vm.draft.defense })}</Render></> : null; })()}
{(() => { const __condition50 = vm.draft.canGrade;  return __condition50 ? <><Render tag="span" props={{}}>{t('cis.gradable')}</Render></> : null; })()}
{(() => { const __condition51 = vm.draft.isRefinable;  return __condition51 ? <><Render tag="span" props={{}}>{t('cis.refinable')}</Render></> : null; })()}</Render>
{(() => { const __condition52 = vm.previewControls.length;  return __condition52 ? <><Render tag="div" props={{"role": "group",
"aria-label": t('cis.previewRefineGrade'),
"className": ["flex flex-wrap gap-2 mb-3"].filter(Boolean).join(' ')}}>{(vm.previewControls ?? []).map((__entry53: any, __index53: number, __array53: any[]) => { const control = __entry53; return <Fragment key={identityKey(__entry53)}><Render tag="app-equipment-chip" props={{"view": control.view,
"pick": (event: any) => vm.action(() => { const $event = event; vm.pickPreview(control.field,$event) }),
"clear": (event: any) => vm.action(() => { const $event = event; vm.setPreviewValue(control.field,null) })}}></Render></Fragment>; })}</Render></> : null; })()}
{(() => { const __condition54 = (vm.draft.kind === "pet");  return __condition54 ? <><Render tag="div" props={{"className": ["studio-fields ui-fluid mb-3"].filter(Boolean).join(' ')}}><Render tag="div" props={{}}><Render tag="label" props={{"htmlFor": "studio-loyalty"}}>{t('cis.loyalty')}</Render>
<Render tag="app-ui-dropdown" props={{"inputId": "studio-loyalty",
"options": vm.loyaltyOptions,
"value": vm.previewLoyalty,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.previewLoyalty = $event);vm.updatePreview() }))(value); })}}></Render></Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["studio-description border-top-1 surface-border pt-3"].filter(Boolean).join(' ')}}>{(vm.previewText || t('cis.noBonusMapped'))}</Render>
<Render tag="div" props={{"className": ["border-top-1 surface-border pt-3 mt-3 text-sm"].filter(Boolean).join(' ')}}><Render tag="strong" props={{}}>{t('cis.bonusesInBuild')}</Render>
{(vm.previewBonuses ?? []).map((__entry55: any, __index55: number, __array55: any[]) => { const bonus = __entry55; return <Fragment key={identityKey(__entry55)}><Render tag="span" props={{"className": ["block mt-1"].filter(Boolean).join(' ')}}>{interpolate([""," ","",""], [bonus.label,((bonus.value >= 0) ? "+" : ""),bonus.value])}</Render></Fragment>; })}
{(() => { const __condition56 = !(vm.previewBonuses.length);  return __condition56 ? <><Render tag="small" props={{"className": ["block mt-1 text-color-secondary"].filter(Boolean).join(' ')}}>{t('cis.noActiveEffect')}</Render></> : null; })()}</Render>
{(() => { const __condition57 = vm.previewRules.length;  return __condition57 ? <><Render tag="div" props={{"className": ["border-top-1 surface-border pt-3 mt-3 text-sm"].filter(Boolean).join(' ')}}><Render tag="strong" props={{}}>{t('cis.conditions')}</Render>
{(vm.previewRules ?? []).map((__entry58: any, __index58: number, __array58: any[]) => { const rule = __entry58; return <Fragment key={identityKey(__entry58)}><Render tag="div" props={{"className": ["mt-2",(!(rule.active) ? "text-color-secondary" : '')].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate([""," ","",""], [(rule.active ? "●" : "○"),rule.label,(rule.active ? ((" " + ((rule.value >= 0) ? "+" : "")) + rule.value) : "")])}</Render>
<Render tag="small" props={{"className": ["block text-color-secondary"].filter(Boolean).join(' ')}}>{interpolate(["",""], [rule.reason])}</Render></Render></Fragment>; })}</Render></> : null; })()}</Render></Render></> : null; })()}
{(() => { const __condition59 = vm.diagnostics.length;  return __condition59 ? <><Render tag="div" props={{"role": "alert",
"className": ["studio-errors ui-error text-sm mt-2"].filter(Boolean).join(' ')}}>{(vm.diagnostics ?? []).map((__entry60: any, __index60: number, __array60: any[]) => { const error = __entry60; return <Fragment key={identityKey(__entry60)}><Render tag="div" props={{}}>{interpolate(["",""], [error])}</Render></Fragment>; })}</Render></> : null; })()}
</Render>
<Render tag="app-ui-dialog" props={{"header": t('cis.helpTitle'),
"visible": vm.scriptHelpVisible,
"modal": true,
"dismissableMask": true,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.scriptHelpVisible = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "min(92vw, 720px)","height": "85vh"})))}}><Render tag="p" props={{}}>{t('cis.helpIntro')}</Render>
<Render tag="h3" props={{}}>{t('cis.visualEditor')}</Render>
<Render tag="ol" props={{"className": ["pl-4"].filter(Boolean).join(' ')}}><Render tag="li" props={{"className": ["mb-2"].filter(Boolean).join(' ')}}>{rich('cis.helpStep1')}</Render>
<Render tag="li" props={{"className": ["mb-2"].filter(Boolean).join(' ')}}>{rich('cis.helpStep2')}</Render>
<Render tag="li" props={{}}>{rich('cis.helpStep3')}</Render></Render>
<Render tag="h3" props={{}}>{t('cis.helpValuesTitle')}</Render>
<Render tag="p" props={{}}>{t('cis.helpValuesIntro')}</Render>
<Render tag="table" props={{"className": ["w-full text-sm"].filter(Boolean).join(' ')}}><Render tag="thead" props={{}}><Render tag="tr" props={{}}><Render tag="th" props={{"scope": "col",
"className": ["text-left p-2"].filter(Boolean).join(' ')}}>{t('cis.visualSetup')}</Render>
<Render tag="th" props={{"scope": "col",
"className": ["text-left p-2"].filter(Boolean).join(' ')}}>{t('cis.result')}</Render></Render></Render>
<Render tag="tbody" props={{}}><Render tag="tr" props={{}}><Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow1Setup')}</Render>
<Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow1Result')}</Render></Render>
<Render tag="tr" props={{}}><Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow2Setup')}</Render>
<Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow2Result')}</Render></Render>
<Render tag="tr" props={{}}><Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow3Setup')}</Render>
<Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow3Result')}</Render></Render>
<Render tag="tr" props={{}}><Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow4Setup')}</Render>
<Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow4Result')}</Render></Render>
<Render tag="tr" props={{}}><Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow5Setup')}</Render>
<Render tag="td" props={{"className": ["p-2"].filter(Boolean).join(' ')}}>{t('cis.helpRow5Result')}</Render></Render></Render></Render>
<Render tag="h3" props={{}}>{t('cis.conditions')}</Render>
<Render tag="p" props={{}}>{t('cis.helpCond1')}</Render>
<Render tag="p" props={{}}>{t('cis.helpCond2')}</Render>
<Render tag="p" props={{}}>{t('cis.helpCond3')}</Render>
<Render tag="h3" props={{}}>{t('cis.helpUnitsTitle')}</Render>
<Render tag="ul" props={{"className": ["pl-4"].filter(Boolean).join(' ')}}><Render tag="li" props={{"className": ["mb-2"].filter(Boolean).join(' ')}}>{rich('cis.helpUnits1')}</Render>
<Render tag="li" props={{"className": ["mb-2"].filter(Boolean).join(' ')}}>{rich('cis.helpUnits2')}</Render>
<Render tag="li" props={{"className": ["mb-2"].filter(Boolean).join(' ')}}>{rich('cis.helpUnits3')}</Render>
<Render tag="li" props={{}}>{rich('cis.helpUnits4')}</Render></Render>
<Render tag="h3" props={{}}>{t('cis.helpJsonTitle')}</Render>
<Render tag="p" props={{}}>{t('cis.helpJson1')}</Render>
<Render tag="pre" props={{"className": ["surface-ground border-round p-3 overflow-auto"].filter(Boolean).join(' ')}}><Render tag="code" props={{}}>{interpolate(["",""], [vm.scriptHelpExample])}</Render></Render>
<Render tag="p" props={{}}>{rich('cis.helpJson2')}</Render>
<Render tag="p" props={{}}>{t('cis.helpJson3')}</Render>
<Render tag="p" props={{}}>{rich('cis.helpJson4')}</Render>
<Render tag="h3" props={{}}>{t('cis.helpPreviewTitle')}</Render>
<Render tag="p" props={{}}>{rich('cis.helpPreview1')}</Render>
<Render tag="p" props={{}}>{rich('cis.helpPreview2')}</Render>
<Render tag="p" props={{}}>{t('cis.helpPreview3')}</Render></Render>
<Render tag="app-ui-dialog" props={{"header": t('cis.mcpTitle'),
"visible": vm.mcpVisible,
"modal": true,
"dismissableMask": true,
"visibleChange": (event: any) => vm.action(() => { const $event = event; (vm.mcpVisible = $event) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle({"width": "min(92vw, 540px)"})))}}><Render tag="p" props={{}}>{t('cis.mcpIntro')}</Render>
<Render tag="code" props={{"className": ["block p-3 surface-ground border-round studio-item-name"].filter(Boolean).join(' ')}}>{interpolate(["",""], [vm.mcpUrl])}</Render>
<Render tag="p" props={{}}>{t('cis.mcpNote')}</Render></Render></>;
}
