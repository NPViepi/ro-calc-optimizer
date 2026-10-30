#!/usr/bin/env node
// Derive the browser-facing data artifacts from the hand-edited sources in
// src/assets/demo/data/ and emit them to src/assets/data/ (gitignored).
//
// Why this exists: the app used to fetch item.json (11,5 MB) + latam-items.json
// (6,6 MB) and do the LATAM merge in the browser, on the main thread, on every
// single page load. Over half of that payload was `description` — and for the
// items that exist on LATAM the English description was thrown away and replaced
// by the pt-BR one from latam-items.json a few milliseconds later. This script
// does that merge once, at build time, and splits the result so the calculator
// can boot without the descriptions (they are only needed for hover tooltips and
// the item-search preview, both user-triggered).
//
// Emits, into --out (default src/assets/data/):
//
//   items-core[.<hash>].json   { "<key>": CoreItem } — item.json already merged
//                              with the LATAM overlay: pt-BR `name`, `enName`
//                              when it differs, `presentInLatam`, `canGrade`.
//                              `preRelease` passes through untouched and forces
//                              `presentInLatam` on for items LATAM has not shipped.
//                              Minus `description`, `unidName`, `resName` and
//                              `requiredLevel`, none of which the browser reads.
//
//   items-desc[.<hash>].json   { "<key>": "<pt-BR description>" } — fetched
//                              after the calculator's first visible calculation.
//
//   items-name-<locale>[.<hash>].json  { "<key>": "<name>" } — the item names in
//                              Spanish and English, only where they differ from the
//                              name items-core carries. Fetched beside items-core
//                              when the reader is not reading Portuguese.
//   items-desc-<locale>[.<hash>].json  the same two languages' descriptions, deferred
//                              exactly like items-desc and fetched instead of it.
//   skill-descriptions[.<hash>].json — skill prose extracted from the authored
//                              TypeScript catalog using esbuild, also deferred.
//
//   monsters[.<hash>].json     monster.json with the pt-BR names from
//                              latam-monsters.json already applied.
//
//   hpsp / classes / item-views [.<hash>].json — reserialized, minified.
//
//   data-manifest.json         logical name -> emitted filename. Never hashed,
//                              and deliberately one directory ABOVE the hashed
//                              files so the src/_headers header globs
//                              (immutable vs no-cache) cannot overlap.
//
// IMPORTANT: this script only ever READS src/assets/demo/data/. item.json stays
// the hand-edited source of truth — .agents/skills/add-ro-item/apply.mjs appends
// new records as raw text before the closing brace, and a full re-stringify by
// anything else would rewrite all ~9,5k entries and destroy that diff.
//
// Usage:
//   node tools/build-web-data.mjs [--hash] [--report] [--all-desc]
//                                 [--src <dir>] [--out <dir>]
//
//   --hash      content-hash the emitted filenames (production builds). Off for
//               `pnpm start`, where stable names let a re-run be picked up by a
//               plain reload.
//   --report    print raw/gzip/brotli sizes per artifact.
//   --all-desc  also emit descriptions for items absent from LATAM. Off by
//               default: their item.json description is in English and they are
//               filtered out of every dropdown anyway.

import { createHash } from 'node:crypto';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSkillCatalog, splitSkillCatalog } from './browser-data.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

// Mirrors src/app/constants/item.const.ts. Kept as literals so this stays a
// dependency-free .mjs; the derived-data spec asserts the outputs agree with the
// real TypeScript helpers.
const ITEM_TYPE_WEAPON = 1;
const ITEM_TYPE_ARMOR = 2;

/** Same rule as canGradeItem() in src/app/utils/can-grade.ts (asserted by the spec). */
export function canGradeItem(item) {
  if (!item) return false;
  if (item.itemTypeId === ITEM_TYPE_WEAPON) return item.itemLevel === 5;
  if (item.itemTypeId === ITEM_TYPE_ARMOR) return item.itemLevel === 2;
  return false;
}

