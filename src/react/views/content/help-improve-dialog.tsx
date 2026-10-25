import { Fragment } from 'react';
import { Render, interpolate, parseStyle, normalizeStyle, identityKey } from '../render';
export function Content({vm, services}: {vm: any; services: any}) {
return <><Render tag="app-ui-dialog" props={{"visible": vm.visible,
"modal": true,
"contentStyle": {"maxHeight": "75vh"},
"visibleChange": (event: any) => vm.action(() => { const $event = event; (!($event) && vm.onHide()) }),
"style": normalizeStyle(Object.assign({}, normalizeStyle(vm.dialogStyle))),
"template_header": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center gap-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "heart-fill",
"className": ["text-xl"].filter(Boolean).join(' ')}}></Render>
<Render tag="span" props={{"className": ["text-xl font-medium"].filter(Boolean).join(' ')}}>{"Ajude o simulador a acertar as contas"}</Render></Render></>; },
"template_footer": (context: any) => {  return <><Render tag="div" props={{"className": ["flex align-items-center justify-content-end w-full"].filter(Boolean).join(' ')}}><Render tag="button" props={{"label": "Fechar",
"click": (event: any) => vm.action(() => { const $event = event; vm.onHide() }),
"className": ["ui-button-text"].filter(Boolean).join(' '),
"button": true}}></Render></Render></>; }}}>
<Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{" Cada fórmula daqui é conferida contra o jogo de verdade: pegamos uma "}
<Render tag="b" props={{}}>{"gravação"}</Render>
{" sua, lemos os pacotes de dano um por um e comparamos com o que o simulador calcula. Quando um número não bate, é assim que o erro aparece — e é assim que ele é corrigido. "}</Render>
<Render tag="p" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{" Esta primeira etapa tem um alvo específico: "}
<Render tag="b" props={{}}>{"achar itens cadastrados errados e fórmulas erradas"}</Render>
{". Para isso a gravação precisa ser "}
<Render tag="b" props={{}}>{"limpa"}</Render>
{" — só assim dá para saber se a diferença veio do item ou da conta. Por isso duas regras são obrigatórias, e o envio é recusado sem elas: "}</Render>
<Render tag="div" props={{"className": ["flex align-items-start gap-2 mb-3 p-3 border-round"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}><Render tag="b" props={{}}>{"1. No campo de treinamento"}</Render>
{" ("}
<Render tag="code" props={{}}>{"tra_fild"}</Render>
{"), "}
<Render tag="b" props={{}}>{"batendo nos dummies"}</Render>
{". Os dummies têm DEF e RES zeradas, ficam parados e não revidam — é o único alvo cujos números são todos conhecidos. Em qualquer outro lugar o monstro tem defesas próprias e a conta passa a ter duas incógnitas ao mesmo tempo."}
<Render tag="br" props={{}}></Render>
<Render tag="b" props={{}}>{"2. Sem buffs de fora."}</Render>
{" Nada de Bênção, Agilidade, Bragi, Poema, comidas ou buffs de outro jogador. Eles inflam todos os números sem dizer em que etapa entraram, e foi exatamente o que inutilizou a primeira leva de gravações. Seus próprios bônus de equipamento e as habilidades da sua classe, sim — é isso que está sendo medido. "}</Render></Render>
<Render tag="p" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{" Gravar leva uns "}
<Render tag="b" props={{}}>{"10 minutos"}</Render>
{" e ajuda principalmente as classes menos testadas. Se a sua gravação levar a alguma correção, seu nome entra nas Novidades. "}</Render>
<Render tag="app-ui-accordion" props={{}}><Render tag="app-ui-accordion-tab" props={{"header": "1. Como abrir o gravador"}}><Render tag="ul" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{"O gravador fica num botão dentro da "}
<Render tag="b" props={{}}>{"janela de informações do personagem"}</Render>
{"."}</Render>
<Render tag="li" props={{}}>{"Ele tem os botões "}
<Render tag="b" props={{}}>{"Início/Fim"}</Render>
{", "}
<Render tag="b" props={{}}>{"Pausa"}</Render>
{" e "}
<Render tag="b" props={{}}>{"Opções"}</Render>
{"."}</Render>
<Render tag="li" props={{}}>{"É preciso dar um "}
<Render tag="b" props={{}}>{"nome"}</Render>
{" ao vídeo antes de gravar."}</Render>
<Render tag="li" props={{}}>{"O arquivo sai em "}
<Render tag="b" props={{}}>{".rrf"}</Render>
{", na pasta "}
<Render tag="b" props={{}}>{"Replay"}</Render>
{" de onde o jogo está instalado."}</Render></Render>
<Render tag="a" props={{"target": "_blank",
"rel": "noreferrer noopener",
"href": vm.browikiUrl}}>{"Passo a passo completo no bROWiki →"}</Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "2. Antes de apertar Início — confira as Opções"}}><Render tag="div" props={{"className": ["flex align-items-start gap-2 mb-3 p-2 border-round"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{"className": ["line-height-3"].filter(Boolean).join(' ')}}>{" A caixa "}
<Render tag="b" props={{}}>{"Skill"}</Render>
{" é o que põe a "}
<Render tag="b" props={{}}>{"árvore de habilidades"}</Render>
{" dentro do arquivo — sem ela não dá para conferir nada, e o envio é recusado. As caixas só podem ser mexidas "}
<Render tag="b" props={{}}>{"antes"}</Render>
{" de começar a gravar. "}</Render></Render>
<Render tag="ul" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{"Marque "}
<Render tag="b" props={{}}>{"Basic Info"}</Render>
{", "}
<Render tag="b" props={{}}>{"Equip"}</Render>
{", "}
<Render tag="b" props={{}}>{"Item"}</Render>
{" e "}
<Render tag="b" props={{}}>{"Skill"}</Render>
{" — o mais fácil é marcar "}
<Render tag="b" props={{}}>{"All"}</Render>
{"."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Privacidade:"}</Render>
{" com "}
<Render tag="b" props={{}}>{"Chatting"}</Render>
{" marcado, a gravação leva junto o chat público e as "}
<Render tag="b" props={{}}>{"conversas particulares"}</Render>
{". Recomendamos "}
<Render tag="b" props={{}}>{"desmarcar"}</Render>
{" — nada da conferência depende do chat. "}</Render></Render></Render>
<Render tag="app-ui-accordion-tab" props={{"header": "3. O que fazer durante a gravação"}}><Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{" Tudo numa "}
<Render tag="b" props={{}}>{"gravação só"}</Render>
{". As trocas de equipamento ficam registradas com a hora, então dá para separar as fases depois — o que importa é comparar o mesmo personagem com e sem cada peça. "}</Render>
<Render tag="ol" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{"Vá ao "}
<Render tag="b" props={{}}>{"campo de treinamento"}</Render>
{" ("}
<Render tag="code" props={{}}>{"tra_fild"}</Render>
{"), fique de frente para um "}
<Render tag="b" props={{}}>{"dummy"}</Render>
{" e comece a gravar."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Espere seus buffs de fora acabarem"}</Render>
{" antes de bater — ou vá para o campo sem eles."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Sem nenhum equipamento:"}</Render>
{" use cada habilidade de ataque umas 10 vezes (as repetições garantem críticos, que é o que dá para conferir com precisão)."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Só com a arma:"}</Render>
{" repita as mesmas habilidades."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Com o equipamento completo:"}</Render>
{" repita de novo."}</Render>
<Render tag="li" props={{}}>{"Use a "}
<Render tag="b" props={{}}>{"habilidade suprema"}</Render>
{", ainda no dummy."}</Render>
<Render tag="li" props={{}}><Render tag="b" props={{}}>{"Saia do campo e volte, uma vez, ainda gravando."}</Render>
{" É ao entrar num mapa que o jogo grava seus "}
<Render tag="b" props={{}}>{"talentos"}</Render>
{" no arquivo — sem isso eles não vão junto e o formulário vai pedir que você os digite. Comece a gravar "}
<Render tag="b" props={{}}>{"já dentro do campo"}</Render>
{": a gravação é recusada se o mapa onde ela começa não for o "}
<Render tag="code" props={{}}>{"tra_fild"}</Render>
{". "}</Render>
<Render tag="li" props={{}}>{"Não mexa nos "}
<Render tag="b" props={{}}>{"talentos"}</Render>
{" durante a gravação."}</Render></Render>
<Render tag="p" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}>{" Se quiser ajudar mais, repita a sequência nos dummies de "}
<Render tag="b" props={{}}>{"tamanhos"}</Render>
{" e "}
<Render tag="b" props={{}}>{"elementos"}</Render>
{" diferentes — eles ficam no mesmo campo, e é assim que dá para conferir os bônus por tamanho e por elemento. "}</Render>
<Render tag="ul" props={{"className": ["mt-0 line-height-3"].filter(Boolean).join(' ')}}><Render tag="li" props={{}}>{"Só gravações do "}
<Render tag="b" props={{}}>{"RO LATAM"}</Render>
{" — o arquivo não diz de qual servidor veio, então isso fica na sua palavra."}</Render>
<Render tag="li" props={{}}>{"Um personagem por gravação, e poucos minutos (o limite é 900 KB)."}</Render>
<Render tag="li" props={{}}>{" Bater em monstros de verdade fica para uma etapa seguinte: enquanto os itens e as fórmulas não estiverem certos no dummy, não há como interpretar o que acontece fora dele. "}</Render></Render></Render></Render>
{(() => { const __condition1 = !(vm.sentId);  return __condition1 ? <><Render tag="div" props={{"tabIndex": "0",
"dragover": (event: any) => vm.action(() => { const $event = event; vm.onDragOver($event) }),
"dragleave": (event: any) => vm.action(() => { const $event = event; vm.onDragLeave($event) }),
"drop": (event: any) => vm.action(() => { const $event = event; vm.onDrop($event) }),
"click": (event: any) => vm.action(() => { const $event = event; vm.replayInput.click() }),
"keydown": (event: any) => vm.action(() => { const $event = event; if (event.key?.toLowerCase() === "enter") { vm.replayInput.click() } }),
"className": ["replay-dropzone mt-3",(vm.dragOver ? "dragover" : '')].filter(Boolean).join(' ')}}>{(() => { let replayInput: any = vm["replayInput"]; return <><Render tag="app-icon" props={{"name": "upload",
"className": ["replay-dropzone-icon"].filter(Boolean).join(' ')}}></Render>
<Render tag="p" props={{"className": ["m-0 replay-dropzone-drag"].filter(Boolean).join(' ')}}>{"Arraste sua gravação "}
<Render tag="b" props={{}}>{".rrf"}</Render>
{" aqui"}</Render>
<Render tag="p" props={{"className": ["my-2 text-sm replay-dropzone-drag"].filter(Boolean).join(' ')}}>{"ou"}</Render>
<Render tag="button" props={{"type": "button",
"icon": "folder-open",
"label": "Selecionar arquivo",
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
{"Conferindo a gravação…"}</Render></> : null; })()}
{(() => { const __condition3 = vm.rejected; const bad = __condition3; return __condition3 ? <><Render tag="div" props={{"className": ["mt-3 p-3 border-round line-height-3"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--red-100); color: var(--red-900)")))}}><Render tag="div" props={{"className": ["flex align-items-start gap-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "times-circle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{}}><Render tag="b" props={{}}>{"Essa gravação não serve."}</Render>
<Render tag="div" props={{"className": ["mt-1"].filter(Boolean).join(' ')}}>{interpolate(["",""], [bad.message])}</Render></Render></Render></Render></> : null; })()}
{(() => { const __condition4 = vm.accepted; const good = __condition4; return __condition4 ? <><>{(() => { const __condition5 = !(vm.sentId);  return __condition5 ? <><Render tag="div" props={{"className": ["mt-3"].filter(Boolean).join(' ')}}><Render tag="h3" props={{"className": ["mt-0 mb-2 text-lg"].filter(Boolean).join(' ')}}>{"Confira se é isso mesmo"}</Render>
<Render tag="div" props={{"className": ["submission-summary p-3 border-round surface-100"].filter(Boolean).join(' ')}}><Render tag="div" props={{}}><Render tag="span" props={{}}>{"Personagem"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [(good.summary.player || "—")])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Classe"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.className])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Nível"}</Render>
<Render tag="b" props={{}}>{interpolate([""," / ",""], [good.summary.baseLevel,good.summary.jobLevel])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Mapa"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [(good.summary.map || "—")])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Duração"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [vm.formatDuration(good.summary.durationMs)])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Habilidades"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.learnedSkillCount])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Equipamentos"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.equippedCount])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Trocas de equip."}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.equipChangeCount])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Golpes gravados"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.damageEvents])}</Render></Render>
<Render tag="div" props={{}}><Render tag="span" props={{}}>{"Golpes nos dummies"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.dummyHits])}</Render></Render>
{(() => { const __condition6 = good.summary.skippedItems.length;  return __condition6 ? <><Render tag="div" props={{}}><Render tag="span" props={{}}>{"Itens fora do banco"}</Render>
<Render tag="b" props={{}}>{interpolate(["",""], [good.summary.skippedItems.length])}</Render></Render></> : null; })()}
{(() => { const __condition7 = vm.importedTraits; const t = __condition7; return __condition7 ? <><Render tag="div" props={{}}><Render tag="span" props={{}}>{"Talentos"}</Render>
<Render tag="b" props={{}}>{(vm.traitKeys ?? []).map((__entry8: any, __index8: number, __array8: any[]) => { const key = __entry8;
const last = __index8 === __array8.length - 1; return <Fragment key={identityKey(__entry8)}><>{interpolate([""," ",""], [vm.traitLabels[key],t[key]])}
{(() => { const __condition9 = !(last);  return __condition9 ? <><Render tag="span" props={{}}>{" · "}</Render></> : null; })()}</></Fragment>; })}</Render></Render></> : null; })()}</Render>
{(() => { const __condition10 = good.warnings.length;  return __condition10 ? <><Render tag="div" props={{"className": ["mt-2 p-2 border-round line-height-3"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}>{(() => { const __condition11 = good.warnings.includes("external-buffs");  return __condition11 ? <><Render tag="div" props={{}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-1"].filter(Boolean).join(' ')}}></Render>
{"A gravação tem "}
<Render tag="b" props={{}}>{"buffs de fora"}</Render>
{" ligados (Bênção, Agilidade, Bragi e parecidos). Ela ainda vai ser lida, mas eles inflam todos os números sem dizer em que etapa entraram — uma gravação sem eles vale bem mais. "}</Render></> : null; })()}
{(() => { const __condition12 = good.warnings.includes("no-equip-change");  return __condition12 ? <><Render tag="div" props={{}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-1"].filter(Boolean).join(' ')}}></Render>
{"Você não trocou de equipamento durante a gravação. Ela ainda ajuda, mas a comparação fica bem mais fácil com as fases “sem equipamento / só arma / completo”. "}</Render></> : null; })()}
{(() => { const __condition13 = good.warnings.includes("many-unknown-items");  return __condition13 ? <><Render tag="div" props={{}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-1"].filter(Boolean).join(' ')}}></Render>
{"Vários itens não estão no nosso banco. Se a gravação for mesmo do LATAM, ótimo — é justamente o tipo de coisa que precisamos cadastrar. "}</Render></> : null; })()}</Render></> : null; })()}
{(() => { const __condition14 = good.needsTraits;  return __condition14 ? <><Render tag="div" props={{"className": ["mt-3"].filter(Boolean).join(' ')}}><Render tag="h3" props={{"className": ["mt-0 mb-1 text-lg"].filter(Boolean).join(' ')}}>{"Seus talentos"}</Render>
<Render tag="p" props={{"className": ["mt-0 mb-2 line-height-3 text-sm"].filter(Boolean).join(' ')}}>{" Esta gravação "}
<Render tag="b" props={{}}>{"não"}</Render>
{" trouxe os talentos, e sem eles o teste dá errado. O jogo só os grava quando o personagem "}
<Render tag="b" props={{}}>{"entra num mapa"}</Render>
{", e esta ficou o tempo todo parada no mesmo lugar. Da próxima vez eles vêm sozinhos se você "}
<Render tag="b" props={{}}>{"começar a gravar já no campo de treinamento, sair dele e voltar"}</Render>
{" — a volta é a entrada no mapa que os registra. Por ora, abra a janela de status e copie o "}
<Render tag="b" props={{}}>{"primeiro número"}</Render>
{" de cada um — "}
<Render tag="b" props={{}}>{"sem"}</Render>
{" o valor entre parênteses, que é o bônus de classe. Em "}
<Render tag="span" props={{"className": ["font-italic"].filter(Boolean).join(' ')}}>{"POD 90 (+15)"}</Render>
{", o que vale aqui é "}
<Render tag="b" props={{}}>{"90"}</Render>
{". "}</Render>
<Render tag="div" props={{"className": ["trait-grid"].filter(Boolean).join(' ')}}>{(vm.traitKeys ?? []).map((__entry15: any, __index15: number, __array15: any[]) => { const key = __entry15; return <Fragment key={identityKey(__entry15)}><Render tag="app-status-input" props={{"label": vm.traitLabels[key],
"dropdownList": vm.traitStatusList,
"value": vm.traits[key],
"showExtra": false,
"valueChange": (event: any) => vm.action(() => { const $event = event; (vm.traits[key] = $event) })}}></Render></Fragment>; })}</Render>
{(() => { const __condition16 = vm.traitsUntouched;  return __condition16 ? <><Render tag="div" props={{"className": ["mt-2 p-2 border-round line-height-3 text-sm"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--yellow-100); color: var(--yellow-900)")))}}><Render tag="app-icon" props={{"name": "exclamation-triangle",
"className": ["mr-1"].filter(Boolean).join(' ')}}></Render>
{"Os seis talentos estão em zero. Preencha com os valores da sua janela de status — uma gravação com talentos errados leva a conferência para o lado errado. "}</Render></> : null; })()}</Render></> : null; })()}
<Render tag="h3" props={{"className": ["mt-3 mb-2 text-lg"].filter(Boolean).join(' ')}}>{"Sobre você (opcional)"}</Render>
<Render tag="div" props={{"className": ["grid"].filter(Boolean).join(' ')}}><Render tag="div" props={{"className": ["col-6"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "helpImproveNick",
"className": ["block mb-1 text-sm"].filter(Boolean).join(' ')}}>{"Nick para os créditos"}</Render>
<Render tag="input" props={{"id": "helpImproveNick",
"maxLength": "40",
"placeholder": "como você quer ser citado",
"value": vm.nick,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.nick = $event) }))(value); }),
"className": ["w-full"].filter(Boolean).join(' '),
"inputText": true}}></Render></Render>
<Render tag="div" props={{"className": ["col-6"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "helpImproveDiscord",
"className": ["block mb-1 text-sm"].filter(Boolean).join(' ')}}>{"Discord"}</Render>
<Render tag="input" props={{"id": "helpImproveDiscord",
"maxLength": "60",
"placeholder": "caso a gente precise perguntar algo",
"value": vm.discord,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.discord = $event) }))(value); }),
"className": ["w-full"].filter(Boolean).join(' '),
"inputText": true}}></Render></Render>
<Render tag="div" props={{"className": ["col-12"].filter(Boolean).join(' ')}}><Render tag="label" props={{"htmlFor": "helpImproveNotes",
"className": ["block mb-1 text-sm"].filter(Boolean).join(' ')}}>{"O que você gravou / o que achou estranho (opcional)"}</Render>
<Render tag="textarea" props={{"appInputTextarea": "",
"id": "helpImproveNotes",
"rows": "3",
"maxLength": "1000",
"placeholder": "ex.: usei Implosão Tóxica nível 5 no dummy; o dano no jogo parece uns 10% maior que aqui",
"value": vm.notes,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.notes = $event) }))(value); }),
"className": ["w-full"].filter(Boolean).join(' ')}}></Render></Render></Render>
<Render tag="div" props={{"className": ["mt-2 flex align-items-start gap-2 p-2 border-round surface-100 line-height-3"].filter(Boolean).join(' ')}}><Render tag="app-ui-checkbox" props={{"inputId": "helpImproveConsent",
"binary": true,
"value": vm.consent,
"onModelChange": (value: any, event: any) => vm.action(() => { ((event: any) => vm.action(() => { const $event = event; (vm.consent = $event) }))(value); })}}></Render>
<Render tag="label" props={{"htmlFor": "helpImproveConsent",
"className": ["text-sm"].filter(Boolean).join(' ')}}>{" Confirmo que esta gravação é do "}
<Render tag="b" props={{}}>{"RO LATAM"}</Render>
{" e autorizo o envio do arquivo para os servidores do LATAM Tools. Ela entra na "}
<Render tag="b" props={{}}>{"fila de conferência sem aparecer publicamente"}</Render>
{". Se for aproveitada, pode virar um "}
<Render tag="b" props={{}}>{"teste no código"}</Render>
{", que é aberto — e aí sim o arquivo fica público junto com o repositório. "}</Render></Render>
{(() => { const __condition17 = vm.sendError;  return __condition17 ? <><Render tag="div" props={{"className": ["mt-2 p-2 border-round line-height-3"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--red-100); color: var(--red-900)")))}}>{interpolate([" "," "], [vm.sendError])}</Render></> : null; })()}
<Render tag="div" props={{"className": ["mt-3 flex justify-content-end"].filter(Boolean).join(' ')}}><Render tag="button" props={{"disabled": !(vm.canSend),
"icon": (vm.sending ? "spinner" : "send"),
"label": (vm.sending ? "Enviando…" : "Enviar gravação"),
"click": (event: any) => vm.action(() => { const $event = event; vm.send() }),
"className": ["ui-button-success"].filter(Boolean).join(' '),
"button": true}}></Render></Render></Render></> : null; })()}</></> : null; })()}
{(() => { const __condition18 = vm.sentId;  return __condition18 ? <><Render tag="div" props={{"className": ["mt-3 p-3 border-round line-height-3"].filter(Boolean).join(' '),
"style": normalizeStyle(Object.assign({}, parseStyle("background: var(--green-100); color: var(--green-900)")))}}><Render tag="div" props={{"className": ["flex align-items-start gap-2"].filter(Boolean).join(' ')}}><Render tag="app-icon" props={{"name": "check-circle",
"className": ["mt-1"].filter(Boolean).join(' ')}}></Render>
<Render tag="div" props={{}}><Render tag="b" props={{}}>{"Recebido, obrigado!"}</Render>
<Render tag="div" props={{"className": ["mt-1"].filter(Boolean).join(' ')}}>{" A gravação entrou na fila de conferência. Se ela levar a alguma correção, aparece nas Novidades — com o seu nick, se você deixou um. "}</Render>
<Render tag="div" props={{"className": ["mt-1 text-sm"].filter(Boolean).join(' ')}}>{"Código do envio: "}
<Render tag="code" props={{}}>{interpolate(["",""], [vm.sentId])}</Render></Render>
<Render tag="button" props={{"icon": "plus",
"label": "Enviar outra",
"click": (event: any) => vm.action(() => { const $event = event; vm.startAnother() }),
"className": ["ui-button-sm ui-button-text mt-2"].filter(Boolean).join(' '),
"button": true}}></Render></Render></Render></Render></> : null; })()}
</Render></>;
}
