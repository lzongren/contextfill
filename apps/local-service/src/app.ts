import { Hono } from 'hono';
import {
  syntheticMessageSchema,
  type SyntheticMessage,
  type VerificationCandidate,
} from '../../../packages/core/src/index.js';
import { extractWithGpt } from './extractor.js';
import {
  createMailboxManager,
  MailboxError,
  mailProviderSchema,
  type MailboxManagerLike,
} from './mailbox.js';

type Extractor = (message: SyntheticMessage) => Promise<VerificationCandidate>;

const allowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  return (
    /^chrome-extension:\/\/[a-p]{32}$/.test(origin) ||
    origin === 'http://127.0.0.1:4173' ||
    origin === 'http://localhost:4173'
  );
};

export function createServiceApp(
  extractor: Extractor = extractWithGpt,
  mailbox: MailboxManagerLike = createMailboxManager(),
) {
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

  const requireMailboxOrigin = (origin: string | undefined): MailboxError | null => {
    const extensionId = process.env.CONTEXTFILL_EXTENSION_ID?.trim();
    if (!extensionId || !/^[a-p]{32}$/.test(extensionId)) {
      return new MailboxError(
        'provider_not_configured',
        'CONTEXTFILL_EXTENSION_ID must match the unpacked Chrome extension ID.',
        503,
      );
    }
    if (origin !== `chrome-extension://${extensionId}`) {
      return new MailboxError(
        'provider_not_configured',
        'This extension origin is not paired with the local service.',
        403,
      );
    }
    return null;
  };

  const mailboxError = (error: unknown): { error: string; message: string; status: number } => {
    if (error instanceof MailboxError) {
      return { error: error.code, message: error.message, status: error.status };
    }
    return {
      error: 'mailbox_unavailable',
      message: 'The mailbox service is unavailable.',
      status: 502,
    };
  };

  app.get('/mail/status', (context) => {
    const originError = requireMailboxOrigin(context.req.header('origin'));
    if (originError) {
      const failure = mailboxError(originError);
      return context.json(
        { error: failure.error, message: failure.message },
        failure.status as 403,
      );
    }
    return context.json({ providers: mailbox.statuses() });
  });

  app.post('/mail/connect/:provider', async (context) => {
    const originError = requireMailboxOrigin(context.req.header('origin'));
    if (originError) {
      const failure = mailboxError(originError);
      return context.json(
        { error: failure.error, message: failure.message },
        failure.status as 403,
      );
    }
    const provider = mailProviderSchema.safeParse(context.req.param('provider'));
    if (!provider.success) return context.json({ error: 'unsupported_provider' }, 404);
    try {
      return context.json({ authorizationUrl: await mailbox.beginConnection(provider.data) });
    } catch (error) {
      const failure = mailboxError(error);
      return context.json(
        { error: failure.error, message: failure.message },
        failure.status as 400,
      );
    }
  });

  app.post('/mail/disconnect/:provider', async (context) => {
    const originError = requireMailboxOrigin(context.req.header('origin'));
    if (originError) {
      const failure = mailboxError(originError);
      return context.json(
        { error: failure.error, message: failure.message },
        failure.status as 403,
      );
    }
    const provider = mailProviderSchema.safeParse(context.req.param('provider'));
    if (!provider.success) return context.json({ error: 'unsupported_provider' }, 404);
    await mailbox.disconnect(provider.data);
    return context.json({ ok: true });
  });

  app.get('/mail/messages/:provider', async (context) => {
    const originError = requireMailboxOrigin(context.req.header('origin'));
    if (originError) {
      const failure = mailboxError(originError);
      return context.json(
        { error: failure.error, message: failure.message },
        failure.status as 403,
      );
    }
    const provider = mailProviderSchema.safeParse(context.req.param('provider'));
    if (!provider.success) return context.json({ error: 'unsupported_provider' }, 404);
    try {
      return context.json({ messages: await mailbox.listMessages(provider.data) });
    } catch (error) {
      const failure = mailboxError(error);
      return context.json(
        { error: failure.error, message: failure.message },
        failure.status as 400,
      );
    }
  });

  app.get('/mail/oauth/:provider/callback', async (context) => {
    const provider = mailProviderSchema.safeParse(context.req.param('provider'));
    const code = context.req.query('code');
    const state = context.req.query('state');
    const providerError = context.req.query('error');
    context.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (!provider.success || providerError || !code || !state) {
      return context.text(
        'ContextFill could not connect this mailbox. Close this tab and try again.',
        400,
      );
    }
    try {
      const account = await mailbox.completeConnection(provider.data, code, state);
      return context.text(
        `ContextFill connected ${account}. You can close this tab and reopen the extension.`,
      );
    } catch {
      return context.text(
        'ContextFill could not finish mailbox authorization. Close this tab and try again.',
        400,
      );
    }
  });

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
