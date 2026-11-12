import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { proxy, BASE_URL, loadSession } from '../api/client.js';
import { fail, printJson } from '../output.js';

function teamOpt(cmd: Command): Command {
  return cmd.option('--team <idOrSlug>', 'team id or slug — only needed if the workspace has more than one eligible team');
}

export function registerAdCommands(program: Command): void {
  const ad = program.command('ad').description('Advertisement API — send a card to every member thread of a team');

  teamOpt(
    ad
      .command('upload-image')
      .description('Upload one banner image (JPEG/PNG/WebP, max 300KB) and get back an image_url for `ad send --image-url`')
      .requiredOption('--file <path>', 'local path to the image'),
  ).action(async (opts: { file: string; team?: string }) => {
    try {
      const session = await loadSession();
      if (!session) throw new Error('Not logged in. Run: staqon login');
      const data = await readFile(opts.file);
      const form = new FormData();
      form.append('image', new Blob([data]), opts.file.split('/').pop() ?? 'image');

      const headers: Record<string, string> = { Authorization: `Bearer ${session.token}` };
      if (opts.team) headers['X-StaqOn-Team'] = opts.team;

      const res = await fetch(`${BASE_URL}/api/v1/cli-proxy.php?_ep=external/ad-image`, {
        method: 'POST',
        headers,
        body: form,
      });
      const body = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`);
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });

  teamOpt(
    ad
      .command('send')
      .description(
        'Queue an ad card to every active thread of the team — asynchronous: returns 202 immediately, poll `ad status` for progress',
      )
      .requiredOption('--body <text>', '50-900 characters')
      .requiredOption('--button-label <text>', '1-30 characters')
      .requiredOption('--button-url <url>', 'must start with https://')
      .option('--image-url <url>', 'from `ad upload-image`, same workspace+team')
      .option('--external-ref <ref>', 'idempotency key — repeating it returns the original send\'s counts, sends nothing twice')
      .option('--dry-run', 'validate everything (card, image ownership, external_ref dedup) and report the real current target-thread count, without queuing anything or using up external_ref'),
  ).action(
    async (opts: {
      body: string;
      buttonLabel: string;
      buttonUrl: string;
      imageUrl?: string;
      externalRef?: string;
      team?: string;
      dryRun?: boolean;
    }) => {
      try {
        const body = await proxy('external/ad', {
          method: 'POST',
          team: opts.team,
          json: {
            body: opts.body,
            button_label: opts.buttonLabel,
            button_url: opts.buttonUrl,
            image_url: opts.imageUrl,
            external_ref: opts.externalRef,
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
    ad
      .command('status')
      .description('Progress or final result of one ad send — look up by external_ref or ad_request_id')
      .option('--external-ref <ref>')
      .option('--request-id <id>'),
  ).action(async (opts: { externalRef?: string; requestId?: string; team?: string }) => {
    if (!opts.externalRef && !opts.requestId) fail(new Error('Pass --external-ref or --request-id.'));
    try {
      const body = await proxy('external/ad-status', {
        method: 'GET',
        team: opts.team,
        query: { external_ref: opts.externalRef, ad_request_id: opts.requestId },
      });
      printJson(body);
    } catch (e) {
      fail(e);
    }
  });
}
