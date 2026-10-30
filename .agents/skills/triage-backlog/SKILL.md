---
name: triage-backlog
description: Works the simulator's bug/suggestion backlog on the shared issue tracker — reads the cards, traces each report into the code to say whether it holds up, collects who gets credited in the Novidades, and lands the fixes once told to. Use when someone asks to go through the backlog, to check whether reported bugs are real, or to fix what the community reported.
---

# Triage of the reported bugs and suggestions

The board is **issues.latam-tools.com.br** (Firebase project `issues-latam-tools`,
collection `issues`), filtered to `projeto: "simulador"`. This skill owns every card on the
board — `tipo: "bug"`, `tipo: "feature"` **and `tipo: "replay"`**.

The recording cards used to be filtered out here, handed wholesale to a skill that read the
submission **inbox** — the private queue of `.rrf` files, which are not cards and never
reach this query. That split was drawn in the wrong place. The inbox is now worked by hand
on the tracker's `/admin/gravacoes` page, and promoting an entry there is what turns it
into a card. A replay card is something a human already promoted *out* of that inbox and
onto the board — it has a title, a status and a credit, and if it sits in `backlog` it is
an accepted item of this queue like any other.

Judging a whole queue of them — which are usable, which are worth a review pass — is
[`triage-rrf`](../triage-rrf/SKILL.md), which reads this same board through this same
script and joins it against the repo's spec coverage. Use it when the run is about
recordings. What follows still applies to a replay card met on its own.

Filtering it out cost a real triage run. A Shinkiro crit bug was filed twice on the same
day, once as a bug card and once as the recording that proved it; `--list` showed only the
bug card, and the report went out asking for evidence that was sitting in the next row.

So: **judge a replay card exactly like a bug card** — it states a symptom and you trace it
into the code. The difference is only where its evidence lives, and the script hands you
both halves:

```
node .agents/skills/triage-backlog/backlog.mjs --anexos <id> --out .scratch/<id>.rrf
```

The `.rrf` is stored **inline on the card**, as a Firestore `bytesValue` under
`anexos/gravacao` — there is no download URL and nothing to ask the reporter for. `--get`
prints the card's `gravação` block above the description: file, class, level, map, duration,
and **the talent allocation**.

Those talents are the part to actually read. A session recorded inside a single map never
fires `ZC_COUPLESTATUS`, so the `.rrf` itself carries **no traits** — `review-rrf-class` §0
is explicit that a build cannot be rebuilt without them, and the "Ajude o simulador" dialog
collects them by hand for exactly that reason. The block says which it is: *lidos da
gravação* (the game's own) or *informados por quem gravou* (typed by a human, so worth
sanity-checking against the status window). Reading the decoded file and finding
`traits: null` means **look at the card**, not ask the reporter — that mistake cost a full
review pass on the Shinkiro crit card, which was one query away from six numbers already
sitting on it.

Decoding the packets is still [`review-rrf-class`](../review-rrf-class/SKILL.md)'s job. A
replay card whose verdict turns on the recording is a card that needs that skill run — say
so in its row rather than guessing at what the packets would have shown.

**It works one column: `status: "backlog"`.** That is the queue — what has already been
read and accepted and is waiting to be built. `reportado` is unsorted intake and is **not**
part of a triage run. See §1 before reading a single card.

The work runs read → judge → **report and stop** → plan → **stop again** → build, and the
two stops are the point. A backlog reading that ends in six commits nobody asked for is
worse than one that ends in a table, and a batch built straight off an approved triage
table is how cards get fixed at the wrong size. Nothing is written to the repo or to the
board until the report is approved; nothing is built until the plan on top of it is.

## 0. The two credit fields — get this right before writing any release note

The public form has two optional fields, and they are not interchangeable:

