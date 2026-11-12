# @staqon.one/cli

[![CI](https://github.com/aroraashish292-creator/staqon-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/aroraashish292-creator/staqon-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@staqon.one/cli.svg)](https://www.npmjs.com/package/@staqon.one/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A command-line tool for a StaqOn workspace owner  -  send messages, post ads, run e-StaqOn Verify approvals, manage External and Internal team members, and raise escalation matters, all from your terminal.

The CLI never holds, sees, or asks you to paste a raw API key. Instead it uses a device-pairing flow: you approve each computer once from your StaqOn dashboard, and after that every call goes through StaqOn's own proxy on your workspace's behalf. Full technical details for engineers who want them are at [`/developer`](https://staqon.one/developer) (the live, interactive Swagger spec)  -  this README covers the CLI's own commands.

## Start here  -  five minutes, one real integration

This walks through everything end-to-end: install, pair, invite a real customer to connect, and send them a message  -  the same four steps any real integration needs, in the order you'll actually do them. Each step below links down to its full reference section if you want more detail later; for now just follow along.

**1. Install the CLI.**

```bash
npm install -g @staqon.one/cli
```

Requires Node 18+. ([More detail &darr;](#install))

**2. Pair it to your workspace.**

```bash
staqon login
```

This prints an 8-character code and a link. Before this works, the workspace owner needs to turn on "Allow CLI access" once, in **Workspace Settings → API → CLI access**  -  if you skip this, `login` will tell you so. Open the printed link (or go to `/cli` and type the code) while signed in to StaqOn, pick the workspace, and approve. ([More detail &darr;](#sign-in))

**3. Confirm you're paired.**

```bash
staqon whoami
```

```json
{
  "ok": true,
  "workspace": { "id": 42, "slug": "partners-channels", "name": "Partners Channels" },
  "session": { "id": 9, "device_label": "Windows", "created_at": "2026-11-11 09:00:00", "expires_at": "2027-02-10 09:00:00", "absolute_expires_at": "2027-11-11 09:00:00" },
  "limits": { "per_minute": 30, "per_day": 3000, "used_last_minute": 0, "used_today": 0 },
  "access": [
    { "surface": "external", "purpose": "message", "endpoints": ["members list", "messages send", "..."], "families": ["messaging"], "teams": [{ "team_id": 3, "team_slug": "partners-channels", "team_name": "Partners Channels" }], "automatic": true }
  ]
}
```

Each entry in `access` is one surface+purpose combination your workspace has a key for, with the real list of CLI commands it covers and the eligible team(s) for it. If an entry's `teams` has more than one row, every command in that entry needs `--team <id-or-slug>` to say which one you mean; `automatic: true` means there's exactly one, so you don't have to.

**4. Connect a real customer, and message them.**

Before you can message anyone, that person has to approve a StaqOn Link connection with your workspace  -  this is their consent, not yours, and it's the one step in this walkthrough you can't fully automate end-to-end without a real human on the other side:

```bash
staqon link invite --email jane@example.com --external-ref first-customer
```

```json
{
  "ok": true,
  "token": "lnktok_7f3a9c2e1b8d4f0a9c6e2b1d7a4f8e3c",
  "short_code": "482913",
  "expires_in": 86400,
  "confirm_url": "https://staqon.one/link/confirm?t=lnktok_7f3a9c2e1b8d4f0a9c6e2b1d7a4f8e3c"
}
```

Send that `confirm_url` (or just the `short_code`) to Jane yourself  -  email, SMS, your own app, whatever you'd normally use. StaqOn doesn't deliver it for you. Once she opens it and approves, confirm the connection went through:

```bash
staqon link list
```

```json
{
  "ok": true,
  "links": [
    { "crm_email": "jane@example.com", "link_type": "external", "username": "jane.doe", "status": "approved", "linked_at": "2026-11-12 09:40:00" }
  ]
}
```

Now send her a real message  -  this one doesn't need the Link connection at all (writing in is always the workspace's own authority; only *reading her replies back* needs her consent):

```bash
staqon messages send --email jane@example.com --message "Hi Jane, you're connected!"
```

That's a complete, real integration: a paired CLI, a customer who's consented to connect, and a message actually delivered. ([More detail &darr;](#messaging-external-team))

**What's next.** Everything below is reference material for the rest of the commands  -  Verify approvals, Ad cards, escalations, webhooks, scripting with `--json`, and running this unattended on a server. Jump to the [Command &rarr; Swagger endpoint table](#commands) if you want to go straight to a specific one.

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

**Sessions renew themselves on use  -  no re-login needed for unattended/cron use.** Every call slides `expires_at` forward to 90 days from that call, capped at an absolute 1 year from pairing. So a cron job or server process that calls the CLI at least once every 90 days stays signed in indefinitely, up to that 1-year cap  -  nothing to run, no owner approval needed, it's automatic. There is no separate "refresh" command because there's nothing to trigger: any real command (including `staqon whoami`) renews the session as a side effect. Watch `staqon whoami`'s `session.expires_at` and `session.absolute_expires_at` to know when you're approaching either limit  -  once the absolute cap is hit, only `staqon login` (with fresh owner approval) can continue.

**A prerequisite:** the workspace owner must turn on "Allow CLI access" in **Workspace Settings → API → CLI access** before `staqon login` can succeed. This is a separate, per-workspace switch  -  turning it off immediately signs out every paired computer.

```bash
staqon whoami     # confirm you're paired, see your rate-limit usage and which commands are available
staqon logout     # forget the session on THIS computer (does not revoke it server-side  -  use the dashboard for that)
```

## How calls are authorized

Every command goes through StaqOn's own CLI proxy, never a tenant's raw API key:

1. Your paired session's bearer token (`stq_cli_...`) authenticates the call.
2. StaqOn checks, on every single call, that your workspace's "Allow CLI access" switch is still on and that you're still that workspace's active owner.
3. StaqOn picks which of the workspace's own API keys to act as  -  automatically if there's exactly one eligible key for that command, or you'll be asked to disambiguate with `--team <id-or-slug>` if there are several active teams of the right type.
4. The underlying endpoint runs exactly as it would for a direct API call  -  same validation, same responses.

If a command returns `"error": "team_required"` with a list of teams, re-run it with `--team <id-or-slug>`.

## Rate limits

Two independent limits apply to every call:

- **This CLI session:** 30 requests/minute, 3,000/day  -  separate from, and in addition to, the workspace's own API key limits.
- **The workspace's underlying API key:** if that key is already at its own limit from *direct* API traffic, CLI calls pause too (CLI traffic itself never counts against or depletes the key's direct-API headroom  -  they're tracked separately).

A `429` response includes `Retry-After` in seconds either way.

### All rate limits at a glance

| Limit | Scope | Value | Where it applies |
|---|---|---|---|
| CLI session, per minute | per paired session | 30/min | Every CLI command |
| CLI session, per day | per paired session | 3,000/day | Every CLI command |
| Workspace API key (Messaging/Ad), per minute | per key, set by the owner | varies  -  see `staqon whoami` | Direct API traffic and CLI calls acting as that key share this ceiling |
| Link invite | per Link key | 30/min | `staqon link invite` |
| Link list | per Link key | 120/min | `staqon link list` |
| e-StaqOn Verify start | per **member** (not per key) | 5/min | `staqon verify start`  -  this is the one most likely to 429 you if you're starting several verifications for the same member in a short window |

Every `429` carries `Retry-After` in seconds  -  wait that long and retry rather than polling faster. With `--json`, a `429` always maps to exit code `4` regardless of which limit tripped (see [Scripting](#scripting-and-unattended-use)).

## Commands

Every command below names the exact Swagger/OpenAPI path it calls (`GET`/`POST` + path under `https://staqon.one`) so you can jump straight to the full request/response schema, headers, and error shapes in the [live spec](https://staqon.one/developer) instead of re-deriving them from this README.

| CLI command | Swagger endpoint |
|---|---|
| `members list` | `GET /external/members.php` |
| `members get` | `GET /external/member.php` |
| `members add` | `POST /external/add-member.php` |
| `members remove` | `POST /external/remove-member.php` |
| `members teams` | `GET /external/member-teams.php` |
| `internal-members` | `GET /internal/members.php` |
| `messages send` | `POST /external/message.php` |
| `messages comment` | `POST /external/comment.php` |
| `messages read` | `GET /external/messages.php` |
| `internal-message` | `POST /internal/message.php` |
| `verify start` | `POST /external/staqon-verify-start.php` |
| `verify check` | `POST /external/staqon-verify-check.php` |
| `verify cancel` | `POST /external/staqon-verify-cancel.php` |
| `ad upload-image` | `POST /external/ad-image.php` |
| `ad send` | `POST /external/ad.php` |
| `ad status` | `GET /external/ad-status.php` |
| `escalation raise` | `POST /external/escalation.php` |
| `escalation list` / `escalation get` | `GET /external/escalations.php` |
| `link invite` | `POST /api/link-invite.php` |
| `link list` | `GET /api/link-list.php` |
| `status` | `GET /external/status.php` (or `GET /internal/status.php` with `--internal`) |
| `webhook status` | `GET /external/webhook-status.php` |
| `webhook status --purpose ad` | `GET /external/ad-webhook-status.php`\* |
| `webhook set-url` / `webhook rotate` | `POST /external/webhook-configure.php` |
| `webhook set-url --purpose ad` / `webhook rotate --purpose ad` | `POST /external/ad-webhook-configure.php`\* |
| `internal-webhook status` | `GET /internal/webhook-status.php` |
| `internal-webhook set-url` / `internal-webhook rotate` | `POST /internal/webhook-configure.php` |

\*There's no separate `ad-webhook-status.php`/`ad-webhook-configure.php` file on the server &mdash; both names route through the proxy to the exact same `webhook-status.php`/`webhook-configure.php` as the message-purpose row above (see [the full `_ep` list](#calling-the-proxy-directly----no-node-required)); the split exists only because the CLI proxy resolves one fixed key purpose per `_ep` name, so Ad-purpose keys need their own name to be reachable at all.

The CLI never calls these with a raw API key &mdash; see [How calls are authorized](#how-calls-are-authorized) &mdash; but every request body, response shape, and error code is identical to calling that same endpoint directly.

### Members (External team)

```bash
staqon members list [--page 1] [--limit 50] [--search text] [--team id-or-slug]
staqon members get --email you@example.com
staqon members get --member-id 123
staqon members add --name "Jane Doe" --email jane@example.com
staqon members remove --email jane@example.com
staqon members teams --external-ref your-ref-from-link-invite
```

`--limit` accepts 1-200 on `list`. `add` only takes `--name` and `--email`  -  there is no phone field on this endpoint.

Removing a member archives their thread (history is kept) and drops their team/conversation membership.

**Example  -  `members list`** (confirmed live Nov 12 2026):
```json
{
  "ok": true,
  "members": [
    { "id": 101501, "name": "Sudiip Joshii", "email": "cscsudiip@gmail.com", "username": "8301q6013", "status": "active", "joined_at": "2026-11-12 09:56:00", "last_message_at": "2026-11-12 09:56:00", "messages_sent": 1 }
  ],
  "total": 1089,
  "page": 1,
  "pages": 363
}
```

**Example  -  `members get`** (confirmed live Nov 12 2026):
```json
{
  "ok": true,
  "member": {
    "id": 101501,
    "name": "Sudiip Joshii",
    "email": "cscsudiip@gmail.com",
    "username": "8301q6013",
    "joined_at": "2026-11-12 09:56:00",
    "last_active": "2026-11-12 10:12:02",
    "messages_sent": 1,
    "has_mpin": true
  }
}
```

**Example  -  `members remove`:**
```json
{ "ok": true, "removed": true, "member_id": 101855 }
```

### Internal team members

```bash
staqon internal-members [--page 1] [--limit 50] [--search text] [--team id-or-slug]
```

Same shape as `members list`, but for Internal teams: no guest-role filter, and it reports each member's `role` instead of message stats (Internal is a one-way feed, not a conversation).

### Messaging (External team)

```bash
staqon messages send --email jane@example.com --message "Hello!" [--dry-run]
staqon messages comment --username jane.doe --comment "Thanks for your order" [--external-ref my-idempotency-key] [--card '{...}' | --card-file card.json] [--dry-run]
staqon messages read --username jane.doe [--limit 50] [--before 1000 | --after 2000]
```

- `send` and `comment` both write into a member's thread as the workspace. `send` uses the member's email; `comment` uses their StaqOn username and supports an `--external-ref` so a retried call with the same ref is idempotent  -  but **the uniqueness check is workspace-wide, not per recipient**: reusing the same ref for a different recipient will silently fail to reach them (you'll get a 409 back, not a second delivery).
- `read` requires an **approved consent link** for that member  -  you'll get a 403 if the member hasn't linked. `send`/`comment` don't need that link (writing in is the workspace's own authority).
- `--before`/`--after` page through history; use one or the other, not both.
- **`comment` (not `send`) can attach a card** via `--card` (inline JSON) or `--card-file` (a JSON file, useful when shell-quoting nested JSON gets painful  -  **especially in PowerShell**, where inline `--card '{"...":"..."}'` can silently mangle the quotes depending on how the string is passed; `--card-file` sidesteps that entirely). The CLI does not re-validate the card's contents  -  it just checks the JSON parses as an object, then forwards it as-is, so the server's own specific error comes back unchanged (e.g. `"card.header_color must be one of the 10 allowed hex codes"`). See [Cards](#cards) below for the full schema and a worked example.
- **`--dry-run`** on either command runs every real gate (payment hold, card validation, member exists, team membership, active thread resolution) and reports what would happen, with no message written and no notification/realtime/FCM/webhook fan-out. See [Dry runs](#dry-runs) below.

**Example  -  `messages comment --dry-run`** (confirmed live Nov 12 2026):
```json
{
  "ok": true,
  "dry_run": true,
  "would_post_to": { "username": "2453k1698", "conversation_id": 1092001326 },
  "comment_length": 20,
  "has_card": false,
  "external_ref": null
}
```

### Cards

`messages comment`, `internal-message`, and `verify start` can all attach a structured **card**  -  a small presentation object (header color, title, body, optional icon/sub-body/table/button) shown alongside the plain-text message/comment/context, rendered on web and Android (table support on iOS is planned but not shipped yet; put anything essential in the required `body` text as a fallback).

Pass it as `--card '<json>'` (inline) or `--card-file <path>` (a JSON file)  -  **prefer `--card-file` from PowerShell**, where inline JSON with embedded quotes is easy to mangle depending on how the shell passes it through; a file sidesteps that entirely. The CLI does not re-validate the card's fields against the server's own rules  -  it only checks the JSON parses as a plain object, then forwards it as-is, so a rejected card comes back with the server's own specific error (e.g. `"card.header_color must be one of the 10 allowed hex codes"`, `"card.body is too long (max 2000 chars)"`), not a generic one.

**Fields** (required: `header_color`, `title`, `body`):

| Field | Type | Notes |
|---|---|---|
| `header_color` | string | Exactly one of: `#1F7A54` `#059669` `#D97706` `#DC2626` `#2563EB` `#4B5563` `#7C3AED` `#0D9488` `#DB2777` `#0891B2` |
| `title` | string | Max 200 chars |
| `body` | string | Max 2000 chars. Supports a small markdown subset rendered client-side: `**bold**`, `*italic*`, and `"- "` lines grouped into a real bullet list |
| `sub_body` | string, optional | Max 2000 chars, same markdown subset |
| `meta_title` | string, optional | Max 60 chars |
| `icon` | string, optional | One of: `check` `warning` `document` `security` `wallet` `person` `alert` `info` `reassign` `pending` |
| `button` | object, optional | `{label, url, color?}`  -  one button max. `url` must be `https://`, `tel:`, or `mailto:`. **Not allowed on `verify start`** (400 if present; the CLI catches this before sending). |
| `table` | object, optional | `{columns: [{label, align?}], rows: [[...]]}`  -  2-6 columns, up to 500 rows, 60,000 chars total. Keep to 4 columns or fewer for phone screens. |

**Example  -  a card file** (`card.json`):
```json
{
  "header_color": "#1F7A54",
  "title": "Order shipped",
  "body": "Your order **#4821** is on its way.\n- Carrier: BlueDart\n- ETA: 2 business days",
  "icon": "check",
  "button": { "label": "Track order", "url": "https://example.com/track/4821" }
}
```

```bash
staqon messages comment --username jane.doe --comment "Here's an update" --card-file card.json
```

### Dry runs

Five commands  -  the ones that write a message, post a comment, send an advertisement, or start a Verify request  -  accept a `--dry-run` flag: `messages send`, `messages comment`, `internal-message`, `verify start`, and `ad send`. With `--dry-run`, the server runs every real validation gate it already has for that endpoint (member exists, team membership, consent/link check, card validation, rate limits, image/dedup checks for `ad send`) exactly as it would for a real call, then stops **before** its first write and reports what would have happened  -  no message/comment/ad/verify-request is created, and no notification, realtime push, FCM, or webhook fan-out fires. `verify start --dry-run` deliberately does **not** count against the 5-per-minute Verify rate limit either (confirmed live: the attempts counter is unchanged after a dry-run call), so you can safely dry-run-check as many times as you like before actually starting a real approval.

Each command's dry-run response is a materially different shape from its real-send response (not a subset or a superset)  -  see each command's own section above for its confirmed `would_...` shape. `verify check` and `verify cancel` have no dry-run mode (nothing to simulate: they read or cancel an existing request, they don't create one).

**Example  -  `ad send --dry-run`** (confirmed live Nov 12 2026):
```json
{ "ok": true, "dry_run": true, "would_send_to_targets": 1087, "external_ref": null, "has_image": false }
```

`would_send_to_targets` is the real, current `COUNT(*)` of eligible threads at the moment you ran the command  -  not an estimate, and not guaranteed to match the count by the time you remove `--dry-run` and actually send, if membership changed in between.

**Example  -  `verify start --dry-run`** (confirmed live Nov 12 2026):
```json
{
  "ok": true,
  "dry_run": true,
  "would_ask": { "username": "2453k1698", "action": "test.dryrun" },
  "ttl_seconds": 30,
  "has_card": false,
  "attempts_used_last_minute": 0,
  "attempts_limit_per_minute": 5
}
```

### Webhooks

Check or configure the outbound webhook for a Messaging key (`verify.resolved`) or an Ad key (`ad.completed`). This is separate from the workspace's **Link** webhook (member/escalation events, one per workspace, set up in Workspace Settings → Link) -- `webhook status` reports both where relevant, but `set-url`/`rotate` only ever touch the calling key's own Verify/Ad webhook.

```bash
staqon webhook status --team partners-channels
```

**Example** (confirmed live Nov 12 2026):
```json
{
  "ok": true,
  "webhooks": [
    {
      "source": "link",
      "url": "https://vistarkriya.com/api/staqon/link-verify.php",
      "events": ["member.joined", "member.left", "member.message", "member.removed", "escalation.created", "escalation.resolved", "link.status_changed"],
      "is_active": true,
      "failure_count": 0,
      "last_triggered_at": "2026-11-12 11:09:10",
      "created_at": "2026-09-04 16:01:33"
    }
  ]
}
```

The `source: "verify"`/`"ad"` entries (this key's own Verify/Ad webhook, when one is set) report `events`, `is_active`, and `failure_count` as `null` -- unlike the Link webhook, these don't auto-disable on repeated failures (see [Troubleshooting](#troubleshooting) if yours seems to have stopped firing; it hasn't been turned off, check your receiver).

```bash
# set or change the URL -- first time ever set on this key, a secret is generated and shown once
staqon webhook set-url --team partners-channels --url "https://example.com/staqon/verify-resolved"
# -> {"ok":true,"url":"https://example.com/staqon/verify-resolved","secret":"whsec_..."}   secret shown ONCE

# changing the URL again keeps the existing secret (secret comes back null)
staqon webhook set-url --team partners-channels --url "https://example.com/staqon/verify-resolved-v2"
# -> {"ok":true,"url":"...-v2","secret":null}

# rotate the secret without changing the URL
staqon webhook rotate --team partners-channels
# -> {"ok":true,"secret":"whsec_..."}   new secret shown ONCE, takes effect immediately

# remove the webhook entirely (--url "" does NOT work -- Commander treats an empty value as no value; use --clear)
staqon webhook set-url --team partners-channels --clear
# -> {"ok":true,"removed":true}
```

By default these three commands act on a **Messaging** key's Verify webhook. Pass `--purpose ad` to act on an **Ad** key's completion webhook instead -- same three commands, same shapes:

```bash
staqon webhook status --team partners-channels --purpose ad
staqon webhook set-url --team partners-channels --purpose ad --url "https://example.com/staqon/ad-complete"
staqon webhook rotate --team partners-channels --purpose ad
```

The webhook URL must be `https://` (or `http://`) and resolve to a public address -- loopback, private, link-local and reserved ranges (including the `169.254.169.254` cloud-metadata address) are rejected with `"Webhook URL must be a public address."`, the same SSRF guard the dashboard's own webhook settings use.

For an **Internal** key, the equivalent commands are `internal-webhook status`/`set-url`/`rotate` -- always the Verify webhook (Internal never issues Ad-purpose keys), so there's no `--purpose` flag:

```bash
staqon internal-webhook status --team sales
staqon internal-webhook set-url --team sales --url "https://example.com/staqon/internal-verify"
staqon internal-webhook rotate --team sales
staqon internal-webhook set-url --team sales --clear
```

### Internal messaging

```bash
staqon internal-message --username jane.doe --message "Your ticket was updated" [--title "Ticket #123"] [--link-url https://...] [--external-ref ref] [--card '{...}' | --card-file card.json] [--dry-run]
```

A one-way push into the member's API Messages feed  -  not a conversation (no replies, reactions, or attachments). Requires the member's explicit, separate consent for *internal* messages: a 403 "Member has not approved API messages" means they haven't opted in; this consent gate is checked **before** `--dry-run`'s own simulate-and-return step, so a dry-run call against a non-consenting member still 403s exactly like a real one would (confirmed live) -- `--dry-run` never bypasses a real gate. A 404 with "Internal Link is not set up" means the workspace hasn't configured that gate at all yet. Accepts `--card`/`--card-file` the same way as `messages comment`  -  see [Cards](#cards).

### e-StaqOn Verify  -  push approval for sensitive actions

```bash
staqon verify start --username jane.doe --action "Withdraw $500" --context "Approve withdrawal of $500 to your linked bank account?" [--ttl 60] [--card '{...}' | --card-file card.json] [--dry-run]
staqon verify check --id <verification_id> [--wait <seconds>]
staqon verify cancel --id <verification_id>
```

`start` pushes an approval prompt to the member's StaqOn app and returns a `verification_id`. Poll `check` until you get `verified: true` (approved), or `verified: false` with a `reason` of `pending`, `declined`, `timeout`, or `cancelled`. `ttl` is 30-180 seconds (default 30; out-of-range values are clamped, not rejected). `cancel` withdraws a still-pending request  -  if the member already answered, you'll get a 409 and their answer stands, not your cancellation.

`start` also accepts `--card`/`--card-file` to show a presentation card on the member's approval screen, below `context` (which stays the authoritative text either way  -  the card is presentation only). **`card.button` is rejected here with a 400**  -  the CLI checks for this client-side before sending, so you get the error instantly instead of waiting on a round-trip. See [Cards](#cards).

**`check` supports long-polling via `--wait <seconds>`** (0-25, default 0  -  instant return, same as before). While the request is still `pending`, the CLI holds the connection open and the server re-checks every 500ms, returning as soon as it resolves or the window elapses  -  this cuts polling volume roughly 10x versus calling `check` in a tight loop. See also the `verify.resolved` webhook below for a poll-free alternative that needs no polling at all.

This requires an approved, **unexpired** consent link for the member (stricter than `messages send`'s check).

**What happens when  -  edge cases worth knowing before you build on Verify:**

- **The member answers right at the TTL deadline.** A still-pending request past its deadline is flipped to `expired` the next time anyone reads it (lazily, on the next `check` call)  -  it can never be approved after that, and `check` reports `reason: "timeout"`, never a late approval. The `expired` transition also fires the `verify.resolved` webhook (below) exactly once, from whichever `check` call actually wins the atomic state change.
- **You cancel after the member already answered.** `cancel` is atomic and only succeeds while the request is still pending and unexpired. If the member got there first, you get a `409` with `reason: "already_resolved"`, the real `status` (`approved` or `declined`), and `verified` (`true` only for `approved`). **Treat a `409` with `verified: true` as a real approval you must honour or reverse on your own side**  -  it is not a failed cancellation, it's a race you lost.
- **You cancel an already-cancelled request.** Safe and idempotent: `200` with `already: true`, not an error.
- **After a successful cancel**, `check` reports `reason: "cancelled"` from then on, and the member's open prompt closes immediately on web, app, and push  -  they can no longer approve it. The cancellation also fires the `verify.resolved` webhook (below), after your own cancel response has already been sent.
- **A cancel never counts toward, or resets, the 5-per-minute Start limit** for that member.
- **`--dry-run` on `start`** runs every real gate (member exists, team membership, approved+unexpired link, the 5-per-minute rate limit) and reports what would happen without creating a request or asking the member  -  and, deliberately, without counting against that same rate limit (confirmed live: the attempts-used count is unaffected by dry-run calls). See [Dry runs](#dry-runs).
- **Polling `check` is rate-limited same as everything else.** At one call a second you'll burn through the 30/min session budget in under 30 seconds. Space out your polling, use `--wait` to long-poll (above), or set up the `verify.resolved` webhook (below) and stop polling altogether.

#### `verify.resolved` webhook  -  skip polling entirely

Set a webhook URL on your **messaging key** (`staqon webhook set-url`, or Workspace Settings → API → Messaging API → "Set webhook URL"  -  the same key `verify start`/`check`/`cancel` use) and StaqOn POSTs a signed `verify.resolved` event the moment a member approves or declines, instead of you polling for it. The event also fires for `expired` and `cancelled` outcomes (both confirmed live, screenshot-verified against a real webhook.site receiver this session), not only `approved`/`declined`  -  same event name and payload shape for all four, branch on `data.decision`:

```json
{
  "event": "verify.resolved",
  "timestamp": "2026-11-11T18:51:39+05:30",
  "data": {
    "verification_id": "57531e6a-d80b-40f7-bb16-e04d0f10d628",
    "action": "Withdraw $500",
    "context": "Approve withdrawal of $500 to your linked bank account?",
    "decision": "approved",
    "resolved_at": "2026-11-11 18:51:39"
  }
}
```

Signed HMAC-SHA256 of the raw body in `X-StaqOn-Signature` (hex), event name in `X-StaqOn-Event`  -  verify it the same way you'd verify the `ad.completed` webhook. One synchronous delivery attempt; a failure is retried twice more (+5s, +30s) after your `start`/`check`/`cancel` caller already got its own response, so de-duplicate on `verification_id`. Unlike the `member.*` webhooks, there's no delivery-failure tracking or auto-disable here yet  -  a dead endpoint just stops receiving events until you fix it.

### Advertisement API

```bash
staqon ad upload-image --file ./banner.jpg
staqon ad send --body "Big autumn sale, 20% off everything" --button-label "Shop now" --button-url https://example.com/sale [--image-url <from upload-image>] [--external-ref campaign-001] [--dry-run]
staqon ad status --external-ref campaign-001
staqon ad status --request-id 812
```

Requires an **ad-purpose** API key on the target team (separate from your messaging key  -  created in Workspace Settings → API → Ad API). `ad send` is asynchronous: it queues the send and returns right away; poll `ad status` for progress and final counts. `upload-image` enforces JPEG/PNG/WebP under 300KB; images are centre-cropped to 16:9 server-side. `--dry-run` validates the card, image ownership, and `external_ref` dedup, and reports the real current target-thread count, without queuing anything or consuming the `external_ref`  -  see [Dry runs](#dry-runs) for the confirmed live example.

### Escalation matters

```bash
staqon escalation raise --email jane@example.com --title "Repeated no-shows" --description "..." --due-date 2026-12-01 [--priority high]
staqon escalation list [--page 1] [--limit 50] [--status open]
staqon escalation get --matter-id 42
```

`--due-date` must be strictly after today. `--priority` is one of `low`, `medium`, `high`, `critical` (default `medium`). `list`/`get` only ever show matters your key can see  -  scoped to "the target member is in this key's team," not by any other workspace linkage. Each matter is identified by a `uuid`, not a numeric id  -  `escalation get`'s `--matter-id` flag name is historical; pass the matter's `uuid` to it.

**Example  -  `escalation list`** (confirmed live Nov 12 2026, abridged to one matter):
```json
{
  "ok": true,
  "matters": [
    {
      "uuid": "ab720c88-80ab-4f02-a892-be672a7f81b3",
      "title": "Repeated no-shows",
      "description": "...",
      "status": "in_progress",
      "priority": "high",
      "due_date": "2026-11-12",
      "resolved_at": null,
      "comment_count": 5,
      "last_activity_at": "2026-11-09 11:48:43",
      "created_at": "2026-11-09 10:52:14",
      "target_username": "0042u0477"
    }
  ],
  "total": 12,
  "page": 1,
  "pages": 1
}
```

### Link  -  invite a customer, list who's linked

```bash
staqon link invite --email jane@example.com --external-ref customer-482
staqon link list [--limit 50 --offset 0]
```

Link has no `--team`  -  it's one connection per **workspace**, not per team, and the server resolves your workspace's single active Link key on its own.

- `invite` creates a single-use invite token for one customer and returns `{token, short_code, expires_in, confirm_url}`  -  **you deliver that to the customer yourself** (email, SMS, your own CRM UI); StaqOn never emails, texts, or pushes anything to them at this step. The token/short code are shown once. A new invite for the same `--external-ref` supersedes an older still-pending one for that same customer reference.
- `list` returns your workspace's already-**approved** Link connections: each customer's CRM email (`crm_email`), link type, StaqOn username, status, and when they linked. Omit `--limit`/`--offset` for the full list (no `pagination` key in the response at all in that case  -  confirmed live); pass both together to page through it (max `--limit` 200), and the response then adds a `pagination: {limit, offset, total, has_more}` object.
- Requires Link to be set up for your workspace (Workspace Settings → Link)  -  if it isn't, you'll get a 409 `no_link_key`.
- Your Link signing secret never leaves StaqOn's server: the CLI calls this through the same paired session as every other command, and StaqOn signs the request on your workspace's behalf.

**Example  -  `link invite`:**
```json
{
  "ok": true,
  "token": "lnktok_7f3a9c2e1b8d4f0a9c6e2b1d7a4f8e3c",
  "short_code": "482913",
  "expires_in": 86400,
  "confirm_url": "https://staqon.one/link/confirm?t=lnktok_7f3a9c2e1b8d4f0a9c6e2b1d7a4f8e3c"
}
```

**Example  -  `link list --limit 2`** (confirmed live Nov 12 2026):
```json
{
  "ok": true,
  "links": [
    { "crm_email": "gnagender14@gmail.com", "link_type": "external", "username": "8719y7013", "status": "approved", "linked_at": "2026-11-12 10:55:19" },
    { "crm_email": "ds9929555@gmail.com", "link_type": "external", "username": "3431v6073", "status": "approved", "linked_at": "2026-11-12 08:54:16" }
  ],
  "pagination": { "limit": 2, "offset": 0, "total": 579, "has_more": true }
}
```

**Example  -  `link list`, no `--limit`/`--offset`** (confirmed live Nov 12 2026  -  note: no `pagination` key at all):
```json
{
  "ok": true,
  "links": [
    { "crm_email": "gnagender14@gmail.com", "link_type": "external", "username": "8719y7013", "status": "approved", "linked_at": "2026-11-12 10:55:19" }
  ]
}
```

### Status and webhook health

```bash
staqon status [--internal]
staqon webhook status [--internal]
```

`status` reports member counts and your current rate-limit usage for the External (default) or Internal surface. `webhook status` reports each registered webhook's health  -  see [Webhooks](#webhooks) above for the full shape and `--purpose ad`/`internal-webhook status`.

**Example  -  `status`** (confirmed live Nov 12 2026):
```json
{
  "ok": true,
  "workspace": "Vistarkriya workspace",
  "team": "Partners Channels",
  "team_type": "external",
  "total_members": 1089,
  "active_members": 1089,
  "api_key_usage": 34858,
  "rate_limit": "100/minute",
  "rate_remaining": 97
}
```

`api_key_usage` is a plain running count (not an `{used, limit}` object), and `rate_limit` is a display string (e.g. `"100/minute"`), not a bare number  -  confirmed against a real live call this session.

## Scripting and unattended use

Pass `--json` (anywhere in the command line) to get machine-readable errors instead of prose, and stable exit codes to branch on without parsing error text:

```bash
staqon --json status --team sales || echo "exit code: $?"
```

On failure, `--json` prints one line to stderr: `{"ok":false,"status":<http status>,"error":"...","retry_after":<seconds, on 429s>,"detail":{...}}`. Exit codes:

| Code | Meaning |
|---|---|
| `3` | Not signed in, or the session is missing/expired/revoked  -  run `staqon login` |
| `4` | Rate limited  -  see `retry_after` (seconds) |
| `5` | Team or key problem  -  no eligible key (`no_key`), several eligible teams (`team_required`, re-run with `--team`), or the workspace's own key is at its own limit |
| `6` | Consent missing  -  the target member hasn't approved the relevant link / API messages |
| `1` | Anything else (validation errors, network errors) |

Without `--json`, output and exit codes are unchanged from before (`Error: <message>`, exit `1` for every failure)  -  this is additive, not a breaking change.

TypeScript consumers piping `--json` output, or importing this package as a library rather than shelling out to it, can import real response types from `@staqon.one/cli/dist/api/responses.js` for the endpoints that have them  -  see [Typed responses for scripting](#typed-responses-for-scripting) below.

### Typed responses for scripting

If your scripting language is TypeScript (or you're calling this package's internals directly rather than shelling out to the compiled binary), `src/api/responses.ts` exports interfaces for a growing set of this CLI's response shapes  -  each one transcribed from a real, live server response, not guessed from a field name or an endpoint's purpose. As of this release, typed shapes exist for:

- All five `--dry-run` responses: `CommentDryRunResponse`, `MessageSendDryRunResponse`, `InternalMessageDryRunResponse`, `VerifyStartDryRunResponse`, `AdSendDryRunResponse`
- `MembersListResponse` (`members list`)
- `MemberGetResponse` (`members get`)
- `StatusResponse` (`status`, both surfaces)
- `WebhookStatusResponse` (`webhook status`, `internal-webhook status`, both purposes)
- `EscalationListResponse` (`escalation list`)
- `LinkListResponse` (`link list`, with and without pagination)

The real-send (non-dry-run) shapes for `messages send`/`comment`, `internal-message`, `verify start`/`check`/`cancel`, `ad send`/`status`/`upload-image`, `members add`/`remove`/`teams`, `escalation raise`/`get`, and `link invite` are **not yet typed**  -  calling `proxy()` for those endpoints without an explicit type parameter returns the untyped `Record<string, unknown>` it always has. This is a known, deliberate gap (left untyped rather than shipped with a guessed shape) and will be filled in incrementally, each addition backed by a real live call the same way the shapes above were. If you need one of these typed sooner, open an issue with the real response you got back and it can be added directly from that.

## Running on shared/managed PHP hosting

The CLI is a Node process  -  it needs to actually run (`staqon <command>`), not just exist as a file. Most shared or managed PHP hosts block or kill long-running / arbitrary processes started from a web request, so you generally **cannot** trigger the CLI from inside a PHP page load. The fix is the same one people use for any scheduled job on that kind of host: run the CLI from **cron**, not from a web request.

A minimal cron-worker pattern  -  e.g. checking for new Link approvals every 5 minutes:

```bash
#!/bin/sh
# /home/you/staqon-worker.sh  -  runs as your shell user, NOT inside the PHP/web process
cd /home/you
/usr/bin/node /usr/lib/node_modules/@staqon.one/cli/dist/index.js --json link list > /home/you/staqon-link-list.json 2>> /home/you/staqon-worker.log
```

```cron
*/5 * * * * /home/you/staqon-worker.sh
```

Then have your PHP application read the JSON file the worker wrote (`staqon-link-list.json`) instead of shelling out to the CLI directly. This also sidesteps most hosts' `exec()`/`shell_exec()` restrictions on PHP itself, since cron runs independently of the web server.

Your paired CLI session renews itself on every call (see [Sign in](#sign-in)), so once `staqon login` is approved, a cron job calling it every few minutes never needs to re-authenticate.

### Calling from PHP directly (no CLI, no Node)

If your own integration is PHP rather than the CLI, you don't need Node at all for this  -  call the proxy endpoint with cURL from PHP the same way the [direct-REST section](#calling-the-proxy-directly----no-node-required) below does it from the shell. Three things matter more in PHP than they do in a one-off `curl` command, because a long-running PHP worker (a cron job, a queue consumer) will eventually hit all three if you don't handle them:

**1. JSON-encode the body properly  -  never string-concatenate it.** Building the request body by hand (`'{"username":"' . $username . '",...}'`) breaks the moment a value contains a quote, backslash, or newline  -  which a real `--context`/`--comment`/`--description` field eventually will. Always use `json_encode()`:

```php
<?php
$body = json_encode([
    'username' => $username,          // never interpolate this into a hand-built JSON string
    'action'   => 'payout.approve',
    'context'  => $context,           // may contain quotes, newlines, unicode -- json_encode handles all of it
    'ttl_seconds' => 60,
]);
if ($body === false) {
    // json_encode fails on invalid UTF-8 input, among other things -- don't send a false/null body
    throw new RuntimeException('Failed to encode request body: ' . json_last_error_msg());
}
```

**2. Always set a timeout, and check `curl_errno()` before reading the response.** Without `CURLOPT_TIMEOUT` (or `CURLOPT_CONNECTTIMEOUT`), a cURL call that never gets a response -- a network blip, the server taking unusually long -- can hang your PHP worker indefinitely, which is especially bad in a cron job or queue consumer that's expected to exit. `curl_exec()` returns `false` on a timeout or any other transport-level failure, not an HTTP error you can see in the response body, so check it explicitly before trying to `json_decode()` whatever came back:

```php
<?php
$ch = curl_init('https://staqon.one/api/v1/cli-proxy.php?_ep=external/staqon-verify-start');
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'POST',
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,   // fail fast if StaqOn's server can't even be reached
    CURLOPT_TIMEOUT         => 15, // fail if the whole request/response round-trip takes too long
    CURLOPT_HTTPHEADER      => [
        'Authorization: Bearer ' . $token,
        'X-StaqOn-Team: partners-channels',
        'Content-Type: application/json',
    ],
]);

$raw = curl_exec($ch);
if ($raw === false) {
    // Transport-level failure -- timeout, DNS, TLS, connection refused. There is no HTTP status
    // code here at all; curl_error() is the only information you have about what went wrong.
    $error = curl_error($ch);
    curl_close($ch);
    throw new RuntimeException("Request to StaqOn failed: $error");
}

$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = json_decode($raw, true);
if ($data === null && json_last_error() !== JSON_ERROR_NONE) {
    // The server should always return valid JSON, but don't assume it -- an upstream proxy
    // timeout or a misconfigured server can return an HTML error page instead.
    throw new RuntimeException("StaqOn returned non-JSON response (HTTP $status): " . substr($raw, 0, 200));
}

if ($status === 429) {
    // Respect Retry-After the same way the CLI's own exit-code-4 handling does -- don't retry immediately.
    throw new RuntimeException('Rate limited: ' . ($data['error'] ?? 'unknown'));
}
if ($status >= 400) {
    throw new RuntimeException("StaqOn error (HTTP $status): " . ($data['error'] ?? 'unknown'));
}
```

**3. Escape anything that reaches a shell, not just JSON.** This applies only if your PHP code ever shells out to something else with a value that came from a StaqOn response (a username, an email, a card's `body` text) -- for example, piping a member's name into a logging command, or writing it into a filename. Never string-concatenate untrusted text into `shell_exec()`/`exec()`; use `escapeshellarg()` on each value:

```php
<?php
// WRONG -- a member name containing a backtick, $, or quote can break out of the intended command
// shell_exec("echo '{$member['name']}' >> /var/log/staqon-members.log");

// RIGHT
$safeName = escapeshellarg($member['name']);
shell_exec("echo $safeName >> /var/log/staqon-members.log");
```

In practice, most PHP integrations never need to shell out to begin with (write to the filesystem with PHP's own `file_put_contents()`, log with PHP's own logging, etc.), which sidesteps this category of bug entirely -- the two points above (proper JSON encoding, and always setting a timeout + checking `curl_errno()`) are the ones that come up in every PHP integration of this proxy, timeout handling especially, since a hung cron worker is a much quieter failure than an HTTP error.

**4. Back off on 429  -  don't just fail and retry on the next cron tick.** A worker that fires every minute and gets a 429 will burn through its whole budget retrying at the same pace that got it rate-limited in the first place. Read `Retry-After` from the response and sleep (or skip this run and let the next scheduled tick act as the retry, if `Retry-After` is longer than your cron interval):

```php
<?php
if ($status === 429) {
    $retryAfter = (int)($data['retry_after'] ?? 10);
    error_log("StaqOn rate limited, retry_after={$retryAfter}s -- sleeping instead of hammering it");
    sleep(min($retryAfter, 60)); // cap it -- don't block a cron worker indefinitely on a bad value
    // then retry once, or simply exit and let the next cron tick pick it up
}
```

**5. Handle a 401 as "stop and alert," not "retry forever."** Unlike a timeout or a 429, a 401 ("session missing, expired, or revoked") will never resolve itself on retry -- the owner turned off CLI access, the session hit its absolute 1-year cap, or `staqon logout` was run on the paired device. A cron worker that doesn't check for this will either loop uselessly forever or silently stop doing anything useful while reporting no error anyone notices:

```php
<?php
if ($status === 401) {
    // Don't retry -- this needs a human to re-pair (staqon login) or re-approve CLI access
    // in Workspace Settings -> API -> CLI access. Alert loudly instead of looping.
    error_log('StaqOn session is missing/expired/revoked -- re-pairing required, see README Sign in section');
    mail('you@example.com', 'StaqOn CLI session needs re-pairing', $raw);
    exit(1);
}
```

**6. Guard against cron overlap for write-type calls.** If your cron entry can overlap itself (a slow previous run still executing when the next tick fires, or two servers both running the same cron job), a *read* like `link list` is harmless to run twice, but a *write* -- `verify start`, `ad send`, `messages send`/`comment`, `internal-message` -- firing twice means a duplicate verification prompt, a duplicate ad send, or a duplicate message. Use a simple lock file for the cron script itself, and lean on `--external-ref`/`external_ref` (see each command's own section above) for the API-level dedup, since a lock file only protects against overlap on *this* machine:

```php
<?php
$lockFile = '/tmp/staqon-worker.lock';
$lock = fopen($lockFile, 'c');
if (!flock($lock, LOCK_EX | LOCK_NB)) {
    error_log('Previous staqon-worker run still in progress -- skipping this tick');
    exit(0);
}
// ... do the work ...
flock($lock, LOCK_UN);
```

**7. Protect a self-stored token the same way the CLI protects its own.** If your PHP integration stores the bearer token itself (rather than reading it from this CLI's `~/.staqon/credentials.json`), put it outside the webroot and set restrictive permissions -- the same `0600` the CLI enforces on its own credentials file, and the same reasoning: on shared hosting, other sites/processes on the same box, or a misconfigured webroot, can otherwise read it.

```php
<?php
$tokenPath = '/home/you/.staqon-token';   // NOT inside public_html/ or any web-served directory
file_put_contents($tokenPath, $token);
chmod($tokenPath, 0600);
```

## Calling the proxy directly  -  no Node required

Everything this CLI does goes through one HTTP endpoint on StaqOn's own server: `POST|GET https://staqon.one/api/v1/cli-proxy.php?_ep=<name>`, authenticated with a plain `Authorization: Bearer stq_cli_...` header. That endpoint is ordinary REST  -  this CLI is a thin wrapper around it, not a special protocol. If your integration is PHP, Python, Go, a shell script, or anything else that isn't Node, you can call it directly and skip this package entirely, except for the one-time pairing step. (PHP specifically: see [Calling from PHP directly](#calling-from-php-directly-no-cli-no-node) above for timeout and escaping guidance beyond the plain curl examples below.)

**Getting a token without Node.** Pairing itself is also just REST  -  two calls to `api/cli-pair.php`, the same ones this CLI's own `login` command makes:

```bash
# 1) ask the server for a pairing code (no auth needed for this call)
curl -s -X POST "https://staqon.one/api/cli-pair.php?action=code_request" \
  -H "Content-Type: application/json" \
  -d '{"device_label":"my-php-server","os":"linux","cli_version":"direct-rest"}'
# -> {"ok":true,"pair_id":"...","code":"ABCD-1234","verification_url":"https://staqon.one/cli?code=ABCD-1234","poll_secret":"...","expires_in":600,"interval":3}
```

Open `verification_url` (or go to `/cli` and type the code) while signed in as the workspace owner, pick the workspace, and approve  -  exactly the same approval screen `staqon login` sends you to. Then poll for the token:

```bash
# 2) poll every few seconds using the SAME pair_id + poll_secret from step 1
curl -s -X POST "https://staqon.one/api/cli-pair.php?action=poll" \
  -H "Content-Type: application/json" \
  -d '{"pair_id":"...","poll_secret":"..."}'
# while pending: {"ok":true,"status":"pending"}
# once approved: {"ok":true,"status":"approved","token":"stq_cli_...","workspace":{...},"expires_at":"..."}
```

The token (`stq_cli_` followed by 64 hex characters) is shown exactly once, at that moment  -  store it yourself (an env var, a secrets file with restricted permissions); StaqOn never shows it again and this CLI itself never holds or displays a raw API key either, for the same reason. It auto-renews on every proxied call (sliding expiry, capped at an absolute maximum  -  see [Sign in](#sign-in)), so a long-running non-Node integration polling the proxy regularly never needs to re-pair.

**Shortcut, if you already have Node available once:** run `staqon login` interactively, approve it, then read the token straight out of wherever this CLI stores it on that machine and copy it into your non-Node environment. Functionally identical to the curl flow above  -  same token shape, same server-side pairing record  -  just faster if Node happens to already be installed somewhere you can run it once.

**Calling an endpoint.** Every call needs the bearer token; add `X-StaqOn-Team: <team id or slug>` only when the workspace has more than one eligible team for that endpoint (the response says so if you omit it and it's needed  -  see [How calls are authorized](#how-calls-are-authorized)):

```bash
curl -s -X POST "https://staqon.one/api/v1/cli-proxy.php?_ep=external/staqon-verify-start" \
  -H "Authorization: Bearer stq_cli_..." \
  -H "X-StaqOn-Team: partners-channels" \
  -H "Content-Type: application/json" \
  -d '{"username":"theirusername","action":"payout.approve","context":"Approve payout of Rs 12,000?","ttl_seconds":60}'
```

The request body and response shape for each `_ep` are **identical** to the matching command's own documentation elsewhere in this README (e.g. `external/staqon-verify-start` is exactly [`verify start`](#e-staqon-verify)'s payload)  -  nothing is reformatted or simplified for the CLI, so you can read any command's section above as the direct-REST reference too. Every send-type endpoint (`external/comment`, `external/message`, `internal/message`, `external/staqon-verify-start`, `external/ad`) also accepts `"dry_run": true` in the body, with the same meaning as the CLI's `--dry-run` flag  -  see [Dry runs](#dry-runs).

**The full list of `_ep` names** (also returned, grouped by surface/purpose, from `GET|POST .../cli-proxy.php?_ep=whoami`):

| `_ep` | What it does |
|---|---|
| `external/message` | [`messages send`](#messaging-external-team) |
| `external/messages` | [`messages read`](#messaging-external-team) |
| `external/comment` | [`messages comment`](#messaging-external-team) |
| `external/members` | [`members list`](#members-external-team) |
| `external/member` | [`members get`](#members-external-team) |
| `external/add-member` | [`members add`](#members-external-team) |
| `external/remove-member` | [`members remove`](#members-external-team) |
| `external/member-teams` | member's teams |
| `external/ad` | [`ad send`](#advertisement-api) |
| `external/ad-image` | [`ad upload-image`](#advertisement-api) |
| `external/ad-status` | [`ad status`](#advertisement-api) |
| `external/staqon-verify-start` | [`verify start`](#e-staqon-verify) |
| `external/staqon-verify-check` | [`verify check`](#e-staqon-verify) |
| `external/staqon-verify-cancel` | [`verify cancel`](#e-staqon-verify) |
| `external/escalation` | [`escalation raise`](#escalation-matters) |
| `external/escalations` | [`escalation list`/`get`](#escalation-matters) |
| `external/webhook-status` | [`webhook status`](#webhooks) (message-purpose key) |
| `external/ad-webhook-status` | `webhook status --purpose ad` (ad-purpose key) |
| `external/webhook-configure` | [`webhook set-url`/`rotate`](#webhooks) (message-purpose key) |
| `external/ad-webhook-configure` | `webhook set-url`/`rotate --purpose ad` (ad-purpose key) |
| `external/status` | [`status`](#status-and-webhook-health) |
| `internal/message` | [`internal-message`](#internal-messaging) |
| `internal/members` | internal member list |
| `internal/webhook-status` | [`internal-webhook status`](#webhooks) |
| `internal/webhook-configure` | [`internal-webhook set-url`/`rotate`](#webhooks) |
| `internal/status` | internal status |
| `link/invite` | [`link invite`](#link----invite-a-customer-list-whos-linked) |
| `link/list` | [`link list`](#link----invite-a-customer-list-whos-linked) |

`link/invite` and `link/list` are the one exception to "identical to the matching endpoint's docs": they're a separate auth mechanism entirely (the workspace's single Link key, HMAC-signed server-side  -  no API key or team selection involved), so there's no separate `link-invite.php`/`link-list.php` to call directly outside the proxy; the proxy *is* the only way to reach them, Node or not.

## A note on API keys and this CLI

Creating a **new** Messaging or Ad API key from the dashboard requires the workspace's Link integration to be set up first  -  the "+ New key" button is disabled with a "Set up Link first" tooltip until then. Keys created before Link was required keep working. This restriction is enforced in the dashboard UI, not by the API itself, and it has nothing to do with CLI pairing  -  CLI access is a separate switch and doesn't require Link at all.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `staqon login` never completes | The workspace owner hasn't approved the code at `/cli` yet, or 10 minutes passed  -  run `staqon login` again. |
| Any command returns 401 "...missing, expired or revoked" | Your paired session is gone. Run `staqon login` again. |
| 403 "CLI access is turned off for this workspace" | The owner turned the workspace's CLI switch off. They'll need to turn it back on and you'll need to pair again. |
| 409 "no_key" | The workspace has no active API key of the right surface+purpose for that command. The owner creates one in Workspace Settings → API. |
| 409 "team_required" | The workspace has more than one eligible team for that command. Re-run with `--team <id-or-slug>`  -  the error body lists the choices. |
| 403 "Member has not approved API messages" on `internal-message` (even with `--dry-run`) | The target member hasn't opted in to Internal messages. This gate is checked before dry-run's simulate step runs, so `--dry-run` doesn't skip it  -  confirmed live this session. |

## Changelog

See [CHANGELOG.md](https://github.com/aroraashish292-creator/staqon-cli/blob/main/CHANGELOG.md) for every released version, what changed, and server-side fixes that needed no upgrade.

## License

MIT
