# @staqon.one/cli

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
  "links": [{ "email": "jane@example.com", "username": "jane.doe", "linked_at": "2026-11-12 09:40:00" }],
  "pagination": { "limit": 50, "offset": 0, "total": 1 }
}
```

Now send her a real message  -  this one doesn't need the Link connection at all (writing in is always the workspace's own authority; only *reading her replies back* needs her consent):

```bash
staqon messages send --email jane@example.com --message "Hi Jane, you're connected!"
```

```json
{ "ok": true, "message_id": 884213, "conversation_id": 90331 }
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
| `link list` | `POST /api/link-list.php` |
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

**Example  -  `members list`:**
```json
{
  "ok": true,
  "members": [
    { "member_id": 101494, "name": "Anuvika Enterprises", "email": "anuvikaenterprises@gmail.com", "username": "8176m2858", "status": "active", "joined_at": "2026-11-11 16:40:14" }
  ],
  "total": 1086,
  "page": 1,
  "pages": 22
}
```

**Example  -  `members add`:**
```json
{
  "ok": true,
  "member_id": 101855,
  "username": "4471k2093",
  "conversation_id": 90331,
  "status": "active",
  "login_url": "https://staqon.one/m/4471k2093"
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
staqon messages send --email jane@example.com --message "Hello!"
staqon messages comment --username jane.doe --comment "Thanks for your order" [--external-ref my-idempotency-key] [--card '{...}' | --card-file card.json]
staqon messages read --username jane.doe [--limit 50] [--before 1000 | --after 2000]
```

