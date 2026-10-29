# Formato do `item.json`

Referência completa do banco de itens da calculadora: **`src/assets/demo/data/item.json`**.

Cada item descreve **o que** ele concede (chaves de bônus), **quanto** (o valor) e **quando**
(condições). O objetivo deste documento é mapear *todos* os parâmetros aceitos, porque a
sintaxe do campo `script` é compacta e pouco óbvia.

> **Nome e descrição em pt-BR são aplicados em runtime.** O `RoService` sobrepõe `name` e
> `description` a partir de `latam-items.json` e marca `presentInLatam`. Por isso, ao
> cadastrar um item você deixa `name` com o nome pt e `description: ""` — não precisa
> preencher a descrição aqui.

> **Prefira identificar por id, não por nome.** Várias condições antigas casam itens e
> perícias pelo **nome** em inglês. Isso quebra quando o nome muda na localização pt-BR ou
> ganha um sufixo como `[Apoio]`. As versões **por id** (`EQUIP_ID`, `SKILL_ID`,
> `ACTIVE_SKILL_ID`, `SKILL_ID2`) são estáveis e devem ser usadas em itens novos. As formas
> por nome estão marcadas como **Legado** nas tabelas abaixo.

---

### Bônus contra monstros específicos

`MONSTER_ID[20801||20802]5` aplica o valor somente quando o alvo selecionado tem
um dos IDs listados. Pode preceder um limiar de refino, como
`MONSTER_ID[20801||20802]9===15`; o refino é o do equipamento que contém o encanto.
Os encantamentos Q do Motor Desbravador usam listas de IDs resolvidas pelos nomes
da descrição do cliente (incluindo `Farmiliar Intrépido`, grafia do banco de monstros
para `Familiar Intrépido`).

As chaves `p_monster` e `m_monster` são multiplicadores de dano físico e mágico
separados de raça, tamanho, elemento e classe do monstro. `submonster` reduz o dano
recebido do monstro selecionado em uma categoria própria, sem efeito em PvP.

## 1. Estrutura de uma entrada

O arquivo é um objeto cuja **chave é o id do item**. Exemplo mínimo:

```jsonc
"450147": {
  "id": 450147,
  "aegisName": "Illusion_Vest_A",
  "name": "Colete Ilusión A",
  "unidName": "Armor",
  "resName": "환영의-나뭇잎",
  "description": "",
  "slots": 1,
  "itemTypeId": 2,
  "itemSubTypeId": 513,
  "itemLevel": null,
  "attack": null,
  "defense": 0,
  "weight": 60,
  "requiredLevel": 100,
  "location": null,
  "compositionPos": null,
  "usableClass": ["Swordman"],
  "script": {
    "atk": ["100", "2---10", "EQUIP_ID[480062]50"],
    "aspdPercent": ["7===10"],
    "acd": ["EQUIP_ID[480063]10"]
  }
}
```

### Campos estruturais

| Campo            | Tipo            | Descrição |
|------------------|-----------------|-----------|
| `id`             | número          | Id do item (igual à chave). |
| `aegisName`      | string          | Nome interno (AegisName) do servidor. |
| `name`           | string          | Nome exibido — fica em pt-BR (sobreposto em runtime). |
| `unidName`       | string          | Nome genérico do tipo (ex.: `Armor`). |
| `resName`        | string          | Nome do recurso gráfico (sprite). |
| `description`    | string          | Deixe `""`; a descrição pt-BR vem de `latam-items.json`. |
| `slots`          | número          | Quantidade de cartas. Vem do cliente, via `latam-items.json`; **não** infira pelo `[1]` do nome. `0` esconde o slot. |
| `itemTypeId`     | número          | Categoria: `1` arma, `2` equipamento, `9` traje/visual. |
| `itemSubTypeId`  | número          | Subtipo — define onde o item entra nos dropdowns (ver abaixo). |
| `itemLevel`      | número \| null  | Nível do item (usado pela condição `ITEM_LV`). |
| `attack`         | número \| null  | ATQ base (armas). |
| `defense`        | número          | DEF base. |
| `weight`         | número          | Peso. |
| `requiredLevel`  | número          | Nível mínimo para usar. |
| `location`       | string \| null  | Posição para itens de topo/meio/base (ex.: `Upper`, `Lower`). |
| `locations`      | string[] \| —   | **Só para equipamentos de cabeça que ocupam mais de uma posição.** Ver abaixo. |
| `compositionPos` | string \| null  | Posições combináveis (chapéus multi-slot). |
| `usableClass`    | string[]        | Classes que podem equipar (nomes internos, ex.: `Swordman`). |
| `script`         | objeto          | Os bônus do item — o coração deste documento (seções 2–5). |
| `preRelease`     | `true` \| —     | **Temporário.** Item que ainda não saiu no LATAM, exibido mesmo assim com o texto em inglês do iRO (ou do kRO, quando o iRO não tem). Ver abaixo. |

