import { Command } from 'commander';
import { proxy } from '../api/client.js';
import { fail, printJson } from '../output.js';

function teamOpt(cmd: Command): Command {
  return cmd.option('--team <idOrSlug>', 'team id or slug — only needed if the workspace has more than one eligible team');
}

export function registerVerifyCommands(program: Command): void {
  const verify = program.command('verify').description('e-StaqOn Verify — ask a member to push-approve a sensitive action');

  teamOpt(
    verify
      .command('start')
      .description('Ask a member to confirm a sensitive action (push approval) — requires an approved, unexpired consent link')
      .requiredOption('--username <username>')
      .requiredOption('--action <text>', 'short label, max 100 chars')
      .requiredOption('--context <text>', 'what the member is approving — shown to them verbatim, max 500 chars')
      .option('--ttl <seconds>', 'how long the request stays open, 30-180 (default 30; out-of-range is clamped, not rejected)'),
  ).action(
    async (opts: { username: string; action: string; context: string; ttl?: string; team?: string }) => {
      try {
        const body = await proxy('external/staqon-verify-start', {
          method: 'POST',
          team: opts.team,
          json: {
            username: opts.username,
            action: opts.action,
            context: opts.context,
            ttl_seconds: opts.ttl ? Number(opts.ttl) : undefined,
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
      .requiredOption('--id <verification_id>'),
  ).action(async (opts: { id: string; team?: string }) => {
    try {
      const body = await proxy('external/staqon-verify-check', {
        method: 'POST',
        team: opts.team,
        json: { verification_id: opts.id },
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
