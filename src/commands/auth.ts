import { Command } from 'commander';
import { login, logout } from '../auth.js';
import { whoami as fetchWhoami } from '../api/client.js';
import { ok, fail } from '../output.js';

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description('Pair this computer with a StaqOn workspace (device-code flow — no API key needed)')
    .option('--label <name>', 'a name for this computer, shown to the workspace owner when they approve')
    .action(async (opts: { label?: string }) => {
      try {
        const { workspace } = await login(opts.label);
        ok(`Paired with workspace "${workspace.name}" (${workspace.slug}).`);
      } catch (e) {
        fail(e);
      }
    });

  program
    .command('logout')
    .description('Forget this computer\'s paired session (does not revoke it on the server — use the dashboard for that)')
    .action(async () => {
      await logout();
      ok('Logged out locally. The server-side session, if still live, can be revoked from the workspace\'s CLI access page.');
    });

  program
    .command('whoami')
    .description('Show the paired workspace, session info, rate-limit usage, and which commands are available')
    .action(async () => {
      try {
        const body = await fetchWhoami();
        console.log(JSON.stringify(body, null, 2));
      } catch (e) {
        fail(e);
      }
    });
}
