# @staqon.one/cli

A command-line tool for a StaqOn workspace owner — send messages, post ads, run e-StaqOn Verify approvals, manage External and Internal team members, and raise escalation matters, all from your terminal.

The CLI never holds, sees, or asks you to paste a raw API key. Instead it uses a device-pairing flow: you approve each computer once from your StaqOn dashboard, and after that every call goes through StaqOn's own proxy on your workspace's behalf. Full technical details for engineers who want them are at [`/developer`](https://staqon.one/developer) (the live, interactive Swagger spec) — this README covers the CLI's own commands.

## Install

```bash
npm install -g @staqon.one/cli
```

Requires Node 18+.

## Sign in

```bash
staqon login
```

This prints an 8-character code and a link (`https://staqon.one/cli?code=XXXX-XXXX`). Open the link (or go to `/cli` and type the code) while signed in to StaqOn as the workspace owner, pick which workspace to pair, and confirm. If your web session is more than 15 minutes old, you'll be asked for your MPIN first.

The code expires in 10 minutes. Once approved, the CLI stores a session token locally (`~/.staqon/credentials.json`, permissions `0600`) and you won't need to log in again until that session is revoked or expires.

**Sessions renew themselves on use — no re-login needed for unattended/cron use.** Every call slides `expires_at` forward to 90 days from that call, capped at an absolute 1 year from pairing. So a cron job or server process that calls the CLI at least once every 90 days stays signed in indefinitely, up to that 1-year cap — nothing to run, no owner approval needed, it's automatic. There is no separate "refresh" command because there's nothing to trigger: any real command (including `staqon whoami`) renews the session as a side effect. Watch `staqon whoami`'s `session.expires_at` and `session.absolute_expires_at` to know when you're approaching either limit — once the absolute cap is hit, only `staqon login` (with fresh owner approval) can continue.

**A prerequisite:** the workspace owner must turn on "Allow CLI access" in **Workspace Settings → API → CLI access** before `staqon login` can succeed. This is a separate, per-workspace switch — turning it off immediately signs out every paired computer.

```bash
staqon whoami     # confirm you're paired, see your rate-limit usage and which commands are available
staqon logout     # forget the session on THIS computer (does not revoke it server-side — use the dashboard for that)
```

## How calls are authorized

Every command goes through StaqOn's own CLI proxy, never a tenant's raw API key:

1. Your paired session's bearer token (`stq_cli_...`) authenticates the call.
2. StaqOn checks, on every single call, that your workspace's "Allow CLI access" switch is still on and that you're still that workspace's active owner.
3. StaqOn picks which of the workspace's own API keys to act as — automatically if there's exactly one eligible key for that command, or you'll be asked to disambiguate with `--team <id-or-slug>` if there are several active teams of the right type.
4. The underlying endpoint runs exactly as it would for a direct API call — same validation, same responses.

If a command returns `"error": "team_required"` with a list of teams, re-run it with `--team <id-or-slug>`.

## Rate limits

Two independent limits apply to every call:

- **This CLI session:** 30 requests/minute, 3,000/day — separate from, and in addition to, the workspace's own API key limits.
- **The workspace's underlying API key:** if that key is already at its own limit from *direct* API traffic, CLI calls pause too (CLI traffic itself never counts against or depletes the key's direct-API headroom — they're tracked separately).

A `429` response includes `Retry-After` in seconds either way.

## Commands

### Members (External team)

```bash
staqon members list [--page 1] [--limit 50] [--search text] [--team id-or-slug]
staqon members get --email you@example.com
staqon members get --member-id 123
staqon members add --name "Jane Doe" --email jane@example.com
staqon members remove --email jane@example.com
staqon members teams --external-ref your-ref-from-link-invite
```

`--limit` accepts 1–200 on `list`. `add` only takes `--name` and `--email` — there is no phone field on this endpoint.

Removing a member archives their thread (history is kept) and drops their team/conversation membership.

### Internal team members

```bash
staqon internal-members [--page 1] [--limit 50] [--search text] [--team id-or-slug]
```

Same shape as `members list`, but for Internal teams: no guest-role filter, and it reports each member's `role` instead of message stats (Internal is a one-way feed, not a conversation).

### Messaging (External team)

```bash
staqon messages send --email jane@example.com --message "Hello!"
staqon messages comment --username jane.doe --comment "Thanks for your order" [--external-ref my-idempotency-key]
staqon messages read --username jane.doe [--limit 50] [--before 1000 | --after 2000]
```

- `send` and `comment` both write into a member's thread as the workspace. `send` uses the member's email; `comment` uses their StaqOn username and supports an `--external-ref` so a retried call with the same ref is idempotent — but **the uniqueness check is workspace-wide, not per recipient**: reusing the same ref for a different recipient will silently fail to reach them (you'll get a 409 back, not a second delivery).
- `read` requires an **approved consent link** for that member — you'll get a 403 if the member hasn't linked. `send`/`comment` don't need that link (writing in is the workspace's own authority).
- `--before`/`--after` page through history; use one or the other, not both.

### Internal messaging

```bash
staqon internal-message --username jane.doe --message "Your ticket was updated" [--title "Ticket #123"] [--link-url https://...] [--external-ref ref]
```

A one-way push into the member's API Messages feed — not a conversation (no replies, reactions, or attachments). Requires the member's explicit, separate consent for *internal* messages: a 403 means they haven't opted in; a 404 with "Internal Link is not set up" means the workspace hasn't configured that gate at all yet.

### e-StaqOn Verify — push approval for sensitive actions

```bash
staqon verify start --username jane.doe --action "Withdraw $500" --context "Approve withdrawal of $500 to your linked bank account?" [--ttl 60]
staqon verify check --id <verification_id>
staqon verify cancel --id <verification_id>
```

`start` pushes an approval prompt to the member's StaqOn app and returns a `verification_id`. Poll `check` until you get `verified: true` (approved), or `verified: false` with a `reason` of `pending`, `declined`, `timeout`, or `cancelled`. `ttl` is 30–180 seconds (default 30; out-of-range values are clamped, not rejected). `cancel` withdraws a still-pending request — if the member already answered, you'll get a 409 and their answer stands, not your cancellation.

This requires an approved, **unexpired** consent link for the member (stricter than `messages send`'s check).

### Advertisement API

```bash
staqon ad upload-image --file ./banner.jpg
staqon ad send --body "Big autumn sale, 20% off everything" --button-label "Shop now" --button-url https://example.com/sale [--image-url <from upload-image>] [--external-ref campaign-001]
staqon ad status --external-ref campaign-001
staqon ad status --request-id 812
```

Requires an **ad-purpose** API key on the target team (separate from your messaging key — created in Workspace Settings → API → Ad API). `ad send` is asynchronous: it queues the send and returns right away; poll `ad status` for progress and final counts. `upload-image` enforces JPEG/PNG/WebP under 300KB; images are centre-cropped to 16:9 server-side.

### Escalation matters

```bash
staqon escalation raise --email jane@example.com --title "Repeated no-shows" --description "..." --due-date 2026-12-01 [--priority high]
staqon escalation list [--page 1] [--limit 50] [--status open]
staqon escalation get --matter-id 42
```

`--due-date` must be strictly after today. `--priority` is one of `low`, `medium`, `high`, `critical` (default `medium`). `list`/`get` only ever show matters your key can see — scoped to "the target member is in this key's team," not by any other workspace linkage.

### Status and webhook health

```bash
staqon status [--internal]
staqon webhooks [--internal]
```

`status` reports member counts and your current rate-limit usage for the External (default) or Internal surface. `webhooks` reports each registered webhook's health — a webhook that fails 10 consecutive deliveries auto-disables, and this is the only way to notice that happened short of your own monitoring.

## Scripting and unattended use

Pass `--json` (anywhere in the command line) to get machine-readable errors instead of prose, and stable exit codes to branch on without parsing error text:

```bash
staqon --json status --team sales || echo "exit code: $?"
```

On failure, `--json` prints one line to stderr: `{"ok":false,"status":<http status>,"error":"...","retry_after":<seconds, on 429s>,"detail":{...}}`. Exit codes:

| Code | Meaning |
|---|---|
| `3` | Not signed in, or the session is missing/expired/revoked — run `staqon login` |
| `4` | Rate limited — see `retry_after` (seconds) |
| `5` | Team or key problem — no eligible key (`no_key`), several eligible teams (`team_required`, re-run with `--team`), or the workspace's own key is at its own limit |
| `6` | Consent missing — the target member hasn't approved the relevant link / API messages |
| `1` | Anything else (validation errors, network errors) |

Without `--json`, output and exit codes are unchanged from before (`Error: <message>`, exit `1` for every failure) — this is additive, not a breaking change.

## A note on API keys and this CLI

Creating a **new** Messaging or Ad API key from the dashboard requires the workspace's Link integration to be set up first — the "+ New key" button is disabled with a "Set up Link first" tooltip until then. Keys created before Link was required keep working. This restriction is enforced in the dashboard UI, not by the API itself, and it has nothing to do with CLI pairing — CLI access is a separate switch and doesn't require Link at all.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `staqon login` never completes | The workspace owner hasn't approved the code at `/cli` yet, or 10 minutes passed — run `staqon login` again. |
| Any command returns 401 "...missing, expired or revoked" | Your paired session is gone. Run `staqon login` again. |
| 403 "CLI access is turned off for this workspace" | The owner turned the workspace's CLI switch off. They'll need to turn it back on and you'll need to pair again. |
| 409 "no_key" | The workspace has no active API key of the right surface+purpose for that command. The owner creates one in Workspace Settings → API. |
| 409 "team_required" | The workspace has more than one eligible team for that command. Re-run with `--team <id-or-slug>` — the error body lists the choices. |

## License

MIT
