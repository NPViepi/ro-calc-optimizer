import { Render, displayPipe, interpolate, classNames, parseStyle, normalizeStyle } from '../render';
import { useText } from '../../state/use-text';
export function Content({vm, services}: {vm: any; services: any}) {
const t = useText();
return <><Render tag="div" props={{"className": ["grid ui-fluid grid-nogutter misc-detail-table"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-7"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["grid grid-nogutter"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-6"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["grid grid-nogutter"].filter(Boolean).join(' ')}}>{(() => { const __condition1 = vm.isShowSkillMultiplierTable;  return __condition1 ? <><Render tag="div" props={{"className": ["col-12 pb-3"].filter(Boolean).join(' ')}}><Render tag="app-ui-table" props={{"styleClass": "ui-datatable-sm",
"value": vm.skillMultiplierTable,
"tableStyle": {"width": "100%","table-layout": "fixed"},
"template_header": (context: any) => {  return <><Render tag="tr" props={{}}><Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.skillNameTitle'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"className": ["color_highlight"].filter(Boolean).join(' ')}}>{t('misc.skill')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.skillBonusTitle'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"style": normalizeStyle(Object.assign({}, parseStyle("width: 3rem")))}}>{"%"}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.cdTitle'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false},
"style": normalizeStyle(Object.assign({}, parseStyle("width: 3rem")))}}>{"CD"}</Render></Render></>; },
"template_body": (context: any) => { const val = context["$implicit"]; return <><Render tag="tr" props={{}}><Render tag="td" props={{"className": ["text_ellips_no_height"].filter(Boolean).join(' ')}}><Render tag="span" props={{"tooltipPosition": "top",
"tooltipStyleClass": "item_desc_tooltip",
"className": ["skill_name_cell"].filter(Boolean).join(' '),
"tooltip": {text: (vm.skillTooltip ? vm.skillTooltip(val) : (val.displayName || val.name)), position: "top", className: "item_desc_tooltip", showDelay: 400, hideDelay: 0, escape: false, disabled: false}}}>{(() => { const __condition2 = val.icon;  return __condition2 ? <><Render tag="img" props={{"alt": "",
"src": displayPipe("iconUrl", val.icon, ["skill"], services),
"className": ["skill_icon"].filter(Boolean).join(' ')}}></Render></> : null; })()}
{(() => { const __condition3 = val.icon;  return __condition3 ? <><Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": interpolate(["https://www.divine-pride.net/database/skill/",""], [val.icon]),
"className": ["skill_label_text skill_link"].filter(Boolean).join(' ')}}>{interpolate(["",""], [(val.displayName || val.name)])}</Render></> : null; })()}
{(() => { const __condition4 = !(val.icon);  return __condition4 ? <><Render tag="span" props={{"className": ["skill_label_text"].filter(Boolean).join(' ')}}>{interpolate(["",""], [(val.displayName || val.name)])}</Render></> : null; })()}</Render></Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.value && vm.onSkillClick(val,"value")) }),
"className": [classNames(interpolate(["",""], [(!(!(val.value)) ? "summary_damage bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.value}}>{interpolate(["",""], [vm.pct(val.value)])}</Render>
{(() => { const __condition5 = vm.showArrow(val,"value");  return __condition5 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.value2 && vm.onSkillClick(val,"value",true)) }),
"className": [classNames(interpolate(["",""], [(!(!(val.value2)) ? "summary_damage2 bonus_clickable" : "summary_damage2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.value2}}>{interpolate(["",""], [vm.pct(val.value2)])}</Render></></> : null; })()}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.cd && vm.onSkillClick(val,"cd")) }),
"className": [classNames(interpolate(["",""], [(!(!(val.cd)) ? "summary_damage bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.cd}}>{interpolate(["",""], [(val.cd || "-")])}</Render>
{(() => { const __condition6 = vm.showArrow(val,"cd");  return __condition6 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.cd2 && vm.onSkillClick(val,"cd",true)) }),
"className": [classNames(interpolate(["",""], [(!(!(val.cd2)) ? "summary_damage2 bonus_clickable" : "summary_damage2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.cd2}}>{interpolate(["",""], [(val.cd2 || "-")])}</Render></></> : null; })()}</Render></Render></>; }}}>
</Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["col-12 pb-3"].filter(Boolean).join(' ')}}><Render tag="app-ui-table" props={{"styleClass": "ui-datatable-sm",
"value": vm.classTable,
"tableStyle": {"min-width": "10rem"},
"template_header": (context: any) => {  return <><Render tag="tr" props={{}}><Render tag="th" props={{"className": ["color_highlight"].filter(Boolean).join(' ')}}>{t('misc.class')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.physical'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.physicalShort')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.magical'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.magicalShort')}</Render></Render></>; },
"template_body": (context: any) => { const val = context["$implicit"]; return <><Render tag="tr" props={{}}><Render tag="td" props={{}}>{interpolate(["",""], [(val.displayName || val.name)])}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.physical && vm.onClassClick(val,"physical")) }),
"className": [classNames(interpolate(["",""], [((val.physical != 0) ? "summary_stat_atk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.physical}}>{interpolate(["",""], [vm.pct(val.physical)])}</Render>
{(() => { const __condition7 = vm.showArrow(val,"physical");  return __condition7 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.physical2 && vm.onClassClick(val,"physical",true)) }),
"className": [classNames(interpolate(["",""], [((val.physical2 != 0) ? "summary_stat_atk2 bonus_clickable" : "summary_stat_atk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.physical2}}>{interpolate(["",""], [vm.pct(val.physical2)])}</Render></></> : null; })()}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.magical && vm.onClassClick(val,"magical")) }),
"className": [classNames(interpolate(["",""], [((val.magical != 0) ? "summary_stat_matk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.magical}}>{interpolate(["",""], [vm.pct(val.magical)])}</Render>
{(() => { const __condition8 = vm.showArrow(val,"magical");  return __condition8 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.magical2 && vm.onClassClick(val,"magical",true)) }),
"className": [classNames(interpolate(["",""], [((val.magical2 != 0) ? "summary_stat_matk2 bonus_clickable" : "summary_stat_matk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.magical2}}>{interpolate(["",""], [vm.pct(val.magical2)])}</Render></></> : null; })()}</Render></Render></>; }}}>
</Render></Render>
{(() => { const __condition9 = vm.isShowSizeTable;  return __condition9 ? <><Render tag="div" props={{"className": ["col-12 pb-3"].filter(Boolean).join(' ')}}><Render tag="app-ui-table" props={{"styleClass": "ui-datatable-sm",
"value": vm.sizeTable,
"tableStyle": {"min-width": "10rem"},
"template_header": (context: any) => {  return <><Render tag="tr" props={{}}><Render tag="th" props={{"className": ["color_highlight"].filter(Boolean).join(' ')}}>{t('misc.size')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.physical'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.physicalShort')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.magical'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.magicalShort')}</Render></Render></>; },
"template_body": (context: any) => { const val = context["$implicit"]; return <><Render tag="tr" props={{}}><Render tag="td" props={{}}>{interpolate(["",""], [(val.displayName || val.name)])}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.physical && vm.onSizeClick(val,"physical")) }),
"className": [classNames(interpolate(["",""], [((val.physical != 0) ? "summary_stat_atk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.physical}}>{interpolate(["",""], [vm.pct(val.physical)])}</Render>
{(() => { const __condition10 = vm.showArrow(val,"physical");  return __condition10 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.physical2 && vm.onSizeClick(val,"physical",true)) }),
"className": [classNames(interpolate(["",""], [((val.physical2 != 0) ? "summary_stat_atk2 bonus_clickable" : "summary_stat_atk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.physical2}}>{interpolate(["",""], [vm.pct(val.physical2)])}</Render></></> : null; })()}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.magical && vm.onSizeClick(val,"magical")) }),
"className": [classNames(interpolate(["",""], [((val.magical != 0) ? "summary_stat_matk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.magical}}>{interpolate(["",""], [vm.pct(val.magical)])}</Render>
{(() => { const __condition11 = vm.showArrow(val,"magical");  return __condition11 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.magical2 && vm.onSizeClick(val,"magical",true)) }),
"className": [classNames(interpolate(["",""], [((val.magical2 != 0) ? "summary_stat_matk2 bonus_clickable" : "summary_stat_matk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.magical2}}>{interpolate(["",""], [vm.pct(val.magical2)])}</Render></></> : null; })()}</Render></Render></>; }}}>
</Render></Render></> : null; })()}
{(() => { const __condition12 = vm.isShowAtkTypeTable;  return __condition12 ? <><Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-ui-table" props={{"styleClass": "ui-datatable-sm",
"value": vm.atkTypeTable,
"tableStyle": {"min-width": "10rem"},
"template_header": (context: any) => {  return <><Render tag="tr" props={{}}><Render tag="th" props={{}}></Render>
<Render tag="th" props={{"className": ["color_highlight"].filter(Boolean).join(' ')}}>{"%"}</Render></Render></>; },
"template_body": (context: any) => { const val = context["$implicit"]; return <><Render tag="tr" props={{}}><Render tag="td" props={{}}>{interpolate(["",""], [(val.displayName || val.name)])}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.value && vm.onAtkTypeClick(val)) }),
"className": [classNames(interpolate(["",""], [((val.value == 0) ? "" : ((((val.name == "Melee") || (val.name == "Range")) ? "summary_stat_atk" : "summary_stat_matk") + " bonus_clickable"))]))].filter(Boolean).join(' '),
"activateWithKeys": val.value}}>{interpolate(["",""], [vm.pct(val.value)])}</Render>
{(() => { const __condition13 = vm.showArrow(val,"value");  return __condition13 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.value2 && vm.onAtkTypeClick(val,true)) }),
"className": [classNames(interpolate(["",""], [((((val.name == "Melee") || (val.name == "Range")) ? "summary_stat_atk2" : "summary_stat_matk2") + ((val.value2 != 0) ? " bonus_clickable" : ""))]))].filter(Boolean).join(' '),
"activateWithKeys": val.value2}}>{interpolate(["",""], [vm.pct(val.value2)])}</Render></></> : null; })()}</Render></Render></>; }}}>
</Render></Render></> : null; })()}</Render></Render>
<Render tag="div" props={{"className": ["col-6"].filter(Boolean).join(' ')}}><Render tag="app-ui-table" props={{"styleClass": "ui-datatable-sm",
"value": vm.raceTable,
"tableStyle": {"min-width": "10rem"},
"template_header": (context: any) => {  return <><Render tag="tr" props={{}}><Render tag="th" props={{"className": ["color_highlight"].filter(Boolean).join(' ')}}>{t('misc.race')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.physical'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.physicalShort')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.magical'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.magicalShort')}</Render></Render></>; },
"template_body": (context: any) => { const val = context["$implicit"]; return <><Render tag="tr" props={{}}><Render tag="td" props={{}}>{interpolate(["",""], [(val.displayName || val.name)])}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.physical && vm.onRaceClick(val,"physical")) }),
"className": [classNames(interpolate(["",""], [((val.physical != 0) ? "summary_stat_atk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.physical}}>{interpolate(["",""], [vm.pct(val.physical)])}</Render>
{(() => { const __condition14 = vm.showArrow(val,"physical");  return __condition14 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.physical2 && vm.onRaceClick(val,"physical",true)) }),
"className": [classNames(interpolate(["",""], [((val.physical2 != 0) ? "summary_stat_atk2 bonus_clickable" : "summary_stat_atk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.physical2}}>{interpolate(["",""], [vm.pct(val.physical2)])}</Render></></> : null; })()}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.magical && vm.onRaceClick(val,"magical")) }),
"className": [classNames(interpolate(["",""], [((val.magical != 0) ? "summary_stat_matk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.magical}}>{interpolate(["",""], [vm.pct(val.magical)])}</Render>
{(() => { const __condition15 = vm.showArrow(val,"magical");  return __condition15 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.magical2 && vm.onRaceClick(val,"magical",true)) }),
"className": [classNames(interpolate(["",""], [((val.magical2 != 0) ? "summary_stat_matk2 bonus_clickable" : "summary_stat_matk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.magical2}}>{interpolate(["",""], [vm.pct(val.magical2)])}</Render></></> : null; })()}</Render></Render></>; }}}>
</Render></Render></Render></Render>
{(() => { const __condition16 = vm.isShowElementTable;  return __condition16 ? <><Render tag="div" props={{"className": ["col-5"].filter(Boolean).join(' ')}}><Render tag="app-ui-table" props={{"styleClass": "ui-datatable-sm",
"value": vm.elementTable,
"tableStyle": {"min-width": "18rem"},
"template_header": (context: any) => {  return <><Render tag="tr" props={{}}><Render tag="th" props={{"className": ["color_highlight"].filter(Boolean).join(' ')}}>{t('misc.element')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.physical'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.physicalShort')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.magical'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.magicalShort')}</Render>
<Render tag="th" props={{}}>{t('misc.magicElement')}</Render>
<Render tag="th" props={{"tooltipPosition": "top",
"tooltip": {text: t('misc.elementRRTooltip'), position: "top", className: '', showDelay: 300, hideDelay: 0, escape: true, disabled: false}}}>{t('misc.elementRR')}</Render></Render></>; },
"template_body": (context: any) => { const val = context["$implicit"]; return <><Render tag="tr" props={{}}><Render tag="td" props={{}}><Render tag="app-ui-tag" props={{"value": (val.displayName || val.name),
"styleClass": vm.elementTagClass(val.name)}}></Render></Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.physicalElementToMonster && vm.onElementClick(val,"physical")) }),
"className": [classNames(interpolate(["",""], [((val.physicalElementToMonster != 0) ? "summary_stat_atk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.physicalElementToMonster}}>{interpolate(["",""], [vm.pct(val.physicalElementToMonster)])}</Render>
{(() => { const __condition17 = vm.showArrow(val,"physicalElementToMonster");  return __condition17 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.physicalElementToMonster2 && vm.onElementClick(val,"physical",true)) }),
"className": [classNames(interpolate(["",""], [((val.physicalElementToMonster2 != 0) ? "summary_stat_atk2 bonus_clickable" : "summary_stat_atk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.physicalElementToMonster2}}>{interpolate(["",""], [vm.pct(val.physicalElementToMonster2)])}</Render></></> : null; })()}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.magicalElementToMonster && vm.onElementClick(val,"magical")) }),
"className": [classNames(interpolate(["",""], [((val.magicalElementToMonster != 0) ? "summary_stat_matk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.magicalElementToMonster}}>{interpolate(["",""], [vm.pct(val.magicalElementToMonster)])}</Render>
{(() => { const __condition18 = vm.showArrow(val,"magicalElementToMonster");  return __condition18 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.magicalElementToMonster2 && vm.onElementClick(val,"magical",true)) }),
"className": [classNames(interpolate(["",""], [((val.magicalElementToMonster2 != 0) ? "summary_stat_matk2 bonus_clickable" : "summary_stat_matk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.magicalElementToMonster2}}>{interpolate(["",""], [vm.pct(val.magicalElementToMonster2)])}</Render></></> : null; })()}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.myElement && vm.onElementClick(val,"myElement")) }),
"className": [classNames(interpolate(["",""], [((val.myElement != 0) ? "summary_stat_matk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.myElement}}>{interpolate(["",""], [vm.pct(val.myElement)])}</Render>
{(() => { const __condition19 = vm.showArrow(val,"myElement");  return __condition19 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.myElement2 && vm.onElementClick(val,"myElement",true)) }),
"className": [classNames(interpolate(["",""], [((val.myElement2 != 0) ? "summary_stat_matk2 bonus_clickable" : "summary_stat_matk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.myElement2}}>{interpolate(["",""], [vm.pct(val.myElement2)])}</Render></></> : null; })()}</Render>
<Render tag="td" props={{}}><Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.elementResistReduction && vm.onElementClick(val,"resist")) }),
"className": [classNames(interpolate(["",""], [((val.elementResistReduction != 0) ? "summary_stat_matk bonus_clickable" : "")]))].filter(Boolean).join(' '),
"activateWithKeys": val.elementResistReduction}}>{interpolate(["",""], [vm.pct(val.elementResistReduction)])}</Render>
{(() => { const __condition20 = vm.showArrow(val,"elementResistReduction");  return __condition20 ? <><><Render tag="span" props={{"className": ["summary_arrow"].filter(Boolean).join(' ')}}>{"→"}</Render>
<Render tag="span" props={{"click": (event: any) => vm.action(() => { const $event = event; (val.elementResistReduction2 && vm.onElementClick(val,"resist",true)) }),
"className": [classNames(interpolate(["",""], [((val.elementResistReduction2 != 0) ? "summary_stat_matk2 bonus_clickable" : "summary_stat_matk2")]))].filter(Boolean).join(' '),
"activateWithKeys": val.elementResistReduction2}}>{interpolate(["",""], [vm.pct(val.elementResistReduction2)])}</Render></></> : null; })()}</Render></Render></>; }}}>
</Render></Render></> : null; })()}
<Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["grid grid-nogutter"].filter(Boolean).join(' ')}}></Render></Render></Render></>;
}
