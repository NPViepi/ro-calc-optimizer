import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareRelease, readFragments } from './release-notes.mjs';

describe('release fragments', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), 'release-notes-'));
    mkdirSync(resolve(root, 'release-notes'));
    mkdirSync(resolve(root, 'src/releases'), { recursive: true });
    writeFileSync(resolve(root, 'package.json'), JSON.stringify({ version: '0.1.165-beta' }));
    writeFileSync(resolve(root, 'src/releases/history.json'), JSON.stringify([
      { v: '0.1.165-beta', date: '06-10-2026', logs: ['Earlier release'] },
    ]));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  // A fragment ships the three languages; `translated` mirrors each pt-BR line so a
  // test that does not care about the wording still writes a valid fragment.
  const translated = (logs: unknown[], suffix: string) => logs.map(log => `${log} (${suffix})`);
  const fragment = (name: string, logs: unknown[], overrides: Record<string, unknown> = {}) =>
    writeFileSync(resolve(root, 'release-notes', name), JSON.stringify({
      type: 'patch', logs, logs_es: translated(logs, 'es'), logs_en: translated(logs, 'en'), ...overrides,
    }));

  it('batches parallel changes, preserves history, and does not bump again on retry', () => {
    fragment('b.json', ['Second change']);
    fragment('a.json', ['First change']);
    expect(prepareRelease(root, new Date('2026-10-09T01:00:00Z'))).toBe('0.1.166-beta');
    const history = JSON.parse(readFileSync(resolve(root, 'src/releases/history.json'), 'utf8'));
    expect(history[0]).toEqual({ v: '0.1.166-beta', date: '08-10-2026',
      logs: ['First change', 'Second change'],
      logs_es: ['First change (es)', 'Second change (es)'],
      logs_en: ['First change (en)', 'Second change (en)'] });
    expect(history[1].v).toBe('0.1.165-beta');
    expect(readdirSync(resolve(root, 'release-notes'))).toEqual([]);
    expect(prepareRelease(root)).toBeNull();
    fragment('c.json', ['Later change']);
    expect(prepareRelease(root)).toBe('0.1.167-beta');
  });

  it('rejects malformed notes before modifying version or consuming any fragments', () => {
    fragment('a.json', ['Valid']);
    fragment('b.json', [' ']);
    expect(() => prepareRelease(root)).toThrow('Invalid release fragment');
    expect(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version).toBe('0.1.165-beta');
    expect(readdirSync(resolve(root, 'release-notes'))).toHaveLength(2);
  });

  it('refuses a fragment that does not ship all three languages', () => {
    fragment('a.json', ['Change'], { logs_es: undefined });
    expect(() => readFragments(root)).toThrow('Expected nonempty logs_es');
    fragment('a.json', ['Change'], { logs_en: [] });
    expect(() => readFragments(root)).toThrow('Expected nonempty logs_en');
  });

  it('refuses a translation that does not cover every line', () => {
    fragment('a.json', ['One', 'Two'], { logs_es: ['Uno'] });
    expect(() => readFragments(root)).toThrow('one line per logs entry');
  });

  it('keeps releases published before the notes became trilingual readable', () => {
    // History written by an older release has no logs_es/logs_en; nothing may
    // rewrite or reject it, and a new release is simply added on top.
    fragment('a.json', ['Change']);
    expect(prepareRelease(root, new Date('2026-10-09T01:00:00Z'))).toBe('0.1.166-beta');
    const history = JSON.parse(readFileSync(resolve(root, 'src/releases/history.json'), 'utf8'));
    expect(history[1]).toEqual({ v: '0.1.165-beta', date: '06-10-2026', logs: ['Earlier release'] });
  });

  it('validates read-only and refuses inconsistent release history', () => {
    fragment('a.json', ['Change']);
    expect(readFragments(root)).toHaveLength(1);
    writeFileSync(resolve(root, 'package.json'), JSON.stringify({ version: '0.1.164-beta' }));
    expect(() => prepareRelease(root)).toThrow('disagree');
    expect(readdirSync(resolve(root, 'release-notes'))).toHaveLength(1);
  });
});
