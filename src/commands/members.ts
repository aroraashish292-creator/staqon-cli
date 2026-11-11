import { Command } from 'commander';
import { proxy, MAX_LIST_LIMIT } from '../api/client.js';
import { fail, printJson, ok } from '../output.js';

function teamOpt(cmd: Command): Command {
  return cmd.option('--team <idOrSlug>', 'team id or slug — only needed if the workspace has more than one eligible team');
}

export function registerMemberCommands(program: Command): void {
  const members = program.command('members').description('Manage external team members');

  teamOpt(
    members
      .command('list')
      .description('List this team\'s external (guest) members')
      .option('--page <n>', 'page number', '1')
      .option('--limit <n>', `page size, 1-${MAX_LIST_LIMIT} (default 50)`, '50')
      .option('--search <text>', 'match against name or email'),
  ).action(async (opts: { page: string; limit: string; search?: string; team?: string }) => {
    try {
      const body = await proxy('external/members', {
        method: 'GET',
        team: opts.team,
        query: { page: opts.page, limit: opts.limit, search: opts.search },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    members
      .command('get')
      .description('Get one external member, by email or member_id')
      .option('--email <email>')
      .option('--member-id <id>'),
  ).action(async (opts: { email?: string; memberId?: string; team?: string }) => {
    try {
      const body = await proxy('external/member', {
        method: 'GET',
        team: opts.team,
        query: { email: opts.email, member_id: opts.memberId },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    members
      .command('add')
      .description('Add (or re-add) a member to this external team')
      .requiredOption('--name <name>')
      .requiredOption('--email <email>'),
    // NOTE: no --phone flag. add-member.php's request schema is {name, email} only (both
    // required) — verified against openapi.yaml this session. The old CLI sent a --phone
    // value the server silently ignored; that flag is dropped here rather than kept as a
    // no-op, so nobody mistakes it for working.
  ).action(async (opts: { name: string; email: string; team?: string }) => {
    try {
      const body = await proxy('external/add-member', {
        method: 'POST',
        team: opts.team,
        json: { name: opts.name, email: opts.email },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    members
      .command('remove')
      .description('Remove a member from this external team (archives their thread; history kept)')
      .requiredOption('--email <email>'),
  ).action(async (opts: { email: string; team?: string }) => {
    try {
      const body = await proxy('external/remove-member', {
        method: 'POST',
        team: opts.team,
        json: { email: opts.email },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    members
      .command('teams')
      .description('Which external teams has a linked member joined? (looked up by external_ref)')
      .requiredOption('--external-ref <ref>', 'the external_ref originally sent to link-invite'),
  ).action(async (opts: { externalRef: string; team?: string }) => {
    try {
      const body = await proxy('external/member-teams', {
        method: 'GET',
        team: opts.team,
        query: { external_ref: opts.externalRef },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  // Internal-surface member listing — same family, different endpoint/scope (no guest filter, reports role not message stats).
  teamOpt(
    program
      .command('internal-members')
      .description('List this key\'s internal team members (role-based, no external thread stats)')
      .option('--page <n>', 'page number', '1')
      .option('--limit <n>', `page size, 1-${MAX_LIST_LIMIT} (default 50)`, '50')
      .option('--search <text>', 'match against name, email or username'),
  ).action(async (opts: { page: string; limit: string; search?: string; team?: string }) => {
    try {
      const body = await proxy('internal/members', {
        method: 'GET',
        team: opts.team,
        query: { page: opts.page, limit: opts.limit, search: opts.search },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });
}
