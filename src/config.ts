import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';

export const BASE_URL = process.env.STAQON_BASE_URL ?? 'https://staqon.one';
const CONFIG_DIR = join(homedir(), '.staqon');
const CREDS_PATH = join(CONFIG_DIR, 'credentials.json');

export interface StoredSession {
  token: string;                // stq_cli_<64 hex> — the CLI's own session token, never a tenant API key
  workspace: { id: number; slug: string; name: string };
  expires_at: string;           // informational only; the server is the real authority on expiry
  paired_at: string;
}

async function ensureDir(): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await readFile(CREDS_PATH, 'utf8');
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await ensureDir();
  await writeFile(CREDS_PATH, JSON.stringify(session, null, 2), { mode: 0o600 });
  // writeFile's mode option is only honored on file *creation* on some platforms — enforce it explicitly.
  await chmod(CREDS_PATH, 0o600);
}

export async function clearSession(): Promise<void> {
  await ensureDir();
  try {
    await writeFile(CREDS_PATH, '', { mode: 0o600 });
    await import('node:fs/promises').then((fs) => fs.unlink(CREDS_PATH));
  } catch {
    // already gone — fine
  }
}

export function credentialsPath(): string {
  return CREDS_PATH;
}
