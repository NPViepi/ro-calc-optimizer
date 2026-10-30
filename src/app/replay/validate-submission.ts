import { decodeReplay, Replay } from 'rrfparser';
import { ClassIdBySpriteJob, getClassDropdownList } from '../jobs';
import { BUFF_EFST } from './replay-buffs';
import { ReplayTraits } from './replay-traits';
import { replayToModel } from './replay-to-model';
import { TextRef } from '../i18n';

/**
 * Decides whether a community `.rrf` recording is worth sending us, before it
 * leaves the browser. Framework-free so it can be unit-tested against the
 * fixtures in `__tests__/fixtures/`.
 *
 * The bar is what the `review-rrf-class` skill actually needs: a class the
 * calculator models, and the skill tree (which the in-game recorder only writes
 * when the "Skill" box is ticked in its Opções panel).
 */

/** A Firestore document caps at 1 MiB; leave headroom for the metadata. */
export const MAX_REPLAY_BYTES = 900 * 1024;

/**
 * The training field. This is the only map a submission is accepted from in the current
 * pass, because it is the only place the comparison is clean: the dummies stand still,
 * have 0 DEF and 0 RES, and do not fight back.
 *
 * Instances prefix the map with `N@`, so the party number is stripped before comparing.
 */
export const TRAINING_MAP = 'tra_fild';

/** Mob ids of the training dummies — a contiguous block, Small through Undead Lv1. */
export const DUMMY_ID_RANGE = { first: 21064, last: 21086 } as const;

export const isTrainingDummy = (mobId: number): boolean =>
  mobId >= DUMMY_ID_RANGE.first && mobId <= DUMMY_ID_RANGE.last;

/** `0eo1@advs` and `1@advs` are the same map; the prefix is the instance's party id. */
export const normalizeMap = (map: string): string => (map || '').replace(/^[^@]*@/, '');

export { ReplayTraits };

/**
 * What the parser read out of the recording. Shown to the sender for a sanity
 * check, and denormalized into the Firestore document so triage can list
 * submissions without downloading the blobs.
 */
export interface ReplaySubmissionSummary {
  player: string;
  className: string;
  /** Calculator class id (already translated from the sprite job id). */
  classId: number;
  spriteJob: number;
  baseLevel: number;
  jobLevel: number;
  map: string;
  durationMs: number;
  damageEvents: number;
  learnedSkillCount: number;
  equippedCount: number;
  equipChangeCount: number;
  packetCount: number;
  /** Damage packets landed on a training dummy — what the conference actually reads. */
  dummyHits: number;
  /** Item ids outside the LATAM item DB, so they can be triaged with add-ro-item. */
  skippedItems: number[];
}

export type SubmissionBlockerCode =
  | 'too-big'
  | 'unreadable'
  | 'unknown-class'
  | 'no-skill-tree'
  | 'wrong-map'
  | 'no-dummy-damage';

export type SubmissionWarningCode = 'many-unknown-items' | 'no-equip-change' | 'external-buffs';

/**
 * Deliberately one flat shape rather than a discriminated union: this project
 * compiles with `strict: false`, where TypeScript does not narrow a union by its
 * discriminant, so a union would only force casts at every use.
 * `blocker`/`text` carry the rejection; the rest is only meaningful when `ok`.
 */
export interface SubmissionCheck {
  ok: boolean;
  blocker: SubmissionBlockerCode | null;
  /**
   * Why it was refused, as a catalog key: the validator runs in the browser and in the
   * MCP tools, long before a locale is chosen, so whoever shows the rejection resolves
   * it. Null when the recording was accepted.
   */
  text: TextRef | null;
  summary: ReplaySubmissionSummary | null;
  /**
   * The six traits read straight out of the recording, or null when it did not
   * carry them (most recordings don't — see `readReplayTraits`).
   */
  traits: ReplayTraits | null;
  /**
   * True when the class has trait stats *and* the recording did not carry them,
   * so the sender has to type them in. False once `traits` is filled: asking for
   * numbers we already have is how they get typed in wrong.
   */
  needsTraits: boolean;
  warnings: SubmissionWarningCode[];
}

function reject(blocker: SubmissionBlockerCode, text: TextRef): SubmissionCheck {
  return { ok: false, blocker, text, summary: null, traits: null, needsTraits: false, warnings: [] };
}

export function validateReplaySubmission(buf: ArrayBuffer, itemMap: Record<number, any>): SubmissionCheck {
  if (buf.byteLength > MAX_REPLAY_BYTES) {
    return reject('too-big', {
      key: 'hi.rejectTooBig',
      params: { size: formatKb(buf.byteLength), limit: formatKb(MAX_REPLAY_BYTES) },
    });
  }

  let replay: Replay;
  try {
    replay = decodeReplay(buf);
  } catch (e) {
    // Unlike the build importer, show the parser's own message — an unsupported version
    // and a truncated file call for different fixes.
    return reject('unreadable', { key: 'hi.rejectUnreadable', params: { reason: (e as Error).message } });
  }

  return checkReplay(replay, itemMap);
}