/** Fields the browser never reads — see the header for why each one goes. */
const DROPPED_FIELDS = new Set([
  'description', // moved to items-desc (and overwritten by the pt-BR one anyway)
  'unidName', // zero reads outside the ItemModel declaration
  'resName', // zero reads outside the ItemModel declaration
  'canGrade', // recomputed here from itemLevel; the stored flag had drifted
  'presentInLatam', // recomputed here from the LATAM key set
]);

function parseArgs(argv) {
  const out = { hash: false, report: false, allDesc: false, src: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hash') out.hash = true;
    else if (a === '--report') out.report = true;
    else if (a === '--all-desc') out.allDesc = true;
    else if (a === '--src') out.src = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else {
      console.error('usage: node tools/build-web-data.mjs [--hash] [--report] [--all-desc] [--src <dir>] [--out <dir>]');
      process.exit(1);
    }
  }
  out.src = resolve(out.src ?? join(ROOT, 'src/assets/demo/data'));
  out.out = resolve(out.out ?? join(ROOT, 'src/assets/data'));
  return out;
}

const readJson = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

/**
 * item.json has 9,555 keys but only 9,553 distinct ids: 4807 is deliberately
 * listed under 4807 / 48079999 / 480799999 so the ASPD+1 enchant shows up in
 * several costume-enchant pickers. The LATAM overlay is keyed by real id, so try
 * the id first and fall back to the map key.
 */
export const latamEntry = (latam, key, item) => latam[item.id] ?? latam[key];

export function buildItems(items, latam, { allDesc } = {}) {
  const core = {};
  const desc = {};

  for (const key of Object.keys(items)) {
    const item = items[key];
    const pt = latamEntry(latam, key, item);

    const rec = {};
    for (const field of Object.keys(item)) {
      if (!DROPPED_FIELDS.has(field)) rec[field] = item[field];
    }

    // `preRelease` is the one hand-authored source of presentInLatam: an item that
    // LATAM has not shipped yet but that we want selectable anyway, carrying the iRO
    // English name and description. See docs/item-json.md and the graduation check in
    // src/app/api-services/pre-release-items.spec.ts.
    if (pt) {
      rec.presentInLatam = true;
      // Set/combo scripts (EQUIP[...], POS_SPECIFIC[...], REFINE_NAME[...]) match
      // partner items by their English display name, so it has to survive the
      // swap to pt-BR — calculator.ts matches on `enName ?? name`.
      if (pt.name && pt.name !== item.name) {
        rec.enName = item.name;
        rec.name = pt.name;
      }
      if (pt.description) desc[key] = pt.description;
    } else if (item.preRelease) {
      rec.presentInLatam = true;
      // The English description is the only one there is, so it ships unconditionally
      // rather than waiting for --all-desc.
      if (item.description) desc[key] = item.description;
    } else if (allDesc && item.description) {
      desc[key] = item.description;
    }

    if (canGradeItem(item)) rec.canGrade = true;

    core[key] = rec;
  }

  return { core, desc };
}

/**
 * The artifacts below exist only for the MCP server, which serves the same engine over
 * Model Context Protocol and needs more of the LATAM universe than the browser does.
 *
 * They are sidecars because they are data the browser has no use for at all — not fields
 * clawed back out of a file it already downloads. A field the MCP needs from item.json
 * simply stays in items-core, where 1,6% of extra bytes is cheaper than a second artifact
 * and a merge step.
 */

/**
 * The LATAM ids with no `item.json` record at all — around 6,6k of them.
 *
 * The browser's pipeline iterates item.json's keys and so never sees these; the MCP's
 * search index unions them back in as name-only rows flagged `inCalcDb: false`
 * (mcp/src/data/item-index.ts). Mirrors that loop's own test — an id counts as present
 * when some record carries it as `id`, which is what makes the 4807 alias keys collapse
 * to one row. Names/slots only, ~340 KB; descriptions ride in items-desc-mcp.
 */
