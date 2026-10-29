#!/usr/bin/env node
// Post the current version's "novidades" (changelog) to Discord after a deploy.
//
// Standard message = project name + version number + the newly-added items for
// that version, as a single embed. Source of truth is src/releases/history.json, also used by the app;
// the version is read from package.json.
//
// Usage:
//   DISCORD_BOT_TOKEN=xxx node tools/post-novidades.mjs            # posts
//   node tools/post-novidades.mjs --dry-run                        # prints payload, no network
//
// Env:
//   DISCORD_BOT_TOKEN   (required to post) — a bot token; keep it in a GitHub
//                       Actions secret, never in the repo.
//   DISCORD_CHANNEL_ID  (optional) — defaults to the #novidades channel below.
//
// Exit codes: 0 = posted / dry-run. 1 = missing configuration, missing notes,
// or a rejected Discord request; the release remains pending for retry.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PROJECT_NAME = 'Simulador RO LATAM';
const SITE_URL = 'https://simulador.latam-tools.com.br';
const DEFAULT_CHANNEL_ID = '1524025278471471295';
const EMBED_COLOR = 0xf59e0b; // amber, matches the app's beta theme
const DISCORD_DESC_LIMIT = 4096;

const dryRun = process.argv.includes('--dry-run');

function readVersion() {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function readChangelogEntry(version) {
  const history = JSON.parse(readFileSync(resolve(ROOT, 'src/releases/history.json'), 'utf8'));
  const entry = history.find(entry => entry.v === version);
  return entry ? { version, date: entry.date, logs: entry.logs, logs_es: entry.logs_es, logs_en: entry.logs_en } : null;
}

// One embed per language, in the order the app lists them. A release published
// before the notes became trilingual carries only pt-BR and posts a single embed,
// so old announcements and reposts look exactly as they did.
const LANGUAGES = [
  { key: 'logs', label: null, published: 'Publicado em' },
  { key: 'logs_es', label: 'Español', published: 'Publicado el' },
  { key: 'logs_en', label: 'English', published: 'Published on' },
];

function buildEmbed({ version, date, logs, label, published }) {
  let description = logs.map((l) => `• ${l}`).join('\n\n');
  if (description.length > DISCORD_DESC_LIMIT) {
    description = description.slice(0, DISCORD_DESC_LIMIT - 1) + '…';
  }
  const host = SITE_URL.replace('https://', '');
  return {
    title: label ? `${PROJECT_NAME} — v${version} (${label})` : `${PROJECT_NAME} — v${version}`,
    url: SITE_URL,
    description,
    color: EMBED_COLOR,
    footer: { text: date ? `${published} ${date} • ${host}` : host },
    timestamp: new Date().toISOString(),
  };
}

function buildEmbeds(entry) {
  return LANGUAGES
    .filter(language => Array.isArray(entry[language.key]) && entry[language.key].length)
    .map(language => buildEmbed({ ...entry, logs: entry[language.key], label: language.label, published: language.published }));
}

async function main() {
  const version = process.env.RELEASE_VERSION || readVersion();
  const entry = readChangelogEntry(version);
  if (!entry || entry.logs.length === 0) {
    console.warn(`No changelog entry with logs for v${version} in src/releases/history.json — nothing to post.`);
    throw new Error(`Missing release notes for ${version}`);
  }

  const payload = { embeds: buildEmbeds(entry), nonce: version, enforce_nonce: true };

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN not set — announcement remains pending.');
  }
  const channelId = process.env.DISCORD_CHANNEL_ID || DEFAULT_CHANNEL_ID;

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`Discord API ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log(`Posted novidades for v${version} to channel ${channelId}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
