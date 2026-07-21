import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { mailboxMessageSchema, type MailboxMessage } from '../../../packages/core/src/index.js';
import {
  createCredentialStore,
  type CredentialStore,
  type StoredCredential,
} from './credential-store.js';

export const mailProviderSchema = z.enum(['gmail', 'outlook']);
export type MailProvider = z.infer<typeof mailProviderSchema>;

export type MailProviderStatus = {
  provider: MailProvider;
  configured: boolean;
  connected: boolean;
  account: string | null;
  sessionOnly: boolean;
  credentialStorage: 'os-keychain' | 'session';
};

export type MailboxManagerLike = {
  statuses(): Promise<MailProviderStatus[]>;
  beginConnection(provider: MailProvider): Promise<string>;
  completeConnection(provider: MailProvider, code: string, state: string): Promise<string>;
  disconnect(provider: MailProvider): Promise<void>;
  listMessages(provider: MailProvider): Promise<MailboxMessage[]>;
};

type OAuthConfig = {
  provider: MailProvider;
  clientId: string;
  clientSecret: string | null;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scopes: string[];
};

export type MailboxProviderSetup = {
  provider: MailProvider;
  configured: boolean;
  missing: string[];
  redirectUri: string;
  scopes: string[];
  registrationType: 'web-application' | 'public-client';
};

export type MailboxSetup = {
  servicePort: number;
  redirectOrigin: string;
  providers: MailboxProviderSetup[];
};

type PendingAuthorization = {
  provider: MailProvider;
  verifier: string;
  createdAt: number;
};

type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  account: string | null;
  persisted: boolean;
};

type MailboxErrorCode =
  | 'provider_not_configured'
  | 'invalid_oauth_state'
  | 'oauth_exchange_failed'
  | 'mailbox_not_connected'
  | 'mailbox_access_expired'
  | 'mailbox_api_failed'
  | 'credential_store_failed';

export class MailboxError extends Error {
  constructor(
    readonly code: MailboxErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    expires_in: z.number().positive().optional(),
  })
  .passthrough();

const gmailPartSchema: z.ZodType<GmailPart> = z.lazy(() =>
  z
    .object({
      mimeType: z.string().optional(),
      filename: z.string().optional(),
      headers: z.array(z.object({ name: z.string(), value: z.string() }).passthrough()).optional(),
      body: z.object({ data: z.string().optional() }).passthrough().optional(),
      parts: z.array(gmailPartSchema).optional(),
    })
    .passthrough(),
);

type GmailPart = {
  mimeType?: string | undefined;
  filename?: string | undefined;
  headers?: Array<{ name: string; value: string }> | undefined;
  body?: { data?: string | undefined } | undefined;
  parts?: GmailPart[] | undefined;
};

const gmailMessageSchema = z
  .object({
    id: z.string().min(1),
    internalDate: z.string().regex(/^\d+$/),
    snippet: z.string().optional(),
    payload: gmailPartSchema,
  })
  .passthrough();

const outlookMessageSchema = z
  .object({
    id: z.string().min(1),
    subject: z.string().nullable().optional(),
    receivedDateTime: z.string().datetime(),
    from: z
      .object({
        emailAddress: z
          .object({
            name: z.string().nullable().optional(),
            address: z.string().nullable().optional(),
          })
          .passthrough(),
      })
      .passthrough()
      .nullable()
      .optional(),
    body: z.object({ content: z.string() }).passthrough(),
  })
  .passthrough();

const outlookSummarySchema = z
  .object({
    id: z.string().min(1),
    subject: z.string().nullable().optional(),
    receivedDateTime: z.string().datetime(),
    bodyPreview: z.string().nullable().optional(),
  })
  .passthrough();

function base64Url(value: Buffer): string {
  return value.toString('base64url');
}

function codeChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

function safeOrigin(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('CONTEXTFILL_OAUTH_REDIRECT_ORIGIN must be a valid URL origin.');
  }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('CONTEXTFILL_OAUTH_REDIRECT_ORIGIN must be an HTTP loopback origin.');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || !url.port) {
    throw new Error(
      'CONTEXTFILL_OAUTH_REDIRECT_ORIGIN must contain only an HTTP loopback host and explicit port.',
    );
  }
  return url.origin;
}

function servicePort(environment: NodeJS.ProcessEnv): number {
  const raw = environment.CONTEXTFILL_SERVICE_PORT?.trim() || '4318';
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('CONTEXTFILL_SERVICE_PORT must be an integer from 1 through 65535.');
  }
  return port;
}