**Mapa de `itemSubTypeId`** (equipamento normal, `itemTypeId: 2`): topo `512` (+`location`),
armadura `513`, escudo `514`, capa `515`, calçado `516`, acessório `517` (ou `510` direito /
`511` esquerdo se o bônus for específico do lado). Trajes/`[Visual]` usam `itemTypeId: 9` e
subtipos `519`/`520`/`521`/`522`. Armas usam `itemTypeId: 1` e o `itemSubTypeId` é a classe
da arma. **Não** copie os subtipos `526`–`530`: são equipamentos de sombra.

### Equipamentos de cabeça que ocupam várias posições

Uma máscara "Equipa em: ^777777Meio e Baixo^000000" ocupa **as duas** posições no jogo —
não dá para usar outro item de meio junto. Registre isso em `locations`:

```jsonc
"436003": {
  "itemSubTypeId": 512,
  "location": "Lower",                      // mantido: posição "principal", legado
  "locations": ["Middle", "Lower"],         // todas as posições ocupadas
}
```

- Valores válidos: `"Upper"`, `"Middle"`, `"Lower"` (a ordem no arquivo não importa).
- **Só preencha quando houver duas ou mais posições.** Com uma só, `location` (ou, em
  trajes, o próprio `itemSubTypeId`) já resolve.
- Vale igual para trajes (`519`/`520`/`521`).

O item passa a aparecer no dropdown de **todas** as posições listadas; escolhendo uma, as
outras ficam marcadas como *(ocupado)*. A fonte da verdade é a linha `Equipa em:` da
descrição pt-BR — `head-gear-locations.data.spec.ts` compara as duas e falha se divergirem.

### `preRelease` — itens que ainda não saíram no LATAM

Normalmente um item só aparece nos dropdowns se estiver em `latam-items.json`: é dali que
`tools/build-web-data.mjs` deriva `presentInLatam`. Mas `latam-items.json` é **gerado** por
`tools/sync-latam-db.mjs` a partir do ragassets, então não dá para acrescentar um id à mão —
a próxima sincronização apagaria.

`preRelease: true` é a **única** fonte escrita à mão de `presentInLatam`. Use quando o item
já está por vir e as pessoas querem montar a build antes do lançamento:

```jsonc
"400374": {
  "id": 400374,
  "preRelease": true,
  "name": "Crown of Good and Evil (Dragon Knight) [1]",   // nome do iRO, em inglês
  "description": "Crown imbued with the power of good and evil.\n…",
}
```

- **`name` e `description` ficam em inglês**, copiados da página do iRO no divine-pride (ou da dpRO, a tradução em inglês do kRO, quando o item não saiu no iRO) —
  não existe texto pt-BR oficial ainda, e inventar um quebraria a busca por nome. O
  `description` aqui é a exceção à regra de deixar `""`: como não há overlay pt-BR, é a
  única descrição que existe, e o gerador a publica sem depender do `--all-desc`.
- Os pickers marcam essas linhas com uma etiqueta **Prévia**, para ninguém montar uma build
  achando que já dá para equipar (`.pre_release_tag` em `src/styles.css`).
