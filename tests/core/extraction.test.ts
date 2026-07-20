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

  it('classifies a magic link without offering an OTP value', () => {
    const magic = extractDeterministic(messages.find((message) => message.id === 'magic-link')!);
    expect(magic).toMatchObject({ type: 'magic_link', value: null });
  });

  it('extracts every supported fixture without throwing', () => {
    const candidates = extractInboxDeterministic(messages);
    expect(candidates.map((candidate) => candidate.messageId)).not.toContain('receipt-unrelated');
    expect(candidates.length).toBeGreaterThanOrEqual(7);
  });
});
