# Changelog

All notable changes to `@staqon.one/cli` are documented here. Versions follow `MAJOR.MINOR.PATCH`. From 1.0.0 onward, a MINOR release never breaks an existing command or flag  -  only a MAJOR (2.0.0+) release would.

## 2.0.2

- **CI/CD hardening**: added CodeQL security scanning, Dependabot dependency updates, an `npm audit` step in CI, and branch protection on `main` requiring CI + CodeQL to pass before merge. No CLI behavior change.
- Dependency bumps: `commander` 12→15, `open` 10→11, `@types/node` 20→26, and GitHub Actions `checkout`/`setup-node`/`codeql-action` to their latest majors.

## 2.0.1

- **Fixed a build-breaking bug**: `src/card.ts` was missing from the published source entirely, so `npm run build` failed on a fresh clone, and `messages comment`, `internal-message`, and `verify start` (all three depend on `--card`/`--card-file`) couldn't run. Restored, and the two call sites that had stopped `await`-ing it are fixed too.
- **Repo hygiene, no behavior change**: added `LICENSE`, `SECURITY.md` (responsible-disclosure process), `CONTRIBUTING.md`, GitHub issue/PR templates, and a CI workflow that builds on every push/PR. Added a `files` field to `package.json` so `npm publish` ships only `dist/` and the docs, not raw TypeScript source.

## 2.0.0

A major release, but **not a breaking one** for anyone already using 1.0.0 -- every command, flag, and exit code from 1.0.0 keeps working exactly as before. It's a MAJOR bump because this release adds a new way to call the proxy (direct REST, no CLI required) that changes how non-Node integrations are expected to talk to StaqOn, which is a big enough shift in surface area to mark with a major version rather than a MINOR.