| field | what the form promises | may it be published? |
|---|---|---|
| `autor` — "Seu nick (opcional)" | *"Aparece publicamente no card e nas novidades, como crédito."* | **yes** — this is the credit |
| `privado/contato` — "Contato (opcional)" | *"Discord ou e-mail, caso eu precise de mais detalhes. **Não aparece no site — só eu vejo.**"* | **never** |

The admin panel shows the contact as "**Contato de quem reportou**", which reads like a
credit and is not one. It is frequently an e-mail address. Someone who filled the contact
and left the nick blank chose not to be named — that is what the blank field means.

So: **`autor` present → "Reportado por Fulano."; `autor` blank → "Reportado por usuário
anônimo."** No exceptions, and no lifting a name out of the contact field because it
happens to look like a nick. If it seems a shame to lose a credit, the fix is to ask the
person and, if they agree, put the nick in `autor` — not to publish the contact.

**One exception: `autor: "Adson"` is the maintainer** — the person you are working for.
Those cards get **no credit line at all**; the Novidades entry just says what changed.
"Reportado por Adson" reads as a stranger thanking themselves.

## 1. Read the board

```
node .agents/skills/triage-backlog/backlog.mjs --list
node .agents/skills/triage-backlog/backlog.mjs --get <id>
```

`--list` with no flags **is** the run: it defaults to `--status backlog`, and that default
is the scope of the skill, not a convenience. Whatever it prints is the complete set of
cards to judge — one card, or none, is a complete set.

**Never widen it on your own initiative.** `--status reportado` is unsorted intake: cards
nobody has accepted yet, which may be duplicates, may be wrong, and may be things the
maintainer has already weighed and parked. Triaging them produces a report about work that
was never agreed to exist, and it buries the cards that were — one accepted card in a table
of eight reads as one row out of eight. `--status todas` is worse for the same reason.

Reach for either only when the user names the intake in so many words ("olha a intake",
"triagem das fichas em reportado") or names a card by id. Then work what they named, and
nothing besides.

If a backlog card cannot be judged without an intake card — a duplicate, a card that
replaces it, the comment that carries its reference — read that one with `--get <id>` and
say in its row why you went there. Reading one named neighbour is not triaging the column.

`--get` prints the full description, every comment and the credit block.

Read the comments — a maintainer comment often carries the reference that decides the card
(the Illusion enchant card had the browiki link that held the real table).

> The site renders in the browser: fetching its HTML gives you an empty page, and the
> `/t/<slug>` URL is a client route. Use the script. The in-app browser works too if you
> want to see a card the way the reporter does.

## 2. Judge each report — in the code, not from the title

Reporters describe a symptom from where they sit, and the symptom is often not the bug.
Trace every card to the line that causes it before writing a verdict. Real examples:

- *"não aparece para o Invocador"* → the item was missing from `item.json` for **every**
  class, nothing class-specific about it.
- *"Escudo Excelion não aplica efeitos"* → the record still held the **Thai** item of the
  same id: its script, its DEF, its weight.
- *"não aparece na lista de armas"* → the card existed, with a `compositionPos` no branch
  of the card router matches, so it reached no list at all.

The recurring families, and where to look:

| family | how to confirm |
|---|---|
| upstream record for the same id | compare the pt-BR description in `latam-items.json` against the `script`/`defense`/`weight` in `item.json` — Thai or Korean text in `description` is the tell. See [[upstream-thai-scripts]] |
| item absent from the database | look the id up in `item.json`; the fix is the `add-ro-item` skill |
| item present but unreachable in a picker | `compositionPos` vs `CardPosition`, `itemSubTypeId`, `location`/`locations`, `usableClass` |
| enchant slots missing | `getEnchants` matches by **`aegisName`** — an item with no `EnchantTable` row shows no enchant dropdown |
| a combo clause not registered | read the pt-BR `Conjunto` block and check every line of it against the `script` |
| class formula/hook | `src/app/jobs/<Class>.ts`, usually `setAdditionalBonus` or the skill entry |
| **already fixed** | `git log -S '<the code>' -- <file>` and compare against the card's `criadoEm`; a card filed before a sweep landed can already be done |
| not modellable | the bonus key does not exist in `create-raw-total-bonus.ts` |

