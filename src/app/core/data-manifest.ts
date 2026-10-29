/**
 * The one description of what `tools/build-web-data.mjs` emits.
 *
 * Three things resolve artifacts through `data-manifest.json` and used to each carry their
 * own copy of this: the app (`src/app/api-services/ro.service.ts`), the Worker's MCP data
 * loader (`worker/mcp/data.ts`) and the spec loader (`mcp/src/data/dataset.node.ts`).
 * Same reasoning as `share-path.ts` — when a grammar has three readers, it gets one
 * definition, or two of them drift.
 *
 * Framework-free on purpose: the Worker cannot import from `@angular/core`.
 */

/** Artifact keys, in the order the generator emits them. */
export const DATA_KEYS = [
  'itemsCore',
  'itemsDesc',
  'itemNamesEs',
  'itemNamesEn',
  'itemsDescEs',
  'itemsDescEn',
  'skillDescriptions',
  'monsters',
  'hpsp',
  'classes',
  'itemViews',
  'latamExtra',
  'latamMonsters',
  'itemsDescMcp',
] as const;

export type DataKey = (typeof DATA_KEYS)[number];

export interface DataManifest {
  v: number;
  /** Directory the files live in, relative to the site root, with a trailing slash. */
  base: string;
  files: Record<DataKey, string>;
}

/**
 * The path an artifact lives at, relative to the site root.
 *
 * Throws rather than returning undefined: every caller would otherwise concatenate
 * `undefined` into a URL and get the SPA fallback — an HTML page, with status 200, parsed
 * as JSON somewhere far from the cause.
 */
export function manifestPath(manifest: DataManifest, key: DataKey): string {
  const file = manifest.files[key];
  if (!file) throw new Error(`data-manifest.json não tem a chave "${key}".`);
  return manifest.base + file;
}
