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
});
