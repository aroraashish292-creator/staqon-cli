#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerMemberCommands } from './commands/members.js';
import { registerMessagingCommands } from './commands/messaging.js';
import { registerVerifyCommands } from './commands/verify.js';
import { registerAdCommands } from './commands/ad.js';
import { registerMiscCommands } from './commands/misc.js';
import { registerLinkCommands } from './commands/link.js';
import { registerWebhookCommands } from './commands/webhook.js';
import { registerMarqueeCommands } from './commands/marquee.js';
import { setJsonErrors } from './output.js';

// Read the version from package.json rather than hardcoding it here, so `staqon --version`
// always matches what was actually published.
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const program = new Command();

program
  .name('staqon')
  .description(
    'Command-line tool for a StaqOn workspace owner. Sign in with `staqon login` — a device-pairing ' +
      'flow approved from your StaqOn dashboard. The CLI never holds or sees a raw API key.',
  )
  .version(pkg.version)
  .option(
    '--json',
    'on any failure, print one machine-readable JSON line to stderr ({"ok":false,"status":...,"error":...}) ' +
      'instead of "Error: ...", and use stable exit codes (3 = not signed in, 4 = rate limited, 5 = team/key ' +
      'problem, 6 = consent missing, 1 = anything else) -- for scripts and unattended use.',
  );

program.hook('preAction', () => {
  setJsonErrors(Boolean(program.opts().json));
});

registerAuthCommands(program);
registerMemberCommands(program);
registerMessagingCommands(program);
registerVerifyCommands(program);
registerAdCommands(program);
registerMiscCommands(program);
registerLinkCommands(program);
registerWebhookCommands(program);
registerMarqueeCommands(program);

program.parseAsync(process.argv).catch((e) => {
  console.error('Error:', e instanceof Error ? e.message : e);
  process.exit(1);
});