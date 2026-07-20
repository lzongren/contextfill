import { Hono, type Context } from 'hono';
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
import { createPairingManager, type PairingManager } from './pairing.js';

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
  pairing: PairingManager = createPairingManager(),
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
      context.header(
        'Access-Control-Allow-Headers',
        'content-type, x-contextfill-extension-id, x-contextfill-pairing',
      );
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

  const pairingSecret = (header: string | undefined): string | undefined => {
    return header?.trim() || undefined;
  };

  const extensionOrigin = (context: Context): string | undefined => {
    const origin = context.req.header('origin');
    const extensionId = context.req.header('x-contextfill-extension-id')?.trim();
    const headerOrigin =
      extensionId && /^[a-p]{32}$/.test(extensionId)
        ? `chrome-extension://${extensionId}`
        : undefined;
    if (origin && /^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
      return headerOrigin && headerOrigin !== origin ? undefined : origin;
    }
    return origin ? undefined : headerOrigin;
  };

  app.get('/pair/status', async (context) => {
    const origin = extensionOrigin(context);
    if (!origin) {
      return context.json({ error: 'invalid_extension_origin' }, 403);
    }
    return context.json({
      pairing: await pairing.status(
        origin,
        pairingSecret(context.req.header('x-contextfill-pairing')),
      ),
    });
  });

  app.post('/pair', async (context) => {
    const body = (await context.req.json().catch(() => null)) as Record<string, unknown> | null;
    const result = await pairing.pair(
      extensionOrigin(context),
      typeof body?.code === 'string' ? body.code : '',
      typeof body?.secret === 'string' ? body.secret : '',
    );
    if (!result.ok) {
      return context.json({ error: result.error, message: result.message }, result.status);
    }
    return context.json({ ok: true });
  });

  app.get('/mail/status', async (context) => {
    const authorization = await pairing.authorize(
      extensionOrigin(context),
      pairingSecret(context.req.header('x-contextfill-pairing')),
    );
    if (!authorization.ok) {
      return context.json(
        { error: authorization.error, message: authorization.message },
        authorization.status,
      );
    }
    return context.json({ providers: await mailbox.statuses() });
  });

  app.post('/mail/connect/:provider', async (context) => {
    const authorization = await pairing.authorize(
      extensionOrigin(context),
      pairingSecret(context.req.header('x-contextfill-pairing')),
    );
    if (!authorization.ok) {
      return context.json(
        { error: authorization.error, message: authorization.message },
        authorization.status,
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
    const authorization = await pairing.authorize(
      extensionOrigin(context),
      pairingSecret(context.req.header('x-contextfill-pairing')),
    );
    if (!authorization.ok) {
      return context.json(
        { error: authorization.error, message: authorization.message },
        authorization.status,
      );
    }
    const provider = mailProviderSchema.safeParse(context.req.param('provider'));
    if (!provider.success) return context.json({ error: 'unsupported_provider' }, 404);
    try {
      await mailbox.disconnect(provider.data);
      return context.json({ ok: true });
    } catch (error) {
      const failure = mailboxError(error);
      return context.json(
        { error: failure.error, message: failure.message },
        failure.status as 400,
      );
    }
  });

  app.get('/mail/messages/:provider', async (context) => {
    const authorization = await pairing.authorize(
      extensionOrigin(context),
      pairingSecret(context.req.header('x-contextfill-pairing')),
    );
    if (!authorization.ok) {
      return context.json(
        { error: authorization.error, message: authorization.message },
        authorization.status,
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
    const authorization = await pairing.authorize(
      extensionOrigin(context),
      pairingSecret(context.req.header('x-contextfill-pairing')),
    );
    if (!authorization.ok) {
      return context.json(
        { error: authorization.error, message: authorization.message },
        authorization.status,
      );
    }
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
