import { describe, expect, it, vi } from 'vitest';
import {
  MailboxManager,
  normalizeGmailMessage,
  normalizeOutlookMessage,
} from '../../apps/local-service/src/mailbox.js';
import { FakeCredentialStore } from './fake-credential-store.js';

const now = new Date('2026-07-20T19:00:00.000Z');

function encoded(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function gmailMessage(id = 'gmail-message-1') {
  return {
    id,
    internalDate: String(now.getTime()),
    snippet: 'Use verification code 481203.',
    payload: {
      mimeType: 'multipart/alternative',
      headers: [
        { name: 'From', value: 'Northstar Access <verify@northstar.example>' },
        { name: 'Subject', value: 'Your Northstar sign-in code' },
      ],
      parts: [
        {
          mimeType: 'text/plain',
          body: {
            data: encoded(
              'Use verification code 481203 at account.northstar.example. Valid for 10 minutes.',
            ),
          },
        },
      ],
    },
  };
}

function gmailMagicLinkMessage(id = 'gmail-magic-link') {
  return {
    id,
    internalDate: String(now.getTime()),
    snippet: 'Confirm your email to continue.',
    payload: {
      mimeType: 'text/html',
      headers: [
        { name: 'From', value: 'Cedar Notes <hello@cedarnotes.example>' },
        { name: 'Subject', value: 'Confirm your email' },
      ],
      body: {
        data: encoded(
          '<p>Confirm your email to continue.</p><a href="https://login.cedarnotes.example/confirm/private-token?nonce=secret&amp;source=email">Confirm email</a>',
        ),
      },
    },
  };
}

function outlookMessage(id = 'outlook-message-1') {
  return {
    id,
    subject: 'Your Northstar security code',
    receivedDateTime: now.toISOString(),
    from: {
      emailAddress: {
        name: 'Northstar Access',
        address: 'verify@northstar.example',
      },
    },
    body: {
      content:
        'Use security code 481203 at account.northstar.example. This code expires in 10 minutes.',
    },
  };
}

describe('mailbox message normalization', () => {
  it('normalizes a Gmail MIME message and infers its expiry', () => {
    expect(normalizeGmailMessage(gmailMessage())).toMatchObject({
      id: 'gmail:gmail-message-1',
      source: 'gmail',
      senderName: 'Northstar Access',
      senderAddress: 'verify@northstar.example',
      subject: 'Your Northstar sign-in code',
      receivedAt: now.toISOString(),
      expiresAt: '2026-07-20T19:10:00.000Z',
    });
  });

  it('normalizes an Outlook message and preserves read-only evidence', () => {
    expect(normalizeOutlookMessage(outlookMessage())).toMatchObject({
      id: 'outlook:outlook-message-1',
      source: 'outlook',
      senderName: 'Northstar Access',
      senderAddress: 'verify@northstar.example',
      expiresAt: '2026-07-20T19:10:00.000Z',
    });
  });

  it('preserves an HTML-only Gmail action URL without fetching it', () => {
    const normalized = normalizeGmailMessage(gmailMagicLinkMessage());
    expect(normalized).toMatchObject({
      id: 'gmail:gmail-magic-link',
      source: 'gmail',
      subject: 'Confirm your email',
    });
    expect(normalized?.body).toContain(
      'https://login.cedarnotes.example/confirm/private-token?nonce=secret&source=email',
    );
  });
});

describe('mailbox OAuth and provider adapters', () => {
  it('uses PKCE, read-only Gmail scope, refreshable tokens, and Gmail message APIs', async () => {
    const credentialStore = new FakeCredentialStore();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        expect(String(init?.body)).toContain('code_verifier=');
        return Response.json({ access_token: 'google-access', refresh_token: 'google-refresh' });
      }
      if (url.endsWith('/users/me/profile')) {
        return Response.json({ emailAddress: 'person@gmail.example' });
      }
      if (url.includes('/users/me/messages?')) {
        const query = new URL(url).searchParams.get('q');
        expect(query).toContain('"magic link"');
        expect(query).toContain('"secure access link"');
        expect(query).toContain('"sign in to"');
        expect(query).toContain('"booking reference"');
        return Response.json({ messages: [{ id: 'gmail-message-1' }] });
      }
      if (url.includes('/users/me/messages/gmail-message-1?format=full')) {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer google-access');
        return Response.json(gmailMessage());
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const manager = new MailboxManager(
      {
        CONTEXTFILL_GOOGLE_CLIENT_ID: 'google-client',
        CONTEXTFILL_GOOGLE_CLIENT_SECRET: 'google-secret',
        CONTEXTFILL_SERVICE_PORT: '4318',
      },
      fetcher as typeof fetch,
      () => now.getTime(),
      credentialStore,
    );

    const authorizationUrl = new URL(await manager.beginConnection('gmail'));
    expect(authorizationUrl.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/gmail.readonly',
    );
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizationUrl.searchParams.get('access_type')).toBe('offline');
    await manager.completeConnection(
      'gmail',
      'authorization-code',
      authorizationUrl.searchParams.get('state')!,
    );

    expect((await manager.statuses())[0]).toMatchObject({
      provider: 'gmail',
      configured: true,
      connected: true,
      account: 'person@gmail.example',
      sessionOnly: false,
      credentialStorage: 'os-keychain',
    });
    expect(await credentialStore.load('gmail')).toEqual({
      version: 1,
      refreshToken: 'google-refresh',
      account: 'person@gmail.example',
    });
    expect(await manager.listMessages('gmail')).toHaveLength(1);
  });

  it('uses delegated Mail.Read and lists recent Outlook messages through Microsoft Graph', async () => {
    const credentialStore = new FakeCredentialStore();
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/oauth2/v2.0/token')) {
        return Response.json({ access_token: 'outlook-access', refresh_token: 'outlook-refresh' });
      }
      if (url.includes('/v1.0/me?$select=')) {
        return Response.json({ mail: 'person@outlook.example' });
      }
      if (url.includes('/v1.0/me/messages?')) {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer outlook-access');
        expect(new Headers(init?.headers).get('prefer')).toBeNull();
        return Response.json({
          value: [
            {
              id: 'outlook-message-1',
              subject: 'Your Northstar security code',
              receivedDateTime: now.toISOString(),
              bodyPreview: 'Use security code 481203 to sign in.',
            },
          ],
        });
      }
      if (url.includes('/v1.0/me/messages/outlook-message-1?')) {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer outlook-access');
        expect(new Headers(init?.headers).get('prefer')).toBe('outlook.body-content-type="text"');
        return Response.json(outlookMessage());
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const manager = new MailboxManager(
      {
        CONTEXTFILL_MICROSOFT_CLIENT_ID: 'microsoft-client',
        CONTEXTFILL_MICROSOFT_TENANT: 'common',
      },
      fetcher as typeof fetch,
      () => now.getTime(),
      credentialStore,
    );

    const authorizationUrl = new URL(await manager.beginConnection('outlook'));
    expect(authorizationUrl.searchParams.get('scope')).toContain('Mail.Read');
    expect(authorizationUrl.searchParams.get('scope')).not.toContain('Mail.ReadWrite');
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
    await manager.completeConnection(
      'outlook',
      'authorization-code',
      authorizationUrl.searchParams.get('state')!,
    );

    expect((await manager.statuses())[1]).toMatchObject({
      provider: 'outlook',
      configured: true,
      connected: true,
      account: 'person@outlook.example',
      sessionOnly: false,
      credentialStorage: 'os-keychain',
    });
    expect(await manager.listMessages('outlook')).toHaveLength(1);
  });

  it('restores a refresh token from the OS keychain and refreshes on first use', async () => {
    const credentialStore = new FakeCredentialStore();
    await credentialStore.save('gmail', {
      version: 1,
      refreshToken: 'stored-google-refresh',
      account: 'person@gmail.example',
    });
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        expect(String(init?.body)).toContain('grant_type=refresh_token');
        expect(String(init?.body)).toContain('refresh_token=stored-google-refresh');
        return Response.json({ access_token: 'restored-google-access' });
      }
      if (url.includes('/users/me/messages?')) {
        expect(new Headers(init?.headers).get('authorization')).toBe(
          'Bearer restored-google-access',
        );
        return Response.json({ messages: [{ id: 'gmail-message-1' }] });
      }
      if (url.includes('/users/me/messages/gmail-message-1?format=full')) {
        expect(new Headers(init?.headers).get('authorization')).toBe(
          'Bearer restored-google-access',
        );
        return Response.json(gmailMessage());
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const manager = new MailboxManager(
      {
        CONTEXTFILL_GOOGLE_CLIENT_ID: 'google-client',
        CONTEXTFILL_GOOGLE_CLIENT_SECRET: 'google-secret',
      },
      fetcher as typeof fetch,
      () => now.getTime(),
      credentialStore,
    );

    expect((await manager.statuses())[0]).toMatchObject({
      connected: true,
      account: 'person@gmail.example',
      sessionOnly: false,
    });
    expect(await manager.listMessages('gmail')).toHaveLength(1);
  });

  it('falls back to session-only authorization when the OS keychain is unavailable', async () => {
    const credentialStore = new FakeCredentialStore();
    credentialStore.fail = true;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'google-access', refresh_token: 'google-refresh' });
      }
      if (url.endsWith('/users/me/profile')) {
        return Response.json({ emailAddress: 'person@gmail.example' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const manager = new MailboxManager(
      {
        CONTEXTFILL_GOOGLE_CLIENT_ID: 'google-client',
        CONTEXTFILL_GOOGLE_CLIENT_SECRET: 'google-secret',
      },
      fetcher as typeof fetch,
      () => now.getTime(),
      credentialStore,
    );
    const authorizationUrl = new URL(await manager.beginConnection('gmail'));
    await manager.completeConnection(
      'gmail',
      'authorization-code',
      authorizationUrl.searchParams.get('state')!,
    );

    expect((await manager.statuses())[0]).toMatchObject({
      connected: true,
      sessionOnly: true,
      credentialStorage: 'session',
    });
  });

  it('does not report a clean disconnect when the durable credential cannot be deleted', async () => {
    const credentialStore = new FakeCredentialStore();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'google-access', refresh_token: 'google-refresh' });
      }
      if (url.endsWith('/users/me/profile')) {
        return Response.json({ emailAddress: 'person@gmail.example' });
      }
      if (url.startsWith('https://oauth2.googleapis.com/revoke?')) {
        return new Response(null, { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const manager = new MailboxManager(
      {
        CONTEXTFILL_GOOGLE_CLIENT_ID: 'google-client',
        CONTEXTFILL_GOOGLE_CLIENT_SECRET: 'google-secret',
      },
      fetcher as typeof fetch,
      () => now.getTime(),
      credentialStore,
    );
    const authorizationUrl = new URL(await manager.beginConnection('gmail'));
    await manager.completeConnection(
      'gmail',
      'authorization-code',
      authorizationUrl.searchParams.get('state')!,
    );
    credentialStore.fail = true;

    await expect(manager.disconnect('gmail')).rejects.toMatchObject({
      code: 'credential_store_failed',
    });
  });
});