- **`--dry-run`** on all five write-type commands: `messages send`, `messages comment`, `internal-message`, `verify start`, and `ad send`. Runs every real validation gate (member exists, team membership, consent/link check, card validation, rate limits, image/dedup checks for `ad send`) and reports what would happen, with no write and no notification/webhook fan-out. `verify start --dry-run` doesn't count against the 5-per-minute Verify rate limit, so you can check as often as you like before sending for real. See the README's [Dry runs](https://github.com/aroraashish292-creator/staqon-cli#dry-runs) section.
- **Typed TypeScript response shapes** for scripting and library use. `src/api/client.ts`'s `proxy()` is now generic (`proxy<T>()`, defaulting to the old untyped behavior, so nothing existing breaks), and `src/api/responses.ts` exports real interfaces -- each one transcribed from an actual live server response, not guessed -- for all five dry-run shapes plus `members list`, `members get`, `status` (both surfaces), `webhook status` (both purposes and surfaces), `escalation list`, and `link list` (including its conditional `pagination` field). The remaining real-send response shapes stay intentionally untyped for now rather than shipped with a guessed type; see the README's [Typed responses for scripting](https://github.com/aroraashish292-creator/staqon-cli#typed-responses-for-scripting) section for the exact list and what's still to come.
- **Calling the proxy directly, no Node required.** New README section documenting the underlying `POST|GET /api/v1/cli-proxy.php?_ep=<name>` endpoint this CLI has always been a thin wrapper around -- the full pairing flow in plain curl, the complete `_ep` name table, and how each one maps to this README's own per-command docs (same request/response shapes, nothing reformatted). Useful for PHP, Python, Go, or any non-Node integration that wants to skip this package entirely except for the one-time pairing step.
- **Expanded PHP/shared-hosting guidance.** The cron-worker pattern gained concrete handling for the failure modes a long-running PHP worker actually hits: honoring `Retry-After` on a 429 instead of hammering the endpoint every tick, treating a 401 as "stop and alert a human" rather than retrying forever, a `flock`-based lock against overlapping cron runs (plus a reminder to use `--external-ref` for true cross-machine dedup on write-type calls), and keeping a self-stored token outside the webroot at `0600` the same way this CLI protects its own.
- **README accuracy pass.** Several worked-example responses (`members list`, the `webhooks`/`status` top-level commands, `link list`, `escalation list`/`get`) had drifted from the real server responses since earlier rewrites; all five are now re-verified against this release's own live testing, and the Command → Swagger table's `link list` row is corrected from `POST` to `GET`.

No server-side or database changes in this release -- it's entirely CLI-side (new flags, new types, new docs).

## 1.0.0  -  first stable release

No behavior change from 0.1.8  -  this release marks the command surface (`members`, `messages`, `internal-message`, `verify`, `ad`, `escalation`, `link`, `status`, `webhooks`, every flag and exit code) as stable. From here, a breaking change to any of that would require a 2.0.0, not a MINOR bump.

Also rolls up everything shipped across the 0.1.x line into one stable baseline:

- Device-pairing login with self-renewing sessions (90-day sliding, 1-year absolute cap)
- Members, messaging, internal messaging, e-StaqOn Verify (including `--wait` long-polling and the `verify.resolved` webhook), the Advertisement API, escalation matters, and Link (invite/list)
- `--json` scripting support with 5 stable exit codes (`1`, `3`, `4`, `5`, `6`)
- Full documentation pass: a "Start here" walkthrough, a real example response for every command, and a Command &rarr; Swagger endpoint cross-reference table

## 0.1.8

- **`verify check --wait <seconds>` (new flag).** Long-polls the server instead of returning instantly: while the request is still pending, holds the connection open and re-checks every 500ms, returning as soon as it resolves or the window (0-25s, default 0) elapses. Cuts polling volume roughly 10x for anyone waiting on an approval. Forwards as `wait_seconds` in the request body (server-side support for this has been live since the last release). Tested end-to-end against a real pending request (timeout path returns `pending` after the full wait; an already-resolved request returns the real decision promptly).
- **New `verify.resolved` webhook.** Set a webhook URL on your messaging key (Workspace Settings → API → Messaging API → "Set webhook URL") and get a signed POST the instant a member approves or declines, instead of polling `check` at all. Dashboard-only to configure  -  no CLI change needed to use it. See the README's Verify section for the payload shape and signature details.

## 0.1.7

- **Docs only, no behavior change.** Added this changelog, a shared-hosting cron-worker example to the README, and clarified that `staqon webhooks` is read-only (webhooks are created/managed only from the StaqOn dashboard, and a disabled webhook can never be re-enabled  -  only replaced).
- Fixed: `staqon whoami` no longer errors on workspaces with a Link connection set up. (Server-side fix, deployed independently of this package version  -  see below.)

## 0.1.6

- Fixed a mangled `description` field in `package.json` (a pre-existing double-encoding artifact, unrelated to any CLI behavior).

## 0.1.5

- Added `staqon link invite` and `staqon link list`  -  invite a customer to connect with your workspace via StaqOn Link, and list who's already connected. Uses the same paired CLI session as every other command; your Link signing secret never leaves StaqOn's server.

## 0.1.3 and earlier

- Initial public releases: device-pairing login (`staqon login`/`whoami`/`logout`), External/Internal members, messaging, e-StaqOn Verify, the Advertisement API, escalation matters, `--json` scripting support with stable exit codes, and self-renewing sessions.
- No changelog was kept for these versions; if you're pinned below 0.1.5, `npm view @staqon.one/cli versions` lists what's available, and `npm install -g @staqon.one/cli@<version>` pins a specific one.

## Server-side fixes (not package versions)

Some fixes happen on StaqOn's server and need no CLI upgrade at all  -  they take effect the next time you run a command. Notable ones:

- **2026-11-11**  -  `staqon whoami` returned a `500` for any workspace with a Link connection configured (a bug introduced when Link commands were added in 0.1.5; `whoami`'s internal team-resolution check didn't account for Link having no team/key concept). Fixed server-side; no CLI upgrade needed, just run `staqon whoami` again.
