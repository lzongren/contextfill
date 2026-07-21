import { describe, expect, it } from 'vitest';
import {
  extractDeterministic,
  extractInboxDeterministic,
  makeSyntheticInbox,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-20T19:00:00.000Z');

describe('deterministic extraction', () => {
  const messages = makeSyntheticInbox(now);

  it('extracts numeric and alphanumeric verification codes', () => {
    const numeric = extractDeterministic(
      messages.find((message) => message.id === 'northstar-current')!,
    );
    const alpha = extractDeterministic(
      messages.find((message) => message.id === 'bluerail-current')!,
    );
    expect(numeric).toMatchObject({ value: '481203', claimedService: 'Northstar', type: 'otp' });
    expect(numeric?.referencedDomains).toContain('account.northstar.test');
    expect(alpha).toMatchObject({ value: 'BR7K9Q', claimedService: 'BlueRail', type: 'otp' });
  });

  it('ignores an unrelated receipt despite several numbers', () => {
    const receipt = messages.find((message) => message.id === 'receipt-unrelated')!;
    expect(extractDeterministic(receipt)).toBeNull();
  });

  it('recognizes common real-mailbox passcode wording', () => {
    expect(
      extractDeterministic({
        id: 'gmail:passcode',
        source: 'gmail',
        senderName: 'Example Security',
        senderAddress: 'security@example.com',
        subject: 'Your account passcode',
        body: 'Your sign-in passcode is 654321. Use it only at account.example.com.',
        receivedAt: now.toISOString(),
        expiresAt: null,
        serviceHint: 'Example',
      }),
    ).toMatchObject({ value: '654321', type: 'otp' });
  });

  it('extracts the exact magic-login URL as an action candidate', () => {
    const magic = extractDeterministic(messages.find((message) => message.id === 'magic-link')!);
    expect(magic).toMatchObject({
      type: 'magic_link',
      value: 'https://login.cedarnotes.test/magic/sample-token',
    });
  });

  it('supports email confirmation but rejects high-risk recovery links', () => {
    const base = {
      source: 'gmail' as const,
      senderName: 'Example',
      senderAddress: 'hello@example.test',
      receivedAt: now.toISOString(),
      expiresAt: null,
      serviceHint: 'Example',
    };
    expect(
      extractDeterministic({
        ...base,
        id: 'confirm-email',
        subject: 'Confirm your email',
        body: 'Confirm your email at https://account.example.test/confirm/token-value.',
      }),
    ).toMatchObject({
      type: 'magic_link',
      value: 'https://account.example.test/confirm/token-value',
    });
    expect(
      extractDeterministic({
        ...base,
        id: 'password-reset',
        subject: 'Reset your password',
        body: 'Use this password reset link: https://account.example.test/reset/token-value.',
      }),
    ).toBeNull();
  });

  it('does not mistake an unsubscribe URL for a mentioned magic link', () => {
    expect(
      extractDeterministic({
        id: 'unsubscribe-only',
        source: 'gmail',
        senderName: 'Example',
        senderAddress: 'hello@example.test',
        subject: 'Your magic link was sent separately',
        body: 'Manage preferences or unsubscribe: https://example.test/unsubscribe/list-token',
        receivedAt: now.toISOString(),
        expiresAt: null,
        serviceHint: 'Example',
      }),
    ).toBeNull();
  });

  it('extracts an explicit booking reference but not a generic order number', () => {
    const reference = extractDeterministic(
      messages.find((message) => message.id === 'booking-reference')!,
    );
    expect(reference).toMatchObject({
      type: 'reference',
      value: 'CT-7K92Q',
      claimedService: 'Cedar Travel',
      referencedDomains: ['trips.cedartravel.test'],
    });
    expect(
      extractDeterministic(messages.find((message) => message.id === 'receipt-unrelated')!),
    ).toBeNull();
  });

  it('extracts every supported fixture without throwing', () => {
    const candidates = extractInboxDeterministic(messages);
    expect(candidates.map((candidate) => candidate.messageId)).not.toContain('receipt-unrelated');
    expect(candidates.length).toBeGreaterThanOrEqual(7);
  });
});
