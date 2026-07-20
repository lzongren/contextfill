import { z } from 'zod';
import { mailboxMessageSchema, type MailboxMessage } from '../../../packages/core/src/index.js';

const serviceBase = 'http://127.0.0.1:4318';

export const mailProviderSchema = z.enum(['gmail', 'outlook']);
export const mailSourceSchema = z.enum(['synthetic', 'gmail', 'outlook']);
export type MailProvider = z.infer<typeof mailProviderSchema>;
export type MailSource = z.infer<typeof mailSourceSchema>;

const providerStatusSchema = z
  .object({
    provider: mailProviderSchema,
    configured: z.boolean(),
    connected: z.boolean(),
    account: z.string().nullable(),
    sessionOnly: z.boolean(),
    credentialStorage: z.enum(['os-keychain', 'session']),
  })
  .strict();

const statusResponseSchema = z.object({ providers: z.array(providerStatusSchema) }).strict();
const messagesResponseSchema = z.object({ messages: z.array(mailboxMessageSchema) }).strict();
const connectResponseSchema = z.object({ authorizationUrl: z.string().url() }).strict();
const pairingStatusSchema = z
  .object({
    mode: z.enum(['unpaired', 'paired', 'legacy-env']),
    authenticated: z.boolean(),
    persistent: z.boolean(),
  })
  .strict();
const pairingResponseSchema = z.object({ pairing: pairingStatusSchema }).strict();

export type MailProviderStatus = z.infer<typeof providerStatusSchema>;
export type PairingStatus = z.infer<typeof pairingStatusSchema>;

export class MailClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

async function serviceRequest(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const headers = await companionServiceHeaders(init?.headers);
    const response = await fetch(`${serviceBase}${path}`, {
      ...init,
      cache: 'no-store',
      headers,
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: unknown;
      message?: unknown;
    };
    if (!response.ok) {
      throw new MailClientError(
        typeof body.message === 'string'
          ? body.message
          : 'The mailbox service rejected the request.',
        typeof body.error === 'string' ? body.error : 'mailbox_unavailable',
      );
    }
    return body;
  } catch (error) {
    if (error instanceof MailClientError) throw error;
    throw new MailClientError(
      'Start the ContextFill companion service and try again.',
      'service_unavailable',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function companionServiceHeaders(initial?: HeadersInit): Promise<Headers> {
  const headers = new Headers(initial);
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return headers;
  headers.set('x-contextfill-extension-id', chrome.runtime.id);
  const secret = await loadPairingSecret();
  if (secret) headers.set('x-contextfill-pairing', secret);
  return headers;
}

export async function getPairingStatus(): Promise<PairingStatus> {
  return pairingResponseSchema.parse(await serviceRequest('/pair/status')).pairing;
}

export async function pairCompanionService(code: string): Promise<void> {
  const secret = pairingSecret();
  await serviceRequest('/pair', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, secret }),
  });
  await chrome.storage.local.set({ pairingSecret: secret });
}

export async function getMailProviderStatus(): Promise<MailProviderStatus[]> {
  return statusResponseSchema.parse(await serviceRequest('/mail/status')).providers;
}

export async function beginMailConnection(provider: MailProvider): Promise<string> {
  return connectResponseSchema.parse(
    await serviceRequest(`/mail/connect/${provider}`, { method: 'POST' }),
  ).authorizationUrl;
}

export async function disconnectMailProvider(provider: MailProvider): Promise<void> {
  await serviceRequest(`/mail/disconnect/${provider}`, { method: 'POST' });
}

export async function fetchMailboxMessages(provider: MailProvider): Promise<MailboxMessage[]> {
  return messagesResponseSchema.parse(await serviceRequest(`/mail/messages/${provider}`)).messages;
}

export async function loadMailSource(): Promise<MailSource> {
  const stored = await chrome.storage.local.get('mailSource');
  const parsed = mailSourceSchema.safeParse(stored.mailSource);
  return parsed.success ? parsed.data : 'synthetic';
}

export async function saveMailSource(source: MailSource): Promise<void> {
  await chrome.storage.local.set({ mailSource: source });
}

export async function loadRealMailModelOptIn(): Promise<boolean> {
  const stored = await chrome.storage.local.get('realMailModelOptIn');
  return stored.realMailModelOptIn === true;
}

export async function saveRealMailModelOptIn(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ realMailModelOptIn: enabled });
}

async function loadPairingSecret(): Promise<string | null> {
  const stored = await chrome.storage.local.get('pairingSecret');
  return typeof stored.pairingSecret === 'string' ? stored.pairingSecret : null;
}

function pairingSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function sourceLabel(source: MailSource): string {
  if (source === 'gmail') return 'Gmail';
  if (source === 'outlook') return 'Outlook';
  return 'Demo inbox';
}
