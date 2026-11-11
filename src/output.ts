import { StaqOnApiError } from './api/client.js';

export function ok(message: string): void {
  console.log(message);
}

/**
 * Set once, at startup, from the global `--json` flag (see index.ts). When on, every failure prints
 * one machine-readable line to stderr instead of the human "Error: ..." text, so an unattended caller
 * never has to parse prose to find out what went wrong.
 */
let jsonErrors = false;
export function setJsonErrors(on: boolean): void {
  jsonErrors = on;
}

/**
 * Exit codes, stable across releases so a script can branch on them without reading error text:
 *   3 = not signed in / session missing, expired or revoked (re-run `staqon login`)
 *   4 = rate limited (see retry_after)
 *   5 = team or key problem (no eligible key, or several — needs --team; a key at its own limit)
 *   6 = consent missing (the target member hasn'\''t approved the relevant link/API-messages)
 *   1 = anything else (validation errors, network errors, bugs)
 */
function exitCodeFor(e: StaqOnApiError): number {
  if (e.status === 401) return 3;
  if (e.status === 429) return 4;
  if (e.status === 403 || e.status === 409) {
    const text = `${e.message} ${JSON.stringify(e.body)}`.toLowerCase();
    if (
      text.includes('no approved link') ||
      text.includes('has not approved') ||
      text.includes('not opted') ||
      text.includes('link is not set up') ||
      text.includes('consent')
    ) {
      return 6;
    }
    if (
      text.includes('team_required') ||
      text.includes('no_key') ||
      text.includes('team') ||
      text.includes('rate limit') ||
      text.includes('key_ceiling')
    ) {
      return 5;
    }
  }
  return 1;
}

export function fail(e: unknown): never {
  if (e instanceof StaqOnApiError) {
    const code = exitCodeFor(e);
    if (jsonErrors) {
      console.error(
        JSON.stringify({
          ok: false,
          status: e.status,
          error: e.message,
          ...(e.retryAfter !== undefined ? { retry_after: e.retryAfter } : {}),
          ...(Object.keys(e.body).length
            ? { detail: Object.fromEntries(Object.entries(e.body).filter(([k]) => k !== 'error' && k !== 'ok')) }
            : {}),
        }),
      );
    } else {
      console.error(`Error: ${e.message}`);
      if (Object.keys(e.body).length) {
        const extra = Object.fromEntries(Object.entries(e.body).filter(([k]) => k !== 'error' && k !== 'ok'));
        if (Object.keys(extra).length) console.error(JSON.stringify(extra, null, 2));
      }
    }
    process.exit(code);
  } else if (e instanceof Error) {
    if (jsonErrors) console.error(JSON.stringify({ ok: false, status: 0, error: e.message }));
    else console.error(`Error: ${e.message}`);
  } else {
    if (jsonErrors) console.error(JSON.stringify({ ok: false, status: 0, error: String(e) }));
    else console.error('Error:', e);
  }
  process.exit(1);
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
