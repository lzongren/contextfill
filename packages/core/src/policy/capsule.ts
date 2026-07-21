import {
  analyzeHost,
  detectLookalike,
  domainsAlign,
  normalizeHostname,
  senderDomain,
} from '../domains/index.js';
import {
  capsulePageContextSchema,
  contextCapsuleSchema,
  mailboxMessageSchema,
  type CapsulePageContext,
  type CapsulePolicyResult,
  type ContextCapsule,
  type MailboxMessage,
} from '../types.js';

export type CapsulePolicyOptions = {
  now?: Date;
  usedCapsuleIds?: ReadonlySet<string>;
  hasConflictingRecentMessages?: boolean;
  maxMessageAgeMinutes?: number;
};

const normalizedService = (value: string | null) =>
  value
    ?.normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '') ?? null;

function blocked(
  capsuleId: string,
  reasonCode: CapsulePolicyResult['reasonCode'],
  reason: string,
  activeRegistrableDomain: string | null,
  matchedDomain: string | null = null,
  lookalikeSignals: string[] = [],
): CapsulePolicyResult {
  return {
    capsuleId,
    decision: 'block',
    reason,
    reasonCode,
    activeRegistrableDomain,
    matchedDomain,
    lookalikeSignals,
  };
}

function appearsInMessage(value: string, message: MailboxMessage): boolean {
  return `${message.subject}\n${message.body}`
    .toLocaleLowerCase()
    .includes(value.toLocaleLowerCase());
}

export function authorizeContextCapsule(
  capsuleInput: ContextCapsule,
  messageInput: MailboxMessage,
  pageInput: CapsulePageContext,
  options: CapsulePolicyOptions = {},
): CapsulePolicyResult {
  const capsuleResult = contextCapsuleSchema.safeParse(capsuleInput);
  const messageResult = mailboxMessageSchema.safeParse(messageInput);
  const pageResult = capsulePageContextSchema.safeParse(pageInput);
  const capsuleId = capsuleResult.success ? capsuleResult.data.id : 'invalid-capsule';
  const pageHost = pageResult.success ? pageResult.data.hostname : '';
  const active = analyzeHost(pageHost);
  if (!capsuleResult.success || !messageResult.success || !pageResult.success) {
    return blocked(
      capsuleId,
      'invalid_capsule',
      'The capsule, message, or page context failed strict validation.',
      active.registrableDomain,
    );
  }
  const capsule = capsuleResult.data;
  const message = messageResult.data;
  const page = pageResult.data;
  const now = options.now ?? new Date();
  if (capsule.intent !== 'travel_check_in') {
    return blocked(
      capsule.id,
      'unsupported_intent',
      'Only airline check-in capsules are supported in this release.',
      active.registrableDomain,
    );
  }
  if (capsule.messageId !== message.id) {
    return blocked(
      capsule.id,
      'message_mismatch',
      'The capsule is not bound to this source message.',
      active.registrableDomain,
    );
  }
  if (
    capsule.facts.some(
      (fact) =>
        !appearsInMessage(fact.value, message) ||
        fact.supportingText.some((supportingText) => !appearsInMessage(supportingText, message)),
    )
  ) {
    return blocked(
      capsule.id,
      'invented_evidence',
      'One or more capsule facts are not supported by the source message.',
      active.registrableDomain,
    );
  }
  if (capsule.facts.some((fact) => fact.confidence < 0.8)) {
    return blocked(
      capsule.id,
      'low_confidence',
      'One or more extracted facts do not meet the confidence threshold.',
      active.registrableDomain,
    );
  }
  if (options.usedCapsuleIds?.has(capsule.id)) {
    return blocked(
      capsule.id,
      'used',
      'This context capsule was already transferred during this browser session.',
      active.registrableDomain,
    );
  }
  if (new Date(capsule.expiresAt).getTime() <= now.getTime()) {
    return blocked(
      capsule.id,
      'expired',
      'This context capsule has expired. Run a fresh scan to continue.',
      active.registrableDomain,
    );
  }
  const ageMs = now.getTime() - new Date(message.receivedAt).getTime();
  const maxAgeMs = (options.maxMessageAgeMinutes ?? 24 * 60) * 60_000;
  if (ageMs < -60_000 || ageMs > maxAgeMs) {
    return blocked(
      capsule.id,
      'stale',
      'The booking message is outside the supported 24-hour check-in window.',
      active.registrableDomain,
    );
  }
  if (options.hasConflictingRecentMessages) {
    return blocked(
      capsule.id,
      'conflicting_messages',
      'Multiple recent booking messages contain different passenger details. No capsule was chosen.',
      active.registrableDomain,
    );
  }
  const pageService = normalizedService(page.serviceHint);
  const claimedService = normalizedService(capsule.claimedService);
  if (pageService && claimedService && pageService !== claimedService) {
    return blocked(
      capsule.id,
      'service_mismatch',
      `The page represents ${page.serviceHint}, but the message is for ${capsule.claimedService}.`,
      active.registrableDomain,
    );
  }
  const evidenceDomains = capsule.referencedDomains.map(normalizeHostname).filter(Boolean);
  if (evidenceDomains.length === 0) {
    return blocked(
      capsule.id,
      'missing_domain_evidence',
      'The message does not provide domain evidence for this airline.',
      active.registrableDomain,
    );
  }
  const matchedDomain =
    evidenceDomains.find((domain) => domainsAlign(page.hostname, domain)) ?? null;
  if (!matchedDomain) {
    const signals = detectLookalike(page.hostname, evidenceDomains);
    return blocked(
      capsule.id,
      signals.length > 0 ? 'lookalike' : 'domain_mismatch',
      signals.length > 0
        ? 'The requesting site resembles the airline domain but has a different registrable domain.'
        : 'The requesting website does not match any domain referenced by the booking message.',
      active.registrableDomain,
      null,
      signals,
    );
  }
  const sender = senderDomain(message.senderAddress);
  if (!sender || !domainsAlign(sender, matchedDomain)) {
    return blocked(
      capsule.id,
      'sender_conflict',
      sender
        ? 'The page matches the message, but the sender uses a different registrable domain.'
        : 'The source message has no verifiable sender domain.',
      active.registrableDomain,
      matchedDomain,
    );
  }
  return {
    capsuleId: capsule.id,
    decision: 'allow',
    reason: `Sender, airline, message domain, requesting website, freshness, and task intent align for ${matchedDomain}.`,
    reasonCode: 'aligned',
    activeRegistrableDomain: active.registrableDomain,
    matchedDomain,
    lookalikeSignals: [],
  };
}
