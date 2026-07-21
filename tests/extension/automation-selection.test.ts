import { describe, expect, it } from 'vitest';
import { selectAutomaticCandidate } from '../../apps/extension/src/automation-selection.js';
import {
  extractInboxDeterministic,
  makeSyntheticInbox,
  messagesForScenario,
  rankCandidates,
  type PageContext,
  type SyntheticMessage,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-21T08:00:00.000Z');
const page: PageContext = {
  hostname: 'account.northstar.test',
  serviceHint: 'Northstar',
  simulated: true,
  scenario: 'legitimate-single',
  fieldKind: 'single',
  fieldCount: 1,
};

function ranked(messages: SyntheticMessage[], context = page) {
  return rankCandidates(extractInboxDeterministic(messages), context, { now });
}

describe('automatic candidate selection', () => {
  it('selects the newest relevant unused OTP when an older trusted code also exists', () => {
    const result = selectAutomaticCandidate(ranked(messagesForScenario('legitimate-single', now)), [
      'otp',
    ]);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.ranked.candidate.value).toBe('481203');
  });

  it('preserves deterministic trust blocks for lookalike sites', () => {
    const lookalike = { ...page, hostname: 'account.n0rthstar.test', scenario: 'lookalike' };
    const result = selectAutomaticCandidate(
      ranked(messagesForScenario('lookalike', now), lookalike),
      ['otp'],
    );
    expect(result).toMatchObject({ status: 'blocked', reasonCode: 'lookalike' });
  });

  it('blocks instead of guessing when two different trusted messages compete within 90 seconds', () => {
    const source = makeSyntheticInbox(now).find((message) => message.id === 'northstar-current')!;
    const competing: SyntheticMessage = {
      ...source,
      id: 'northstar-competing',
      body: source.body.replace('481203', '725904'),
      receivedAt: new Date(now.getTime() - 2.5 * 60_000).toISOString(),
    };
    const result = selectAutomaticCandidate(ranked([source, competing]), ['otp']);
    expect(result).toMatchObject({ status: 'blocked', reasonCode: 'competing_messages' });
  });
});
