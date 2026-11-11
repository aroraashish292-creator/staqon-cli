#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerMemberCommands } from './commands/members.js';
import { registerMessagingCommands } from './commands/messaging.js';
import { registerVerifyCommands } from './commands/verify.js';
import { registerAdCommands } from './commands/ad.js';
import { registerMiscCommands } from './commands/misc.js';

const program = new Command();

program
  .name('staqon')
  .description(
    'Command-line tool for a StaqOn workspace owner. Sign in with `staqon login` — a device-pairing ' +
      'flow approved from your StaqOn dashboard. The CLI never holds or sees a raw API key.',
  )
  .version('0.1.0');

registerAuthCommands(program);
registerMemberCommands(program);
registerMessagingCommands(program);
registerVerifyCommands(program);
registerAdCommands(program);
registerMiscCommands(program);

program.parseAsync(process.argv).catch((e) => {
  console.error('Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
