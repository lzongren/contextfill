import { inspectMagicLink, isSupportedMagicLinkText } from '../actions/links.js';
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
  const active = analyzeHost(page.hostname);
  const used = options.usedCandidateIds?.has(candidate.id) ?? false;
  const isMagicLink = candidate.type === 'magic_link';
  const isReference = candidate.type === 'reference';
  const maxAgeMinutes = options.maxAgeMinutes ?? (isReference ? 24 * 60 : 15);
  const maxAgeMs = maxAgeMinutes * 60_000;

  if (!candidate.value || !['otp', 'magic_link', 'reference'].includes(candidate.type)) {
    return result(
      {
        decision: 'block',
        reason: 'This message does not contain a supported temporary action.',
        reasonCode: 'unsupported_candidate',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }
  if (
    (candidate.type === 'otp' && !['single', 'split'].includes(page.fieldKind)) ||
    (isReference && page.fieldKind !== 'reference')
  ) {
    return result(
      {
        decision: 'block',
        reason: isReference
          ? 'No matching reference field was found on this page.'
          : 'No usable verification-code field was found on this page.',
        reasonCode: 'no_field',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }
  const linkInspection = isMagicLink ? inspectMagicLink(candidate.value) : null;
  if (
    isMagicLink &&
    (!isSupportedMagicLinkText(`${candidate.subject}\n${candidate.supportingText.join('\n')}`) ||
      !linkInspection?.safe)
  ) {
    return result(
      {
        decision: 'block',
        reason:
          linkInspection?.reason ??
          'Only magic-login and email-confirmation links are eligible for verified handoff.',
        reasonCode: linkInspection?.safe === false ? 'unsafe_link' : 'unsupported_candidate',
        canOverride: false,
      },
      active.registrableDomain,
    );
  }
  if (used) {
    return result(
      {
        decision: 'block',
        reason: isMagicLink
          ? 'This action link was already opened during this browser session.'
          : isReference
            ? 'This reference was already transferred during this browser session.'
            : 'This code was already filled during this browser session.',
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
        reason: isMagicLink
          ? 'The message says this action link has expired.'
          : isReference
            ? 'The message says this reference is no longer valid.'
            : 'The message says this verification code has expired.',
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
        reason: `The message is outside the ${isReference ? '24-hour reference' : '15-minute temporary-action'} window.`,
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

  if (isMagicLink && linkInspection?.safe && linkInspection.hostname) {
    const destination = linkInspection.hostname;
    const destinationMatchesPage = domainsAlign(page.hostname, destination);
    const lookalikeSignals = detectLookalike(page.hostname, [destination]);
    if (!destinationMatchesPage) {
      return result(
        {
          decision: 'block',
          reason:
            lookalikeSignals.length > 0
              ? 'The requesting site resembles the link destination but has a different registrable domain.'
              : 'The link destination does not match the site that initiated this action.',
          reasonCode: lookalikeSignals.length > 0 ? 'lookalike' : 'destination_mismatch',
          canOverride: false,
        },
        active.registrableDomain,
        null,
        lookalikeSignals,
      );
    }

    const sender = senderDomain(candidate.senderAddress);
    if (!sender || !domainsAlign(sender, destination)) {
      return result(
        {
          decision: 'warn',
          reason: sender
            ? 'The page and link destination match, but the sender uses a different registrable domain.'
            : 'The page and link destination match, but the message has no verifiable sender domain.',
          reasonCode: 'sender_conflict',
          canOverride: false,
        },
        active.registrableDomain,
        destination,
      );
    }
    if (candidate.confidence < 0.8) {
      return result(
        {
          decision: 'warn',
          reason:
            'The page, sender, and link destination match, but extraction confidence is only moderate.',
          reasonCode: 'moderate_confidence',
          canOverride: false,
        },
        active.registrableDomain,
        destination,
      );
    }
    return result(
      {
        decision: 'allow',
        reason: `The page, sender, and link destination share ${active.registrableDomain}; the message is recent and unused.`,
        reasonCode: 'aligned',
        canOverride: false,
      },
      active.registrableDomain,
      destination,
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
      reason: `The page and message share ${active.registrableDomain}, and the ${isReference ? 'reference' : 'code'} is recent and unused.`,
      reasonCode: 'aligned',
      canOverride: false,
    },
    active.registrableDomain,
    matchedDomain,
  );
}
