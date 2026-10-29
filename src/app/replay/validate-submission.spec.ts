import { Replay } from 'rrfparser';
import { describe, expect, it } from 'vitest';
import itemJson from '../../assets/demo/data/item.json';
import { loadReplayFixture } from './__tests__/load-fixture';
import {
  DUMMY_ID_RANGE,
  MAX_REPLAY_BYTES,
  TRAINING_MAP,
  checkReplay,
  isTrainingDummy,
  normalizeMap,
  validateReplaySubmission,
} from './validate-submission';

const items = itemJson as unknown as Record<number, any>;

const ME = 100;
const DUMMY_AID = 200;
const MOB_AID = 300;

/** Entity snapshot with one training dummy and one ordinary monster on screen. */
const entities = () =>
  new Map<number, any>([
    [DUMMY_AID, { aid: DUMMY_AID, kind: 'mob', view: 21065 }],
    [MOB_AID, { aid: MOB_AID, kind: 'mob', view: 1002 }],
  ]);

const hit = (target: number) => ({ source: ME, target, skillId: 0, damage: 100, hits: 1 });

/**
 * A parsed replay with only the fields the check reads. The default is an *acceptable*
 * submission — training field, hitting a dummy — so each test only has to break the one
 * rule it is about.
 */
const makeReplay = (over: Partial<Replay> = {}): Replay =>
  ({
    sessionInfo: { player: 'Tester', map: 'tra_fild', aid: ME, job: 4307, baseLevel: 240, jobLevel: 50, durationMs: 60_000 },
    learnedSkills: new Map<number, number>([[1, 5]]),
    initialInventory: new Map(),
    entities: entities(),
    damage: [hit(DUMMY_AID)],
    statusEvents: [],
    equipChanges: [],
    totals: { packetCount: 10, handledPackets: 10, knownPacketIds: [] },
    ...over,
  } as unknown as Replay);

