import { describe, expect, it } from 'vitest';
import {
  extractInboxDeterministic,
  makeSyntheticInbox,
  rankCandidates,
  type PageContext,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-20T19:00:00.000Z');
const page: PageContext = {
  hostname: 'account.northstar.test',
  serviceHint: 'Northstar',
  simulated: true,
  scenario: 'legitimate-single',
  fieldKind: 'single',
  fieldCount: 1,
};

describe('candidate ranking', () => {
  it('selects the newest relevant aligned verification code', () => {
    const ranked = rankCandidates(extractInboxDeterministic(makeSyntheticInbox(now)), page, {
      now,
    });
    expect(ranked[0]?.candidate.value).toBe('481203');
    expect(ranked[0]?.policy.decision).toBe('allow');
    expect(ranked[0]?.rationale).toContain('message is recent');
  });

  it('selects the aligned magic link for a fieldless initiating page', () => {
    const magicPage: PageContext = {
      ...page,
      hostname: 'login.cedarnotes.test',
      serviceHint: 'Cedar Notes',
      scenario: 'magic-link',
      fieldKind: 'none',
      fieldCount: 0,
    };
    const ranked = rankCandidates(extractInboxDeterministic(makeSyntheticInbox(now)), magicPage, {
      now,
    });
    expect(ranked[0]?.candidate.type).toBe('magic_link');
    expect(ranked[0]?.policy.decision).toBe('allow');
    expect(ranked[0]?.rationale).toContain('fieldless page matches a verified-link action');
  });

  it('selects the aligned reference for an explicitly labeled reference field', () => {
    const referencePage: PageContext = {
      ...page,
      hostname: 'trips.cedartravel.test',
      serviceHint: 'Cedar Travel',
      scenario: 'reference',
      fieldKind: 'reference',
      fieldCount: 1,
    };
    const ranked = rankCandidates(
      extractInboxDeterministic(makeSyntheticInbox(now)),
      referencePage,
      { now },
    );
    expect(ranked[0]?.candidate).toMatchObject({ type: 'reference', value: 'CT-7K92Q' });
    expect(ranked[0]?.policy.decision).toBe('allow');
  });
});
