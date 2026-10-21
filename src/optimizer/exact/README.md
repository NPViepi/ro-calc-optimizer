# Modo exato do otimizador

Implementa o plano "Motor de otimização exata de builds": uma busca em profundidade (DFS) que
**prova** o ótimo quando termina, ao lado do modo heurístico (que continua sendo o padrão e
passou a gerar a build inicial do exato).

> **Otimizar ≠ enumerar.** Encontrar uma build de dano máximo pode podar ramos que comprovadamente
> não superam a melhor conhecida. Enumerar todas as builds válidas (`mode: 'enumerate'`) nunca
> poda por dano, só por inviabilidade.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `engine.ts` | Motor genérico: DFS iterativo, empates, enumeração, limite superior opcional, status, métricas, checkpoint/retomada, execução fatiada |
| `ro-problem.ts` | O espaço de builds do RO como `SearchProblem`, usando só as regras que já existiam (`candidates`, `attachments`, `enchant-limits`, `placeItem`, `BuildEvaluator`) |
| `optimize.ts` | `optimizeExact`: build inicial heurística → DFS → resultado, assinatura do checkpoint, ajuste opcional de atributos |
| `__tests__/toy.ts` | Problema artificial + força bruta para testar o motor |
| `*.spec.ts` | Testes contra força bruta (sintética e com o simulador real) |

## Espaço de busca

- **Decisões:** um slot livre por vez; depois de escolher um item, cada encaixe de carta e cada
  posição de encantamento desse item é uma decisão própria (o que é válido depende do item).
- **Opções de um slot:** o slot original intacto (item, cartas, encantamentos, refino, grau,
  opções aleatórias), o item original com cartas/encantamentos livres, vazio, e todo item do
  catálogo (`buildCatalog`, mesmos filtros dos dropdowns, LATAM, inventário, divinos, MVP).
  Escudo e munição dependem da arma escolhida (`WeaponRulesProbe`), então são decididos depois dela.
- **Cartas:** todas as do catálogo para a posição, em cada encaixe (inclui "sem carta").
- **Encantamentos:** todas as opções de cada posição (`deriveSlot`), inclui "sem encantamento".
- **Refino/grau:** `refineDomain: 'limit'` (padrão, escolhido pelo usuário) usa o máximo dos
  Limites; `'all'` enumera todos os níveis de 0 até ele e todos os graus até o grau máximo.
- **Atributos:** fixos (os da build). O ótimo é comprovado para esses atributos. O ajuste opcional
  (`postOptimizeStats`) roda o guloso das fases 1–2 depois e é mostrado à parte, "sem garantia".
- **Visuais:** por padrão só os encantamentos de visual mudam (como no heurístico).
- A build original sempre está no espaço, então o resultado nunca é pior que a entrada.

## Avaliação

Cada build completa é avaliada pelo simulador (`BuildEvaluator`) e pontuada por `scoreOf`, a
mesma pontuação do heurístico: primeiro a violação dos limites de tempo, depois o objetivo
(dano médio/mín./máx. ou DPS com metas). Não existe segunda implementação de fórmula. O dano de
estados incompletos nunca é usado para podar.

## Podas — condição e justificativa

| Poda | Onde | Condição | Por que não elimina uma build ótima |
|---|---|---|---|
| `conflict` | `RoBuildProblem.apply` | Colocar o item tirou um item de um slot **já decidido** ou **travado** (máscara que ocupa um slot já preenchido; arma que não aceita o escudo travado; munição travada incompatível) | Decisões futuras nunca recolocam um item já decidido; a build pedida pelo caminho não existe. A mesma build é alcançada pelo caminho em que o slot ocupado fica vazio |
| `enchantLimit` | `RoBuildProblem.applyField` | O encantamento quebra um limite cadastrado (`data/enchant-limits.ts`) ou repete um encantamento com `unknownEnchantRepeats: 'forbid'` | Os limites são **máximos** de contagem: encantamentos adicionais só aumentam contagens, então a violação é irreversível |
| `noCandidate` | `engine.ts` | Uma decisão sem nenhuma opção | Nenhuma conclusão existe. No RO não acontece ("vazio" é sempre opção) |
| `upperBound` | `engine.ts` | `bound(estado) ≤ melhor` (uma build) ou `< melhor` (todas as empatadas) | Só é usada se o problema declarar `upperBound` com prova de que `bound ≥ score` de toda conclusão. **O problema do RO não declara**: o simulador é caixa-preta e há bônus negativos e condicionais (ex.: "DES+3 AGI−3", combos `EQUIP_ID`), então não há prova de monotonicidade. Testada apenas no problema sintético, contra força bruta |

**Não implementado, de propósito:** dominância entre estados (sem prova de que um estado iguala
ou supera todas as continuações do outro), memoização de estados (sem representação equivalente
comprovada — a identidade dos itens importa para conjuntos e sinergias) e simetria entre
encaixes de carta da arma (sem prova de que a ordem dos encaixes não importa no motor).

## Heurísticas (só ordem)

- A build inicial heurística é explorada primeiro (o primeiro caminho do DFS é ela).
- Itens e cartas ordenados pela troca única na build inicial.
- Slot com menos opções primeiro (MRV); os slots grandes ficam no fundo da árvore, que é o que o
  DFS varia primeiro.

Nenhuma delas tira opções. Os testes comparam MRV × ordem fixa e com/sem triagem.

## Status

| Status | Quando |
|---|---|
| `OPTIMAL` | A pilha esvaziou: toda a árvore foi explorada ou podada pelas regras acima |
| `BEST_FOUND` | Só em progresso: há build, mas a busca não terminou |
| `INTERRUPTED` | Parou (botão Parar, tempo máximo): resultado = melhor até agora, com checkpoint |
| `NO_SOLUTION` | Terminou sem build válida |
| `COMPLETE` | `enumerate` terminou |
| `ERROR` | Erro: não confiar no resultado |

## Checkpoint e retomada

O cursor guarda, por profundidade, o índice da escolha em andamento. Como domínios e ordem são
determinísticos (a build inicial vai junto no checkpoint), retomar reconstrói a pilha e continua
exatamente do mesmo ponto: nada é perdido nem repetido (testado contando folhas). A assinatura
(`problemSignature`) junta versão do motor, catálogo, conteúdo dos itens, opções, alvo, build
original e build inicial; um checkpoint de outra configuração é recusado. O painel salva o último
checkpoint no navegador a cada 5 s e ao parar.

## Na prática

Com todos os slots livres, o Guerrilheiro 240 tem ~10^90 builds no espaço exato; a ~300–500
builds/s, o modo exato não termina e devolve `INTERRUPTED` (a melhor build é a inicial ou uma
vizinha dela). Ele conclui com `OPTIMAL` quando o escopo é reduzido: inventário (só os itens que
você tem), slots travados, sem cartas/encantamentos. O painel mostra o tamanho do espaço.

## Pendências do plano

- Paralelização (dividir a raiz entre workers): não feita; a busca sequencial está validada.
- Limite superior seguro para o RO: exige provar monotonicidade por chave de bônus; mantido desligado.
- Avaliação incremental: não implementada (cada folha usa a avaliação completa).
