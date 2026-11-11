# Changelog

All notable changes to `@staqon.one/cli` are documented here. Versions follow `MAJOR.MINOR.PATCH`; this package is pre-1.0, so a MINOR bump can still include a breaking change  -  read this file when you upgrade.

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