### Sources of truth, in order

1. **The item's own pt-BR description** (`latam-items.json`) decides effects, and the skill
   catalog's `description` decides skills. See [[ptbr-description-source-of-truth]].
2. **browiki** for the tables the client does not ship — enchant pools, and formulas the
   client states without a number. "Aumenta a velocidade de ataque" gave no figure; the
   Aura de Combate page gave `4 × (100 − VelAtq% do equipamento)` with worked examples.
   Cite the page in the code comment and in the spec. See [[browiki-source]].
3. Nothing else. **Never invent a bonus key or a multiplier stage** — report the gap and
   let the user judge. See [[no-new-damage-modifiers]] and [[no-guessing-translations]].

### Then stop and report — gate 1

One table, one row per card: verdict, root cause with the `file:line`, and rough size.
The verdicts:

| verdict | means |
|---|---|
| **confirmed** | reproduced in the code, cause located, fixable as reported |
| **confirmed but wider** | real, and the same cause hits things the card does not mention |
| **already fixed** | landed before the card, or by a later sweep — check `criadoEm` |
| **misdiagnosed** | real bug, wrong cause; say what the cause actually is |
| **needs more context** | cannot be judged without something only a person can supply |
| **not modellable** | the engine has no measure for it; see [[no-new-damage-modifiers]] |

**"Needs more context" is a verdict, not a failure** — and it is the one that must never be
papered over with a guess. Reach it only after the code has been read: the row still owes a
`file:line` for how far you got. What it may ask for: a replay or a screenshot of the status
window, the item id or the exact in-game name, which server/episode, a share link of the
build, or a client description the repo does not carry. What it may **not** do is invent the
missing half — no guessed ids, no guessed pt-BR names, no bonus key that does not exist
([[no-guessing-translations]]). Ask the question in the report; if the answer has to come
from the reporter rather than the maintainer, say so, because that is a comment on the card
and a card that goes back to waiting.

Say when two cards are the same bug — the Excelion pair was one job. Note what you would
leave out and why, so the scope is agreed before it is built.

Then **stop**. Do not touch the repo, do not comment on the board, do not start the plan.

## 3. Plan the approved batch — gate 2

Once the report comes back approved, the approved rows — and only those — become a written
plan, before any edit. Cards parked at "needs more context" stay parked; a card the user
dropped is dropped.

The plan is per card, and each entry says:

- **the change** — the file, and the shape of the edit (which `item.json` record, which
  `script` clause, which class hook, which picker branch);
- **the source** that decides it, quoted or linked — the pt-BR description, the browiki
  page, the replay. A plan entry with no source behind its numbers is not ready to build;
- **the spec** — file and the cases, positive *and* negative;
- **the blast radius** — the counters in `mcp/src/data/merge-items.spec.ts`, a shared combo,
  anything else the edit is known to move;
- **what stays out**, and whether it becomes its own card.

Close with the batch-level pieces: the order to do them in, the uniquely named
release-notes fragment and its Novidades lines (credits already resolved in §4),
and how it gets verified in the preview. Do not bump package.json or edit published
history; the main workflow assigns the next version. See docs/releases.md.

Then **stop again** and let the user approve the plan. Build only what the approved plan
says; if the code turns out to disagree with the plan mid-way — the cause is not where the
triage said, the fix is three times the size — stop and re-report rather than improvising a
bigger change than was agreed.

## 4. Collect the credits

```
node .agents/skills/triage-backlog/backlog.mjs --credits --status resolvido
```

One ready line per card, obeying §0. Do this while triaging, not while writing the release
— the release entry is where a private contact gets published by accident.

