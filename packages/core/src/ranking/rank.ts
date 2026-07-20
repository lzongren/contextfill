import { domainsAlign } from '../domains/index.js';
import { evaluateTrust, type PolicyOptions } from '../policy/evaluate.js';
import type { PageContext, RankedCandidate, VerificationCandidate } from '../types.js';

const policyWeight = { allow: 100, warn: 40, block: -40 } as const;

export function rankCandidates(
  candidates: VerificationCandidate[],
  page: PageContext,
  options: PolicyOptions = {},
): RankedCandidate[] {
  const now = options.now ?? new Date();
  return candidates
    .filter((candidate) => candidate.type === 'otp' && candidate.value)
    .map((candidate) => {
      const policy = evaluateTrust(candidate, page, options);
      const ageMinutes = Math.max(
        0,
        (now.getTime() - new Date(candidate.receivedAt).getTime()) / 60_000,
      );
      let score =
        policyWeight[policy.decision] + candidate.confidence * 20 - Math.min(ageMinutes, 60);
      const rationale: string[] = [];
      if (candidate.referencedDomains.some((domain) => domainsAlign(page.hostname, domain))) {
        score += 30;
        rationale.push('message domain matches the requesting site');
      }
      if (
        candidate.claimedService &&
        page.serviceHint &&
        candidate.claimedService.toLowerCase() === page.serviceHint.toLowerCase()
      ) {
        score += 20;
        rationale.push('claimed service matches the page');
      }
      if (ageMinutes <= 5) {
        score += 12;
        rationale.push('message is recent');
      }
      if (candidate.expiresAt && new Date(candidate.expiresAt).getTime() <= now.getTime()) {
        score -= 200;
        rationale.push('message is expired');
      }
      if (policy.reasonCode === 'used') {
        score -= 200;
        rationale.push('candidate was already used');
      }
      return { candidate, policy, score, rationale };
    })
    .sort(
      (a, b) => b.score - a.score || b.candidate.receivedAt.localeCompare(a.candidate.receivedAt),
    );
}
