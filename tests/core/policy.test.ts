import { describe, expect, it } from 'vitest';
import {
  evaluateTrust,
  extractDeterministic,
  makeSyntheticInbox,
  type PageContext,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-20T19:00:00.000Z');
const inbox = makeSyntheticInbox(now);
const current = extractDeterministic(inbox.find((message) => message.id === 'northstar-current')!)!;
const magicLink = extractDeterministic(inbox.find((message) => message.id === 'magic-link')!)!;
const reference = extractDeterministic(
  inbox.find((message) => message.id === 'booking-reference')!,
)!;
const basePage: PageContext = {
  hostname: 'account.northstar.test',
  serviceHint: 'Northstar',
  simulated: true,
  scenario: 'legitimate-single',
  fieldKind: 'single',
  fieldCount: 1,
};

describe('deterministic trust policy', () => {
  it('allows a recent aligned unused candidate', () => {
    expect(evaluateTrust(current, basePage, { now })).toMatchObject({
      decision: 'allow',
      reasonCode: 'aligned',
    });
  });

  it.each([
    ['lookalike', { ...basePage, hostname: 'account.n0rthstar.test' }, 'lookalike'],
    ['different service', { ...basePage, serviceHint: 'BlueRail' }, 'service_mismatch'],
  ])('blocks %s evidence', (_label, page, reasonCode) => {
    expect(evaluateTrust(current, page, { now })).toMatchObject({ decision: 'block', reasonCode });
  });

  it('blocks an expired candidate and a used candidate', () => {
    const expired = extractDeterministic(
      inbox.find((message) => message.id === 'northstar-expired')!,
    )!;
    expect(evaluateTrust(expired, basePage, { now })).toMatchObject({
      decision: 'block',
      reasonCode: 'expired',
    });
    expect(
      evaluateTrust(current, basePage, { now, usedCandidateIds: new Set([current.id]) }),
    ).toMatchObject({
      decision: 'block',
      reasonCode: 'used',
    });
  });

  it('warns when sender evidence conflicts but never silently allows', () => {
    const ambiguous = extractDeterministic(
      inbox.find((message) => message.id === 'ambiguous-sender')!,
    )!;
    expect(evaluateTrust(ambiguous, basePage, { now })).toMatchObject({
      decision: 'warn',
      reasonCode: 'sender_conflict',
      canOverride: true,
    });
  });

  it('allows a verified magic link on an aligned fieldless initiating page', () => {
    const page: PageContext = {
      ...basePage,
      hostname: 'login.cedarnotes.test',
      serviceHint: 'Cedar Notes',
      scenario: 'magic-link',
      fieldKind: 'none',
      fieldCount: 0,
    };
    expect(evaluateTrust(magicLink, page, { now })).toMatchObject({
      decision: 'allow',
      reasonCode: 'aligned',
      matchedDomain: 'login.cedarnotes.test',
    });
  });

  it('blocks magic-link lookalikes, unrelated destinations, unsafe URLs, and replay', () => {
    const page: PageContext = {
      ...basePage,
      hostname: 'login.cedarnotes.test',
      serviceHint: 'Cedar Notes',
      scenario: 'magic-link',
      fieldKind: 'none',
      fieldCount: 0,
    };
    expect(
      evaluateTrust(magicLink, { ...page, hostname: 'login.cedarn0tes.test' }, { now }),
    ).toMatchObject({ decision: 'block', reasonCode: 'lookalike' });
    expect(
      evaluateTrust({ ...magicLink, value: 'https://unrelated.test/magic/sample-token' }, page, {
        now,
      }),
    ).toMatchObject({ decision: 'block', reasonCode: 'destination_mismatch' });
    expect(
      evaluateTrust(
        { ...magicLink, value: 'http://login.cedarnotes.test/magic/sample-token' },
        page,
        { now },
      ),
    ).toMatchObject({ decision: 'block', reasonCode: 'unsafe_link' });
    expect(
      evaluateTrust(magicLink, page, { now, usedCandidateIds: new Set([magicLink.id]) }),
    ).toMatchObject({ decision: 'block', reasonCode: 'used' });
    expect(
      evaluateTrust(
        {
          ...magicLink,
          receivedAt: new Date(now.getTime() - 16 * 60_000).toISOString(),
          expiresAt: null,
        },
        page,
        { now },
      ),
    ).toMatchObject({ decision: 'block', reasonCode: 'stale' });
  });

  it('does not allow link navigation when sender evidence is missing or conflicts', () => {
    const page: PageContext = {
      ...basePage,
      hostname: 'login.cedarnotes.test',
      serviceHint: 'Cedar Notes',
      scenario: 'magic-link',
      fieldKind: 'none',
      fieldCount: 0,
    };
    expect(
      evaluateTrust({ ...magicLink, senderAddress: 'delivery@mailer.test' }, page, { now }),
    ).toMatchObject({ decision: 'warn', reasonCode: 'sender_conflict', canOverride: false });
  });

  it('allows an aligned reference field and blocks a reference-site lookalike', () => {
    const page: PageContext = {
      ...basePage,
      hostname: 'trips.cedartravel.test',
      serviceHint: 'Cedar Travel',
      scenario: 'reference',
      fieldKind: 'reference',
      fieldCount: 1,
    };
    expect(evaluateTrust(reference, page, { now })).toMatchObject({
      decision: 'allow',
      reasonCode: 'aligned',
    });
    expect(
      evaluateTrust(reference, { ...page, hostname: 'trips.cedar-travel.test' }, { now }),
    ).toMatchObject({ decision: 'block', reasonCode: 'lookalike' });
    expect(evaluateTrust(reference, { ...page, fieldKind: 'single' }, { now })).toMatchObject({
      decision: 'block',
      reasonCode: 'no_field',
    });
  });
});
