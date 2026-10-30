# Releases and novidades

Feature PRs add uniquely named JSON fragments in `release-notes/`, rather than
editing shared version numbers or published history. Internal-only work does
not need notes. The supported release type is `patch`, retaining sequential
versions such as `0.1.165-beta` → `0.1.166-beta`.

## Languages

The notes are published in the three languages the interface ships. A fragment
carries `logs` (PT-BR, the source the notes are written in) plus `logs_es` and
`logs_en`, each with one line per `logs` entry, in the same order.
`tools/release-notes.mjs` enforces that on every fragment, so a note cannot reach
the app untranslated.

Releases published before the notes became trilingual have only `logs`, and
nothing rewrites them. `entryLogs` in `src/releases/entry-logs.ts` falls back to
PT-BR per entry, so the bell shows an old note in Portuguese rather than hiding
it, and `tools/post-novidades.mjs` posts one Discord embed per language present —
a single PT-BR embed for those older releases, exactly as before.

On a push to main, the deployment workflow checks out the latest main, combines
all pending fragments in filename order, increments the patch version, and
consumes the fragments. Dates use America/Sao_Paulo. The app bell and Discord
share `src/releases/history.json`; existing versions and local read markers
remain valid. PR previews show published history until their fragments release.

The coordinator installs dependencies, checks types and source, tests, and
builds before committing. It pushes the release commit and `v<version>` tag
atomically without force. If another merge wins the race, it starts again from
latest main and repeats validation and build, up to five attempts. Quick merges
may be batched into one release. Workflow concurrency serializes deployment;
every run collects all fragments, including those from superseded pending runs.

The same run deploys its built commit and then announces unannounced release
tags contained in that commit, oldest first. Successful announcements get an
`announced/v<version>` receipt tag. A Discord failure leaves the release pending
and does not fail the already completed deployment. Historical entries without
release tags are not announced. Discord's enforced nonce also suppresses recent
duplicate requests, but a crash between posting and pushing the receipt can
still produce a duplicate on a much later retry. This is not an exactly-once
delivery guarantee. The manual announcement workflow intentionally allows reposts.

If deployment or announcement fails, rerun the workflow or dispatch it manually.
With no new fragments it retains the allocated version. New fragments allocate
the next version; any pending older announcements are recovered after deployment.

## GitHub configuration

The workflow needs `contents: write`, and repository/ruleset policy must allow
GitHub Actions to push release commits to main and create release/receipt tags.
If main requires all changes through PRs with no permitted automation bypass,
configure a dedicated GitHub App with an allowed bypass and use its token for
checkout. Do not broadly disable branch protection. The default GITHUB_TOKEN
release push does not trigger another push workflow; deployment continues in
the original run. A custom App token can trigger another run, which finds no
new fragments and does not create another release.

Never run `tools/release-main.mjs` locally: it resets its checkout to origin/main
and is guarded for GitHub Actions. Local fragment validation is read-only:
`node tools/release-notes.mjs`.
