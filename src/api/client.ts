import { BASE_URL, loadSession, saveSession, clearSession } from '../config.js';

export class StaqOnApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
    public retryAfter?: number,
  ) {
    super(typeof body.error === 'string' ? body.error : `HTTP ${status}`);
  }
}

/**
 * The real, server-enforced ceiling for every paginated CLI list endpoint
 * (members.php, internal/members.php, messages.php): Swagger says
 * `maximum: 200` on all three. The OLD cli had a client-side MAX_LIST_LIMIT
 * of 100 — that was a self-imposed, unnecessarily tight cap, not a server
 * fact. Verified against openapi.yaml this session (Nov 11 2026).
 */
export const MAX_LIST_LIMIT = 200;

interface CallOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  json?: Record<string, unknown>;
  team?: string; // X-StaqOn-Team — only needed when a workspace has 2+ eligible teams for that command's family
}

function buildQuery(params: Record<string, string | number | undefined> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * The CLI's ONE front door, matching /api/v1/cli-proxy.php exactly:
 *   GET|POST /api/v1/cli-proxy.php?_ep=<name>&...their own query
 *   Authorization: Bearer stq_cli_<64 hex>
 *   X-StaqOn-Team: <team id or slug>   (only when the workspace has >1 eligible team)
 * Never sends X-API-Key — the proxy drops it server-side anyway; the CLI
 * never holds, or needs, a raw tenant key.
 *
 * Generic over its return type `T` (default: the old untyped
 * Record<string, unknown>, so any existing call site that doesn't supply a
 * type parameter keeps compiling and behaving exactly as before). Callers
 * that know their endpoint's real response shape pass it explicitly, e.g.
 * `proxy<AdSendResponse>('external/ad', {...})` — see api/responses.ts for
 * the full set of shapes, each one transcribed from a real server response
 * confirmed live this session (Nov 2026), not invented from the endpoint's
 * name. This is a compile-time-only annotation: the server's actual JSON is
 * trusted as-is and not runtime-validated against T.
 */
export async function proxy<T = Record<string, unknown>>(ep: string, opts: CallOptions = {}): Promise<T> {
  const session = await loadSession();
  if (!session) {
    throw new StaqOnApiError(401, { error: 'Not logged in. Run: staqon login' });
  }

  const method = opts.method ?? (opts.json ? 'POST' : 'GET');
  const url = `${BASE_URL}/api/v1/cli-proxy.php${buildQuery({ _ep: ep, ...opts.query })}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.token}`,
  };
  if (opts.team) headers['X-StaqOn-Team'] = opts.team;
  if (opts.json) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: opts.json ? JSON.stringify(opts.json) : undefined,
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  // Retry-After is sent as a header on 429s; some 429 bodies also carry retry_after_seconds.
  // Either one ends up on the thrown error so callers (and --json output) can back off correctly.
  const retryAfterHeader = res.headers.get('Retry-After');
  const retryAfter =
    retryAfterHeader != null
      ? Number(retryAfterHeader)
      : typeof body.retry_after_seconds === 'number'
        ? body.retry_after_seconds
        : undefined;

  if (res.status === 401) {
    // Session is gone/expired/revoked server-side — don't leave a dead token lying around locally.
    await clearSession();
    throw new StaqOnApiError(401, {
      error: (body.error as string) ?? 'This CLI session is missing, expired or revoked. Run: staqon login',
    });
  }
  if (!res.ok) throw new StaqOnApiError(res.status, body, retryAfter);
  return body as T;
}

/** `_ep=whoami` — no backing file; the proxy answers directly with session/workspace/limits/access. */
export async function whoami(): Promise<Record<string, unknown>> {
  return proxy('whoami', { method: 'GET' });
}

export { BASE_URL, loadSession, saveSession, clearSession };
