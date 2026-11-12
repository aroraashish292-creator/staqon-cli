import { Command } from 'commander';
import { proxy } from '../api/client.js';
import { fail, printJson } from '../output.js';

function teamOpt(cmd: Command): Command {
  return cmd.option('--team <idOrSlug>', 'team id or slug — only needed if the workspace has more than one eligible team');
}

// webhook-status/webhook-configure each serve EITHER a message-purpose key's Verify webhook or an
// ad-purpose key's Ad-completion webhook -- the server resolves two distinct CLI endpoint names per
// command (one per purpose) since a CLI token's own candidate-key resolution is purpose-fixed. This
// file picks the right pair based on --purpose (default 'message', since Verify is the common case
// --wait/verify commands already use); pass --purpose ad to act on an Ad-purpose key's webhook instead.
function epFor(base: 'webhook-status' | 'webhook-configure', purpose: string): string {
  if (purpose === 'ad') return `external/ad-${base}`;
  return `external/${base}`;
}

export function registerWebhookCommands(program: Command): void {
  const webhook = program.command('webhook').description('Check or configure a key\'s outbound webhook (e-StaqOn Verify or Advertisement completion)');

  function purposeOpt(cmd: Command): Command {
    return cmd.option('--purpose <message|ad>', 'which key\'s webhook to act on (default: message, i.e. the e-StaqOn Verify webhook)', 'message');
  }

  teamOpt(purposeOpt(
    webhook
      .command('status')
      .description('List this key\'s webhooks and their health — the workspace Link webhook plus this key\'s own Verify/Ad webhook, if set'),
  )).action(async (opts: { team?: string; purpose: string }) => {
    try {
      if (!['message', 'ad'].includes(opts.purpose)) fail(new Error('--purpose must be "message" or "ad"'));
      const body = await proxy(epFor('webhook-status', opts.purpose), { method: 'GET', team: opts.team });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(purposeOpt(
    webhook
      .command('set-url')
      .description('Set or change this key\'s webhook URL. First time a URL is ever set, a new signing secret is generated and shown once.')
      .option('--url <url>', 'must be https:// (or http://), publicly reachable — no loopback/private/reserved addresses')
      .option('--clear', 'remove this key\'s webhook (clears both the URL and the secret) — use instead of --url with an empty value, which Commander treats as no value at all'),
  )).action(async (opts: { team?: string; purpose: string; url?: string; clear?: boolean }) => {
    try {
      if (!['message', 'ad'].includes(opts.purpose)) fail(new Error('--purpose must be "message" or "ad"'));
      if (opts.clear && opts.url) fail(new Error('Use either --url or --clear, not both.'));
      if (!opts.clear && !opts.url) fail(new Error('Pass --url <url>, or --clear to remove the webhook.'));
      const body = await proxy(epFor('webhook-configure', opts.purpose), {
        method: 'POST',
        team: opts.team,
        json: { url: opts.clear ? '' : opts.url },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(purposeOpt(
    webhook
      .command('rotate')
      .description('Rotate this key\'s webhook signing secret. Takes effect immediately for new deliveries — there is no grace period on StaqOn\'s own signing side. Requires a URL to already be set.'),
  )).action(async (opts: { team?: string; purpose: string }) => {
    try {
      if (!['message', 'ad'].includes(opts.purpose)) fail(new Error('--purpose must be "message" or "ad"'));
      const body = await proxy(epFor('webhook-configure', opts.purpose), {
        method: 'POST',
        team: opts.team,
        json: { action: 'rotate' },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  // Internal surface: always message-purpose (Internal never issues Ad-purpose keys), so no
  // --purpose option here -- a separate top-level command, matching the External/Internal split
  // every other surface-specific command pair already uses (messages vs internal-message).
  const internalWebhook = program.command('internal-webhook').description('Check or configure an internal key\'s e-StaqOn Verify webhook');

  teamOpt(
    internalWebhook
      .command('status')
      .description('List this internal key\'s webhooks and their health — the workspace\'s Internal Link webhook plus this key\'s own Verify webhook, if set'),
  ).action(async (opts: { team?: string }) => {
    try {
      const body = await proxy('internal/webhook-status', { method: 'GET', team: opts.team });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    internalWebhook
      .command('set-url')
      .description('Set or change this internal key\'s Verify webhook URL. First time a URL is ever set, a new signing secret is generated and shown once.')
      .option('--url <url>', 'must be https:// (or http://), publicly reachable — no loopback/private/reserved addresses')
      .option('--clear', 'remove this key\'s webhook (clears both the URL and the secret) — use instead of --url with an empty value, which Commander treats as no value at all'),
  ).action(async (opts: { team?: string; url?: string; clear?: boolean }) => {
    try {
      if (opts.clear && opts.url) fail(new Error('Use either --url or --clear, not both.'));
      if (!opts.clear && !opts.url) fail(new Error('Pass --url <url>, or --clear to remove the webhook.'));
      const body = await proxy('internal/webhook-configure', {
        method: 'POST',
        team: opts.team,
        json: { url: opts.clear ? '' : opts.url },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    internalWebhook
      .command('rotate')
      .description('Rotate this internal key\'s webhook signing secret. Takes effect immediately — requires a URL to already be set.'),
  ).action(async (opts: { team?: string }) => {
    try {
      const body = await proxy('internal/webhook-configure', {
        method: 'POST',
        team: opts.team,
        json: { action: 'rotate' },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });
}
