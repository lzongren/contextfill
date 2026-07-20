import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceApp } from '../../apps/local-service/src/app.js';
import { extractWithGpt, type ResponsesClient } from '../../apps/local-service/src/extractor.js';
import type { MailboxManagerLike } from '../../apps/local-service/src/mailbox.js';
import { extractDeterministic, makeSyntheticInbox } from '../../packages/core/src/index.js';

const now = new Date('2026-07-20T19:00:00.000Z');
const message = makeSyntheticInbox(now)[0]!;
const originalKey = process.env.OPENAI_API_KEY;
const originalExtensionId = process.env.CONTEXTFILL_EXTENSION_ID;

afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalExtensionId === undefined) delete process.env.CONTEXTFILL_EXTENSION_ID;
  else process.env.CONTEXTFILL_EXTENSION_ID = originalExtensionId;
});

describe('local extraction service', () => {
  it('reports no-key mode without exposing a secret', async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.CONTEXTFILL_EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
    const response = await createServiceApp().request('/health');
    expect(await response.json()).toEqual({ ok: true, model: 'gpt-5.6', configured: false });
    const extractResponse = await createServiceApp().request('/extract', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      },
      body: JSON.stringify({ message }),
    });
    expect(extractResponse.status).toBe(503);
    expect(await extractResponse.json()).toEqual({ fallback: true, reason: 'not_configured' });
  });

  it('returns a candidate from an injected extractor', async () => {
    process.env.CONTEXTFILL_EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
    const candidate = {
      ...extractDeterministic(message)!,
      id: 'candidate:northstar-current',
      extractionMethod: 'gpt-5.6' as const,
    };
    const extractor = vi.fn(async () => candidate);
    const response = await createServiceApp(extractor).request('/extract', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      },
      body: JSON.stringify({ message }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ candidate });
    expect(extractor).toHaveBeenCalledOnce();
  });

  it('rejects cross-origin and oversized requests', async () => {
    process.env.CONTEXTFILL_EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
    const extractor = vi.fn(async () => extractDeterministic(message)!);
    const forbidden = await createServiceApp(extractor).request('/extract', {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    expect(forbidden.status).toBe(403);
    const oversized = await createServiceApp(extractor).request('/extract', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': '13000',
        origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      },
      body: '{}',
    });
    expect(oversized.status).toBe(413);
  });

  it('exposes normalized mailbox data only to the authenticated extension origin', async () => {
    process.env.CONTEXTFILL_EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
    const mailbox: MailboxManagerLike = {
      statuses: async () => [
        {
          provider: 'gmail',
          configured: true,
          connected: true,
          account: 'person@gmail.example',
          sessionOnly: false,
          credentialStorage: 'os-keychain',
        },
      ],
      beginConnection: vi.fn(async () => 'https://accounts.example/authorize'),
      completeConnection: vi.fn(async () => 'person@gmail.example'),
      disconnect: vi.fn(async () => undefined),
      listMessages: vi.fn(async () => [message]),
    };
    const app = createServiceApp(
      vi.fn(async () => extractDeterministic(message)!),
      mailbox,
    );
    const allowed = await app.request('/mail/messages/gmail', {
      headers: { origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' },
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ messages: [message] });

    const otherExtension = await app.request('/mail/messages/gmail', {
      headers: { origin: 'chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba' },
    });
    expect(otherExtension.status).toBe(401);
  });
});

describe('GPT structured-output validation', () => {
  it('rejects a model value absent from the untrusted source message', async () => {
    const responses = {
      create: vi.fn(async () => ({
        output_text: JSON.stringify({
          type: 'otp',
          value: '999999',
          claimedService: 'Northstar',
          referencedDomains: ['account.northstar.test'],
          expirationEvidence: 'expires in 10 minutes',
          confidence: 0.99,
          supportingText: [],
        }),
      })),
    } as unknown as ResponsesClient['responses'];
    await expect(extractWithGpt(message, { responses })).rejects.toThrow('not present');
  });
});
