# Contributing to @staqon.one/cli

Thanks for your interest in improving the StaqOn CLI.

## Development setup

```bash
git clone https://github.com/aroraashish292-creator/staqon-cli.git
cd staqon-cli
npm install
npm run dev -- --help   # runs the CLI from source via tsx, no build needed
```

To test against a real workspace, run `npm run dev -- login` and complete the
device-pairing flow in your browser.

## Building

```bash
npm run build   # compiles TypeScript to dist/
node dist/index.js --help
```

## Project layout

- `src/commands/` — one file per command group (`auth`, `members`, `messaging`,
  `ad`, `verify`, `webhook`, `link`, `misc`)
- `src/api/` — the typed HTTP client and response shapes for StaqOn's API
- `src/auth.ts` — the device-pairing login/refresh/logout flow
- `src/config.ts` — local session storage (`~/.staqon/credentials.json`)
- `src/output.ts` — shared console/JSON output formatting

## Before opening a pull request

- Run `npm run build` and fix any TypeScript errors.
- Keep commands consistent with the existing style: human-readable output by
  default, `--json` for machine-readable output, and a `--dry-run` flag on any
  command that mutates state.
- Never commit real credentials, tokens, or a populated `~/.staqon/` file.
- Update `README.md` and `CHANGELOG.md` for any user-facing change.

## Reporting bugs or requesting features

Open a GitHub issue using the provided templates. For security issues, see
[SECURITY.md](SECURITY.md) instead — please don't file those as public issues.
