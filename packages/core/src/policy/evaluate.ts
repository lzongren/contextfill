import {
  analyzeHost,
  detectLookalike,
  domainsAlign,
  normalizeHostname,
  senderDomain,
} from '../domains/index.js';
import type { PageContext, PolicyResult, VerificationCandidate } from '../types.js';

export type PolicyOptions = {
  now?: Date;
  usedCandidateIds?: ReadonlySet<string>;
  maxAgeMinutes?: number;
};

const normalizedService = (value: string | null) =>
  value
    ?.normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') ?? null;

function result(
  partial: Omit<PolicyResult, 'activeRegistrableDomain' | 'matchedDomain' | 'lookalikeSignals'>,
  activeRegistrableDomain: string | null,
  matchedDomain: string | null = null,
  lookalikeSignals: string[] = [],
): PolicyResult {
  return { ...partial, activeRegistrableDomain, matchedDomain, lookalikeSignals };
}

export function evaluateTrust(
  candidate: VerificationCandidate,
  page: PageContext,
  options: PolicyOptions = {},
): PolicyResult {
  const now = options.now ?? new Date();
  const maxAgeMs = (options.maxAgeMinutes ?? 15) * 60_000;
  const active = analyzeHost(page.hostname);
  const used = options.usedCandidateIds?.has(candidate.id) ?? false;

  if (page.fieldKind === 'none') {
    return result(
      {
        decision: 'block',
        reason: 'No usable verification-code field was found on this page.',
        reasonCode: 'no_field',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }
  if (candidate.type !== 'otp' || !candidate.value) {
    return result(
      {
        decision: 'block',
        reason: 'This message does not contain a supported verification code.',
        reasonCode: 'unsupported_candidate',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }
  if (used) {
    return result(
      {
        decision: 'block',
        reason: 'This code was already filled during this browser session.',
        reasonCode: 'used',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }
  const expiresAt = candidate.expiresAt ? new Date(candidate.expiresAt).getTime() : null;
  if (expiresAt !== null && expiresAt <= now.getTime()) {
    return result(
      {
        decision: 'block',
        reason: 'The message says this verification code has expired.',
        reasonCode: 'expired',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }
  const ageMs = now.getTime() - new Date(candidate.receivedAt).getTime();
  if (ageMs < -60_000 || ageMs > maxAgeMs) {
    return result(
      {
        decision: 'block',
        reason: 'The message is outside the 15-minute verification window.',
        reasonCode: 'stale',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }

  const pageService = normalizedService(page.serviceHint);
  const claimedService = normalizedService(candidate.claimedService);
  if (pageService && claimedService && pageService !== claimedService) {
    return result(
      {
        decision: 'block',
        reason: `The page represents ${page.serviceHint}, but the message is for ${candidate.claimedService}.`,
        reasonCode: 'service_mismatch',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }

  const evidenceDomains = candidate.referencedDomains.map(normalizeHostname).filter(Boolean);
  const matchedDomain =
    evidenceDomains.find((domain) => domainsAlign(page.hostname, domain)) ?? null;
  const lookalikeSignals = detectLookalike(page.hostname, evidenceDomains);
  if (evidenceDomains.length > 0 && !matchedDomain) {
    return result(
      {
        decision: 'block',
        reason:
          lookalikeSignals.length > 0
            ? 'The requesting site resembles the message domain but has a different registrable domain.'
            : 'The requesting site does not match any domain referenced by the message.',
        reasonCode: lookalikeSignals.length > 0 ? 'lookalike' : 'domain_mismatch',
        canOverride: false,
      },
      active.registrableDomain,
      null,
      lookalikeSignals,
    );
  }

  const sender = senderDomain(candidate.senderAddress);
  if (sender && matchedDomain && !domainsAlign(sender, matchedDomain)) {
    return result(
      {
        decision: 'warn',
        reason:
          'The page matches a domain in the message, but the sender uses a different registrable domain.',
        reasonCode: 'sender_conflict',
        canOverride: true,
      },
      active.registrableDomain,
      matchedDomain,
    );
  }
  if (!matchedDomain) {
    return result(
      {
        decision: 'warn',
        reason: 'The service name is plausible, but the message provides no domain evidence.',
        reasonCode: 'missing_domain_evidence',
        canOverride: true,
      },
      active.registrableDomain,
    );
  }
  if (candidate.confidence < 0.8) {
    return result(
      {
        decision: 'warn',
        reason: 'The message and site match, but extraction confidence is only moderate.',
        reasonCode: 'moderate_confidence',
        canOverride: true,
      },
      active.registrableDomain,
      matchedDomain,
    );
  }
  return result(
    {
      decision: 'allow',
      reason: `The page and message share ${active.registrableDomain}, and the code is recent and unused.`,
      reasonCode: 'aligned',
      canOverride: false,
    },
    active.registrableDomain,
    matchedDomain,
  );
}
