import { Command } from 'commander';
import { proxy, MAX_LIST_LIMIT } from '../api/client.js';
import { fail, printJson } from '../output.js';

function teamOpt(cmd: Command): Command {
  return cmd.option('--team <idOrSlug>', 'team id or slug — only needed if the workspace has more than one eligible team');
}

export function registerMessagingCommands(program: Command): void {
  const messages = program.command('messages').description('Send and read External team member conversations');

  teamOpt(
    messages
      .command('send')
      .description('Send a message into a member\'s thread, as the workspace owner')
      .requiredOption('--email <email>')
      .requiredOption('--message <text>', 'max 60000 characters'),
  ).action(async (opts: { email: string; message: string; team?: string }) => {
    try {
      const body = await proxy('external/message', {
        method: 'POST',
        team: opts.team,
        json: { email: opts.email, message: opts.message },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    messages
      .command('comment')
      .description(
        'Post a comment into a member\'s thread, attributed to the workspace (no consent link needed — writing in is the workspace\'s own authority)',
      )
      .requiredOption('--username <username>')
      .requiredOption('--comment <text>', 'max 60000 characters')
      .option(
        '--external-ref <ref>',
        'idempotency key, max 190 chars — scoped to the WHOLE WORKSPACE, not per recipient; reusing it for a different recipient silently does not reach them',
      ),
  ).action(async (opts: { username: string; comment: string; externalRef?: string; team?: string }) => {
    try {
      const body = await proxy('external/comment', {
        method: 'POST',
        team: opts.team,
        json: { username: opts.username, comment: opts.comment, external_ref: opts.externalRef },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    messages
      .command('read')
      .description('Read a member\'s thread history — requires an APPROVED consent link for that member (403 if not present)')
      .requiredOption('--username <username>')
      .option('--limit <n>', `1-${MAX_LIST_LIMIT} (default 50)`, '50')
      .option('--before <id>', 'message id cursor — older messages, newest-first')
      .option('--after <id>', 'message id cursor — newer messages, oldest-first (mutually exclusive with --before)'),
  ).action(async (opts: { username: string; limit: string; before?: string; after?: string; team?: string }) => {
    if (opts.before && opts.after) fail(new Error('Use either --before or --after, not both.'));
    try {
      const body = await proxy('external/messages', {
        method: 'GET',
        team: opts.team,
        query: { username: opts.username, limit: opts.limit, before: opts.before, after: opts.after },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  // Internal surface: one-way feed push, NOT a conversation (no replies/reactions/attachments).
  // Requires an APPROVED link_type='internal' consent row (stricter than External's write path).
  teamOpt(
    program
      .command('internal-message')
      .description('Push a one-way message into a member\'s API Messages feed (internal surface — requires member consent)')
      .requiredOption('--username <username>')
      .requiredOption('--message <text>', 'max 60000 characters')
      .option('--title <text>', 'max 200 characters')
      .option('--link-url <url>', 'must be http(s)')
      .option('--external-ref <ref>', 'idempotency key, max 190 chars — scoped per API key, not per recipient'),
  ).action(
    async (opts: {
      username: string;
      message: string;
      title?: string;
      linkUrl?: string;
      externalRef?: string;
      team?: string;
    }) => {
      try {
        const body = await proxy('internal/message', {
          method: 'POST',
          team: opts.team,
          json: {
            username: opts.username,
            message: opts.message,
            title: opts.title,
            link_url: opts.linkUrl,
            external_ref: opts.externalRef,
          },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    },
  );
}
