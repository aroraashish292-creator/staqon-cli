import { Command } from 'commander';
import { proxy } from '../api/client.js';
import { fail, printJson } from '../output.js';
import { cardOpt, parseCardOpt } from '../card.js';
import type { VerifyStartDryRunResponse } from '../api/responses.js';

function teamOpt(cmd: Command): Command {
  return cmd.option('--team <idOrSlug>', 'team id or slug — only needed if the workspace has more than one eligible team');
}

export function registerVerifyCommands(program: Command): void {
  const verify = program.command('verify').description('e-StaqOn Verify — ask a member to push-approve a sensitive action');

  teamOpt(
    cardOpt(
      verify
        .command('start')
        .description('Ask a member to confirm a sensitive action (push approval) — requires an approved, unexpired consent link')
        .requiredOption('--username <username>')
        .requiredOption('--action <text>', 'short label, max 100 chars')
        .requiredOption('--context <text>', 'what the member is approving — shown to them verbatim, max 500 chars')
        .option('--ttl <seconds>', 'how long the request stays open, 30-180 (default 30; out-of-range is clamped, not rejected)')
        .option('--dry-run', 'validate everything (member, consent link, card, rate limit) and report the real attempts-used count, without asking the member or using up a rate-limit attempt'),
    ),
  ).action(
    async (opts: {
      username: string;
      action: string;
      context: string;
      ttl?: string;
      card?: string;
      cardFile?: string;
      team?: string;
      dryRun?: boolean;
    }) => {
      try {
        const card = await parseCardOpt(opts);
        if (card !== undefined && typeof card === 'object' && card !== null && 'button' in card) {
          fail(new Error('card.button is not allowed for verification requests (the server rejects it with 400)'));
        }
        const body = await proxy<VerifyStartDryRunResponse | Record<string, unknown>>('external/staqon-verify-start', {
          method: 'POST',
          team: opts.team,
          json: {
            username: opts.username,
            action: opts.action,
            context: opts.context,
            ttl_seconds: opts.ttl ? Number(opts.ttl) : undefined,
            card,
            dry_run: opts.dryRun || undefined,
          },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    },
  );

  teamOpt(
    verify
      .command('check')
      .description('Poll the outcome of a verification request — only verified:true means the member approved in time')
      .requiredOption('--id <verification_id>')
      .option('--wait <seconds>', 'long-poll: hold the connection open while the request is still pending, 0-25 (default 0, instant return)'),
  ).action(async (opts: { id: string; wait?: string; team?: string }) => {
    try {
      let waitSeconds: number | undefined;
      if (opts.wait !== undefined) {
        waitSeconds = Number(opts.wait);
        if (!Number.isFinite(waitSeconds) || waitSeconds < 0 || waitSeconds > 25) {
          fail(new Error('--wait must be a number between 0 and 25'));
          return;
        }
      }
      const body = await proxy('external/staqon-verify-check', {
        method: 'POST',
        team: opts.team,
        json: { verification_id: opts.id, wait_seconds: waitSeconds },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    verify
      .command('cancel')
      .description('Withdraw a pending verification request — a 409 means the member already answered; that answer stands')
      .requiredOption('--id <verification_id>'),
  ).action(async (opts: { id: string; team?: string }) => {
    try {
      const body = await proxy('external/staqon-verify-cancel', {
        method: 'POST',
        team: opts.team,
        json: { verification_id: opts.id },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });
}