- **É temporário.** Quando o LATAM lançar o item, `sync-with-ragassets` traz o id para
  `latam-items.json` e `src/app/api-services/pre-release-items.spec.ts` **falha** listando
  os ids afetados. Esse é o gatilho para voltar aqui, apagar o `preRelease`, devolver
  `description` para `""` e deixar o overlay pt-BR assumir.

---

## 2. O objeto `script`

```jsonc
"script": {
  "<chave de bônus>": ["<entrada>", "<entrada>", ...],
  ...
}
```

- A **chave** diz *o que* o item afeta (ATQ, HP, dano de uma perícia, etc.) — seção 3.
- Cada **entrada** da lista é avaliada de forma independente e os resultados são **somados**.
- Uma entrada tem o formato `[condições][valor]`:
  1. As **condições** (seção 5) são "portões". Se *qualquer* uma falhar, a entrada vale `0`.
  2. O **valor** restante (seção 4) é interpretado conforme o separador:
     - contém `---` → bônus por degrau (`floor(base / X) · Y`);
     - contém `===` → limiar de refino (`refino ≥ X ? Y : 0`);
     - caso contrário → valor fixo (número puro).

Exemplo: `"EQUIP_ID[480062]50"` → a condição `EQUIP_ID[480062]` exige que o item `480062`
esteja equipado; passando, sobra `50` (valor fixo).

### 2.1 `script.autoCast` — autoconjuração por ataque básico

`autoCast` é uma diretiva estruturada reservada; não é uma chave de bônus numérico:

```jsonc
"autoCast": [{
  "skillId": 2449,
  "skillLevel": ["3"],
  "chance": ["4", "7===1", "9===2"],
  "trigger": "physical-hit"
}]
```

- `skillId` referencia o Catálogo de Perícias.
- `chance` reutiliza as expressões deste documento e soma todas as aplicáveis: acima, 4%
  sem refino, 5% no +7 e 7% no +9.
- `skillLevel` reutiliza as mesmas expressões, mas escolhe o maior valor aplicável.
- `skillLevelMode: "highest-learned"` usa o maior entre esse valor e o nível aprendido.
- `skillLevelMode: "learned-only"` usa exatamente o nível aprendido; sem a perícia, a
  fonte não aparece. Use-o para "no mesmo nível aprendido", não para "ou no maior nível".
- `trigger` aceita `physical-attack`, `physical-hit`, `melee-physical-hit` ou
  `ranged-physical-hit`.
- Cada objeto representa uma ativação independente. Efeitos de rolagem compartilhada ou
  escolha entre várias magias só entram quando essa semântica estiver implementada.

Somente autoconjurações verificadas, de dano direto e executáveis usam `autoCast`. Para não
perder uma cláusula física que o cliente não permite calcular fielmente, registre-a em
`autoCastPending`; ela aparece como indisponível no painel e nunca entra nos bônus numéricos:

```jsonc
"autoCastPending": [{
  "skillName": "Rajada Congelante",
  "reason": "A habilidade não está catalogada no cliente."
}]
```

Use isso para rolagem compartilhada, nível/chance ausente, habilidade fora do catálogo ou um
estado ainda não modelado. Cura, buff, dano recebido e ataque mágico continuam fora desta
auditoria física até que seus gatilhos tenham um modelo próprio.

`autoCastEffect` também registra estados temporários selecionáveis em **Efeitos**.
`bonus` guarda os bônus fixos do estado; `bonusPerRefine` guarda os bônus multiplicados
pelo refino. Para um efeito garantido ao usar uma habilidade, `activationSkillId`
identifica o gatilho e `durationSeconds` informa a duração. Por exemplo, o Boné
Maratonista Xamânico usa `activationSkillId: 469` (Esma), `minimumRefine: 11`,
`chance: 100`, `durationSeconds: 10` e `bonus: {"2602": 30, "2604": 30}`. O bônus
só entra no cálculo enquanto o efeito estiver selecionado; isso não autoconjura Esma.

