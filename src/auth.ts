import { BASE_URL, saveSession, clearSession, loadSession } from './config.js';

const CLI_VERSION = '0.1.0'; // keep in sync with package.json

interface CodeRequestResponse {
  ok: true;
  pair_id: string;
  code: string;              // shown as "XXXX-XXXX"
  verification_url: string;
  poll_secret: string;
  expires_in: number;        // seconds (600 server-side, i.e. 10 min)
  interval: number;          // seconds between polls (3 server-side)
}

type PollStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'consumed';

interface PollResponse {
  ok: boolean;
  status: PollStatus;
  token?: string;            // present only on the one successful 'approved' poll — shown once
  workspace?: { id: number; slug: string; name: string };
  expires_at?: string;
  error?: string;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/cli-pair.php?action=${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok || (data as { ok?: boolean }).ok === false) {
    throw new Error((data as { error?: string }).error ?? `Login failed (HTTP ${res.status})`);
  }
  return data;
}

function osLabel(): string {
  const p = process.platform;
  if (p === 'darwin') return 'macOS';
  if (p === 'win32') return 'Windows';
  if (p === 'linux') return 'Linux';
  return p;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Device-pairing login, matching api/cli-pair.php exactly:
 *   1. code_request -> {pair_id, code, verification_url, poll_secret, expires_in, interval}
 *   2. show the code + verification_url to the user
 *   3. poll {pair_id, poll_secret} every `interval` seconds until approved/denied/expired
 *   4. on 'approved', the token is minted and returned EXACTLY ONCE on that poll response —
 *      save it immediately; a repeat poll after that returns 'consumed', not the token again.
 *
 * No API key is ever involved. The workspace owner approves the device at
 * <verification_url> (StaqOn's own /cli page), picking which workspace and,
 * if their web session is stale, re-entering their MPIN — all server-side.
 */
export async function login(deviceLabel?: string): Promise<{ workspace: { id: number; slug: string; name: string } }> {
  const label = deviceLabel ?? `${osLabel()} computer`;

  const start = await postJson<CodeRequestResponse>('code_request', {
    device_label: label,
    os: osLabel(),
    cli_version: CLI_VERSION,
  });

  console.log('');
  console.log(`  To finish signing in, visit: ${start.verification_url}`);
  console.log(`  And enter this code: ${start.code}`);
  console.log('');
  console.log('  Waiting for approval (this code expires in 10 minutes)...');

  const deadline = Date.now() + start.expires_in * 1000;
  const intervalMs = Math.max(start.interval, 1) * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const poll = await postJson<PollResponse>('poll', {
      pair_id: start.pair_id,
      poll_secret: start.poll_secret,
    });

    if (poll.status === 'pending') continue;

    if (poll.status === 'approved' && poll.token && poll.workspace) {
      await saveSession({
        token: poll.token,
        workspace: poll.workspace,
        expires_at: poll.expires_at ?? '',
        paired_at: new Date().toISOString(),
      });
      return { workspace: poll.workspace };
    }

    if (poll.status === 'denied') throw new Error('Login request was denied.');
    if (poll.status === 'expired') throw new Error('Login code expired. Run: staqon login');
    if (poll.status === 'consumed') throw new Error('This login code was already used. Run: staqon login');

    throw new Error(poll.error ?? `Unexpected login status: ${poll.status}`);
  }

  throw new Error('Login timed out. Run: staqon login');
}

/**
 * Rotates the current session token via ?action=refresh. The OLD token
 * stays valid for 5 more minutes server-side (CLI_ROTATE_GRACE=300), so a
 * failed save here doesn't strand the user mid-rotation.
 */
export async function refresh(): Promise<void> {
  const session = await loadSession();
  if (!session) throw new Error('Not logged in. Run: staqon login');

  const res = await fetch(`${BASE_URL}/api/cli-pair.php?action=refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = (await res.json()) as { ok: boolean; token?: string; error?: string };
  if (!res.ok || !data.ok || !data.token) {
    throw new Error(data.error ?? 'Could not refresh. Run: staqon login');
  }
  await saveSession({ ...session, token: data.token });
}

export async function logout(): Promise<void> {
  await clearSession();
}
