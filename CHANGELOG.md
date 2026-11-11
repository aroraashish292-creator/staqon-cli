# Changelog

All notable changes to `@staqon.one/cli` are documented here. Versions follow `MAJOR.MINOR.PATCH`; this package is pre-1.0, so a MINOR bump can still include a breaking change  -  read this file when you upgrade.

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
