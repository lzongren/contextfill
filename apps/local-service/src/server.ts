import 'dotenv/config';
import { serve } from '@hono/node-server';
import { pathToFileURL } from 'node:url';
import { createServiceApp } from './app.js';
import { createMailboxManager } from './mailbox.js';

const mailbox = createMailboxManager();
export const app = createServiceApp(undefined, mailbox);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.CONTEXTFILL_SERVICE_PORT || 4318);
  serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
    console.log(`ContextFill local service listening on http://127.0.0.1:${info.port}`);
    console.log(
      process.env.OPENAI_API_KEY
        ? 'GPT-5.6 extraction enabled.'
        : 'No API key: extension will use deterministic fallback.',
    );
    const configuredMailboxes = mailbox
      .statuses()
      .filter((status) => status.configured)
      .map((status) => status.provider);
    console.log(
      configuredMailboxes.length > 0
        ? `Mailbox OAuth configured for: ${configuredMailboxes.join(', ')}.`
        : 'No mailbox OAuth client configured; demo inbox remains available.',
    );
    if (configuredMailboxes.length > 0 && !process.env.CONTEXTFILL_EXTENSION_ID) {
      console.warn('Set CONTEXTFILL_EXTENSION_ID before connecting a real mailbox.');
    }
  });
}