/** The decision itself, on an already-parsed replay. Split out so it can be
 *  exercised against hand-built replays as well as real recordings. */
export function checkReplay(replay: Replay, itemMap: Record<number, any>): SubmissionCheck {
  const session = replay.sessionInfo;
  const classId = ClassIdBySpriteJob[session.job] ?? session.job;
  const klass = getClassDropdownList().find((c) => c.value === classId);
  if (!klass) {
    // A separate entry rather than a placeholder word: a `{player}` filled with
    // "personagem" would have to be translated inside a parameter, which the catalog
    // cannot reach.
    return reject('unknown-class', session.player
      ? { key: 'hi.rejectUnknownClass', params: { player: session.player, job: session.job } }
      : { key: 'hi.rejectUnknownClassUnnamed', params: { job: session.job } });
  }

  if (replay.learnedSkills.size === 0) {
    return reject('no-skill-tree', { key: 'hi.rejectNoSkillTree' });
  }

  // The two rules that make this pass worth running at all. A recording taken anywhere
  // else, or against anything that fights back, cannot separate a wrong item from a wrong
  // formula: the target's own DEF/RES and the damage it deals back are unknowns we would
  // be solving for at the same time as the thing being measured.
  if (normalizeMap(session.map) !== TRAINING_MAP) {
    return reject('wrong-map', session.map
      ? { key: 'hi.rejectWrongMap', params: { map: session.map, training: TRAINING_MAP } }
      : { key: 'hi.rejectWrongMapUnknown', params: { training: TRAINING_MAP } });
  }

  const dummyHits = countDummyHits(replay);
  if (dummyHits === 0) {
    return reject('no-dummy-damage', { key: 'hi.rejectNoDummyDamage' });
  }

  const { summary: importSummary } = replayToModel(replay, itemMap);
  const hasTraits = klass['instant'].isAllowTraitStat();

  const warnings: SubmissionWarningCode[] = [];
  if (replay.equipChanges.length === 0) warnings.push('no-equip-change');
  if (hasExternalBuffs(replay)) warnings.push('external-buffs');
  // A recording from another server lights this up: its gear simply isn't in
  // the LATAM item DB. Not a hard block — a LATAM player can be wearing one
  // piece we haven't catalogued yet.
  if (importSummary.skippedItems.length >= 5) warnings.push('many-unknown-items');

  return {
    ok: true,
    blocker: null,
    text: null,
    // A class with no trait table has nothing to report either way: the server
    // does send it six zeros, but recording them would read in triage as an
    // allocation rather than as "this class has no traits".
    traits: hasTraits ? importSummary.traits : null,
    needsTraits: hasTraits && !importSummary.traits,
    warnings,
    summary: {
      player: session.player || '',
      className: klass.label,
      classId,
      spriteJob: session.job,
      baseLevel: session.baseLevel,
      jobLevel: session.jobLevel,
      map: session.map || '',
      durationMs: Math.round(session.durationMs),
      damageEvents: replay.damage.length,
      learnedSkillCount: importSummary.learnedSkillCount,
      equippedCount: importSummary.equippedCount,
      equipChangeCount: replay.equipChanges.length,
      packetCount: replay.totals.packetCount,
      dummyHits,
      skippedItems: importSummary.skippedItems.map((s) => s.itemId),
    },
  };
}

/**
 * Damage packets the recording player landed on a training dummy.
 *
 * The target is an entity id, so the mob id comes from the entity snapshot; a packet
 * whose target was never seen spawning cannot be attributed and is not counted.
 */
export function countDummyHits(replay: Replay): number {
  const aid = replay.sessionInfo?.aid;
  let n = 0;
  for (const d of replay.damage ?? []) {
    if (aid !== undefined && d.source !== aid) continue;
    const view = replay.entities?.get(d.target)?.view;
    if (view !== undefined && isTrainingDummy(view)) n++;
  }
  return n;
}

/**
 * Whether someone else's buffs were running on the player. Not a blocker — a Bênção left
 * over from town is not worth throwing a recording away for — but it is the single
 * biggest source of noise, so the sender is told before sending.
 */
export function hasExternalBuffs(replay: Replay): boolean {
  const aid = replay.sessionInfo?.aid;
  for (const s of replay.statusEvents ?? []) {
    if (aid !== undefined && s.aid !== aid) continue;
    if (s.isOn && BUFF_EFST[s.statusId]) return true;
  }
  return false;
}

function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}