`enable_skill__48` habilita Ataque Duplo e integra seu golpe adicional à simulação de
ataques básicos, usando o maior nível entre o concedido e o aprendido. O golpe extra
não cria novas rolagens de autoconjuração. `unbreakableWeapon` apenas exibe a propriedade
de arma indestrutível em batalha; não altera o dano.

---

## 3. Chaves de bônus (o "o quê")

A lista **autoritativa** de chaves de atributo está em
[`src/app/utils/create-raw-total-bonus.ts`](../src/app/utils/create-raw-total-bonus.ts)
— leia o arquivo em vez de confiar em um número escrito aqui, que envelhece (ficou em
"187" muito depois de o arquivo passar de 240). **Nunca** invente uma chave fora dessa lista
— uma chave errada é pior que nenhuma. Mas "ainda não tem chave" não é o mesmo que "deixe de fora": veja a §3.4.
Categorias principais:

| Categoria            | Exemplos de chave |
|----------------------|-------------------|
| Atributos            | `str` `agi` `vit` `int` `dex` `luk`; todos → `allStatus` |
| Atributos de 4ª      | `pow` `sta` `wis` `spl` `con` `crt`; todos → `allTrait` |
| ATQ / ATQM           | `atk` `atkPercent` · `matk` `matkPercent` — a linha pelada `Dano físico/mágico +N%` (tradução nova de `ATQ/ATQM +N%`) é `atkPercent`/`matkPercent`; as chaves `p_final`/`m_final` foram removidas da engine |
| HP / SP              | `hp` `hpPercent` · `sp` `spPercent` |
| Defesas              | `def` `mdef` `res` `mres` |
| Conjuração / pós     | `aspd` `aspdPercent` · `vct` (conj. variável) · `fctPercent` (conj. fixa) · `acd` (pós-conj.) |
| Crítico / acerto     | `cri` `criDmg` `hit` `flee` |
| Avançados            | `pAtk` `sMatk` `cRate` `hplus` `range` |
| Dano por raça        | `p_race_<raça>` (físico) · `m_race_<raça>` (mágico) |
| Dano por tamanho     | `p_size_<s\|m\|l>` |
| Dano por elemento    | `p_element_<e>` · `m_element_<e>` · `m_my_element_<e>` |
| Penetração           | `p_pene_race_<raça>` · `m_pene_race_<raça>` |
| Dano vs. classe      | `p_class_all` |
| Dano vs. monstro     | `dmg__<aegisDoMonstro>` |
| **Dano de perícia**  | a **chave é o id da perícia** — ex.: `"382"` = Tiro Preciso (ver abaixo) |
| **Só exibição**      | cura, regeneração, absorção de HP/SP, dano refletido — `healPower` `healReceived` `hpRecovRate` `spRecovRate` `hpDrain` `spDrain` `reduceDamageReturn` `magicHealHp` `magicHealSp` (ver §3.4) |

Sufixos: raça `all` `formless` `undead` `brute` `plant` `insect` `fish` `demon` `demihuman`
`angel` `dragon`; tamanho `s` `m` `l`; elemento `neutral` `water` `earth` `fire` `wind`
`poison` `holy` `dark` `ghost` `undead`. **Sinais:** reduções de conjuração/pós-conjuração
são guardadas como número **positivo** (`-5%` → `"5"`).

### 3.1 Dano de perícia — por id (preferencial)

Um bônus de "+X% de dano da perícia Y" usa o **id da perícia** como chave. O id sai do
Catálogo de Perícias ([`src/app/skills`](../src/app/skills), campo `id` ao lado do `label`
pt-BR). Exemplo: `"382": ["30"]` = +30% de dano em **Tiro Preciso** (Focused Arrow Strike).

> **Legado:** chaves de perícia por **nome** ainda funcionam (fallback), mas para perícias
> que já têm id no catálogo isso é considerado migração pendente — um teste em
> `item-skills.spec.ts` falha se uma chave ficar num nome que possui id. Use sempre o id.

### 3.2 Modificadores por perícia (prefixos)

Alguns bônus afetam *parâmetros* de uma perícia específica. A chave é `prefixo__<id>`:

| Prefixo        | Efeito na perícia |
|----------------|-------------------|
| `cd__<id>`     | Reduz o tempo de recarga (cooldown). |
| `acd__<id>`    | Reduz o pós-conjuração da perícia. |
| `vct__<id>`    | Reduz a conjuração variável da perícia. |
| `fix_vct__<id>`| Reduz a conjuração fixa da perícia. |
| `fct__<id>` / `fctPercent__<id>` | Reduz o tempo de conjuração fixo. |

Ex.: `"cd__5330": ["EQUIP[Angel Wing Bow]GRADE[weapon==C]===1.3"]` = −1.3s de recarga em
Vendaval de Flechas (id 5330) quando equipado com o arco de grau C.

**`enable_skill__<id>`** é o único da família que não modifica a perícia: ele a **habilita**.
Use para a linha "Habilita [Perícia] nv.N" — o valor é o **nível concedido**, não um
incremento. Ex.: `"enable_skill__2211": ["EQUIP_ID[26151]===5"]` na Boina Escarlate-OS
(400528), cujo conjunto com o Rutilus-OS "Habilita [Meteoro Escarlate] nv.5".

Diferente das demais chaves, essa **não soma** entre peças: duas fontes concedendo a mesma
perícia não empilham num nível maior, vale a maior (`updateTotalStatus` em `calculator.ts`).
A perícia em si continua sendo cadastrada na classe, com um `verifyItemFn` que lê a chave —
sem as peças ela aparece na lista marcada como "Requer" e não calcula dano. Veja
`SuperNovice.ts` e `core/boina-escarlate-skill-grant.spec.ts`.

### 3.3 Chance (proc) — `chance__`

A chave `chance__<algo>` registra uma **chance** (em %) de um efeito, exibida na lista de
chances em vez de somar direto ao status. Pode empilhar com outros prefixos
(ex.: `chance__cd__<id>`).

### 3.4 Chaves só de exibição

Uma linha da descrição tem **três** destinos possíveis, não dois. Mapear para uma chave que
já existe é o primeiro; deixar de fora é o último recurso; e no meio há um real:

> **Se a linha promete um efeito quantificado e permanente para o qual a engine simplesmente
> não tem estágio, ela vira uma chave só de exibição em vez de ser descartada.**

A calculadora modela o dano *causado*. Cura, regeneração, absorção de HP/SP e resistência a
dano refletido não têm por onde entrar nessa conta — foi por isso que ficaram anos de fora, e
o silêncio custou caro: cerca de 300 registros não pontuavam nada, e oito automódulos da
Automatron vinham com `script: {}` enquanto o jogo claramente dava alguma coisa. Com a chave,
a lista de bônus do item e o detalhamento passam a nomear o efeito, o Resumo de atributos pode
ter uma linha, e a importação de replay carrega o valor.

As que já existem — **reaproveite antes de criar qualquer outra**:

| Linha pt-BR | Chave |
|---|---|
| `Efetividade de cura +N%` (a cura que você lança) | `healPower` |
| `Cura recebida +N%` / `Efetividade de cura recebida` (a cura que cai em você) | `healReceived` |
| `Regen. natural de HP +N%` | `hpRecovRate` |
| `Regen. natural de SP +N%` | `spRecovRate` |
| `X% de chance de converter N% do dano físico causado em HP` | `hpDrain` |
| …`em SP` | `spDrain` |
| `Resistência a danos refletidos +N%` | `reduceDamageReturn` |
| proc `[Cura Mágica]` | `magicHealHp` |
| proc `[Cura Espiritual]` / `[Cura Mística]` | `magicHealSp` |
| `Ao derrotar monstros: Regenera N de HP` | `hpRestoreOnKill` |
| …`de SP` | `spRestoreOnKill` |

**Regra dura: uma chave só de exibição nunca entra no cálculo de dano.** Isto não é um atalho
para contornar a regra de não inventar modificadores de dano — se o efeito *mudaria* o dano,
ele é um modificador, e não cabe a você inventá-lo: reporte a lacuna. `healing-stats.spec.ts`
segura a linha com um teste que exige dano idêntico entre uma build carregada dessas chaves e
uma sem nenhuma.