export function inspectMailboxSetup(environment: NodeJS.ProcessEnv = process.env): MailboxSetup {
  const port = servicePort(environment);
  const redirectOrigin = safeOrigin(
    environment.CONTEXTFILL_OAUTH_REDIRECT_ORIGIN || `http://localhost:${port}`,
  );
  if (Number(new URL(redirectOrigin).port) !== port) {
    throw new Error('CONTEXTFILL_OAUTH_REDIRECT_ORIGIN port must match CONTEXTFILL_SERVICE_PORT.');
  }
  const gmailMissing = [
    !environment.CONTEXTFILL_GOOGLE_CLIENT_ID?.trim() ? 'CONTEXTFILL_GOOGLE_CLIENT_ID' : null,
    !environment.CONTEXTFILL_GOOGLE_CLIENT_SECRET?.trim()
      ? 'CONTEXTFILL_GOOGLE_CLIENT_SECRET'
      : null,
  ].filter((value): value is string => value !== null);
  const outlookMissing = [
    !environment.CONTEXTFILL_MICROSOFT_CLIENT_ID?.trim() ? 'CONTEXTFILL_MICROSOFT_CLIENT_ID' : null,
  ].filter((value): value is string => value !== null);
  return {
    servicePort: port,
    redirectOrigin,
    providers: [
      {
        provider: 'gmail',
        configured: gmailMissing.length === 0,
        missing: gmailMissing,
        redirectUri: `${redirectOrigin}/mail/oauth/gmail/callback`,
        scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
        registrationType: 'web-application',
      },
      {
        provider: 'outlook',
        configured: outlookMissing.length === 0,
        missing: outlookMissing,
        redirectUri: `${redirectOrigin}/mail/oauth/outlook/callback`,
        scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read', 'Mail.Read'],
        registrationType: 'public-client',
      },
    ],
  };
}

