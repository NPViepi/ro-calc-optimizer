import { MVP_IDS } from './mvp';

const Mapper = {
  iz_ac01: 'Test damage',
  abbey01: '110 - 125 abbey01',
  abbey02: '110 - 125 abbey02',
  abbey03: '110 - 125 abbey03',
  nameless_n: '110 - 125 nameless_n',
  abyss_01: '115 - 125 abyss_01',
  abyss_02: '115 - 125 abyss_02',
  abyss_03: '115 - 125 abyss_03',
  lhz_dun02: '120 - 135 lhz_dun02',
  lasa_dun02: '125 - 133 lasa_dun02',
  lasa_dun03: '133 - 150 lasa_dun03',
  lhz_dun04: '140 - 150 lhz_dun04',
  tur_d03_i: '150 - 160 tur_d03_i',
  tur_d04_i: '150 - 170 tur_d04_i',
  ein_d02_i: '150 - 165 ein_d02_i',
  com_d02_i: '160 - 170 com_d02_i',
  ant_d02_i: '160 - 170 ant_d02_i',
  sp_rudus2: '153 - 165 sp_rudus2',
  sp_rudus3: '163 - 178 sp_rudus3',
  prt_mz03_i: '170 - 175 prt_mz03_i',
  oz_dun01: '170 - 185 oz_dun01',
  oz_dun02: '170 - 185 oz_dun02',
  ra_fild10: '170 - 185 ra_fild10',
  ra_fild11: '170 - 185 ra_fild11',
  mag_dun03: '175 - 185 mag_dun03',
  ein_dun03: '180 - 190 ein_dun03',
  odin_past: '187 - 200 odin_past',
  abyss_04: '192 - 200 abyss_04',
  iz_d04_i: '140 - 150 iz_d04_i',
  iz_d05_i: '180 - 200 iz_d05_i',
  tha_t09: '190 - 215 tha_t09',
  tha_t10: '190 - 215 tha_t10',
  tha_t11: '190 - 215 tha_t11',
  tha_t12: '190 - 215 tha_t12',
  sp_rudus4: '200 - 215 sp_rudus4',
  jor_tail: 'EP 19',
  jor_back1: 'EP 19',
  jor_back2: 'EP 19',
  jor_back3: 'EP 19',
  jor_back4: 'EP 19',
  jor_back5: 'EP 19',
  jor_back6: 'EP 19',
  jor_dun01: 'EP 19',
  jor_dun02: 'EP 19',
  jor_ab01: 'EP 19',
  jor_ab02: 'EP 19',
  amicitia1: '215 - 230 amicitia1',
  amicitia2: '230 - 250 amicitia2',
  nif_dun01: '200 - 230 nif_dun01',
  nif_dun02: '240 - 250 nif_dun02',
  clock_01: '240 - 250 clock_01',
  bl_ice: '240 - 250 bl_ice',
  bl_grass: '240 - 250 bl_grass',
  bl_lava: '240 - 250 bl_lava',
  bl_death: '240 - 250 bl_death',
  gl_cas01_: 'gl_cas01_',
  '1@gl_k': 'Glastheim Antiga',
  '1@gl_kh': 'Glastheim Infernal',
  '1@slw': 'Laboratório Werner',
  '1@advs': 'Villa of Deception',
  '1@mjo2': 'Queda do Aeroplano',
  // The tower's floors and its two boss rooms are three map codes for one
  // instance, so they share a label — MonsterGroupNames dedupes the values.
  '1@ch_t': 'Torre da Constelação',
  '2@ch_t': 'Torre da Constelação',
  '3@ch_t': 'Torre da Constelação',
  // Arena Noturna's real map code is not published: its monsters carry no
  // map-specific drops on divine-pride, which is where the codes above come
  // from. A pseudo-code keys the group instead, as MD_BETELGEUSE already does.
  MD_N_ARENA: 'Arena Noturna',
  // Aquila (21531) and Simulation Juncea (21533) are EP19 memorial-dungeon bosses;
  // Lasgand (21981) and Fallen Angel Slug (21982) are EP20 ones. Divine-pride records
  // no spawn for any of the four and no instance map code is published for them, so a
  // pseudo-code keys the group, as MD_N_ARENA and MD_BETELGEUSE already do. The label
  // is the episode their dbname names — not a guess at the instance's pt-BR title. The
  // EP 19 pair joins the jor_* group above; Snowstorm Angel (21996) needs neither, it
  // spawns on the real jor_back4.
  MD_EP19: 'EP 19',
  MD_EP20: 'EP 20',
  hero_tra: 'Test damage',
  tra_fild: 'Test damage',
  prontera: 'Test damage',
  lhz_dun03: 'lhz_dun03',
  lhz_dun_n: 'lhz_dun_n',
  ba_pw03: 'ba_pw03',
  ba_lost: '150 - 160 ba_lost',
  // Dedicated group for the browiki MVP list. Membership is driven by MVP_IDS
  // (see constants/mvp.ts) in setMonsterDropdownList, not by a real spawn code;
  // this entry just registers the "MVPs" label so it shows up in the group filter.
  MVP: 'MVPs',
} as const;

export const MonsterGroupNames = [...new Set(Object.values(Mapper))].sort((a, b) => (a > b ? 1 : -1));

export const getMonsterSpawnMap = (spawn: string) => {
  const spawns = spawn.split(',').map((a) => Mapper[a]);

  return [...new Set(spawns)].join(', ');
};

/** The fields of a monster record that decide which picker group it lands in. */
export interface MonsterGrouping {
  id: number;
  spawn: string;
  /** `stats.mvp` — 1 for the MVP subset. */
  mvp: number;
  /** `stats.class` — 1 for anything on the boss protocol, MVPs and minibosses alike. */
  class: number;
}

/**
 * Which group of the target picker a monster belongs to.
 *
 * The order matters. An id on the browiki MVP list goes to the shared "MVPs" group
 * whatever its spawn is — that list is the reason the group exists. Everything else is
 * placed by its map, so that an instance's own MVP sits with the rest of the instance
 * rather than in the catch-all "Boss" bucket: someone opening Torre da Constelação is
 * looking for Naght Sieger at least as much as for the mobs of its floors. "Boss" is
 * only the fallback for a boss whose map has no label, and "Etc" for anything else.
 */
export const getMonsterGroupName = ({ id, spawn, mvp, class: monsterClass }: MonsterGrouping): string => {
  if (MVP_IDS.has(id)) return 'MVPs';

  const isBoss = mvp === 1 || monsterClass === 1;

  return getMonsterSpawnMap(spawn) || (isBoss ? ' Boss' : 'Etc');
};