describe('validateReplaySubmission', () => {
  it('accepts a real recording and reports what it read', () => {
    const result = validateReplaySubmission(loadReplayFixture('hn-magic-lv1.rrf'), items);

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({
      spriteJob: 4307,
      baseLevel: 240,
      learnedSkillCount: 51,
      damageEvents: 203,
      equipChangeCount: 60,
    });
    // 4307 is a 4th job, so the sender has to type the traits in by hand.
    expect(result.needsTraits).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  /**
   * `sn-buffs-potion.rrf` is a town recording with no damage at all — exactly what this
   * pass stopped accepting. It used to come through with warnings.
   */
  it('rejects a real recording taken in town', () => {
    const result = validateReplaySubmission(loadReplayFixture('sn-buffs-potion.rrf'), items);

    expect(result).toMatchObject({ ok: false, blocker: 'wrong-map' });
    expect(result.text?.key).toBe('hi.rejectWrongMap');
    expect(result.text?.params?.['map']).toContain('wolfvill');
  });

  /** Every other fixture is already a training-field recording — the rule is what the
   *  usable recordings have always looked like, now written down. */
  it.each([
    ['hn-magic-lv1.rrf', 104],
    ['nw-ult.rrf', 55],
    ['wh-ilimitar.rrf', 26],
  ])('%s is accepted and counts its dummy hits (%i)', (fixture, dummyHits) => {
    const result = validateReplaySubmission(loadReplayFixture(fixture), items);

    expect(result.ok).toBe(true);
    expect(result.summary?.dummyHits).toBe(dummyHits);
  });

  it('rejects a file bigger than a Firestore document can hold', () => {
    const result = validateReplaySubmission(new ArrayBuffer(MAX_REPLAY_BYTES + 1), items);

    expect(result).toMatchObject({ ok: false, blocker: 'too-big' });
  });

  it('rejects something that is not a replay', () => {
    const result = validateReplaySubmission(new TextEncoder().encode('not a replay at all').buffer, items);

    expect(result).toMatchObject({ ok: false, blocker: 'unreadable' });
  });
});

describe('checkReplay', () => {
  it('rejects a recording whose skill tree was left out of the file', () => {
    // What you get when the recorder's "Skill" option is unticked.
    const result = checkReplay(makeReplay({ learnedSkills: new Map() }), items);

    expect(result).toMatchObject({ ok: false, blocker: 'no-skill-tree' });
    expect(result.text?.key).toBe('hi.rejectNoSkillTree');
  });

  it('rejects a class the calculator does not model', () => {
    const replay = makeReplay({ sessionInfo: { ...makeReplay().sessionInfo, job: 4001 } as any });

    expect(checkReplay(replay, items)).toMatchObject({ ok: false, blocker: 'unknown-class' });
  });

  it('does not ask for traits on a class that has none', () => {
    // 4190 = Sentinela Trans (3rd job): TraitBonusTable is empty for it.
    const replay = makeReplay({ sessionInfo: { ...makeReplay().sessionInfo, job: 4190 } as any });
    const result = checkReplay(replay, items);

    expect(result.ok).toBe(true);
    expect(result.needsTraits).toBe(false);
    expect(result.traits).toBeNull();
  });
});

/**
 * The form only ever asks for what the file could not say. A recording that changed
 * map carries the six traits, and asking for them again is how a right number gets
 * retyped as a wrong one.
 */
describe('checkReplay — traits', () => {
  const allSix = { pow: 100, sta: 0, wis: 0, spl: 0, con: 59, crt: 0 };

  it('takes the traits off the recording and stops asking for them', () => {
    const result = checkReplay(makeReplay({ traits: allSix } as any), items);

    expect(result.ok).toBe(true);
    expect(result.traits).toEqual(allSix);
    expect(result.needsTraits).toBe(false);
  });

  it('still asks when the recording carried only some of them', () => {
    const result = checkReplay(makeReplay({ traits: { spl: 100 } } as any), items);

    expect(result.traits).toBeNull();
    expect(result.needsTraits).toBe(true);
  });

  it('still asks when the recording carried none', () => {
    const result = checkReplay(makeReplay(), items);

    expect(result.traits).toBeNull();
    expect(result.needsTraits).toBe(true);
  });

  /** The server sends a 3rd-job character six zeros. Recording them would read in
   *  triage as an allocation instead of "this class has no traits". */
  it('reports nothing for a class without traits, whatever the stream said', () => {
    const replay = makeReplay({ sessionInfo: { ...makeReplay().sessionInfo, job: 4190 } as any, traits: allSix } as any);
    const result = checkReplay(replay, items);

    expect(result.needsTraits).toBe(false);
    expect(result.traits).toBeNull();
  });
});

/**
 * The first pass only fixes wrong items and wrong formulas, and both need a target whose
 * numbers are known: the dummies have 0 DEF and 0 RES, stand still and do not hit back.
 * Anywhere else the target's own defence is an unknown being solved for at the same time
 * as the thing being measured, which is what made the first batch of community
 * recordings unusable.
 */
describe('checkReplay — training field only', () => {
  it('rejects a recording taken anywhere but the training field', () => {
    const replay = makeReplay({ sessionInfo: { ...makeReplay().sessionInfo, map: 'prontera' } as any });
    const result = checkReplay(replay, items);

    expect(result).toMatchObject({ ok: false, blocker: 'wrong-map' });
    expect(result.text).toEqual({ key: 'hi.rejectWrongMap', params: { map: 'prontera', training: TRAINING_MAP } });
  });

  it('accepts the training field behind an instance prefix', () => {
    const replay = makeReplay({ sessionInfo: { ...makeReplay().sessionInfo, map: `3@${TRAINING_MAP}` } as any });

    expect(checkReplay(replay, items).ok).toBe(true);
  });

  it('rejects a training-field recording that never hit a dummy', () => {
    // On the right map, but every packet landed on an ordinary monster.
    const replay = makeReplay({ damage: [hit(MOB_AID), hit(MOB_AID)] as any });
    const result = checkReplay(replay, items);

    expect(result).toMatchObject({ ok: false, blocker: 'no-dummy-damage' });
  });

  it('rejects a training-field recording with no damage at all', () => {
    expect(checkReplay(makeReplay({ damage: [] }), items)).toMatchObject({ ok: false, blocker: 'no-dummy-damage' });
  });

  it('does not count someone else hitting the dummy', () => {
    const replay = makeReplay({ damage: [{ ...hit(DUMMY_AID), source: 999 }] as any });

    expect(checkReplay(replay, items)).toMatchObject({ ok: false, blocker: 'no-dummy-damage' });
  });

  it('counts only the dummy hits, not every packet', () => {
    const replay = makeReplay({ damage: [hit(DUMMY_AID), hit(MOB_AID), hit(DUMMY_AID)] as any });
    const result = checkReplay(replay, items);

    expect(result.ok).toBe(true);
    expect(result.summary?.dummyHits).toBe(2);
    expect(result.summary?.damageEvents).toBe(3);
  });

  it('covers the whole dummy block and nothing either side of it', () => {
    expect(isTrainingDummy(DUMMY_ID_RANGE.first)).toBe(true);
    expect(isTrainingDummy(DUMMY_ID_RANGE.last)).toBe(true);
    expect(isTrainingDummy(DUMMY_ID_RANGE.first - 1)).toBe(false);
    expect(isTrainingDummy(DUMMY_ID_RANGE.last + 1)).toBe(false);
  });

  it('strips only the instance prefix from a map name', () => {
    expect(normalizeMap('tra_fild')).toBe('tra_fild');
    expect(normalizeMap('0eo1@advs')).toBe('advs');
    expect(normalizeMap('')).toBe('');
  });
});

/**
 * External buffs are noise, not grounds for rejection: they inflate every number without
 * saying which stage they moved, but a Bênção left over from town is not worth throwing a
 * recording away for. The sender is told before sending instead.
 */
describe('checkReplay — external buffs', () => {
  /** 10 = Bênção, one of the party buffs BUFF_EFST resolves. */
  const blessing = (aid: number) => ({ statusId: 10, aid, isOn: true, time: 0, totalMs: 0, leftMs: 0 });

  it('warns when a party buff was running on the player', () => {
    const result = checkReplay(makeReplay({ statusEvents: [blessing(ME)] as any }), items);

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('external-buffs');
  });

  it('ignores a buff running on somebody else', () => {
    const result = checkReplay(makeReplay({ statusEvents: [blessing(999)] as any }), items);

    expect(result.warnings).not.toContain('external-buffs');
  });

  it('stays quiet on a clean recording', () => {
    expect(checkReplay(makeReplay(), items).warnings).not.toContain('external-buffs');
  });
});
