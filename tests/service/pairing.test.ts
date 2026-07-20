import { describe, expect, it, vi } from 'vitest';
import { createServiceApp } from '../../apps/local-service/src/app.js';
import type { MailboxManagerLike } from '../../apps/local-service/src/mailbox.js';
import { PairingManager } from '../../apps/local-service/src/pairing.js';
import { extractDeterministic, makeSyntheticInbox } from '../../packages/core/src/index.js';
import { FakeCredentialStore } from './fake-credential-store.js';

const now = new Date('2026-07-20T19:00:00.000Z');
const origin = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const otherOrigin = 'chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba';
const secret = Buffer.alloc(32, 7).toString('base64url');

function mailbox(): MailboxManagerLike {
  return {
    statuses: async () => [
      {
        provider: 'gmail',
        configured: true,
        connected: false,
        account: null,
        sessionOnly: true,
        credentialStorage: 'os-keychain',
      },
    ],
    beginConnection: vi.fn(async () => 'https://accounts.example/authorize'),
    completeConnection: vi.fn(async () => 'person@gmail.example'),
    disconnect: vi.fn(async () => undefined),
    listMessages: vi.fn(async () => []),
  };
}

describe('per-install companion pairing', () => {
  it('uses a one-time code and restores only the hashed capability from the keychain', async () => {
    const store = new FakeCredentialStore();
    const manager = new PairingManager(
      {},
      store,
      () => now.getTime(),
      () => '482913',
    );

    expect(await manager.bootstrapCode()).toBe('482913');
    expect(await manager.status(origin, undefined)).toEqual({
      mode: 'unpaired',
      authenticated: false,
      persistent: false,
    });
    expect(await manager.pair(origin, '000000', secret)).toMatchObject({
      ok: false,
      error: 'invalid_pairing_code',
    });
    expect(await manager.pair(origin, '482913', secret)).toEqual({ ok: true });
    expect(store.pairing).toMatchObject({ version: 1, extensionOrigin: origin });
    expect(JSON.stringify(store.pairing)).not.toContain(secret);
    expect(await manager.status(origin, secret)).toEqual({
      mode: 'paired',
      authenticated: true,
      persistent: true,
    });
    expect((await manager.authorize(otherOrigin, secret)).ok).toBe(false);

    const restored = new PairingManager(
      {},
      store,
      () => now.getTime(),
      () => '111111',
    );
    expect(await restored.bootstrapCode()).toBeNull();
    expect((await restored.authorize(origin, secret)).ok).toBe(true);
  });

  it('rate-limits guesses and expires the bootstrap code', async () => {
    let clock = now.getTime();
    const manager = new PairingManager(
      {},
      new FakeCredentialStore(),
      () => clock,
      () => '482913',
    );
    await manager.bootstrapCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await manager.pair(origin, '000000', secret)).ok).toBe(false);
    }
    expect(await manager.pair(origin, '000000', secret)).toMatchObject({
      error: 'pairing_rate_limited',
      status: 429,
    });

    const expiring = new PairingManager(
      {},
      new FakeCredentialStore(),
      () => clock,
      () => '135790',
    );
    await expiring.bootstrapCode();
    clock += 10 * 60_000 + 1;
    expect(await expiring.pair(origin, '135790', secret)).toMatchObject({
      error: 'pairing_code_expired',
    });
  });

  it('protects mailbox HTTP routes with both the extension origin and paired capability', async () => {
    const store = new FakeCredentialStore();
    const pairing = new PairingManager(
      {},
      store,
      () => now.getTime(),
      () => '482913',
    );
    await pairing.bootstrapCode();
    const message = makeSyntheticInbox(now)[0]!;
    const app = createServiceApp(
      vi.fn(async () => extractDeterministic(message)!),
      mailbox(),
      pairing,
    );

    const initial = await app.request('/pair/status', { headers: { origin } });
    expect(await initial.json()).toEqual({
      pairing: { mode: 'unpaired', authenticated: false, persistent: false },
    });
    expect((await app.request('/mail/status', { headers: { origin } })).status).toBe(401);

    const paired = await app.request('/pair', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ code: '482913', secret }),
    });
    expect(paired.status).toBe(200);
    expect((await app.request('/mail/status', { headers: { origin } })).status).toBe(401);
    expect(
      (
        await app.request('/mail/status', {
          headers: { origin, 'x-contextfill-pairing': secret },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request('/mail/status', {
          headers: { origin: otherOrigin, 'x-contextfill-pairing': secret },
        })
      ).status,
    ).toBe(401);
  });
});