export function buildLatamExtra(items, latam) {
  const known = new Set();
  for (const key of Object.keys(items)) known.add(items[key].id);

  const out = {};
  for (const id of Object.keys(latam)) {
    if (known.has(Number(id))) continue;
    const entry = latam[id];
    const rec = { name: entry.name };
    if (entry.aegisName) rec.aegisName = entry.aegisName;
    if (entry.slots) rec.slots = entry.slots;
    out[id] = rec;
  }
  return out;
}

/**
 * Every description the MCP can serve, keyed by item **id**.
 *
 * Three things make this a different file from items-desc rather than a superset of it:
 *
 *  - it is keyed by id, because both consumers look up by id — `item_description` reads
 *    `latamRecord(id)?.description ?? record(id)?.description` and `get_item` reads
 *    `rec.description`, and items-desc is keyed by map key (the two diverge for the
 *    48079999/480799999 aliases of item 4807);
 *  - it covers the LATAM-only ids, which items-core knows nothing about;
 *  - it keeps the English description of calc-DB items absent from LATAM, which the
 *    browser deliberately withholds but `get_item` still answers with.
 *
 * ~6 MB, and the single reason the Worker loads it behind its own lazy promise.
 */
export function buildDescMcp(items, latam) {
  const out = {};

  for (const key of Object.keys(items)) {
    const item = items[key];
    // Same precedence mergeLatamItems applies: the pt-BR text wins when there is one.
    const pt = latamEntry(latam, key, item);
    const desc = pt?.description ?? item.description;
    if (desc) out[item.id] = desc;
  }

  // LATAM-only ids last: they cannot collide with the loop above, which only ever writes
  // ids that item.json carries.
  for (const id of Object.keys(latam)) {
    const desc = latam[id].description;
    if (desc && out[id] === undefined) out[id] = desc;
  }

  return out;
}

/**
 * One language's item text, keyed the way items-core and items-desc are keyed.
 *
 * Names are emitted only where they differ from the name items-core already carries,
 * which is how 14,9k rows become a ~300 KB overlay instead of a second name table: the
 * client leaves a great many items spelled identically in all three languages, and an
 * absent key means "the Portuguese one was already right".
 *
 * Descriptions carry no such comparison, and whatever items-desc shows is kept wherever
 * the client has nothing: this artifact is fetched INSTEAD of items-desc, so a gap would
 * be an empty tooltip rather than an untranslated one. The pre-release items need that
 * fallback for all 200 of their rows — they have no client row in any language yet.
 */
export function buildLocaleText(items, latam, localeItems) {
  const names = {};
  const desc = {};

  for (const key of Object.keys(items)) {
    const item = items[key];
    const pt = latamEntry(latam, key, item);
    // Same gate as items-core's `presentInLatam`: an id neither the Portuguese table nor
    // `preRelease` vouches for is in no dropdown, so translating it is bytes nobody reads.
    if (!pt && !item.preRelease) continue;
    const entry = localeItems[item.id] ?? localeItems[key];

    // What items-core ended up showing — the pt-BR name when there is one, the
    // English name from item.json when there is not.
    const shown = pt?.name && pt.name !== item.name ? pt.name : item.name;
    if (entry?.name && entry.name !== shown) names[key] = entry.name;
    const text = entry?.description ?? pt?.description ?? item.description;
    if (text) desc[key] = text;
  }

  return { names, desc };
}

export function buildMonsters(monsters, latamMonsters) {
  for (const id of Object.keys(monsters)) {
    const pt = latamMonsters[id];
    if (pt) monsters[id].name = pt;
  }
  return monsters;
}