- `send` and `comment` both write into a member's thread as the workspace. `send` uses the member's email; `comment` uses their StaqOn username and supports an `--external-ref` so a retried call with the same ref is idempotent  -  but **the uniqueness check is workspace-wide, not per recipient**: reusing the same ref for a different recipient will silently fail to reach them (you'll get a 409 back, not a second delivery).
- `read` requires an **approved consent link** for that member  -  you'll get a 403 if the member hasn't linked. `send`/`comment` don't need that link (writing in is the workspace's own authority).
- `--before`/`--after` page through history; use one or the other, not both.
- **`comment` (not `send`) can attach a card** via `--card` (inline JSON) or `--card-file` (a JSON file, useful when shell-quoting nested JSON gets painful  -  **especially in PowerShell**, where inline `--card '{"...":"..."}'` can silently mangle the quotes depending on how the string is passed; `--card-file` sidesteps that entirely). The CLI does not re-validate the card's contents  -  it just checks the JSON parses as an object, then forwards it as-is, so the server's own specific error comes back unchanged (e.g. `"card.header_color must be one of the 10 allowed hex codes"`). See [Cards](#cards) below for the full schema and a worked example.

**Example  -  `messages send`:**
```json
{ "ok": true, "message_id": 884213, "conversation_id": 90331 }
```

**Example  -  `messages read`:**
```json
{
  "ok": true,
  "conversation_id": 90331,
  "member": { "username": "jane.doe", "name": "Jane Doe" },
  "messages": [
    { "id": 884210, "direction": "out", "text": "Your order has shipped", "sent_at": "2026-11-11 14:02:10" },
    { "id": 884213, "direction": "out", "text": "Hello!", "sent_at": "2026-11-11 14:05:41" }
  ],
  "paging": { "has_more": false }
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

```json
{ "ok": true, "message_id": 167368, "conversation_id": 1092001326, "sent_at": "2026-11-12 10:02:43" }
```

### Webhooks

Check or configure the outbound webhook for a Messaging key (`verify.resolved`) or an Ad key (`ad.completed`). This is separate from the workspace's **Link** webhook (member/escalation events, one per workspace, set up in Workspace Settings → Link) -- `webhook status` reports both where relevant, but `set-url`/`rotate` only ever touch the calling key's own Verify/Ad webhook.

```bash
staqon webhook status --team partners-channels
```

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
      "last_triggered_at": "2026-11-12 10:42:05",
      "created_at": "2026-09-04 16:01:33"
    },
    {
      "source": "verify",
      "url": "https://example.com/staqon/verify-resolved",
      "events": ["verify.resolved"],
      "is_active": true,
      "failure_count": null,
      "last_triggered_at": null,
      "created_at": "2026-09-04 16:18:11"
    }
  ]
}
```

`failure_count`/`last_triggered_at` are `null` for `source: "verify"`/`"ad"` -- unlike the Link webhook, these don't auto-disable on repeated failures (see [Troubleshooting](#troubleshooting) if yours seems to have stopped firing; it hasn't been turned off, check your receiver).

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
staqon internal-message --username jane.doe --message "Your ticket was updated" [--title "Ticket #123"] [--link-url https://...] [--external-ref ref] [--card '{...}' | --card-file card.json]
```

A one-way push into the member's API Messages feed  -  not a conversation (no replies, reactions, or attachments). Requires the member's explicit, separate consent for *internal* messages: a 403 means they haven't opted in; a 404 with "Internal Link is not set up" means the workspace hasn't configured that gate at all yet. Accepts `--card`/`--card-file` the same way as `messages comment`  -  see [Cards](#cards).

**Example:**
```json
{ "ok": true, "id": 55012, "delivered_at": "2026-11-11 18:20:03" }
```

### e-StaqOn Verify  -  push approval for sensitive actions

```bash
staqon verify start --username jane.doe --action "Withdraw $500" --context "Approve withdrawal of $500 to your linked bank account?" [--ttl 60] [--card '{...}' | --card-file card.json]
staqon verify check --id <verification_id> [--wait <seconds>]
staqon verify cancel --id <verification_id>
```

`start` pushes an approval prompt to the member's StaqOn app and returns a `verification_id`. Poll `check` until you get `verified: true` (approved), or `verified: false` with a `reason` of `pending`, `declined`, `timeout`, or `cancelled`. `ttl` is 30-180 seconds (default 30; out-of-range values are clamped, not rejected). `cancel` withdraws a still-pending request  -  if the member already answered, you'll get a 409 and their answer stands, not your cancellation.

`start` also accepts `--card`/`--card-file` to show a presentation card on the member's approval screen, below `context` (which stays the authoritative text either way  -  the card is presentation only). **`card.button` is rejected here with a 400**  -  the CLI checks for this client-side before sending, so you get the error instantly instead of waiting on a round-trip. See [Cards](#cards).

**`check` supports long-polling via `--wait <seconds>`** (0-25, default 0  -  instant return, same as before). While the request is still `pending`, the CLI holds the connection open and the server re-checks every 500ms, returning as soon as it resolves or the window elapses  -  this cuts polling volume roughly 10x versus calling `check` in a tight loop. See also the `verify.resolved` webhook below for a poll-free alternative that needs no polling at all.

This requires an approved, **unexpired** consent link for the member (stricter than `messages send`'s check).

**What happens when  -  edge cases worth knowing before you build on Verify:**

- **The member answers right at the TTL deadline.** A still-pending request past its deadline is flipped to `expired` the next time anyone reads it (lazily, on the next `check` call)  -  it can never be approved after that, and `check` reports `reason: "timeout"`, never a late approval.
- **You cancel after the member already answered.** `cancel` is atomic and only succeeds while the request is still pending and unexpired. If the member got there first, you get a `409` with `reason: "already_resolved"`, the real `status` (`approved` or `declined`), and `verified` (`true` only for `approved`). **Treat a `409` with `verified: true` as a real approval you must honour or reverse on your own side**  -  it is not a failed cancellation, it's a race you lost.
- **You cancel an already-cancelled request.** Safe and idempotent: `200` with `already: true`, not an error.
- **After a successful cancel**, `check` reports `reason: "cancelled"` from then on, and the member's open prompt closes immediately on web, app, and push  -  they can no longer approve it.
- **A cancel never counts toward, or resets, the 5-per-minute Start limit** for that member.
- **Polling `check` is rate-limited same as everything else.** At one call a second you'll burn through the 30/min session budget in under 30 seconds. Space out your polling, use `--wait` to long-poll (above), or set up the `verify.resolved` webhook (below) and stop polling altogether.

**Example  -  `verify start`:**
```json
{ "ok": true, "verification_id": "4279a9f9-b5b5-42a3-acff-2395aac2d6bb", "expires_at": "2026-11-11T19:14:03+05:30" }
```

**Example  -  `verify check`, still pending:**
```json
{ "ok": true, "verified": false, "reason": "pending" }
```

**Example  -  `verify check`, approved:**
```json
{ "ok": true, "verified": true }
```

**Example  -  `verify cancel`:**
```json
{ "ok": true, "cancelled": true, "status": "cancelled", "already": false }
```

#### `verify.resolved` webhook  -  skip polling entirely

Set a webhook URL on your **messaging key** (Workspace Settings → API → Messaging API → "Set webhook URL"  -  the same key `verify start`/`check`/`cancel` use) and StaqOn POSTs a signed `verify.resolved` event the moment a member approves or declines, instead of you polling for it:

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

Signed HMAC-SHA256 of the raw body in `X-StaqOn-Signature` (hex), event name in `X-StaqOn-Event`  -  verify it the same way you'd verify the `ad.completed` webhook. One synchronous delivery attempt; a failure is retried twice more (+5s, +30s) after your `start`/`check`/`cancel` caller already got its own response, so de-duplicate on `verification_id`. Fires once per resolution, for both `approved` and `declined` (check `data.decision`)  -  it does **not** fire for `expired` or `cancelled`, since neither is something a member did; you'll only see those via `check`'s `reason`. Unlike the `member.*` webhooks, there's no delivery-failure tracking or auto-disable here yet  -  a dead endpoint just stops receiving events until you fix it.

### Advertisement API

```bash
staqon ad upload-image --file ./banner.jpg
staqon ad send --body "Big autumn sale, 20% off everything" --button-label "Shop now" --button-url https://example.com/sale [--image-url <from upload-image>] [--external-ref campaign-001]
staqon ad status --external-ref campaign-001
staqon ad status --request-id 812
```

Requires an **ad-purpose** API key on the target team (separate from your messaging key  -  created in Workspace Settings → API → Ad API). `ad send` is asynchronous: it queues the send and returns right away; poll `ad status` for progress and final counts. `upload-image` enforces JPEG/PNG/WebP under 300KB; images are centre-cropped to 16:9 server-side.

**Example  -  `ad upload-image`:**
```json
{ "ok": true, "image_url": "https://cdn.staqon.one/ad/9c21.../banner.jpg", "width": 1200, "height": 675, "bytes": 184302, "attachment_id": 5521 }
```

**Example  -  `ad send`** (HTTP 202, queued):
```json
{ "ok": true, "ad_request_id": 8341, "external_ref": "campaign-001", "status": "queued" }
```

**Example  -  `ad status`:**
```json
{
  "ok": true,
  "ad_request_id": 8341,
  "external_ref": "campaign-001",
  "status": "completed",
  "total_targets": 42,
  "delivered": 40,
  "failed": 2,
  "skipped": 0,
  "created_at": "2026-11-11 10:00:02",
  "started_at": "2026-11-11 10:00:03",
  "finished_at": "2026-11-11 10:00:19",
  "duration_ms": 16210
}
```

### Escalation matters

```bash
staqon escalation raise --email jane@example.com --title "Repeated no-shows" --description "..." --due-date 2026-12-01 [--priority high]
staqon escalation list [--page 1] [--limit 50] [--status open]
staqon escalation get --matter-id 42
```

`--due-date` must be strictly after today. `--priority` is one of `low`, `medium`, `high`, `critical` (default `medium`). `list`/`get` only ever show matters your key can see  -  scoped to "the target member is in this key's team," not by any other workspace linkage.

**Example  -  `escalation raise`:**
```json
{ "ok": true, "matter_id": 412 }
```

**Example  -  `escalation get`:**
```json
{
  "ok": true,
  "matter": {
    "matter_id": 412,
    "title": "Repeated no-shows",
    "description": "...",
    "priority": "high",
    "status": "open",
    "due_date": "2026-12-01",
    "created_at": "2026-11-11 09:40:00"
  }
}
```

**Example  -  `escalation list`:**
```json
{
  "ok": true,
  "matters": [
    { "matter_id": 412, "title": "Repeated no-shows", "priority": "high", "status": "open", "due_date": "2026-12-01" }
  ],
  "total": 1,
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
- `list` returns your workspace's already-**approved** Link connections: each customer's email, their StaqOn username, and when they linked. Omit `--limit`/`--offset` for the full list; pass both together to page through it (max `--limit` 200).
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

**Example  -  `link list`:**
```json
{
  "ok": true,
  "links": [
    { "email": "jane@example.com", "username": "jane.doe", "linked_at": "2026-11-05 11:20:00" }
  ],
  "pagination": { "limit": 50, "offset": 0, "total": 1 }
}
```

### Status and webhook health

```bash
staqon status [--internal]
staqon webhooks [--internal]
```

`status` reports member counts and your current rate-limit usage for the External (default) or Internal surface. `webhooks` reports each registered webhook's health  -  a webhook that fails 10 consecutive deliveries over 6+ hours auto-disables, and this is the only way to notice that happened short of your own monitoring.

**`webhooks` is read-only  -  there is no CLI or API command to create, edit, or re-enable one.** Webhooks are created and managed only from the dashboard (Workspace Settings → API), and a disabled webhook **cannot be re-enabled**, by design: the fix is to create a new webhook (a fresh URL/secret pair) from the dashboard, not to flip the old one back on. An empty result from `staqon webhooks` just means your team hasn't created a webhook yet  -  that's a dashboard step, not something this command can do for you.

**Example  -  `status`:**
```json
{
  "ok": true,
  "workspace": "Partners Channels",
  "team": "partners-channels",
  "team_type": "external",
  "total_members": 1086,
  "active_members": 1080,
  "api_key_usage": { "used": 412, "limit": 3000 },
  "rate_limit": 30,
  "rate_remaining": 28
}
```

**Example  -  `webhooks`:**
```json
{
  "ok": true,
  "webhooks": [
    { "url": "https://example.com/hooks/staqon", "status": "active", "last_delivery_at": "2026-11-11 18:51:39", "consecutive_failures": 0 }
  ]
}
```

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

## Calling the proxy directly  -  no Node required

Everything this CLI does goes through one HTTP endpoint on StaqOn's own server: `POST|GET https://staqon.one/api/v1/cli-proxy.php?_ep=<name>`, authenticated with a plain `Authorization: Bearer stq_cli_...` header. That endpoint is ordinary REST  -  this CLI is a thin wrapper around it, not a special protocol. If your integration is PHP, Python, Go, a shell script, or anything else that isn't Node, you can call it directly and skip this package entirely, except for the one-time pairing step.

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

The request body and response shape for each `_ep` are **identical** to the matching command's own documentation elsewhere in this README (e.g. `external/staqon-verify-start` is exactly [`verify start`](#e-staqon-verify)'s payload)  -  nothing is reformatted or simplified for the CLI, so you can read any command's section above as the direct-REST reference too.

**The full list of `_ep` names** (also returned, grouped by surface/purpose, from `GET|POST .../cli-proxy.php?_ep=whoami`):

| `_ep` | What it does |
|---|---|
| `external/message` | [`messages send`](#messaging-external-team) |
| `external/messages` | [`messages read`](#messaging-external-team) |
| `external/comment` | [`messages comment`](#messaging-external-team) |
| `external/members` | [`members list`](#members-external-team) |
| `external/member` | member detail |
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
| `external/escalations` | escalation list |
| `external/webhook-status` | [`webhook status`](#cards) (message-purpose key) |
| `external/ad-webhook-status` | `webhook status --purpose ad` (ad-purpose key) |
| `external/webhook-configure` | [`webhook set-url`/`rotate`](#cards) (message-purpose key) |
| `external/ad-webhook-configure` | `webhook set-url`/`rotate --purpose ad` (ad-purpose key) |
| `external/status` | [`status`](#status-and-webhook-health) |
| `internal/message` | [`internal-message`](#internal-messaging) |
| `internal/members` | internal member list |
| `internal/webhook-status` | [`internal-webhook status`](#cards) |
| `internal/webhook-configure` | [`internal-webhook set-url`/`rotate`](#cards) |
| `internal/status` | internal status |
| `link/invite` | [`link invite`](#link) |
| `link/list` | [`link list`](#link) |

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

## Changelog

See [CHANGELOG.md](https://github.com/aroraashish292-creator/staqon-cli/blob/main/CHANGELOG.md) for every released version, what changed, and server-side fixes that needed no upgrade.

## License

MIT
