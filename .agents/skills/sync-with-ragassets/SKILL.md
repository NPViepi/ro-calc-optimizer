---
name: sync-with-ragassets
description: Refresh the calculator's client-derived data (latam-items.json, item-views.json, latam-classes.json, monster.json, latam-monsters.json) from the ragassets /raw tables. Ends by naming the client items that still have no item.json record and asking whether to add them all. Use after a Ragnarok LATAM client update, when an item/class/monster the client already has is missing here, or whenever these files look stale.
---

# Sync the LATAM data with ragassets

Every byte this repo derives from the game comes from **ragassets**, which reads the
client once and republishes the result as public JSON, no auth:

    https://assets.latam-tools.com.br/raw/<table>.json

**This repo never opens a GRF, never decodes a `.lub` and never calls an upstream API.**
It used to (`build-latam-db.mjs`, `build-item-views.mjs`, `grf.mjs`, `lua51.mjs`) — that
code is gone, along with its requirement of a local client install. If a value is wrong
or missing, the fix belongs upstream in ragassets, not here.

## The tables and what they feed

| /raw | script | generated file |
|---|---|---|
| `items.json` | `tools/sync-latam-db.mjs` | `latam-items.json`, `item-views.json` |
| `jobs.json` | `tools/sync-latam-db.mjs` | `latam-classes.json` |
| `mobs.json` | `tools/sync-monster-db.mjs` | `monster.json` (stats only) |
| `mobs.json` | `tools/build-latam-monsters.mjs` | `latam-monsters.json` |
| `skills.json` | `tools/build-skill-delays.mjs` | `skill-delay.json` |
| `status.json` | — | queried by hand (EFST ids; see `review-rrf-class`) |

All of them land in `src/assets/demo/data/`. What the browser actually downloads is built
from those by `tools/build-web-data.mjs` (`pnpm data:dev`), which is a separate step.

## Procedure

```bash
node tools/sync-latam-db.mjs        # items + views + classes
node tools/sync-monster-db.mjs      # stats of monsters already registered
node tools/build-latam-monsters.mjs # pt-BR name overlay
node tools/build-skill-delays.mjs   # cast/delay table
git diff --stat src/assets/demo/data/
node tools/missing-items.mjs        # new items with no record — see "New items" below
pnpm test && pnpm build
```

Then **read the diff before committing** — it is the whole point of the exercise. A client
update should show up as a handful of new items and a few corrected fields. If it shows up
as "everything changed", something is wrong with the source or the transform; do not commit
it. The two `sync-*` scripts take `--dry` to report without writing (`build-latam-monsters.mjs`
doesn't — it always writes, so look at its diff afterwards).

All three take `--src` for an offline run: a ragassets checkout's `resources/raw` directory
(the monster scripts also accept the `mobs.json` path itself).

```bash
node tools/sync-latam-db.mjs --src ../ragassets/resources/raw --dry
```

## New items: name them, then ask

The sync makes a new client item *known* (`latam-items.json`) but never *usable* —
`item.json` is hand-maintained, so until a record exists the item is missing from every
picker. The Armaduras Desconhecidas sat in that gap for a release after 0.1.129 because the
sync diff was read as "done". **Every sync ends with this step, even when the diff looks
small:**

```bash
node tools/missing-items.mjs          # grouped: weapon, armor, …, ammo, costume, card
node tools/missing-items.mjs --json   # same, machine-readable
```

It lists every LATAM item with no `item.json` record whose type the calculator models
(weapons, armor, shields, garments, shoes, headgear, accessories, ammo, costumes, cards,
shadow gear, enchants). Pet accessories, taming bait, boxes that merely hold gear,
outfit-changing consumables, gear no class can wear ("Classes: Nenhuma") and the Genetic
throwables are counted on the last line but
never wanted.

Then:

1. **Tell the user which items are new, by name** — per category, id and pt-BR name, the way
   the tool prints them. Do not summarise to a count; the names are how they recognise what
   the update brought.
2. **Ask whether to add them all** (AskUserQuestion: add all / pick some / skip). Do not add
   anything before the answer.
3. On a yes, add them with the `add-ro-item` skill. A long list (dozens of ids) splits well
   across subagents by category, **but only one writer may touch `item.json`**: have each
   subagent write its records to a scratch JSON and run `apply.mjs` yourself, one batch at
   a time, then `pnpm test`.
4. Re-run `node tools/missing-items.mjs` — it should print `0 item(s)`.
   `tools/missing-items.spec.ts` fails while any wanted item is missing, so the pre-push
   hook catches a sync that skipped this step.

## Gotchas

- **`latam-items.json` and `item-views.json` do not have the same scope.** ~640 items ship
  a sprite but no display name. `latam-items` skips them, because a key there means "exists
  on LATAM" and drives `presentInLatam`; `item-views` keeps them, because the paper-doll
  draws by id and a missing name says nothing about the sprite. Two files, one input, two
  filters — don't "fix" the inconsistency.
- **`aegisName` falls back to `resourceName`.** ragassets only knows the real item_db aegis
  name for items `itemmoveinfov5.txt` covers; the rest fall back to the client resource
  name, which is often Korean. That is expected, and `add-ro-item` prints it as-is.
- **`slots` is omitted when 0**, matching the file's minimal style. `add-ro-item`'s scaffold
  reads `lt.slots != null`, so an omitted 0 correctly means "no slot".
- **`sync-monster-db.mjs` rewrites `monster.json` in its original key order** (it scans the
  file for the order instead of re-stringifying the object). The file is keyed, not sorted;
  a plain `JSON.stringify` would reorder all 458 records and bury the real change. Never
  replace that writer.
- **`item.json` is hand-maintained and is NOT generated.** No sync script touches it —
  `add-ro-item` appends to it as raw text. Writing the record is that skill's job; finding
  the gap and asking the user is this one's (see "New items" above).
- **`sync-monster-db.mjs` never adds or removes ids**, because a new monster needs a
  hand-set `spawn`. Use `add-ro-monster` for that.
- **`skill-delay.json` is validation data, not runtime data.** Nothing in the browser
  bundle reads it; `src/app/skills/skill-delay.spec.ts` holds every class's atk skills to
  it, so a client retune shows up as that spec failing rather than as a silent diff. Its
  arrays are milliseconds and are zero-padded past `maxLevel` in the source — the
  generator trims them, so never index the raw feed by level yourself. `review-rrf-class`
  §8 has the workflow for reconciling a failure.

## Publishing

The data files are committed. If the sync changed anything users would notice, add
one uniquely named `release-notes/<sync-slug>.json` fragment with
`{"type":"patch","logs":["..."],"logs_es":["..."],"logs_en":["..."]}`. The notes are
published in three languages: write `logs` in Portuguese and translate it into
`logs_es` and `logs_en`, one line each, same order. Preserve user-facing wording and
credits. Do not bump `package.json` or edit published history; the main workflow
allocates the next version and announces after deployment. Validate with
`node tools/release-notes.mjs`. See `docs/releases.md`.