export async function main() {
  const args = parseArgs(process.argv);

  const items = readJson(args.src, 'item.json');
  const latam = readJson(args.src, 'latam-items.json');
  const latamEs = readJson(args.src, 'latam-items-es.json');
  const latamEn = readJson(args.src, 'latam-items-en.json');
  const monsters = readJson(args.src, 'monster.json');
  const latamMonsters = readJson(args.src, 'latam-monsters.json');
  const hpSpTable = readJson(args.src, 'hp_sp_table.json');
  const latamClasses = readJson(args.src, 'latam-classes.json');
  const itemViews = readJson(args.src, 'item-views.json');

  const { core, desc } = buildItems(items, latam, args);
  const es = buildLocaleText(items, latam, latamEs);
  const en = buildLocaleText(items, latam, latamEn);
  const { descriptions: skillDescriptions } = splitSkillCatalog(await readSkillCatalog(ROOT));

  const artifacts = [
    ['itemsCore', 'items-core', core],
    ['itemsDesc', 'items-desc', desc],
    ['itemNamesEs', 'items-name-es', es.names],
    ['itemNamesEn', 'items-name-en', en.names],
    ['itemsDescEs', 'items-desc-es', es.desc],
    ['itemsDescEn', 'items-desc-en', en.desc],
    ['skillDescriptions', 'skill-descriptions', skillDescriptions],
    ['monsters', 'monsters', buildMonsters(monsters, latamMonsters)],
    ['hpsp', 'hpsp', hpSpTable],
    ['classes', 'classes', latamClasses],
    ['itemViews', 'item-views', itemViews],

    // MCP-only sidecars. The browser never fetches these — they are not in EAGER_KEYS and
    // nothing in src/app reads them — but they are plain static assets, which is exactly
    // how the Worker gets at them (worker/mcp/data.ts, via the ASSETS binding).
    ['latamExtra', 'latam-extra', buildLatamExtra(items, latam)],
    // Verbatim: buildMonsters above consumes this file to rename monsters.json and then
    // throws it away, but the MCP's monster index unions its ~3,6k stat-less mobs back in.
    ['latamMonsters', 'latam-monsters', latamMonsters],
    ['itemsDescMcp', 'items-desc-mcp', buildDescMcp(items, latam)],
  ];

  // Wipe first so hashed filenames from previous runs never accumulate.
  rmSync(args.out, { recursive: true, force: true });
  mkdirSync(args.out, { recursive: true });

  const files = {};
  const report = [];

  for (const [key, base, value] of artifacts) {
    const bytes = Buffer.from(JSON.stringify(value));
    // Hash the emitted bytes, not the inputs: a deploy that doesn't touch the
    // item data produces byte-identical names and every returning visitor keeps
    // its immutable cache.
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    const name = args.hash ? `${base}.${hash}.json` : `${base}.json`;

    writeFileSync(join(args.out, name), bytes);
    files[key] = name;
    report.push([name, bytes, Object.keys(value).length]);
  }

  const manifest = { v: 1, base: 'assets/data/', files };
  writeFileSync(join(args.out, '..', 'data-manifest.json'), JSON.stringify(manifest));

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`build-web-data: wrote ${artifacts.length} artifacts to ${args.out}${args.hash ? ' (hashed)' : ''}`);

  if (args.report) {
    let rawTotal = 0;
    let brTotal = 0;
    for (const [name, bytes, count] of report) {
      const gz = gzipSync(bytes, { level: 9 }).length;
      const br = brotliCompressSync(bytes).length;
      rawTotal += bytes.length;
      brTotal += br;
      console.log(`  ${name.padEnd(34)} ${kb(bytes.length).padStart(9)}  ${kb(gz).padStart(8)} gz  ${kb(br).padStart(8)} br  (${count} registros)`);
    }
    console.log(`  ${'TOTAL'.padEnd(34)} ${kb(rawTotal).padStart(9)}  ${''.padStart(11)}  ${kb(brTotal).padStart(8)} br`);
  }
}

// Só executa quando chamado direto pela CLI; a spec importa buildItems/canGradeItem.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
