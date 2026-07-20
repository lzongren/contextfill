import 'dotenv/config';
import { serve } from '@hono/node-server';
import { pathToFileURL } from 'node:url';
import { createServiceApp } from './app.js';

export const app = createServiceApp();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.CONTEXTFILL_SERVICE_PORT || 4318);
  serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
    console.log(`ContextFill local service listening on http://127.0.0.1:${info.port}`);
    console.log(
      process.env.OPENAI_API_KEY
        ? 'GPT-5.6 extraction enabled.'
        : 'No API key: extension will use deterministic fallback.',
    );
  });
}
