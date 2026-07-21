import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceApp } from '../../apps/local-service/src/app.js';
import {
  extractCapsuleWithGpt,
  extractWithGpt,
  type ResponsesClient,
} from '../../apps/local-service/src/extractor.js';
import type { MailboxManagerLike } from '../../apps/local-service/src/mailbox.js';
import {
  extractContextCapsuleDeterministic,
  extractDeterministic,
  makeCapsuleInbox,
  makeSyntheticInbox,
} from '../../packages/core/src/index.js';

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
    expect(mailbox.listMessages).toHaveBeenCalledWith('gmail', 'temporary_action');

    const easyJet = await app.request('/mail/messages/gmail?purpose=easyjet_booking_lookup', {
      headers: { origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' },
    });
    expect(easyJet.status).toBe(200);
    expect(mailbox.listMessages).toHaveBeenLastCalledWith('gmail', 'easyjet_booking_lookup');

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

  it('rejects model classification of a password-reset link even when copied verbatim', async () => {
    const resetMessage = {
      ...message,
      id: 'password-reset',
      subject: 'Reset your password',
      body: 'Use this password reset link: https://account.northstar.test/reset/private-token.',
    };
    const responses = {
      create: vi.fn(async () => ({
        output_text: JSON.stringify({
          type: 'magic_link',
          value: 'https://account.northstar.test/reset/private-token',
          claimedService: 'Northstar',
          referencedDomains: ['account.northstar.test'],
          expirationEvidence: null,
          confidence: 0.99,
          supportingText: ['password reset link'],
        }),
      })),
    } as unknown as ResponsesClient['responses'];
    await expect(extractWithGpt(resetMessage, { responses })).rejects.toThrow(
      'unsupported or high-risk',
    );
  });

  it('validates GPT capsule facts without accepting authorization or target fields', async () => {
    const capsuleMessage = makeCapsuleInbox(new Date('2026-07-21T18:00:00.000Z'))[0]!;
    const responses = {
      create: vi.fn(async () => ({
        output_text: JSON.stringify({
          intent: 'travel_check_in',
          claimedService: 'Aurelia Air',
          referencedDomains: ['checkin.aurelia-air.test'],
          facts: [
            {
              key: 'booking_reference',
              value: 'AU-47K2',
              confidence: 0.98,
              supportingText: ['Booking reference: AU-47K2'],
            },
            {
              key: 'passenger_surname',
              value: 'Rivera',
              confidence: 0.97,
              supportingText: ['Passenger surname: Rivera'],
            },
          ],
        }),
      })),
    } as unknown as ResponsesClient['responses'];
    const capsule = await extractCapsuleWithGpt(
      capsuleMessage,
      { responses },
      new Date('2026-07-21T18:00:00.000Z'),
    );
    expect(capsule).toMatchObject({
      extractionMethod: 'gpt-5.6',
      intent: 'travel_check_in',
      facts: [{ value: 'AU-47K2' }, { value: 'Rivera' }],
    });
    expect(capsule).not.toHaveProperty('authorization');
    expect(capsule).not.toHaveProperty('targetFields');
    expect(extractContextCapsuleDeterministic(capsuleMessage)).not.toBeNull();
  });
});