Phrasing, when you get to the Novidades: impersonal voice, never first person, and
"por Fulano" — not "pelo Fulano". See [[changelog-passive-voice]] and
[[novidades-reportado-por]].

## 5. Build — once the plan is approved

Per card, following the plan:

- **Data before code.** Most of these are `item.json`; `docs/item-json.md` is the format,
  and the condition grammar (`EQUIP_ID[id]`, `str:125&&0===1`, `level:130===5`) is worth
  re-reading rather than guessed at. Missing items go through `add-ro-item`, which fills
  `slots` from the client instead of from the name.
- **Every fix gets a spec, named after its subject** — `wolf-poe-combo.spec.ts`,
  `size-resistance.spec.ts` — never after the backlog or the month. `backlog-<yyyy-mm>.spec.ts`
  was the old shape here and it is now banned: four such grab-bags were split by subject on
  17/08/2026. Put the card id in a comment instead; that is what comments are for. See
  CLAUDE.md and [[spec-names-describe-subject]]. Drive the real `Calculator` through
  `loadItemFromModel().prepareAllItemBonus()` and assert on `totalEquipStatus`; a class fix
  goes next to its class. Assert the negative case too — below the level gate, without the
  combo partner.
- **Adding items breaks three counters** in `mcp/src/data/merge-items.spec.ts` (total keys,
  unique ids, `presentInLatam`). Update them, don't work around them.
- `pnpm test` and `pnpm lint`, both green.
- **Verify in the preview** (`preview_start` with `{name: "ro-calc-dev"}`). For the picker
  and enchant fixes, the fastest real check is the Angular debug API rather than clicking:
  `ng.getComponent(document.querySelector('app-ro-calculator'))` exposes `weaponCardList`,
  `accLeftList` and friends, and on an `app-equipment` you can set `itemId` and call
  `setEnchantList(false)` to read back `enchant2List`. That renders the actual dropdown the
  reporter was missing.
- Commit on `main` (see [[commit-on-main-default]]), one commit for the batch.

Then close the loop:

- Add a uniquely named `release-notes/<batch-slug>.json` fragment with
  `{"type":"patch","logs":["..."],"logs_es":["..."],"logs_en":["..."]}` — one
  user-facing log per card, preserving reporter credits and impersonal wording. The
  notes are published in three languages: write `logs` in Portuguese and translate it
  into `logs_es` and `logs_en`, one line per entry, in the same order. Credits stay as
  written in every language. Do not edit `package.json`
  or published release history: the main workflow assigns the version.
  Validate with `node tools/release-notes.mjs`. See `docs/releases.md`.
- Move the cards:
  ```
  node .agents/skills/triage-backlog/backlog.mjs --mark <id> --status resolvido --note "..."
  ```
  `--note` becomes a public comment. `nao_sera_feito` is for a report that was looked at
  and will not be acted on — say why in the note.
- Anything real that you deliberately left out gets **its own card**, so it is not lost in
  a commit message:
  ```
  node .agents/skills/triage-backlog/backlog.mjs --new --titulo "..." --descricao "..."
  ```
  It lands in `reportado`, publicly, so write it for a stranger: what the item promises,
  what the calculator does, and what is actually blocking it.
- **Do not push.** Pushing `main` deploys the site to Cloudflare — that is the user's call
  ([[commit-on-main-default]]).

## Rules & gotchas

- A card is public from the moment it exists — comments and new cards included. Anything
  written through this skill is world-readable; the private contact never is.
- Moving a card to `resolvido` before the fix is **pushed** tells the community something
  that is not on the site yet. Move it when the release is out, or say so in the note.
- The status vocabulary is fixed: `reportado`, `backlog`, `em_progresso`, `resolvido`,
  `nao_sera_feito`. `arquivado` is a separate boolean and is not a column.
- Leaving an effect out is better than a wrong key. A card whose answer is "the engine has
  no measure for this" is a legitimate outcome — record it on the card.
