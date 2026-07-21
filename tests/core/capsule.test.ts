import { describe, expect, it } from 'vitest';
import {
  authorizeContextCapsule,
  contextCapsuleSchema,
  createContextCapsuleFromModelFacts,
  extractContextCapsuleDeterministic,
  extractContextCapsulesDeterministic,
  extractDeterministic,
  hasConflictingTravelCapsules,
  makeCapsuleInbox,
  maskContextCapsuleFact,
  maskContextCapsuleText,
  type CapsulePageContext,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-21T18:00:00.000Z');
const message = makeCapsuleInbox(now)[0]!;
const page: CapsulePageContext = {
  hostname: 'checkin.aurelia-air.test',
  serviceHint: 'Aurelia Air',
  simulated: true,
  scenario: 'capsule',
};
const easyJetMessage = {
  id: 'gmail:easyjet-synthetic',
  source: 'gmail' as const,
  senderName: 'confirmation@easyjet.com',
  senderAddress: 'private_alias_at_easyjet_com_random@icloud.com',
  senderRelay: {
    kind: 'apple_hide_my_email' as const,
    originalAddress: 'confirmation@easyjet.com',
  },
  subject: 'easyJet booking reference: EZ7TEST',
  body: 'Hi, Sample; here are details for your booking EZ7TEST. Manage it at https://www.easyjet.com/en.',
  receivedAt: '2024-08-10T12:00:00.000Z',
  expiresAt: null,
  serviceHint: 'easyJet',
};
const easyJetMessageWithSurname = {
  ...easyJetMessage,
  body: 'Hi, Sample; passenger surname: Rivera; here are details for your booking EZ7TEST. Manage it at https://www.easyjet.com/en.',
};
const easyJetPage: CapsulePageContext = {
  hostname: 'www.easyjet.com',
  serviceHint: 'easyJet',
  simulated: false,
  scenario: null,
};

describe('context capsule schema and extraction', () => {
  it('extracts only the two typed travel facts with a short expiry', () => {
    const capsule = extractContextCapsuleDeterministic(message, now)!;
    expect(contextCapsuleSchema.parse(capsule)).toMatchObject({
      id: 'capsule:aurelia-check-in-current',
      messageId: message.id,
      intent: 'travel_check_in',
      extractionMethod: 'deterministic',
      facts: [
        { key: 'booking_reference', value: 'AU-47K2' },
        { key: 'passenger_surname', value: 'Rivera' },
      ],
    });
    expect(new Date(capsule.expiresAt).getTime() - now.getTime()).toBe(90_000);
  });

  it('rejects malformed or duplicate fact bundles at the schema boundary', () => {
    const capsule = extractContextCapsuleDeterministic(message, now)!;
    expect(
      contextCapsuleSchema.safeParse({
        ...capsule,
        facts: [capsule.facts[0], capsule.facts[0]],
        authorization: 'allow',
      }).success,
    ).toBe(false);
  });

  it('validates model facts against verbatim message evidence', () => {
    const raw = {
      intent: 'travel_check_in',
      claimedService: 'Aurelia Air',
      referencedDomains: ['checkin.aurelia-air.test'],
      facts: [
        {
          key: 'booking_reference',
          value: 'AU-47K2',
          confidence: 0.97,
          supportingText: ['Booking reference: AU-47K2'],
        },
        {
          key: 'passenger_surname',
          value: 'Rivera',
          confidence: 0.96,
          supportingText: ['Passenger surname: Rivera'],
        },
      ],
    };
    expect(createContextCapsuleFromModelFacts(message, raw, now).extractionMethod).toBe('gpt-5.6');
    expect(() =>
      createContextCapsuleFromModelFacts(
        message,
        {
          ...raw,
          facts: [{ ...raw.facts[0], value: 'INVENTED' }, raw.facts[1]],
        },
        now,
      ),
    ).toThrow(/not present/);
  });

  it('masks both fact types without exposing full values', () => {
    const capsule = extractContextCapsuleDeterministic(message, now)!;
    const masked = capsule.facts.map(maskContextCapsuleFact);
    expect(masked).toEqual(['••••7K2', 'R•••••']);
    expect(masked.join(' ')).not.toContain('AU-47K2');
    expect(masked.join(' ')).not.toContain('Rivera');
    expect(maskContextCapsuleText('Booking AU-47K2 for Rivera is ready', capsule)).toBe(
      'Booking ••••7K2 for R••••• is ready',
    );
  });

  it('detects conflicting recent booking bundles', () => {
    const capsules = extractContextCapsulesDeterministic(makeCapsuleInbox(now).slice(0, 2), now);
    expect(hasConflictingTravelCapsules(capsules)).toBe(true);
    expect(hasConflictingTravelCapsules([capsules[0]!])).toBe(false);
  });

  it('does not mistake an easyJet greeting name for the passenger surname', () => {
    expect(extractContextCapsuleDeterministic(easyJetMessage, now)).toBeNull();
    expect(extractDeterministic(easyJetMessage)).toMatchObject({
      type: 'reference',
      value: 'EZ7TEST',
      senderAddress: 'confirmation@easyjet.com',
    });
  });

  it('extracts an easyJet capsule only when the message explicitly states the surname', () => {
    const capsule = extractContextCapsuleDeterministic(easyJetMessageWithSurname, now)!;
    expect(capsule.facts).toEqual([
      expect.objectContaining({ key: 'booking_reference', value: 'EZ7TEST' }),
      expect.objectContaining({ key: 'passenger_surname', value: 'Rivera' }),
    ]);
  });
});

describe('context capsule trust authorization', () => {
  it('allows an aligned, recent, unused capsule', () => {
    const capsule = extractContextCapsuleDeterministic(message, now)!;
    expect(authorizeContextCapsule(capsule, message, page, { now })).toMatchObject({
      decision: 'allow',
      reasonCode: 'aligned',
      matchedDomain: 'checkin.aurelia-air.test',
    });
  });

  it('blocks lookalikes, conflicts, expiry, staleness, and replay', () => {
    const capsule = extractContextCapsuleDeterministic(message, now)!;
    expect(
      authorizeContextCapsule(
        capsule,
        message,
        { ...page, hostname: 'checkin.aureliaair.test' },
        { now },
      ).reasonCode,
    ).toBe('lookalike');
    expect(
      authorizeContextCapsule(capsule, message, page, { now, hasConflictingRecentMessages: true })
        .reasonCode,
    ).toBe('conflicting_messages');
    expect(
      authorizeContextCapsule(capsule, message, page, { now: new Date(now.getTime() + 91_000) })
        .reasonCode,
    ).toBe('expired');
    const stale = makeCapsuleInbox(now)[2]!;
    const staleCapsule = extractContextCapsuleDeterministic(stale, now)!;
    expect(authorizeContextCapsule(staleCapsule, stale, page, { now }).reasonCode).toBe('stale');
    expect(
      authorizeContextCapsule(capsule, message, page, {
        now,
        usedCapsuleIds: new Set([capsule.id]),
      }).reasonCode,
    ).toBe('used');
  });

  it('accepts only an Apple relay address that encodes the easyJet sender domain', () => {
    const capsule = extractContextCapsuleDeterministic(easyJetMessageWithSurname, now)!;
    expect(
      authorizeContextCapsule(capsule, easyJetMessageWithSurname, easyJetPage, {
        now,
        maxMessageAgeMinutes: 5 * 365 * 24 * 60,
      }),
    ).toMatchObject({ decision: 'allow', reasonCode: 'aligned', matchedDomain: 'www.easyjet.com' });
    expect(
      authorizeContextCapsule(
        capsule,
        {
          ...easyJetMessageWithSurname,
          senderAddress: 'private_alias_at_attacker_com_random@icloud.com',
        },
        easyJetPage,
        { now, maxMessageAgeMinutes: 5 * 365 * 24 * 60 },
      ).reasonCode,
    ).toBe('sender_conflict');
  });
});
