# Security Policy

## Reporting a Vulnerability

If you believe you've found a security vulnerability in `@staqon.one/cli` or in the
StaqOn API it talks to, please report it privately rather than opening a public
GitHub issue.

- Email: **security@staqon.one**
- Please include: a description of the issue, steps to reproduce, the CLI
  version (`staqon --version`) and OS, and the potential impact.
- We aim to acknowledge reports within 3 business days.

Please do not publicly disclose a vulnerability until it has been addressed.

## Supported Versions

Only the latest published version of `@staqon.one/cli` on npm receives security
fixes. Please upgrade before reporting an issue to confirm it still reproduces.

| Version | Supported |
| ------- | --------- |
| 2.x     | ✅        |
| < 2.0   | ❌        |

## Design Notes Relevant to Security

- The CLI never asks for, stores, or transmits a raw StaqOn API key. Authentication
  is done through a device-pairing flow: you approve each computer once from your
  StaqOn dashboard, and the CLI holds only a short-lived, revocable session token
  (`stq_cli_...`) scoped to that device.
- The session token is written to `~/.staqon/credentials.json` with file mode
  `0600` (owner read/write only).
- All API calls go through StaqOn's own reverse proxy on your workspace's behalf —
  the CLI never talks to anything other than `https://staqon.one` (or the host set
  via `STAQON_BASE_URL`, which only exists for local/staging development).
- You can revoke a paired device at any time from your StaqOn dashboard, or locally
  with `staqon logout`.
