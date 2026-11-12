import { Command } from 'commander';
import { proxy, MAX_LIST_LIMIT } from '../api/client.js';
import { fail, printJson } from '../output.js';
import type { StatusResponse, WebhookStatusResponse, EscalationListResponse } from '../api/responses.js';

function teamOpt(cmd: Command): Command {
  return cmd.option('--team <idOrSlug>', 'team id or slug — only needed if the workspace has more than one eligible team');
}

export function registerMiscCommands(program: Command): void {
  // ---- Escalation (External surface) ----
  const escalation = program.command('escalation').description('Raise and read escalation matters against team members');

  teamOpt(
    escalation
      .command('raise')
      .description('Raise an escalation matter against a team member')
      .requiredOption('--email <email>')
      .requiredOption('--title <text>', 'min 2 characters')
      .requiredOption('--description <text>')
      .requiredOption('--due-date <YYYY-MM-DD>', 'must be strictly after today')
      .option('--priority <level>', 'low|medium|high|critical', 'medium'),
  ).action(
    async (opts: { email: string; title: string; description: string; dueDate: string; priority: string; team?: string }) => {
      try {
        const body = await proxy('external/escalation', {
          method: 'POST',
          team: opts.team,
          json: {
            email: opts.email,
            title: opts.title,
            description: opts.description,
            due_date: opts.dueDate,
            priority: opts.priority,
          },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    },
  );

  teamOpt(
    escalation
      .command('list')
      .description('List escalation matters raised against this team\'s members (scoped to matters your key can see)')
      .option('--page <n>', 'page number', '1')
      .option('--limit <n>', `1-${MAX_LIST_LIMIT} (default 50)`, '50')
      .option('--status <status>', 'open|in_progress|resolved'),
  ).action(async (opts: { page: string; limit: string; status?: string; team?: string }) => {
    try {
      const body = await proxy<EscalationListResponse>('external/escalations', {
        method: 'GET',
        team: opts.team,
        query: { page: opts.page, limit: opts.limit, status: opts.status },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    escalation
      .command('get')
      .description('Fetch a single escalation matter by id')
      .requiredOption('--matter-id <id>'),
  ).action(async (opts: { matterId: string; team?: string }) => {
    try {
      const body = await proxy('external/escalations', { method: 'GET', team: opts.team, query: { matter_id: opts.matterId } });
      // NOTE: --matter-id passes `matter_id`, but EscalationMatter's real key is `uuid`, not
      // `matter_id` — this command's query param naming vs. the confirmed response shape hasn't
      // been reconciled/tested this session (list, not get, is what was pulled live), so the
      // response here stays untyped (proxy()'s default) until a real --matter-id call is tested.
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  // ---- Status (key context + usage — External and Internal surfaces) ----
  teamOpt(
    program
      .command('status')
      .description('Key context + usage for this team (External surface) — real-only member counts and rate-limit usage')
      .option('--internal', 'use the Internal surface instead (no guest-role filter)'),
  ).action(async (opts: { internal?: boolean; team?: string }) => {
    try {
      const body = await proxy<StatusResponse | Record<string, unknown>>(opts.internal ? 'internal/status' : 'external/status', {
        method: 'GET',
        team: opts.team,
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  // ---- Webhook health (External and Internal surfaces) ----
  teamOpt(
    program
      .command('webhooks')
      .description('Health of this team\'s webhooks (a webhook auto-disables after 10 consecutive non-2xx deliveries)')
      .option('--internal', 'use the Internal surface instead'),
  ).action(async (opts: { internal?: boolean; team?: string }) => {
    try {
      const body = await proxy<WebhookStatusResponse | Record<string, unknown>>(
        opts.internal ? 'internal/webhook-status' : 'external/webhook-status',
        {
          method: 'GET',
          team: opts.team,
        },
      );
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });
}
