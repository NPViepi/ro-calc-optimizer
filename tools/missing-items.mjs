#!/usr/bin/env node
// Which client items the calculator still has no record for.
//
//   node tools/missing-items.mjs            grouped list, one line per item
//   node tools/missing-items.mjs --json     { category: [{ id, name, aegisName }] }
//   node tools/missing-items.mjs --ids      wanted ids only, space-separated
//
// `latam-items.json` says what exists on LATAM; `item.json` is what the calculator can
// calculate. An id in the first and not the second is invisible in every picker. The
// sync with ragassets refreshes the first and never touches the second, so every client
// update leaves a gap until someone runs `add-ro-item` — this is how that gap is found.
//
// The category comes from the description's type line, the only place the client states
// it: `Tipo: Armadura` on current text, and on old text a first `Classes:` line holding
// the type (`Classes: Katar` … `Classes: Mercenário`). The raw feed's `equipSlots` only
// covers items with a head/garment sprite, so it cannot classify an accessory or ammo.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "../src/assets/demo/data");

/** Categories the calculator models — a missing id here is a real gap. */
export const WANTED = ["weapon", "armor", "shield", "garment", "shoes", "headgear", "accessory", "ammo", "costume", "card", "shadow", "enchant"];

const TYPE_CATEGORY = new Map(
  Object.entries({
    armadura: "armor",
    escudo: "shield",
    capa: "garment",
    calçado: "shoes",
    "equip. para cabeça": "headgear",
    acessório: "accessory",
    "aces. direito": "accessory",
    "aces. esquerdo": "accessory",
    munição: "ammo",
    visual: "costume",
    costume: "costume",
    carta: "card",
    "equip. sombrio": "shadow",
    "encantamento especial": "enchant",
    // Not character gear, or not equipped at all: counted so nothing hides, never wanted.
    "acessório de mascote": "pet-accessory",
    "ovo de mascote": "pet-egg",
    // The EP19 eggs (9170 Angelgolt, 9190 Relógio) are typed "Ovo de Monstro" instead.
    "ovo de monstro": "pet-egg",
    isca: "taming-bait",
    "item de treinamento": "taming-bait",
    "item de domesticação": "taming-bait",
    roupa: "outfit-consumable",
    essência: "essence",
    // Genetic throwables are consumed by the skill, like the EP18 charms — deliberately absent.
    projétil: "throwable",
  }),
);

const WEAPON_TYPES = new Set([
  "adaga", "espada", "espada de duas mãos", "maça", "machado", "machado de duas mãos", "lança", "lança de duas mãos",
  "cajado", "cajado de duas mãos", "arco", "arcos", "livro", "katar", "soqueira", "chicote", "instrumento musical",
  "pistola", "rifle", "espingarda", "metralhadora", "lança-granadas", "shuriken huuma",
]);

const stripColors = (s) => (s ?? "").replace(/\^[0-9a-fA-F]{6}/g, "");
const normType = (s) => s.trim().replace(/\s*(DEF|Def|Defense)\b.*$/, "").trim().toLowerCase();

const categoryOfType = (type) => (WEAPON_TYPES.has(type) ? "weapon" : TYPE_CATEGORY.get(type));

/** The item's category, `"box"` for a box that merely holds gear, or null when it is not gear at all. */
export function classifyItem(entry) {
  const desc = stripColors(entry.description);
  let category = null;

  // "Tipo : Visual" (space before the colon) and untranslated "Type : Costume" both occur.
  const tipo = desc.match(/(?:Tipo|Type)\s*:\s*([^\n]+)/);
  if (tipo) category = categoryOfType(normType(tipo[1])) ?? `unknown:${normType(tipo[1])}`;
  else {
    const oldStyle = [...desc.matchAll(/Classes?:\s*([^\n]+)/g)].map((m) => categoryOfType(normType(m[1]))).find(Boolean);
    category = oldStyle ?? null;
  }
  if (!category) return null;

  // "Uma caixa contendo 1 Anel do Ganhador" is typed as the accessory it holds.
  if (/caixa contendo|a box that contains/i.test(desc)) return "box";
  // Tutorial props ("Capote do Tutorial"): typed as gear, but no class can wear them.
  if (/Classes?:\s*Nenhuma/i.test(desc)) return "unequippable";
  if (category === "ammo") {
    // Rebellion slugs: "Catalisador de [Calibre Letal], não é necessário equipar."
    if (/não é necessário equipar/i.test(desc)) return "skill-catalyst";
    // Grenade spheres: renewal launchers load bullets, which the calculator offers them.
    if (/Lança-Granadas/i.test(desc)) return "grenade-sphere";
    // "[Munição] Poção do Furor": thrown by Arremesso de Item, like the Projétil potions.
    if (/^\[Munição\]/.test(entry.name ?? "")) return "throwable";
  }
  if (category !== "costume" && /^\[Visual\]/.test(entry.name ?? "")) return "costume";
  return category;
}

/** `{ category: [{ id, name, aegisName }] }` for every LATAM item with no item.json record. */
export function findMissingItems(latamItems, itemDb) {
  const out = {};
  for (const [id, entry] of Object.entries(latamItems)) {
    if (itemDb[id]) continue;
    const category = classifyItem(entry);
    if (!category) continue;
    (out[category] ??= []).push({ id: Number(id), name: entry.name, aegisName: entry.aegisName ?? null });
  }
  return out;
}

export const readJson = (name) => JSON.parse(readFileSync(join(DATA, name), "utf8"));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const missing = findMissingItems(readJson("latam-items.json"), readJson("item.json"));
  const args = new Set(process.argv.slice(2));

  if (args.has("--json")) {
    console.log(JSON.stringify(missing, null, 2));
  } else if (args.has("--ids")) {
    console.log(WANTED.flatMap((c) => missing[c] ?? []).map((i) => i.id).join(" "));
  } else {
    const wanted = WANTED.filter((c) => missing[c]?.length);
    const total = wanted.reduce((n, c) => n + missing[c].length, 0);
    console.log(`${total} item(s) the calculator can use are missing from item.json`);
    for (const c of wanted) {
      console.log(`\n## ${c} (${missing[c].length})`);
      for (const i of missing[c]) console.log(`${i.id}\t${i.name}\t${i.aegisName ?? ""}`);
    }
    const skipped = Object.keys(missing).filter((c) => !WANTED.includes(c));
    if (skipped.length) {
      console.log(`\nNot counted (not character gear): ${skipped.map((c) => `${c} ${missing[c].length}`).join(", ")}`);
    }
  }
}
