/**
 * Response shapes for the CLI's proxied endpoints, as `proxy<T>()`'s type parameter.
 *
 * STATUS (Nov 12 2026): only the `*DryRunResponse` interfaces below are confirmed —
 * each one transcribed from a REAL response, either a live curl/CLI call made this
 * session or the exact PHP source for that endpoint's dry_run branch. The
 * non-dry-run response types (message send, comment, ad send, verify
 * start/check/cancel, members, escalation, link, status, webhooks, ...) are the
 * NEXT thing to add here, one at a time, each only after pulling one real live
 * response to transcribe from — not before. Do not add a type to this file from
 * an endpoint's name or from field names recalled from an earlier conversation;
 * that is exactly how the dead-table bug and the stale README row happened
 * earlier this session. Get the real JSON first, then write the interface.
 */

// ---------- messages comment --dry-run (external/comment.php) ----------
export interface CommentDryRunResponse {
  ok: true;
  dry_run: true;
  would_post_to: { username: string; conversation_id: number };
  comment_length: number;
  has_card: boolean;
  external_ref: string | null;
}

// ---------- messages send --dry-run (external/message.php) ----------
export interface MessageSendDryRunResponse {
  ok: true;
  dry_run: true;
  would_send_to: { email: string; conversation_id: number };
  message_length: number;
}

// ---------- internal-message --dry-run (internal/message.php) ----------
export interface InternalMessageDryRunResponse {
  ok: true;
  dry_run: true;
  would_deliver_to: { username: string; team_id: number };
  message_length: number;
  has_card: boolean;
  external_ref: string | null;
}

// ---------- verify start --dry-run (external/staqon-verify-start.php) ----------
export interface VerifyStartDryRunResponse {
  ok: true;
  dry_run: true;
  would_ask: { username: string; action: string };
  ttl_seconds: number;
  has_card: boolean;
  attempts_used_last_minute: number;
  attempts_limit_per_minute: number;
}

// ---------- ad send --dry-run (external/ad.php) ----------
export interface AdSendDryRunResponse {
  ok: true;
  dry_run: true;
  would_send_to_targets: number; // a real current COUNT(*), not an estimate
  external_ref: string | null;
  has_image: boolean;
}

// ---------- members list (external/members.php) — CONFIRMED live Nov 12 2026 ----------
export interface ExternalMember {
  id: number;
  name: string;
  email: string;
  username: string;
  status: string; // seen: "active" — other values not yet observed
  joined_at: string;
  last_message_at: string | null;
  messages_sent: number;
}
export interface MembersListResponse {
  ok: true;
  members: ExternalMember[];
  total: number;
  page: number;
  pages: number;
}

// ---------- status (external/status.php) — CONFIRMED live Nov 12 2026 ----------
export interface StatusResponse {
  ok: true;
  workspace: string;
  team: string;
  team_type: string; // seen: "external" — "internal" presumably on the internal surface, not yet observed
  total_members: number;
  active_members: number;
  api_key_usage: number;
  rate_limit: string; // e.g. "100/minute" — a display string, not a structured object
  rate_remaining: number;
}

// ---------- webhook status (external|internal/webhook-status.php) — CONFIRMED live Nov 12 2026 ----------
export type WebhookSource = 'link' | 'verify' | 'ad';
export interface WebhookEntry {
  source: WebhookSource;
  url: string;
  events: string[] | null; // null for verify/ad (fixed single event, not tracked as a list) — not yet observed null live
  is_active: boolean | null; // null for verify/ad — not yet observed null live
  failure_count: number | null; // null for verify/ad — not yet observed null live
  last_triggered_at: string | null;
  created_at: string;
}
export interface WebhookStatusResponse {
  ok: true;
  webhooks: WebhookEntry[];
}

// ---------- members get (external/member.php) — CONFIRMED live Nov 12 2026 ----------
export interface ExternalMemberDetail {
  id: number;
  name: string;
  email: string;
  username: string;
  joined_at: string;
  last_active: string;
  messages_sent: number;
  has_mpin: boolean;
}
export interface MemberGetResponse {
  ok: true;
  member: ExternalMemberDetail;
}

// ---------- escalation list / get (external/escalations.php) — CONFIRMED live Nov 12 2026 ----------
export type EscalationStatus = 'open' | 'in_progress' | 'resolved';
export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';
export interface EscalationMatter {
  uuid: string;
  title: string;
  description: string;
  status: EscalationStatus;
  priority: EscalationPriority;
  due_date: string;
  resolved_at: string | null;
  comment_count: number;
  last_activity_at: string;
  created_at: string;
  target_username: string;
}
export interface EscalationListResponse {
  ok: true;
  matters: EscalationMatter[];
  total: number;
  page: number;
  pages: number;
}

// ---------- link list (link/list) — CONFIRMED live Nov 12 2026 ----------
// `pagination` is present ONLY when --limit/--offset are passed (confirmed live: a call with
// --limit 2 returned it, a call with neither omitted it entirely — not merely null/undefined).
export interface LinkConnection {
  crm_email: string;
  link_type: string; // seen: "external" — "internal" presumably exists, not yet observed
  username: string;
  status: string; // seen: "approved" — other values (pending, denied, expired?) not yet observed
  linked_at: string;
}
export interface LinkListPagination {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}
export interface LinkListResponse {
  ok: true;
  links: LinkConnection[];
  pagination?: LinkListPagination;
}


// ---------- link revoke (link/revoke) — CONFIRMED live Nov 14 2026 ----------
// Always {ok:true} on success -- identical on first revoke, repeat revoke, and unknown
// external_ref (no distinguishing response, by design, so nothing is probeable).
export interface LinkRevokeResponse {
  ok: true;
}
