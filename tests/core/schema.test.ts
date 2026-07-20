import { describe, expect, it } from 'vitest';
import { makeSyntheticInbox, verificationCandidateSchema } from '../../packages/core/src/index.js';

const now = new Date('2026-07-20T19:00:00.000Z');

describe('candidate schema', () => {
  it('accepts a complete deterministic candidate', () => {
    const message = makeSyntheticInbox(now)[0];
    expect(message).toBeDefined();
    expect(
      verificationCandidateSchema.safeParse({
        id: 'candidate-1',
        messageId: message?.id,
        type: 'otp',
        value: '481203',
        claimedService: 'Northstar',
        referencedDomains: ['northstar.test'],
        senderName: message?.senderName,
        senderAddress: message?.senderAddress,
        subject: message?.subject,
        receivedAt: message?.receivedAt,
        expiresAt: message?.expiresAt,
        confidence: 0.99,
        supportingText: ['verification code near the candidate'],
        extractionMethod: 'deterministic',
      }).success,
    ).toBe(true);
  });

  it('rejects malformed or extra model fields', () => {
    const parsed = verificationCandidateSchema.safeParse({
      id: 'bad',
      messageId: 'message',
      type: 'otp',
      value: '123456',
      claimedService: null,
      referencedDomains: [],
      senderName: null,
      senderAddress: null,
      subject: 'Subject',
      receivedAt: 'not-a-date',
      expiresAt: null,
      confidence: 4,
      supportingText: [],
      extractionMethod: 'gpt-5.6',
      authorize: true,
    });
    expect(parsed.success).toBe(false);
  });
});
