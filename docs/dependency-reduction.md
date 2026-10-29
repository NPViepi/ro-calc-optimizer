# Dependency reduction

Angular remains the application framework. The engine, replay parser, persisted
formats, MCP interfaces and user features retain their existing contracts.

## Measurements

Measured on Windows with Node 22.16 and frozen pnpm installs. Install sizes below
count logical file bytes, excluding symlinks, from separate empty directories with
`--ignore-scripts` for both baseline and final measurements. They exclude the pnpm
store and browser downloads; a pre-existing root installation is not a clean-size
baseline. Package counts count unique name/version entries in the lockfile's
`packages` section, rather than peer-resolution snapshots.

| Measurement | Before | Root after |
| --- | ---: | ---: |
| Direct runtime packages | 23 | 10 |
| Direct development packages | 26 | 10 |
| Unique locked package versions | 1,275 | 328 |
| Clean installation bytes | 558,992,246 | 188,397,115 |
| Production JavaScript + CSS bytes, all route chunks | 3,563,629 | 3,550,422 |

Root direct dependencies decreased 59.2%, locked packages 74.3%, and clean installed
bytes 66.3%. The browser bundle decreased only 0.4%: much of the removed dependency
tree was tooling or unused code already excluded by tree shaking. Retained Angular,
engine and datasets dominate browser code.

Optional `tooling/cloudflare` has one pinned direct development package (Wrangler
4.128.0), 91 locked package versions and 180,725,025 installed bytes. It has its own
manifest and frozen lockfile and is installed only for Worker development or
deployment. This is isolation, not elimination: the combined root/tooling union is
388 package versions. Installing both trees totals 369,122,140 logical bytes before
any shared pnpm-store deduplication, a 34.0% reduction from the baseline.

To remeasure a built checkout:

```sh
node tools/dependency-metrics.mjs
node tools/dependency-metrics.mjs tooling-metrics.json tooling/cloudflare
```

For a clean-install measurement, copy package.json, pnpm-lock.yaml and
pnpm-workspace.yaml into an empty directory inside `.tmp`, perform the same frozen
install, and pass its relative path as the second script argument. The normal root
installation may contain previous package-manager artifacts and is not comparable.

## Implementation

- Removed unused FullCalendar, JWT, Chart.js, Quill and Prism packages and injected
  scripts/styles. Removed CDK, Angular animations and browser-dynamic.
- Local overlay mounting uses Angular's public view/component APIs. Local focus
  trapping, viewport placement, fixed-row virtualization and pointer reordering
  retain the existing shared overlay lifecycle, Escape stack and scroll locks.
- Kept only the historical LZ-string URI algorithm, with original licenses and
  attribution in THIRD_PARTY_NOTICES.md. Golden fixtures were generated using the
  original dependency before its removal and include Unicode, malformed input,
  comparison links and validated custom-item bundles.
- Bootstrap uses an AOT standalone root with retained feature modules/providers.
  Angular compiler stays available for compilation and peer compatibility. The web
  build rejects a bundled JIT compiler.
- Maintained CSS replaces all 16 SCSS files. Angular compiler-cli checks templates
  and compiles resources before esbuild links Angular libraries and emits hashed,
  split bundles into `dist/sakai-ng`. Babel is resolved from compiler-cli's own
  dependency tree, not declared or hoisted as a root replacement.
- Node serves development builds on port 4200 with configurable host/port, watches
  source changes and sends a full-page reload after successful compilation. A build
  runs in a child process while the last successful generation remains available.
- Read-only TypeScript import checks replace ESLint. Vitest, coverage, Playwright,
  TypeScript, esbuild and required type packages remain. CI uses Node 22 and frozen
  pnpm installs for both manifests.

The previous Angular esbuild builder reported that it ignored bundle budgets.
The new builder enforces initial bundle limits and component stylesheet limits.
Three existing oversized component styles have explicit, bounded allowances in
`tools/web-budgets.json`; all other styles use the previous default limits.

### The `totalBaseline` ratchet and the translation catalogs

`totalBaseline` counts the emitted JS and CSS, but the translation catalogs are
mutually exclusive: `loadCatalog` fetches the one chunk for the chosen language and
no reader downloads another. Counting all of them would charge every future language
against a baseline measured before any of them existed, so the total carries the
largest catalog chunk and leaves the rest out. A catalog that doubled in size is
still caught; a fourth language is not charged twice.