function compact(value: string | null | undefined, max: number): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function parseSender(value: string | null | undefined): {
  name: string | null;
  address: string | null;
} {
  const input = value?.trim() ?? '';
  const bracketed = input.match(/<([^<>\s]+@[^<>\s]+)>/);
  const plain = input.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const address = compact(bracketed?.[1] ?? plain?.[0], 320)?.toLowerCase() ?? null;
  const name = bracketed
    ? compact(input.slice(0, bracketed.index).replace(/^['"]|['"]$/g, ''), 320)
    : null;
  return { name, address };
}

function decodeBase64Url(value: string | undefined): string {
  if (!value) return '';
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function htmlToText(value: string): string {
  return decodeEntities(
    value
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(
        /<a\b[^>]*\bhref\s*=\s*(["'])(https?:\/\/[^"']+)\1[^>]*>/gi,
        (_match, _quote: string, href: string) => ` ${href} `,
      )
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

function gmailBody(part: GmailPart, preferredMime: 'text/plain' | 'text/html'): string {
  if (!part.filename && part.mimeType?.toLowerCase() === preferredMime && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const body = gmailBody(child, preferredMime);
    if (body) return body;
  }
  return '';
}

function header(part: GmailPart, name: string): string | null {
  return (
    part.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? null
  );
}

function inferExpiresAt(body: string, receivedAt: string): string | null {
  const duration = body.match(
    /\b(?:expires?|valid)(?:\s+(?:in|for))?\s+(\d{1,3})\s*(minutes?|mins?|hours?|hrs?)\b/i,
  );
  if (!duration?.[1] || !duration[2]) return null;
  const amount = Number(duration[1]);
  const multiplier = /^h/i.test(duration[2]) ? 60 * 60_000 : 60_000;
  const received = new Date(receivedAt).getTime();
  if (!Number.isFinite(received) || amount < 1 || amount > 1440) return null;
  return new Date(received + amount * multiplier).toISOString();
}

function looksTemporaryActionText(text: string): boolean {
  const hasOtp =
    /\b(verification|verify|security code|one[- ]time|sign[- ]?in|login code|otp|2fa|two[- ]factor|authentication code|auth code|access code|confirmation code|passcode)\b/i.test(
      text,
    ) && /\b[A-Z0-9]{4,10}\b/i.test(text);
  const hasMagicLink =
    /\b(magic link|secure (?:access|sign[- ]?in|login) link|sign[- ]?in link|login link|confirm (?:your )?email|verify (?:your )?email|email confirmation|activate (?:your )?account|(?:sign[- ]?in|log ?in) (?:to|with) [a-z0-9][a-z0-9.'’_-]{1,40})\b/i.test(
      text,
    ) && /https:\/\//i.test(text);
  const hasReference =
    /\b(booking|application|support)\s+(?:reference|confirmation)\b/i.test(text) &&
    /\b[A-Z0-9][A-Z0-9-]{4,19}\b/i.test(text);
  return hasOtp || hasMagicLink || hasReference;
}

function looksTemporaryActionLike(message: MailboxMessage): boolean {
  return looksTemporaryActionText(`${message.subject}\n${message.body}`);
}

export function normalizeGmailMessage(input: unknown): MailboxMessage | null {
  const parsed = gmailMessageSchema.safeParse(input);
  if (!parsed.success) return null;
  const message = parsed.data;
  const received = new Date(Number(message.internalDate));
  if (!Number.isFinite(received.getTime())) return null;
  const receivedAt = received.toISOString();
  const plain = gmailBody(message.payload, 'text/plain');
  const html = plain ? '' : gmailBody(message.payload, 'text/html');
  const body = compact(plain || htmlToText(html) || message.snippet, 10_000);
  if (!body) return null;
  const sender = parseSender(header(message.payload, 'from'));
  const normalized = mailboxMessageSchema.safeParse({
    id: `gmail:${message.id}`,
    source: 'gmail',
    senderName: sender.name,
    senderAddress: sender.address,
    subject: compact(header(message.payload, 'subject'), 500) ?? '(no subject)',
    body,
    receivedAt,
    expiresAt: inferExpiresAt(body, receivedAt),
    serviceHint: null,
  });
  return normalized.success ? normalized.data : null;
}

export function normalizeOutlookMessage(input: unknown): MailboxMessage | null {
  const parsed = outlookMessageSchema.safeParse(input);
  if (!parsed.success) return null;
  const message = parsed.data;
  const receivedAt = new Date(message.receivedDateTime).toISOString();
  const body = compact(htmlToText(message.body.content), 10_000);
  if (!body) return null;
  const address = compact(message.from?.emailAddress.address, 320)?.toLowerCase() ?? null;
  const normalized = mailboxMessageSchema.safeParse({
    id: `outlook:${message.id}`,
    source: 'outlook',
    senderName: compact(message.from?.emailAddress.name, 320),
    senderAddress: address,
    subject: compact(message.subject, 500) ?? '(no subject)',
    body,
    receivedAt,
    expiresAt: inferExpiresAt(body, receivedAt),
    serviceHint: null,
  });
  return normalized.success ? normalized.data : null;
}

export class MailboxManager implements MailboxManagerLike {
  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly tokens = new Map<MailProvider, TokenSet>();
  private initialization: Promise<void> | null = null;
  private keychainAvailable = true;

  constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
    private readonly credentialStore: CredentialStore = createCredentialStore(),
  ) {}

  async statuses(): Promise<MailProviderStatus[]> {
    await this.initialize();
    return mailProviderSchema.options.map((provider) => ({
      provider,
      configured: this.config(provider) !== null,
      connected: this.tokens.has(provider),
      account: this.tokens.get(provider)?.account ?? null,
      sessionOnly: !this.tokens.get(provider)?.persisted,
      credentialStorage:
        this.keychainAvailable && this.tokens.get(provider)?.persisted !== false
          ? 'os-keychain'
          : 'session',
    }));
  }

  async beginConnection(provider: MailProvider): Promise<string> {
    await this.initialize();
    const config = this.requireConfig(provider);
    this.purgePending();
    const state = base64Url(randomBytes(24));
    const verifier = base64Url(randomBytes(48));
    this.pending.set(state, { provider, verifier, createdAt: this.now() });
    const url = new URL(config.authorizationEndpoint);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', config.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    if (provider === 'gmail') {
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('include_granted_scopes', 'true');
      url.searchParams.set('prompt', 'consent');
    }
    return url.toString();
  }

  async completeConnection(provider: MailProvider, code: string, state: string): Promise<string> {
    await this.initialize();
    this.purgePending();
    const pending = this.pending.get(state);
    this.pending.delete(state);
    if (!pending || pending.provider !== provider) {
      throw new MailboxError('invalid_oauth_state', 'The mailbox authorization state is invalid.');
    }
    const config = this.requireConfig(provider);
    const body = new URLSearchParams({
      client_id: config.clientId,
      code,
      code_verifier: pending.verifier,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });
    if (config.clientSecret) body.set('client_secret', config.clientSecret);
    const token = await this.exchangeToken(config, body);
    let account: string | null = null;
    try {
      account = await this.accountLabel(provider, token.accessToken);
    } catch {
      account = null;
    }
    const connected = { ...token, account };
    if (!connected.refreshToken) await this.deletePersisted(provider);
    connected.persisted = await this.persist(provider, connected);
    this.tokens.set(provider, connected);
    return account ?? provider;
  }

  async disconnect(provider: MailProvider): Promise<void> {
    await this.initialize();
    const token = this.tokens.get(provider);
    this.tokens.delete(provider);
    let deletionError: MailboxError | null = null;
    try {
      await this.deletePersisted(provider);
    } catch (error) {
      deletionError =
        error instanceof MailboxError
          ? error
          : new MailboxError(
              'credential_store_failed',
              'ContextFill could not delete the saved mailbox credential.',
              500,
            );
    }
    if (provider === 'gmail' && token) {
      const value = token.refreshToken ?? token.accessToken;
      await this.fetcher(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(value)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        },
      ).catch(() => undefined);
    }
    if (deletionError) throw deletionError;
  }

  async listMessages(provider: MailProvider): Promise<MailboxMessage[]> {
    await this.initialize();
    if (provider === 'gmail') return this.listGmailMessages();
    return this.listOutlookMessages();
  }

  private config(provider: MailProvider): OAuthConfig | null {
    const setup = inspectMailboxSetup(this.environment).providers.find(
      (candidate) => candidate.provider === provider,
    )!;
    if (!setup.configured) return null;
    if (provider === 'gmail') {
      return {
        provider,
        clientId: this.environment.CONTEXTFILL_GOOGLE_CLIENT_ID!.trim(),
        clientSecret: this.environment.CONTEXTFILL_GOOGLE_CLIENT_SECRET!.trim(),
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        redirectUri: setup.redirectUri,
        scopes: setup.scopes,
      };
    }
    const tenant = this.environment.CONTEXTFILL_MICROSOFT_TENANT?.trim() || 'common';
    return {
      provider,
      clientId: this.environment.CONTEXTFILL_MICROSOFT_CLIENT_ID!.trim(),
      clientSecret: null,
      authorizationEndpoint: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
      redirectUri: setup.redirectUri,
      scopes: setup.scopes,
    };
  }

  private requireConfig(provider: MailProvider): OAuthConfig {
    const config = this.config(provider);
    if (!config) {
      throw new MailboxError(
        'provider_not_configured',
        `${provider} OAuth credentials are not configured.`,
        503,
      );
    }
    return config;
  }

  private purgePending(): void {
    const cutoff = this.now() - 10 * 60_000;
    for (const [state, pending] of this.pending) {
      if (pending.createdAt < cutoff) this.pending.delete(state);
    }
  }

  private async initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.restoreCredentials();
    }
    await this.initialization;
  }

  private async restoreCredentials(): Promise<void> {
    for (const provider of mailProviderSchema.options) {
      if (!this.config(provider)) continue;
      try {
        const stored = await this.credentialStore.load(provider);
        if (!stored) continue;
        this.tokens.set(provider, {
          accessToken: '',
          refreshToken: stored.refreshToken,
          expiresAt: 0,
          account: stored.account,
          persisted: true,
        });
      } catch {
        this.keychainAvailable = false;
      }
    }
  }

  private async persist(provider: MailProvider, token: TokenSet): Promise<boolean> {
    if (!token.refreshToken || !this.keychainAvailable) return false;
    const credential: StoredCredential = {
      version: 1,
      refreshToken: token.refreshToken,
      account: token.account,
    };
    try {
      await this.credentialStore.save(provider, credential);
      return true;
    } catch {
      this.keychainAvailable = false;
      return false;
    }
  }

  private async deletePersisted(provider: MailProvider): Promise<void> {
    try {
      await this.credentialStore.delete(provider);
    } catch {
      this.keychainAvailable = false;
      throw new MailboxError(
        'credential_store_failed',
        'ContextFill could not delete the saved mailbox credential.',
        500,
      );
    }
  }

  private async exchangeToken(config: OAuthConfig, body: URLSearchParams): Promise<TokenSet> {
    const response = await this.fetcher(config.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const raw = await response.json().catch(() => null);
    const parsed = tokenResponseSchema.safeParse(raw);
    if (!response.ok || !parsed.success) {
      throw new MailboxError('oauth_exchange_failed', 'The provider rejected the token exchange.');
    }
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token ?? null,
      expiresAt: this.now() + (parsed.data.expires_in ?? 3600) * 1000,
      account: null,
      persisted: false,
    };
  }

  private async accessToken(provider: MailProvider, forceRefresh = false): Promise<string> {
    const current = this.tokens.get(provider);
    if (!current) {
      throw new MailboxError('mailbox_not_connected', `${provider} is not connected.`, 401);
    }
    if (!forceRefresh && current.expiresAt > this.now() + 60_000) return current.accessToken;
    if (!current.refreshToken) {
      this.tokens.delete(provider);
      throw new MailboxError('mailbox_access_expired', `${provider} access has expired.`, 401);
    }
    const config = this.requireConfig(provider);
    const body = new URLSearchParams({
      client_id: config.clientId,
      refresh_token: current.refreshToken,
      grant_type: 'refresh_token',
    });
    if (provider === 'outlook') body.set('scope', config.scopes.join(' '));
    if (config.clientSecret) body.set('client_secret', config.clientSecret);
    const refreshed = await this.exchangeToken(config, body);
    const next = {
      ...refreshed,
      refreshToken: refreshed.refreshToken ?? current.refreshToken,
      account: current.account,
    };
    next.persisted = await this.persist(provider, next);
    this.tokens.set(provider, next);
    return refreshed.accessToken;
  }

  private async providerFetch(
    provider: MailProvider,
    url: string,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const request = async (forceRefresh: boolean) =>
      this.fetcher(url, {
        headers: {
          ...headers,
          authorization: `Bearer ${await this.accessToken(provider, forceRefresh)}`,
        },
      });
    let response = await request(false);
    if (response.status === 401) response = await request(true);
    if (!response.ok) {
      throw new MailboxError(
        'mailbox_api_failed',
        `${provider} returned HTTP ${response.status}.`,
        502,
      );
    }
    return response;
  }

  private async accountLabel(provider: MailProvider, accessToken: string): Promise<string | null> {
    const url =
      provider === 'gmail'
        ? 'https://gmail.googleapis.com/gmail/v1/users/me/profile'
        : 'https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName';
    const response = await this.fetcher(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Record<string, unknown>;
    const value =
      provider === 'gmail'
        ? body.emailAddress
        : (body.mail ?? body.userPrincipalName ?? body.displayName);
    return typeof value === 'string' ? compact(value, 320) : null;
  }

  private async listGmailMessages(): Promise<MailboxMessage[]> {
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('maxResults', '20');
    listUrl.searchParams.set('includeSpamTrash', 'false');
    listUrl.searchParams.set(
      'q',
      'newer_than:1d {verification "security code" "sign-in code" "login code" OTP "one-time" passcode "access code" "confirmation code" 2FA "magic link" "secure access link" "sign-in link" "login link" "sign in to" "log in to" "click the link" "confirm your email" "verify your email" "verify email" "email confirmation" "activate your account" "booking reference" "application reference" "support reference"}',
    );
    const listResponse = await this.providerFetch('gmail', listUrl.toString());
    const list = (await listResponse.json()) as { messages?: Array<{ id?: unknown }> };
    const ids = (list.messages ?? [])
      .map((message) => (typeof message.id === 'string' ? message.id : null))
      .filter((id): id is string => id !== null)
      .slice(0, 12);
    const messages = await Promise.all(
      ids.map(async (id) => {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`;
        const response = await this.providerFetch('gmail', url);
        return normalizeGmailMessage(await response.json());
      }),
    );
    return messages.filter((message): message is MailboxMessage => Boolean(message)).slice(0, 10);
  }

  private async listOutlookMessages(): Promise<MailboxMessage[]> {
    const url = new URL('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages');
    url.searchParams.set('$top', '25');
    url.searchParams.set('$orderby', 'receivedDateTime desc');
    url.searchParams.set('$select', 'id,subject,receivedDateTime,bodyPreview');
    const response = await this.providerFetch('outlook', url.toString());
    const body = (await response.json()) as { value?: unknown[] };
    const cutoff = this.now() - 24 * 60 * 60_000;
    const summaries = (body.value ?? [])
      .map((value) => outlookSummarySchema.safeParse(value))
      .filter((value) => value.success)
      .map((value) => value.data)
      .filter((message) => new Date(message.receivedDateTime).getTime() >= cutoff)
      .filter((message) =>
        looksTemporaryActionText(`${message.subject ?? ''}\n${message.bodyPreview ?? ''}`),
      )
      .slice(0, 12);
    const messages = await Promise.all(
      summaries.map(async (summary) => {
        const detailUrl = new URL(
          `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(summary.id)}`,
        );
        detailUrl.searchParams.set('$select', 'id,subject,from,receivedDateTime,body');
        const detail = await this.providerFetch('outlook', detailUrl.toString(), {
          Prefer: 'outlook.body-content-type="text"',
        });
        return normalizeOutlookMessage(await detail.json());
      }),
    );
    return messages
      .filter((message): message is MailboxMessage => Boolean(message))
      .filter(looksTemporaryActionLike)
      .slice(0, 10);
  }
}

export function createMailboxManager(): MailboxManager {
  return new MailboxManager();
}
