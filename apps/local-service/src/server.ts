import 'dotenv/config';
import { serve } from '@hono/node-server';
import { realpathSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { createServiceApp } from './app.js';
import {
  configureOutlook,
  helpText,
  initializeConfig,
  inspectCompanionReadiness,
  outlookSetupInstructions,
} from './cli.js';
import { createMailboxManager } from './mailbox.js';
import { createPairingManager } from './pairing.js';

const mailbox = createMailboxManager();
const pairing = createPairingManager();
export const app = createServiceApp(undefined, mailbox, pairing);

function isEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(helpText);
  } else if (process.argv.includes('--setup')) {
    const setupIndex = process.argv.indexOf('--setup');
    const provider = process.argv[setupIndex + 1];
    if (provider !== 'outlook') {
      console.error('Usage: contextfill-service --setup outlook [--tenant common]');
      console.error('Gmail setup still uses the private .env flow documented in --help.');
      process.exitCode = 1;
    } else {
      const prompt = createInterface({ input: stdin, output: stdout });
      try {
        console.log(outlookSetupInstructions());
        console.log('');
        const clientId = await prompt.question('Microsoft Application (client) ID: ');
        const tenantIndex = process.argv.indexOf('--tenant');
        const tenant = tenantIndex === -1 ? 'common' : (process.argv[tenantIndex + 1] ?? '');
        const output = await configureOutlook(process.cwd(), clientId, tenant);
        console.log(`Saved Outlook settings to ${output} with owner-only permissions.`);
        const report = await inspectCompanionReadiness(process.cwd(), {
          ...process.env,
          CONTEXTFILL_MICROSOFT_CLIENT_ID: clientId.trim(),
          CONTEXTFILL_MICROSOFT_TENANT: tenant,
        });
        console.log(report.text);
        if (!report.ok) process.exitCode = 1;
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Could not save Outlook setup.');
        process.exitCode = 1;
      } finally {
        prompt.close();
      }
    }
  } else if (process.argv.includes('--doctor')) {
    const report = await inspectCompanionReadiness();
    console.log(report.text);
    if (!report.ok) process.exitCode = 1;
  } else if (process.argv.includes('--init')) {
    try {
      const output = await initializeConfig();
      console.log(`Created ${output} with owner-only permissions.`);
      console.log('Edit the provider settings, then run contextfill-service.');
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? error.code : undefined;
      if (code === 'EEXIST') {
        console.error('.env already exists; ContextFill did not overwrite it.');
      } else {
        console.error('Could not create .env.');
      }
      process.exitCode = 1;
    }
  } else {
    const port = Number(process.env.CONTEXTFILL_SERVICE_PORT || 4318);
    const pairingCode = await pairing.bootstrapCode();
    serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, async (info) => {
      console.log(`ContextFill local service listening on http://127.0.0.1:${info.port}`);
      console.log(
        process.env.OPENAI_API_KEY
          ? 'GPT-5.6 extraction enabled.'
          : 'No API key: extension will use deterministic fallback.',
      );
      const statuses = await mailbox.statuses();
      const configuredMailboxes = statuses
        .filter((status) => status.configured)
        .map((status) => status.provider);
      console.log(
        configuredMailboxes.length > 0
          ? `Mailbox OAuth configured for: ${configuredMailboxes.join(', ')}.`
          : 'No mailbox OAuth client configured; demo inbox remains available.',
      );
      if (pairingCode) {
        console.log(`Pairing code: ${pairingCode} (valid for 10 minutes).`);
      } else if (process.env.CONTEXTFILL_EXTENSION_ID) {
        console.warn('Legacy CONTEXTFILL_EXTENSION_ID pairing is active.');
      }
      if (statuses.some((status) => status.credentialStorage === 'session')) {
        console.warn('OS keychain unavailable; mailbox authorization will be session-only.');
      }
    });
  }
}
