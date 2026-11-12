import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';

/**
 * Shared `--card` / `--card-file` option pair, used by `messages comment`,
 * `internal-message`, and `verify start` (see README.md "Cards" section).
 *
 * The CLI deliberately does NOT re-validate a card's fields against the
 * server's own rules (allowed header_color values, max lengths, table
 * limits, etc.) — it only checks that what was passed parses as a plain
 * JSON object, then forwards it as-is. A rejected card comes back with the
 * server's own specific error message unchanged.
 */
export function cardOpt(cmd: Command): Command {
  return cmd
    .option('--card <json>', 'inline JSON card object (see README "Cards" section)')
    .option(
      '--card-file <path>',
      'path to a JSON file containing the card object — prefer this over --card on Windows/PowerShell, where inline JSON with embedded quotes can get mangled',
    );
}

/**
 * Reads --card / --card-file (mutually exclusive) and returns the parsed
 * card object, or undefined if neither was passed.
 *
 * Throws a plain Error (caught by each command's own fail(e) handler) if:
 *  - both --card and --card-file were given
 *  - the JSON doesn't parse
 *  - the JSON parses but isn't a plain object (e.g. an array, a string, null)
 */
export async function parseCardOpt(opts: { card?: string; cardFile?: string }): Promise<Record<string, unknown> | undefined> {
  if (opts.card && opts.cardFile) {
    throw new Error('Use either --card or --card-file, not both.');
  }

  let raw: string | undefined;
  if (opts.cardFile) {
    try {
      raw = await readFile(opts.cardFile, 'utf8');
    } catch (e) {
      throw new Error(`Could not read --card-file "${opts.cardFile}": ${(e as Error).message}`);
    }
  } else if (opts.card) {
    raw = opts.card;
  }

  if (raw === undefined) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`--card${opts.cardFile ? '-file' : ''} is not valid JSON: ${(e as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Card must be a JSON object, e.g. {"header_color": "...", "title": "...", "body": "..."}');
  }

  return parsed as Record<string, unknown>;
}
