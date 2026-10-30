# Pending novidades

Add one uniquely named JSON file per independent change or batch:

```json
{
  "type": "patch",
  "logs": ["Corrigido o comportamento ... Reportado por Fulano."],
  "logs_es": ["Corregido el comportamiento ... Reportado por Fulano."],
  "logs_en": ["Fixed the behaviour ... Reported by Fulano."]
}
```

The notes are published in three languages and the app shows them in the one the
reader chose. `logs` is PT-BR and is the source: write it first and translate from
it. `logs_es` and `logs_en` are required, with one line each, in the same order —
`node tools/release-notes.mjs` refuses a fragment that is missing a language or whose
translations do not line up.

Use user-facing wording, impersonal voice, and reporter credits. Keep in-game proper
nouns in the form the client uses for that language; where the localized name is not
known, keep the PT-BR name rather than inventing one.

Do not choose a version, change `package.json`, or edit `src/releases/history.json`.
Internal changes may omit a fragment. See [release workflow](../docs/releases.md).
