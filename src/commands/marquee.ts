import { Command } from 'commander';
import { proxy } from '../api/client.js';
import { fail, printJson } from '../output.js';

export function registerMarqueeCommands(program: Command): void {
  const marquee = program.command('marquee').description('Scrolling marquee line at the top of a team\'s StaqOn — set a team broadcast or target one member');

  marquee
    .command('set')
    .description('Set the marquee line — omit --username for the team broadcast, pass it to target one member (replaces that target\'s prior line, no stacking, no expiry)')
    .requiredOption('--message <text>', 'plain text, max 200 words / 1500 characters — HTML tags are rejected')
    .requiredOption('--team <idOrSlug>', 'team id or slug — the team this marquee line applies to')
    .option('--username <username>', 'target one current member of this team; omit to set the team broadcast')
    .option('--internal', 'use the Internal surface instead of External (the key must be paired to a matching team type)')
    .action(async (opts: { message: string; team: string; username?: string; internal?: boolean }) => {
      try {
        const body = await proxy(opts.internal ? 'internal/marquee' : 'external/marquee', {
          method: 'POST',
          team: opts.team,
          json: { action: 'set', message: opts.message, username: opts.username },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    });

  marquee
    .command('clear')
    .description('Clear the marquee line — omit --username to clear the team broadcast, pass it to clear one member\'s line (idempotent: clearing an already-clear line still succeeds)')
    .requiredOption('--team <idOrSlug>', 'team id or slug — the team this marquee line applies to')
    .option('--username <username>', 'clear one member\'s line; omit to clear the team broadcast')
    .option('--internal', 'use the Internal surface instead of External')
    .action(async (opts: { team: string; username?: string; internal?: boolean }) => {
      try {
        const body = await proxy(opts.internal ? 'internal/marquee' : 'external/marquee', {
          method: 'POST',
          team: opts.team,
          json: { action: 'clear', username: opts.username },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    });
}