The baseline moved from 3,550,422 to 3,610,840 when the interface became
trilingual. The 60 KB is what every reader loads regardless of language: the pt-BR
catalog, which is bundled on purpose so the first paint never shows raw keys (see
`DEFAULT_LOCALE`), plus `translate`/`fill` and the key strings themselves. The
alternative catalogs are not in that figure.

That also put the startup bundle past its *warning* threshold — 2,340,069 against a
2,300,000 warning and a 2,400,000 error. The warning is left in place rather than
raised: it is reporting a real cost, and the next startup-sized addition should have
to answer for it.

The baseline moved again, from 3,610,840 to 3,718,493, when the responsive layer
landed. Half of the 107 KB is one file counted twice: `responsive.css` is emitted at
26,135 bytes into both `main`'s CSS bundle and a shared CSS chunk, and the total adds
up every emitted file. The rest is the JS of the touch affordances and the compact
layouts, with the catalog keys they needed.

Startup then stood at 2,396,283 — 3,717 bytes under the *error* threshold, the point
where the production build throws and CI fails. Only one copy of `responsive.css`
counts there, but it counts for every reader on the first paint.

The item text and the first-run language dialog took 4,307 of those bytes: baseline
3,718,493 to 3,722,800, startup to 2,399,442. The dialog and its sheet are most of it,
and they are startup work by definition — a new visitor is asked before anything else
renders. The per-language item names and descriptions cost the bundle almost nothing,
because they are fetched JSON (`items-name-<locale>`, `items-desc-<locale>`) and the
descriptions replace the Portuguese file rather than joining it; only the client code
that picks between them is here.

A note on that baseline: CI measures 3,722,800 where this machine measures 3,722,295 —
same commit, 505 bytes apart, almost all of it in the largest vendor chunk. Ruled out:
chunk drift around the catalog exclusion (each catalog chunk holds exactly one input, so
nothing shared rides out with it), line endings (the bundle is minified), and a stale
install (`node_modules/.modules.yaml` and `pnpm-lock.yaml` are in step, and the lockfile
has not moved since October 2nd). It is a Linux/Windows difference in the emitted vendor
code that has not been pinned down; before this change the two agreed, so it is worth
re-checking if the gap grows. The baseline tracks CI, because CI is the gate — a local
build now passes with 505 bytes of slack instead of exactly at the line.

That left 558 bytes of headroom, which is not headroom. `initialError` goes to
2,420,000 — the first time it has moved — buying back about 20 KB. It is a guard rail
on the first paint, so the next change to spend it should say what it bought, exactly
as this paragraph does; the ceiling is not the budget, and each raise makes the real
cost of the next one harder to see.

The final simplify pass removed the unused portal view argument, redundant
virtual-list end state and a duplicate filesystem probe. It also consolidated
imports and removed stale CDK comments without changing interaction contracts.

## Validation

Baseline: 317 Vitest files / 6,422 tests passed; production build passed.
After: 321 files / 6,449 tests passed, including the existing untracked replay test.
Read-only source checks, Angular template/type checking, Worker type checking and
production web/Worker builds passed. Frozen clean root and separate tooling installs
passed; both web and Worker also built using the separate clean installation.
All 27 Playwright interaction and unchanged visual-snapshot tests passed, including
focus wrapping/restoration, nested layers, virtual lists, mouse/keyboard/touch
reordering, cancellation, mobile resize/outside clicks, replay import and direct
historical share entry. The production Worker also passed a direct-share browser
check. Wrangler's deployment dry run passed without publishing; local MCP health
reported 17,350 items, 4,179 monsters and 40 classes.

Development verification received two successful SSE reloads, retained the previous
output through an intentional compiler error, recovered after restoring the source,
and returned 200 on all 146 HTTP probes during compilation. Missing JavaScript
returned 404 and a client route returned the SPA shell. Content fingerprints prevent
duplicate Windows metadata/read notifications from causing rebuilds. Static cache
tests check every emitted root JavaScript/CSS file receives immutable caching.

Existing untracked replay recordings and reports were preserved. No deployment or
publication was performed.
