import { Command } from 'commander';
import { proxy } from '../api/client.js';
import { fail, printJson } from '../output.js';

export function registerMarqueeCommands(program: Command): void {
  const marquee = program
    .command('marquee')
    .description(
      'Scrolling marquee line at the top of StaqOn — a workspace-level passive strip shown to the whole surface (broadcast) or to one member (--username). ' +
        'One marquee key covers every team on its surface; there is no team targeting, and the line never appears inside a chat window.',
    );

  marquee
    .command('set')
    .description('Set the marquee line — omit --username for the surface-wide broadcast, pass it to target one member (replaces that target\'s prior line, no stacking, no expiry)')
    .requiredOption('--message <text>', 'plain text, max 200 words / 1500 characters — HTML tags are rejected')
    .option('--username <username>', 'target one member; omit to broadcast to the whole surface')
    .option('--internal', 'use the Internal surface instead of External')
    .action(async (opts: { message: string; username?: string; internal?: boolean }) => {
      try {
        const body = await proxy(opts.internal ? 'internal/marquee' : 'external/marquee', {
          method: 'POST',
          json: { action: 'set', message: opts.message, username: opts.username },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    });

  marquee
    .command('clear')
    .description('Clear the marquee line — omit --username to clear the surface-wide broadcast, pass it to clear one member\'s line (idempotent: clearing an already-clear line still succeeds)')
    .option('--username <username>', 'clear one member\'s line; omit to clear the broadcast')
    .option('--internal', 'use the Internal surface instead of External')
    .action(async (opts: { username?: string; internal?: boolean }) => {
      try {
        const body = await proxy(opts.internal ? 'internal/marquee' : 'external/marquee', {
          method: 'POST',
          json: { action: 'clear', username: opts.username },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    });
}