Duas convenções fechadas na varredura que criou a família:

- **A chave guarda a magnitude, não a chance de disparo.** "2% de chance de converter 3% do
  dano em HP" é `hpDrain: ["3"]`. A chance é de um item só e não soma entre peças — e **não**
  use `chance__` para elas, porque essa chave joga o item na lista de "Efeitos" do dano, que é
  a superfície errada para um número cosmético.
- **Normalize a unidade quando o cliente é inconsistente.** `[Cura Mágica]` está escrita como
  "300 de HP por segundo" no 19404 e "500 de HP a cada 0,4 segundos" no 310115 — as duas são
  guardadas por segundo, para a coluna fechar.

**Continua fora** (e deve ser reportado): proc cuja chance ou duração a descrição não diz;
condição sem contexto na engine ("Apenas nos Castelos TE", "Em mapas de GdE e PvP", "Durante a
transformação"); e escala por perícia ausente do Catálogo de Perícias.

---

## 4. Valores (o "quanto")

Formas que o valor de uma entrada pode assumir (depois que as condições passam):

| Forma                      | Significado | Exemplo |
|----------------------------|-------------|---------|
| `"100"`                    | Valor fixo. | `"atk": ["100"]` → ATQ +100 |
| `"X---Y"`                  | Por degrau de refino: `floor(refino / X) · Y`. | `"2---10"` → +10 a cada 2 refinos |
| `"X===Y"`                  | Limiar de refino: `+Y` se `refino ≥ X`. | `"7===10"` → +10 com refino ≥ 7 |
| `"Y(texto)"`               | Valor fixo `Y`; o texto entre parênteses é só anotação (ignorado). | `"50(90 seg)"` → 50 |
| `"<status>:N---Y"`         | Por ponto de status: `floor(status / N) · Y`. `<status>` ∈ `level jobLevel str int dex agi vit luk`. | `"dex:10---1"` |
| `"<status>:N===Y"`         | `+Y` se `model[status] ≥ N`. | `"str:80===10"` |
| `"level:N(min-max)---Y"`   | A cada `N` níveis dentro da faixa: escala por `(min(max, nível) − min + 1)`. Também `jobLevel:N(min-max)---Y`, sobre o nível de classe, e `<status>:N(min-max)---Y` (`str int dex agi vit luk`), sobre o atributo base. | `"level:1(1-125)---1"`, `"jobLevel:5(1-30)----1"`, `"str:10(1-50)----5"` |
| `"SUM[a,b==N]---Y"`        | `floor((soma dos status a,b) / N) · Y`. | `"SUM[str,luk==80]---6"` |
| `"REFINE[slot==N]---Y"`    | `floor((refino somado dos slots) / N) · Y`. | `"REFINE[boot==1]---2"` |
| `"REFINE[slot==N(C)]---Y"` | Como acima, mas o refino somado é **limitado a C** — para conjuntos do tipo "a cada refino de cada peça do conjunto (**até o +C**)". | `"REFINE[shadowWeapon,shadowArmor==1(30)]---1"` |
| `"REFINE_NAME[Nome==N]---Y"` | Como acima, mas o slot é identificado por **nome** do item. *(por nome — ver Legado)* | `"REFINE_NAME[Judgment Slasher==3]---5"` |
| `"GVALUE[slot==N]---Y"`    | `floor((valor do grau do slot) / N) · Y` (D=1, C=2, B=3, A=4). | `"GVALUE[weapon==1]---2"` |

---

## 5. Condições (o "quando")

Portões avaliados antes do valor. Podem ser **encadeados** numa mesma entrada
(ex.: `EQUIP[...]GRADE[weapon==C]===20`); todos precisam passar. Dentro de `[...]`,
`&&` = "todos" e `||` = "qualquer um".

| Condição | Significado | Legado? |
|----------|-------------|---------|
| `str:N&&<resto>` | Atributo principal ≥ N (forma `status:N&&valor===`). | — |
| `LEVEL[N]` / `LEVEL[min-max]` | Nível de base na faixa. | — |
| `WEAPON_LEVEL[N]` | Nível da arma equipada é N. | — |
| `WEAPON_TYPE[bow\|\|...]` | Tipo da arma (categoria). | — |
| `[weaponType=Pistol]` | Subtipo específico da arma. | — |
| `GRADE[slot==A]` | Grau do item no slot ≥ A (D<C<B<A). `me` = este item. | — |
| `GRADES[a==A&&b==A]` | Vários graus de uma vez. | — |
| `SUM[str,luk==N]` | Soma de atributos ≥ N. | — |
| `REFINE[N]` | Refino **deste** item ≥ N. | — |
| `REFINE[slot==N]` / `REFINE[a,b==N]` | Refino somado dos slots ≥ N. | — |
| `XREFINEX[slot==N]` | Refino de um slot ≥ N (até 3 por entrada). | — |
| `ITEM_LV[me==N]` / `ITEM_LV[slot==N]` | `itemLevel` do item no slot é N. | — |
| `POS[slot]` | Este item está no slot indicado. | — |
| `SPAWN[mapa1\|\|mapa2]` | O monstro-alvo aparece em algum dos mapas. | — |
| `USED[Classe\|\|...]` | A classe atual é uma das listadas. | — |
| `UNTIL[aaaa-mm-dd]` | Bônus "[Durante o Evento]": vale até esse dia (inclusive, horário de Brasília). Use o último dia inteiro — um evento que termina "antes da manutenção" do dia X vale até X−1. | — |
| **`EQUIP_ID[id]`** | **Item `id` também equipado (combo).** | **Use esta** |
| **`AMMO_SUBTYPE[id]`** | **Munição equipada tem o subtipo `id` (flecha = `1024`).** | **Use para gatilho por munição** |
| `EQUIP[Nome]` | Item por **nome** equipado (combo). | ⚠️ Legado → `EQUIP_ID` |
| `POS_SPECIFIC[slot==Nome]` | Item específico (por **nome**) num slot. | por nome¹ |
| `REFINE_NAME[Nome==N]` | Refino somado de itens por **nome**. | por nome¹ |
| **`SKILL_ID[id==lv]`** | **Perícia passiva `id` aprendida em nível ≥ `lv`.** | **Use esta** |
| `LEARN_SKILL[Nome==lv]` | Perícia passiva por **nome** aprendida ≥ `lv`. | ⚠️ Legado → `SKILL_ID` |
| **`SKILL_ID2[id==lv]`** | Variante de `SKILL_ID` (gramática de `LEARN_SKILL2`). | **Use esta** |
| `LEARN_SKILL2[Nome==lv]` | Variante por **nome**. | ⚠️ Legado → `SKILL_ID2` |
| **`ACTIVE_SKILL_ID[id]`** | **Perícia ativa/em uso `id`.** | **Use esta** |
| `ACTIVE_SKILL[Nome]` | Perícia ativa por **nome**. | ⚠️ Legado → `ACTIVE_SKILL_ID` |

¹ `POS_SPECIFIC` e `REFINE_NAME` casam por nome e não têm equivalente por id hoje; use-os
só quando não houver alternativa.

> **Como achar o id de uma perícia:** no Catálogo de Perícias
> ([`src/app/skills`](../src/app/skills)) cada entrada tem `id` (id do jogo) ao lado do
> `label` (nome pt-BR). Ex.: `Tiro Preciso` → `Focused Arrow Strike` → `382`.

---

## 6. Combos (bônus de conjunto)

Cadastre **apenas** os combos descritos na própria descrição **deste** item (o parceiro
declara os dele). Identifique o parceiro pelo **id** com `EQUIP_ID[<id>]`:

```jsonc
"script": {
  "atk": ["100", "2---10", "EQUIP_ID[480062]50"],
  "acd": ["EQUIP_ID[480063]10"]
}
```

`&&` exige todos os parceiros, `||` aceita qualquer um:
`EQUIP_ID[480062||480063]50`. O `&&` é avaliado primeiro, então
`EQUIP_ID[a||b&&c||d]` lê‑se “(a ou b) **e** (c ou d)”.

### Parceiro reeditado: nomeie todas as gerações

O cliente **reedita itens sob ids novos mantendo o nome em inglês do antigo**. Como
`EQUIP[<nome>]` casa por `enName`, uma cláusula por nome disparava para as duas gerações
sem que ninguém tivesse escrito isso — e converter essa cláusula para **um** id derruba
silenciosamente a outra geração.

Quando o parceiro tem reedição, liste todas as gerações no mesmo grupo `||`:

```jsonc
"melee": ["3", "EQUIP_ID[310328||1000378&&310329||1000379]===6"]
```

### O `name` depende do idioma; o `enName`, não

Desde que os nomes de item passaram a seguir o idioma escolhido, `name` é o nome **na
língua de quem está lendo**: o espanhol e o inglês vêm das tabelas do próprio cliente
(`latam-items-es.json` / `latam-items-en.json`) e entram como uma camada sobre o
`items-core`. O casamento por nome continua lendo `enName ?? name`, e a camada **fixa**
em `enName` o nome que o registro mostrava antes de ser traduzido — justamente para que
uma cláusula por nome case igual nos três idiomas.

Na prática isso reforça o aviso abaixo: uma cláusula `EQUIP[<nome>]` só não quebra em
espanhol porque esse `enName` é preservado à mão. Prefira o id.

> ⚠️ `EQUIP[<nome>]` é **legado** e não deve entrar em registro novo (§ tabela de
> condições). A família de Pedras de Encantar Visual (subtipos 71‑76) foi migrada por
> inteiro — 159 registros, 330 cláusulas — e `item-script-keys.spec.ts` trava tanto esse
> zero quanto a contagem geral, que só pode cair. Ao migrar outra família, **grave a
> baseline de comportamento antes de mexer nos dados** e afirme que ela não mudou depois,
> com um caso por geração de cada parceiro; veja
> `costume-enchant-combo-migration.spec.ts`.

---

## 7. Exemplos reais comentados

### 7.1 Conjunto por id (recomendado) — `450147` Colete Ilusión A

```jsonc
"script": {
  "atk":         ["100", "2---10", "EQUIP_ID[480062]50"], // +100 fixo; +10 a cada 2 refinos; +50 se 480062 equipado
  "aspdPercent": ["7===10"],                              // +10% Vel.Atq com refino ≥ 7
  "acd":         ["EQUIP_ID[480063]10"]                   // -10% pós-conjuração se 480063 equipado
}
```

### 7.2 Dano de perícia por id + modificadores — trecho de `490430` Record of Archer 2

```jsonc
"script": {
  "382":      ["30"],                                       // +30% dano de Tiro Preciso (Focused Arrow Strike)
  "2418":     ["30"],                                       // +30% dano de Temporal de Flechas (Severe Rainstorm)
  "vct__382": ["EQUIP[Record of Archer]USED[Ranger]===100"],// -100% conj. variável de Tiro Preciso (combo, só Ranger)
  "aspdPercent": ["10"]
}
```

> Aqui o combo ainda usa `EQUIP[Record of Archer]` (por **nome**, legado). Em um item novo,
> prefira `EQUIP_ID[<id do Record of Archer>]`.

### 7.3 Forma legada → como modernizar — `15461` Apollo Armor

```jsonc
"script": {
  "hpPercent": ["15", "LEARN_SKILL[Increase HP Recovery==2]---1"], // +1% HP a cada 2 níveis da perícia (legado, por nome)
  "acd":       ["EQUIP[2nd Anniversary Card]===5"]                 // -5% pós-conj. com a carta equipada (legado, por nome)
}
```

Equivalente recomendado (Aumentar Recuperação de HP = id `4`; 2nd Anniversary Card = id `27417`):

```jsonc
"script": {
  "hpPercent": ["15", "SKILL_ID[4==2]---1"],
  "acd":       ["EQUIP_ID[27417]===5"]
}
```
