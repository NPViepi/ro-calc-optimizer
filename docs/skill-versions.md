# Skill formula versions and 275/60 previews

The **Fórmulas** selector in Batalha, PVP and Auto-conjuração controls one build setting. **Atual (LATAM)** is the default, including old saved builds and unknown version values, and since 29/10/2026 it *is* the 02/06/2022 kRO rebalance — see "The 28/10/2026 LATAM patch" below. **Pré-rebalanceamento (até 28/10/2026)** selects the ratios and timings LATAM ran before that patch; **Rebalance - 21/12/2022 - (kRO)** selects the later ratios, hit counts and cast timings. Dates are the kRO deployment dates, verified against Gravity's maintenance notices [7600](https://ro.gnjoy.com/news/notice/View.asp?BBSMode=10001&seq=7600&curpage=1) and [7670](https://ro.gnjoy.com/news/notice/View.asp?BBSMode=10001&seq=7670&curpage=1). The adjacent info button opens a popover explaining the dates and linking each rebalance's Korean maintenance notice, English announcement and full formula archive. It is available in all three panels and closes on Escape or an outside click. The setting travels with named saves and shared builds. Comparing two builds resolves each build's version independently.

The persisted version IDs are `current`, `pre-rebalance` and `rebalance-2026-02`. `rebalance-2022-06` was this bundle's ID while it was still a variant; a build saved then asked for exactly what `current` is now, so `normalizeSkillFormulaVersion` maps it there and the build keeps its numbers. The latter ID and the formula articles' February 2026 URLs describe when those references were published; they do not mean the rebalance arrived in kRO in 2026. The later announcement is [Sigma's fourth-rebalance post](https://www.divine-pride.net/forum/index.php?/topic/3723-kro-jobs-improvement-project/page/14/#comment-12421), followed by the final December 21, 2022 maintenance notice. Deployment dates were checked on 2026-10-15.

The legacy class definitions in `src/app/jobs/*.ts` remain the source for `pre-rebalance`; `current` and `rebalance-2026-02` are resolved from them per calculation by `resolveRebalancedSkill`, which never writes to a shared job or skill definition. Each rebalance catalog uses copies and adds attacks the legacy catalog lacks. Preview attacks are available in all three versions and are explicitly labelled **Prévia**; all new buff/condition controls start disabled.

The cog button at the far right of the topbar opens the **Configurações** sidebar on the right. Its only setting is the **Prévias** Sim/Não control, which defaults to **Sim** and persists separately from builds in `ro-show-previews`. Its hover tooltip explains preview visibility, the LATAM reset and persistence. Turning it off hides preview item/enchant choices and skill controls, removes preview attacks from rotations, disables hidden preview buffs, and resets formulas to **Atual (LATAM)**, which is the baseline. Formula selectors in Batalha, PVP and Auto-conjuração stay hidden while it is off, including after loading a saved/shared build. Turning it back on restores the catalogs without re-enabling buffs or rebalance. Existing equipped items are preserved. The sidebar closes with its close button, Escape or a backdrop click. The 285/65 skills were requested by Oden.

## The 28/10/2026 LATAM patch

The 28/10/2026 client moved the fourth-job and expanded-fourth trees onto the 02/06/2022 kRO rebalance, so that bundle stopped being a variant and became the baseline. Three client-side tables say so, and they agree:

- **Descriptions.** The 31/07/2026 client printed Cólera Esmagadora at 600 / 1.200 / 1.800 / 2.400 / **3.000%** — the pre-rebalance numbers the engine carried. The 28/10/2026 client prints 1.200 / 2.000 / 2.800 / 3.600 / **4.400%**, which is `REBALANCE_2022_PATCHES` exactly. 156 skill descriptions moved this way, almost all of them ids 52xx–54xx.
- **Delays.** The same feed retuned 86 `delay` rows, and they reproduce the timing tables in `rebalance-2022-reference.ts`. Cooldowns are enforced, not decorative: the EP19 ultimates went from 60s to 2–5s and Windhawk's four traps from 20–30s to 2,5s.
- **Ratios.** `skill-ratio-client-table.spec.ts` now checks all 100 reference attacks whose description publishes a per-level ATQ/ATQM column. Every one of them reproduces the baseline, and two of them (Colisão Astral, Arremessar Escudo) only did so after the client corrected the class articles.

The recordings made up to 09/2026 measured the pre-patch server, so the ~29 replay and gear-state specs ask for `pre-rebalance` by name and keep asserting the packets they always did. Nothing was retired; each one says in a comment that it predates the patch. **No post-patch recording has been taken yet**, so the baseline is sourced from the client and the articles, not from packets: a recording made after 28/10/2026 is what would confirm it, and is the first thing to ask for if a damage figure looks wrong.

One divergence stays unapplied. Dilacerar's client table reads 270 / **340** / 610 / 780 / 950%, and every level but Nv2 fits `100 + 170*Nv`; 340 breaks that progression by exactly 100, so it is read as a client typo and the engine keeps 440. It is listed in that spec's `EXCEPTIONS` with the reason.

### Checked against the LATAM announcement

LATAM published the patch as ["Rebalanceamento de habilidades: Edição 1"](https://ro.gnjoyamericas.com/pt/news/notice/446) on 29/10/2026, with `Antes` / `Agora` tables for 152 skills. It is the player-facing statement of this patch, so the whole notice was read against the engine on 29/10/2026: **`pre-rebalance` reproduces its `Antes` column and `current` reproduces its `Agora` column.** Of the 102 rows that name a skill the reference covers and publish a damage figure, 96 match outright.

The notice prints one headline figure per skill, while the client publishes a per-level table; where the two disagree the client wins, because `skill-ratio-client-table.spec.ts` can check it level by level and because it is the text the player reads in game. All six disagreements have a cause, and in each the engine already matches the client:

| Skill | Notice `Agora` | Why it differs |
| --- | --- | --- |
| Arremessar Escudo | 14.440% | The client's table is 11.900% at Nv5 plus `Perícia Nv x75`, i.e. 12.650% at mastery 10, and the Korean final notice's 12.840% is that figure plus the example's shield (weight 150, refine +10 × 4). 14.440% is the inflated English-translation number, which the table above already records as superseded. |
| Explosão de Faíscas | 3.300% | Repeats the 3.300% printed for Laser Triplo in the row immediately above — a copy error in the notice. The client gives 1.000% to 7.750% across ten levels. |
| Atirar Rosas | 11.200% 15.250% | Those are the two packets' **[Desarranjo Musical]** values. The client's bare Nv5 row is 10.200% / 14.250%, which is what the engine reports with the mark off. |
| Cólera Esmagadora | 5.150% | The client's table is 4.400% at Nv5, and its description says weapon level and weight scale the damage; the notice's figure reflects an equipped weapon the table does not assume. |
| Lança Galhada | 7.300% | The English post's number; the Korean final notice and the client both give 7.350%, as the table above records. |
| Cortar em Espiral | 4.050% | Printed before the target-size factor. Against a Medium target the engine applies ×1,3, giving 5.265%, which is the `EXCEPTIONS` entry in `skill-ratio-client-table.spec.ts`. |

Two of these — the Explosão de Faíscas copy error and the Arremessar Escudo translation figure — are errors in the notice itself, confirmed against the Korean notice and the client. The remaining four are the notice describing a loaded example where the client prints the bare table.
## June 2022 rebalance coverage (information shared by Shummuy)

The [linked announcement](https://www.divine-pride.net/forum/index.php?/topic/3723-kro-jobs-improvement-project/page/13/#comment-11126) is the **third rebalance of fourth jobs and second rebalance of expanded jobs**. The follow-up [May corrections](https://www.divine-pride.net/forum/index.php?/topic/3723-kro-jobs-improvement-project/page/13/#comment-11497) belong to this same bundle. The 2025 dates on Sigma's complete v3/v2 articles are publication dates of the formula reference, not a separate rebalance. Research checked on 2026-10-13.

All 18 groups / 20 classes / 148 primary attack identities are represented. Their individual source URLs, level limits and historical timing tables are in `src/app/skills/rebalance-2022-reference.ts`. The formula differences are in `REBALANCE_2022_PATCHES`; mathematically unchanged entries share the existing formula functions, while timings are independently recorded. This bundle is the LATAM default, and both the pre-patch build and the later rebalance remain independently selectable. The 275/60 and 285/65 preview skills remain available in all three versions.

The research used the original Korean Gravity developer notes [part 1](https://ro.gnjoy.com/news/devnote/View.asp?category=1&seq=4139189&curpage=1), [part 2](https://ro.gnjoy.com/news/devnote/View.asp?category=1&seq=4139190&curpage=1), [part 3](https://ro.gnjoy.com/news/devnote/View.asp?category=1&seq=4139191&curpage=1), the [final Korean maintenance notice](https://ro.gnjoy.com/news/notice/View.asp?BBSMode=10001&seq=7600&curpage=1), the [official English iRO changelog](https://iro.ragnarokonline.com/news/updatedetail.aspx?id=399), and the complete v3/v2 tables by the announcement's author linked in the reference file. Historical emulator code was inspected at [rAthena commit eadfa053](https://github.com/rathena/rathena/blob/eadfa053f6db830e0e769b7241aab5b8df651c92/src/map/battle.cpp), after its [2022 rebalance implementation series](https://github.com/rathena/rathena/issues/7857). Its speculative comments and later formulas were not taken as official confirmation.

Source reconciliation:

| Skill | Earlier-version decision |
| --- | --- |
| Shield Shooting | **Superseded by the client on 29/10/2026.** The Korean notice's 12840% example at Nv5 / mastery10 / shield weight150 / refine10 is reproduced by the historical base `1400 + 2100*Lv`, but the LATAM client's own table is 2.700% / 5.000% / 7.300% / 9.600% / 11.900%, i.e. `400 + 2300*Lv`, which agrees with `1400 + 2100*Lv` only at Nv5 — the one level the Korean example used. The engine now follows the client; mastery `15*Lv*mastery`, POW5, shield weight and refine4 stay as the article has them, because the client names those terms without numbers. |
| Grand Judgement | Korean final notice and historical code agree on **15250% / 16850%** at Nv10; use `250 + 1500*Lv` normally and `350 + 1650*Lv` against plant/insect. The article's normal `1250*Lv` is a typo. POW7 follows the full article; historical emulator POW10 is a conflicting trait coefficient and is not treated as confirmed. |
| Second Flame | Korean final notice and historical code agree on **14700%** at Nv5: use `200 + 2900*Lv + 9*POW`, correcting the full article's base100. |
| Astral Strike | **Superseded by the client on 29/10/2026.** The article's base300 was right after all: the client's table is 2.100% to 18.300% in steps of 1800 (`300 + 1800*Lv`) and 2.500% to 21.400% in steps of 2100 on Undead and Dragon (`400 + 2100*Lv`). `2140*Lv` matches only at Nv10, which is the level the Korean notice quoted. The initial packet now reads the same as the later bundle. Sustained damage still uses the full article's `650*Lv + 10*SPL`, repeated19 times, with the speculative race bonus excluded. |
| Hyunrok Cannon | Korean final notice confirms **7350%**, correcting the English post's7300%; the full article's `700 + 950*Lv` is consistent. |

These are sourced previews, not recording-validated LATAM mechanics. Unresolved trait coefficients, shield-weight behavior outside the published example and low-level interpolation remain subject to validation; no complete official server formula dump was found. Character progression, resource spending/recovery, duration, movement and automatic state transitions remain outside this formula-version change.

Earlier behavior includes Giant Growth's30% double-damage probability, Deft Stab's `5*Lv` percent repeat chance, Frenzy Shot's one-or-three packets,15 Cross Rain packets,15 galaxy/star packets,5 Research Report thorn packets, the earlier Climax / Breaking Limit bonuses and Vigor's Nv10 basic-attack250% / racial100%. Probabilistic repeat counts use expected damage. Metallic Fury retains both its primary and conditional area packet; its stack selector chooses one to five branded targets and applies the arrow's element to both packets. Hyper Novice's separately selectable initial/field/explosion entries are retained. Existing manual buff/condition controls are reused.

`src/app/skills/rebalance-2022.spec.ts` covers every class, attack and level, independent numeric examples, Korean corrections, conditional packets, cast tables, traits/masteries, save round trips, version isolation, real damage and explicitly supplied autocast definitions. Session and browser tests exercise both rebalance settings and the Prévias reset.

## December 2022 rebalance coverage (formula references published February 2026)

All 18 article groups in Sigma's dropdown are represented (20 classes because two articles cover pairs). Expanded classes call their February article the “3rd version.” The numeric timing reference is in `src/app/skills/rebalance-2026-reference.ts`; formulas and conditional states are in `rebalance-2026.ts`.

| Classes | Article |
| --- | --- |
| Arch Mage | [4th version](https://sigmathefallen.blogspot.com/2026/02/arch-mage-4th-version.html) |
| Dragon Knight | [4th version](https://sigmathefallen.blogspot.com/2026/02/dragon-knight-4th-version.html) |
| Windhawk | [4th version](https://sigmathefallen.blogspot.com/2026/02/windhawk-4th-version.html) |
| Shadow Cross | [4th version](https://sigmathefallen.blogspot.com/2026/02/shadow-cross-4th-version.html) |
| Abyss Chaser | [4th version](https://sigmathefallen.blogspot.com/2026/02/abyss-chaser-4th-version.html) |
| Inquisitor | [4th version](https://sigmathefallen.blogspot.com/2026/02/inquisitor-4th-version.html) |
| Imperial Guard | [4th version](https://sigmathefallen.blogspot.com/2026/02/imperial-guard-4th-version.html) |
| Troubadour, Trouvere | [4th version](https://sigmathefallen.blogspot.com/2026/02/troubadour-trouvere-4th-version.html) |
| Cardinal | [4th version](https://sigmathefallen.blogspot.com/2026/02/cardinal-4th-version.html) |
| Biolo | [4th version](https://sigmathefallen.blogspot.com/2026/02/biolo-4th-version.html) |
| Elemental Master | [4th version](https://sigmathefallen.blogspot.com/2026/02/elemental-master-4th-version.html) |
| Meister | [4th version](https://sigmathefallen.blogspot.com/2026/02/meister-4th-version.html) |
| Night Watch | [3rd version](https://sigmathefallen.blogspot.com/2026/02/night-watch-3rd-version.html) |
| Soul Ascetic | [3rd version](https://sigmathefallen.blogspot.com/2026/02/soul-ascetic-3rd-version.html) |
| Shinkiro, Shiranui | [3rd version](https://sigmathefallen.blogspot.com/2026/02/shinkiro-shiranui-3rd-version.html) |
| Sky Emperor | [3rd version](https://sigmathefallen.blogspot.com/2026/02/sky-emperor-3rd-version.html) |
| Spirit Handler | [3rd version](https://sigmathefallen.blogspot.com/2026/02/spirit-handler-3rd-version.html) |
| Hyper Novice | [3rd version](https://sigmathefallen.blogspot.com/2026/02/hyper-novice-3rd-version.html) |

Displayed hit splits and repeated full-ratio damage packets are distinct. Multipart attacks with unequal repetition (All Bloom, Astral Strike and Mission Bombard) apply defense to each part before repeating its packets. Hyper Novice's initial, sustained and explosion entries remain independently selectable.

Sonic Brand's alternative Reverberation and Metallic Sound ratios are included. Frenzy Shot's probabilistic third hit and Storm Slash's Giant Growth double-damage chance use expected values for the simulator's damage/DPS estimate.

## Preview mapping

Both skill announcements in the [275/60 thread](https://www.divine-pride.net/forum/index.php?/topic/7814-kro-27560-level-expansion-and-new-skills/) are included: 29 unique skills, comprising 26 attacks and 3 support skills. Abyss Flame exposes separate target-centered and user-centered attack entries so their hit counts can be simulated independently.

All 29 preview skills have English effect descriptions in pickers and skill details, independent of the deferred LATAM descriptions. Preview buff controls also use English summaries and preserve an empty icon space.

| Class | Skill IDs and attack names |
| --- | --- |
| Dragon Knight | 6502 Dragonic Pierce |
| Imperial Guard | 6503 Radiant Spear; 6504 Imperial Cross; 6505 Imperial Pressure |
| Meister | 6506 Rush Strike; 6507 Powerful Swing; 6508 Energy Cannonade |
| Biolo | 6509 Mystery Powder; 6510 Dust Explosion |
| Shadow Cross | 6511 Cross Slash |
| Abyss Chaser | 6512 Hit and Sliding; 6513 Chasing Break; 6514 Chasing Shot; 6515 Abyss Flame |
| Elemental Master | 6517 Psychic Stream |
| Cardinal | 6518 Divinus Flos |
| Inquisitor | 6519 Blazing Flame Blast |
| Windhawk | 6520 Wild Walk |
| Troubadour, Trouvere | 6521 Rhythmical Wave |
| Night Watch | 5500 Wild Shot; 5501 Midnight Fallen |
| Sky Emperor | 5502 Sky Sun; 5503 Sky Moon; 5504 Star Light Kick |
| Spirit Handler | 5506 Chulho Battering; 5507 Hyunrok Spirit Power |

The Meister Powerful Swing and Shadow Cross Cross Slash have separate internal names from the older skills with the same English names, preserving item bonus and skill ID identities.

### Support and accompanying buffs

| Class | Preview control | Simulated effect |
| --- | --- | --- |
| Arch Mage | 6516 Energy Conversion | Level-specific SP recovery and AP cost shown in the picker; no persistent stat bonus |
| Hyper Novice | 5505 Overcoming Crisis | Flat MaxHP, P.Atk and S.Matk by level |
| Shinkiro, Shiranui | 5499 Four Colors Charm | Four independent elemental controls; additive ratio for each corresponding cannon |
| Biolo | Mystery Powder | Enables Dust Explosion |
| Abyss Chaser | Chasing | Extra ratios for Unlucky Rush and Chain Reaction Shot's secondary damage; enhanced Chasing Break/Shot ratios and hit counts |
| Windhawk | Wild Walk | Level-specific Flee bonus |
| Shadow Cross | Successful blocking | Records the 10-second state; no extra numerical bonus |
| Inquisitor | Massive Flame Blaster | Enhanced Blazing Flame Blast ratio |
| Cardinal | Ancilla | Neutral Divinus Flos element |
| Elemental Master | Energy Coat | Blocks Psychic Stream while enabled |
| Shinkiro, Shiranui | Hidden Weapon area, Nightmare target mark | Selects conditional rebalance damage |
| Hyper Novice | Target below 50% HP | Selects conditional Mega Sonic Blow damage |

Existing stance, Axe Stomp, Research Report, Shadow Exceed, Mystic Symphony, Dragonic Aura, Hidden Card, celestial and elemental controls are reused. Weapon restrictions are checked by the normal damage pipeline. Buff durations, movement, instantaneous healing, AP expenditure and regeneration are descriptive; the simulator does not advance resource pools or automatically activate buffs after a rotation entry.

### Preview data limits

The announcement supplies base ratios, hit counts, stated passive dependencies, buff effects and restrictions. It mentions scaling with traits and base level without publishing every coefficient or cast delay. Those missing coefficients and timings use the [rAthena renewal skill database](https://github.com/rathena/rathena/blob/master/db/re/skill_db.yml) and [skill implementations](https://github.com/rathena/rathena/tree/master/src/map/skills), inspected on 2026-10-11. They are provisional and have not been validated against LATAM recordings. Later rAthena base-ratio balance changes do not replace the requested announcement ratios.

The calculator's existing supported character levels and job stat tables are unchanged. These previews do not add level-275 character progression or a combat/resource state machine.

## 285/65 previews

The [285/65 reference document](https://docs.google.com/document/d/1WutiU7_5ftOinIMHk5R-CETl4sIX3t-7tsKjNX5ISvs/edit) was checked against the [Gravity developer announcement of 2026-06-30](https://ro.game.onstove.com/news/NewsDevnoteDetail/?category=1&page=1&search=&seq=17&srhval=) and the kROM client descriptions on Divine Pride, inspected 2026-10-12. `preview-285-reference.ts` accounts for every ID from 6608 to 6643: 30 primary skills, five Elemental Integration proc identities and the enhanced kick packet. The 28 primary skills belonging to supported classes are available in both formula versions, with English names and the **Prévia** marker. The existing 275/60 previews remain available.

| Class | New primary skills |
| --- | --- |
| Dragon Knight | 6608 Servant Weapon-Cleave |
| Imperial Guard | 6609 Shield Slam |
| Meister | 6610 Overdrive Protocol |
| Biolo | 6611 Rampant Vine |
| Shadow Cross | 6612 Venom Ignition |
| Abyss Chaser | 6613 Phantom Dagger |
| Arch Mage | 6614 Wraith Dash |
| Elemental Master | 6615 Elemental Integration; procs 6616–6620 |
| Cardinal | 6621 Punitio; 6622 Lex Expiatrix |
| Inquisitor | 6623 Sky-Shattering Strike |
| Windhawk | 6624 Fragment Bolt; 6625 Primed Trap; attacks 6626–6629 |
| Troubadour, Trouvere | 6630 Fugue Des Fleches |
| Shinkiro, Shiranui | 6631 Mirage - Cluster; 6632 Surge; 6633 Shadow Torrent |
| Night Watch | 6634 Tactical Repositioning |
| Sky Emperor | 6635 Seven-Star Heavenly Kick; enhanced packet 6636 via seven satellites |
| Soul Ascetic | 6637 Yellow Dragon Talisman |
| Hyper Novice | 6638 Wind Cutter Turbo; 6639 High Magnum Break |
| Spirit Handler | 6640 Resonance of Gwiseol - Cheolho; 6641 Spirit Tongue Resonance - Hyeonrok |
| Alitea (unsupported) | 6642 Plume Pierce; 6643 Nature Rage — catalog identities/descriptions only |

The client description for an individual skill is at `https://www.divine-pride.net/database/skill/<id>`; use its **kROM** text, not the different jRO description. Overdrive Protocol corrects the client's English typo “Protocal” without changing ID 6610. Wraith Dash deals **Ghost**, rather than the Fire element stated in the supplied translation.

Surge boosts non-critical physical damage, critical damage and melee/ranged damage; it does not grant HIT. Venom Ignition adds HIT and non-critical physical damage while disabling both basic and skill criticals. Its override also takes precedence over forced criticals. Non-critical physical bonuses have their own traced stage, so they do not accidentally increase the critical outcome. Resonances affect the named skill IDs. Existing summon, stance, faith, blessing and elemental controls are reused, with accompanying ABR-Infinity, Creeper and mastery controls where needed. All new controls default to off for old builds.

Elemental Integration resolves the element from its active level and proc strength from its learned level (falling back to active level when learning is unset). It triggers from basic physical attacks with 25% chance and gains the matching higher elemental's bonus. Phantom Dagger uses an expected count of 3.15–3.75 full-ratio hits. Seven-Star Heavenly Kick uses a manually selected satellite count, initially zero; seven selects the enhanced ratio.

**Limits:** 285/65 trait coefficients and cast timings are unpublished in these sources and are not borrowed from unrelated skills. Known base-level scaling and published mastery terms are included; the missing POW/CON/SPL terms and Breaking Limit's new-skill multipliers are not. These are partial preview damage estimates, not LATAM-validated formulas. Individual damage remains available, but DPS, combo timing, time to kill and rotation optimization are unavailable when a rotation contains unknown timings. Movement, clone attacks, duration/resource consumption, healing and automatic state transitions remain descriptive. Alitea needs a separate class implementation before its two catalog entries can be simulated. Character progression still uses the supported LATAM level/job/stat tables.

## Verification

`src/app/skills/preview-285.spec.ts` verifies complete identity coverage, every attack level, independent ratios, conditional hits, buffs, proc identity/element/level, save round trips, real physical damage and unknown-timing behavior. `e2e/skill-versions.spec.ts` verifies Surge selection, preview descriptions, persistence and the unavailable-DPS message.

`src/app/skills/skill-versions.spec.ts` checks every article's classes and attack levels, independent formula examples, legacy isolation, preview identities, support bonuses, shared-build restoration, real damage and autocast resolution. `e2e/skill-versions.spec.ts` checks synchronization across all three panels, reload persistence and a saved preview buff through the UI.
