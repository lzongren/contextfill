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
});
