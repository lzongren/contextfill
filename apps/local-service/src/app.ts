import { Hono } from 'hono';
import {
  syntheticMessageSchema,
  type SyntheticMessage,
  type VerificationCandidate,
} from '../../../packages/core/src/index.js';
import { extractWithGpt } from './extractor.js';

type Extractor = (message: SyntheticMessage) => Promise<VerificationCandidate>;

const allowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  return (
    /^chrome-extension:\/\/[a-p]{32}$/.test(origin) ||
    origin === 'http://127.0.0.1:4173' ||
    origin === 'http://localhost:4173'
  );
};

export function createServiceApp(extractor: Extractor = extractWithGpt) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    const origin = context.req.header('origin');
    if (!allowedOrigin(origin)) return context.json({ error: 'origin_not_allowed' }, 403);
    if (origin) context.header('Access-Control-Allow-Origin', origin);
    context.header('Vary', 'Origin');
    context.header('Cache-Control', 'no-store');
    context.header('X-Content-Type-Options', 'nosniff');
    if (context.req.method === 'OPTIONS') {
      context.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      context.header('Access-Control-Allow-Headers', 'content-type');
      return context.body(null, 204);
    }
    await next();
  });

  app.get('/health', (context) =>
    context.json({
      ok: true,
      model: process.env.OPENAI_MODEL || 'gpt-5.6',
      configured: Boolean(process.env.OPENAI_API_KEY),
    }),
  );

  app.post('/extract', async (context) => {
    if (!process.env.OPENAI_API_KEY && extractor === extractWithGpt) {
      return context.json({ fallback: true, reason: 'not_configured' }, 503);
    }
    const contentLength = Number(context.req.header('content-length') ?? 0);
    if (contentLength > 12_000)
      return context.json({ fallback: true, reason: 'request_too_large' }, 413);
    try {
      const raw = await context.req.text();
      if (raw.length > 12_000)
        return context.json({ fallback: true, reason: 'request_too_large' }, 413);
      const body = JSON.parse(raw) as { message?: unknown };
      const message = syntheticMessageSchema.parse(body.message);
      const candidate = await extractor(message);
      return context.json({ candidate });
    } catch {
      return context.json({ fallback: true, reason: 'invalid_or_unavailable' }, 502);
    }
  });

  return app;
}
