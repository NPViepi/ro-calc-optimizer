import { Render, interpolate, classNames } from '../render';
export function Content({vm, services}: {vm: any; services: any}) {
return <><Render tag="div" props={{"className": ["ui-fluid"].filter(Boolean).join(' ')}}>{/* Ten element columns do not fit a phone; the tables scroll sideways (responsive.css). */}
<p className="elemental-scroll-hint">Deslize as tabelas para o lado para ver todas as propriedades.</p>
<Render tag="div" props={{"className": ["grid grid-nogutter"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["grid grid-nogutter col-5"].filter(Boolean).join(' ')}}><Render tag="div" props={{"hidden": !(vm.isShowElementalTable),
"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-elemental-table-raw" props={{"calcMonsters": vm.elementalTable1}}></Render></Render>
<Render tag="div" props={{"hidden": !(vm.isShowElementalTable),
"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-elemental-table-raw" props={{"calcMonsters": vm.elementalTable2}}></Render></Render>
<Render tag="div" props={{"hidden": !(vm.isShowElementalTable),
"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-elemental-table-raw" props={{"calcMonsters": vm.elementalTable3}}></Render></Render>
<Render tag="div" props={{"hidden": !(vm.isShowElementalTable),
"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-elemental-table-raw" props={{"calcMonsters": vm.elementalTable4}}></Render></Render></Render>
<Render tag="div" props={{"className": [classNames(interpolate(["",""], [(vm.isShowElementalTable ? "col-7" : "col-12")]))].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["grid grid-nogutter align-content-center"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-4"].filter(Boolean).join(' ')}}><Render tag="app-ui-checkbox" props={{"label": "Mostrar tabela elemental",
"binary": true,
"value": vm.isShowElementalTable,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.isShowElementalTable = $event);vm.onToggleShowEleTableClick() }))(value); })}}></Render></Render>
<Render tag="div" props={{"className": ["col-8"].filter(Boolean).join(' ')}}><Render tag="app-ui-multi-select" props={{"filterBy": "label,searchVal",
"scrollHeight": "400px",
"selectedItemsLabel": "{0} monsters selected",
"placeholder": "Escolher Monstros",
"options": vm.groupMonsterList,
"group": true,
"filter": true,
"showClear": true,
"showToggleAll": false,
"cleared": (event: any) => vm.action(() => { const $event = event; vm.onMonsterListChange() }),
"value": vm.selectedMonsterIds,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.selectedMonsterIds = $event) }))(value); ((event: any) => vm.action(() => { const $event = event; vm.onMonsterListChange() }))({value, originalEvent: event}); }),
"template_group": (context: any) => { const group = context["$implicit"]; return <><Render tag="div" props={{"className": ["flex align-items-center font-bold dropdown_monster_group_label"].filter(Boolean).join(' ')}}><Render tag="span" props={{}}>{interpolate(["",""], [group.label])}</Render></Render></>; }}}></Render></Render>
<Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="app-elemental-table-raw" props={{"calcMonsters": vm.calcMonsters,
"isLoading": vm.isProcessing}}></Render></Render></Render></Render></Render></Render></>;
}
