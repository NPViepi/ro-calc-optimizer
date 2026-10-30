import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The languages a fragment ships. `logs` is pt-BR, the source the notes are written
 * in; `logs_es` and `logs_en` are its translations, line for line. The suffixes match
 * the ragassets tables (`items_es`, `items_en`) the app already reads.
 */
export const TRANSLATED_LOGS = ['logs_es', 'logs_en'];

function isLogList(value) {
  return Array.isArray(value) && value.length && value.every(log => typeof log === 'string' && log.trim());
}

export function readFragments(root) {
  const directory = resolve(root, 'release-notes');
  return readdirSync(directory).filter(name => name.endsWith('.json')).sort().map(name => {
    const path = resolve(directory, name);
    const fragment = JSON.parse(readFileSync(path, 'utf8'));
    if (fragment.type !== 'patch' || !isLogList(fragment.logs)) {
      throw new Error(`Invalid release fragment: ${name}. Expected type patch and nonempty logs.`);
    }
    // Every new fragment ships all three languages. Historical entries predate this
    // and are allowed to be pt-BR only, but nothing new may be: a note that reaches
    // the bell untranslated would read as Portuguese leaking into a Spanish app.
    for (const key of TRANSLATED_LOGS) {
      if (!isLogList(fragment[key])) {
        throw new Error(`Invalid release fragment: ${name}. Expected nonempty ${key} beside logs.`);
      }
      if (fragment[key].length !== fragment.logs.length) {
        throw new Error(`Invalid release fragment: ${name}. ${key} must have one line per logs entry.`);
      }
    }
    return { path, logs: fragment.logs, ...Object.fromEntries(TRANSLATED_LOGS.map(key => [key, fragment[key]])) };
  });
}

export function prepareRelease(root, now = new Date()) {
  const fragments = readFragments(root);
  if (!fragments.length) return null;
  const packagePath = resolve(root, 'package.json');
  const historyPath = resolve(root, 'src/releases/history.json');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  const history = JSON.parse(readFileSync(historyPath, 'utf8'));
  if (history[0]?.v !== pkg.version) throw new Error('Package version and release history disagree');
  const match = /^(\d+)\.(\d+)\.(\d+)(-beta)?$/.exec(pkg.version);
  if (!match) throw new Error(`Unsupported version: ${pkg.version}`);
  pkg.version = `${match[1]}.${match[2]}.${Number(match[3]) + 1}${match[4] ?? ''}`;
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric' }).format(now).replaceAll('/', '-');
  history.unshift({ v: pkg.version, date, logs: fragments.flatMap(fragment => fragment.logs),
    ...Object.fromEntries(TRANSLATED_LOGS.map(key => [key, fragments.flatMap(fragment => fragment[key])])) });
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');
  for (const fragment of fragments) unlinkSync(fragment.path);
  return pkg.version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  readFragments(root);
  console.log('Release fragments valid');
}
