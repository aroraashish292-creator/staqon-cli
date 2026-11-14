import { Command } from 'commander';
import { proxy } from '../api/client.js';
import { fail, printJson } from '../output.js';
import type { LinkListResponse, LinkRevokeResponse } from '../api/responses.js';

/**
 * Link ("Link my workspace with StaqOn") -- unlike every other command family, this one has no
 * --team option: Link is one connection per WORKSPACE, not per team, and the server resolves the
 * workspace's single active Link key on its own (cli-proxy.php's 'link' family branch). The CLI
 * never holds, signs, or sees link_keys.secret -- the server signs on the workspace's behalf.
 */
export function registerLinkCommands(program: Command): void {
  const link = program.command('link').description('Invite a customer to link with your workspace, list who already has, or revoke one');

  link
    .command('invite')
    .description('Send a single-use Link invite to a customer by email -- returns a token/short code/confirm URL for you to deliver yourself')
    .requiredOption('--email <email>')
    .requiredOption('--external-ref <ref>', 'your own customer reference -- max 255 characters; a new invite for the same ref supersedes an older pending one')
    .action(async (opts: { email: string; externalRef: string }) => {
      try {
        const body = await proxy('link/invite', {
          method: 'POST',
          json: { email: opts.email, external_ref: opts.externalRef },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    });

  link
    .command('list')
    .description('List your workspace\'s approved Link connections (customer email, StaqOn username, when they linked)')
    .option('--limit <n>', 'page size, 1-200 (omit --limit and --offset together to get the full unpaginated list)')
    .option('--offset <n>', 'rows to skip (requires --limit)')
    .action(async (opts: { limit?: string; offset?: string }) => {
      try {
        const body = await proxy<LinkListResponse>('link/list', {
          method: 'GET',
          query: { limit: opts.limit, offset: opts.offset },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    });

  link
    .command('revoke')
    .description('Revoke an approved Link connection by the external ref you invited them with -- also expires any still-pending invite for that ref, so an old unconfirmed token can\'t bring it back')
    .requiredOption('--external-ref <ref>', 'the customer reference you used when inviting them')
    .action(async (opts: { externalRef: string }) => {
      try {
        const body = await proxy<LinkRevokeResponse>('link/revoke', {
          method: 'POST',
          json: { external_ref: opts.externalRef },
        });
        printJson(body);
      } catch (e) {
        fail(e);
      }
    });
}