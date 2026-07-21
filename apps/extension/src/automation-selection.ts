import type { RankedCandidate } from '../../../packages/core/src/index.js';

export type AutomaticIntent = 'otp' | 'magic_link';

export type AutomaticSelection =
  | { status: 'empty'; reason: string }
  | { status: 'blocked'; ranked: RankedCandidate; reason: string; reasonCode: string }
  | { status: 'ready'; ranked: RankedCandidate };

function matchesIntent(ranked: RankedCandidate, intents: readonly AutomaticIntent[]): boolean {
  return (
    (ranked.candidate.type === 'otp' && intents.includes('otp')) ||
    (ranked.candidate.type === 'magic_link' && intents.includes('magic_link'))
  );
}

function receivedAt(ranked: RankedCandidate): number {
  return new Date(ranked.candidate.receivedAt).getTime();
}

export function selectAutomaticCandidate(
  rankedCandidates: RankedCandidate[],
  intents: readonly AutomaticIntent[],
): AutomaticSelection {
  const relevant = rankedCandidates.filter((ranked) => matchesIntent(ranked, intents));
  const first = relevant[0];
  if (!first) {
    return { status: 'empty', reason: 'No recent message matches what this page is requesting.' };
  }
  if (first.policy.decision !== 'allow') {
    return {
      status: 'blocked',
      ranked: first,
      reason: first.policy.reason,
      reasonCode: first.policy.reasonCode,
    };
  }

  const competing = relevant.find(
    (candidate, index) =>
      index > 0 &&
      candidate.policy.decision === 'allow' &&
      candidate.candidate.value !== first.candidate.value &&
      Math.abs(receivedAt(first) - receivedAt(candidate)) <= 90_000,
  );
  if (competing) {
    return {
      status: 'blocked',
      ranked: first,
      reason:
        'Multiple recent trusted messages could satisfy this page. Open ContextFill to choose manually.',
      reasonCode: 'competing_messages',
    };
  }

  return { status: 'ready', ranked: first };
}
