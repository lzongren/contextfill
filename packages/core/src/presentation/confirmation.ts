import { inspectMagicLink } from '../actions/links.js';
import type { PageContext, PolicyResult, VerificationCandidate } from '../types.js';

export type ConfirmationViewModel = {
  candidateType: VerificationCandidate['type'];
  candidateLabel: string;
  maskedValue: string;
  destination: string | null;
  sender: string;
  subject: string;
  age: string;
  claimedService: string;
  activeDomain: string;
  simulationLabel: string | null;
  statusLabel: string;
  explanation: string;
  canFill: boolean;
  canOpen: boolean;
  canOverride: boolean;
  extractionLabel: string;
};

export function maskCandidateValue(value: string | null): string {
  if (!value) return 'Unavailable';
  if (value.length <= 2) return '•'.repeat(value.length);
  return `${'•'.repeat(value.length - 2)}${value.slice(-2)}`;
}

export function maskTemporarySecretsInText(
  text: string,
  candidateValue: string | null = null,
): string {
  let masked = text;
  if (candidateValue && masked.includes(candidateValue)) {
    const replacement = /^https?:\/\//i.test(candidateValue)
      ? '[verified action link withheld]'
      : '•'.repeat(Math.min(candidateValue.length, 10));
    masked = masked.split(candidateValue).join(replacement);
  }
  return masked.replace(
    /\b((?:(?:verification|security|sign[- ]?in|login|temporary|authentication|auth|access|confirmation|one[- ]?time)\s+)?(?:code|passcode)\s*(?:is\s+|:\s*)?)([A-Z0-9]{4,10})\b/gi,
    (_match, label: string, secret: string) => `${label}${'•'.repeat(secret.length)}`,
  );
}

export function formatMessageAge(receivedAt: string, now = new Date()): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(receivedAt).getTime()) / 60_000),
  );
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

export function buildConfirmationViewModel(
  candidate: VerificationCandidate,
  policy: PolicyResult,
  page: PageContext,
  now = new Date(),
): ConfirmationViewModel {
  const link =
    candidate.type === 'magic_link' && candidate.value ? inspectMagicLink(candidate.value) : null;
  return {
    candidateType: candidate.type,
    candidateLabel:
      candidate.type === 'magic_link'
        ? 'Verified action link'
        : candidate.type === 'reference'
          ? 'Candidate reference'
          : 'Candidate code',
    maskedValue: link?.maskedUrl ?? maskCandidateValue(candidate.value),
    destination: link?.hostname ?? null,
    sender: candidate.senderAddress
      ? `${candidate.senderName ?? 'Unknown sender'} <${candidate.senderAddress}>`
      : (candidate.senderName ?? 'Unknown sender'),
    subject: maskTemporarySecretsInText(candidate.subject, candidate.value),
    age: formatMessageAge(candidate.receivedAt, now),
    claimedService: candidate.claimedService ?? 'Not identified',
    activeDomain: page.hostname,
    simulationLabel: page.simulated ? 'Deterministic localhost domain simulation' : null,
    statusLabel:
      policy.decision === 'allow'
        ? 'Allowed'
        : policy.decision === 'warn'
          ? 'Needs caution'
          : 'Blocked',
    explanation: policy.reason,
    canFill: candidate.type !== 'magic_link' && policy.decision === 'allow',
    canOpen: candidate.type === 'magic_link' && policy.decision === 'allow',
    canOverride:
      candidate.type !== 'magic_link' && policy.decision === 'warn' && policy.canOverride,
    extractionLabel:
      candidate.extractionMethod === 'gpt-5.6'
        ? 'Extracted with GPT-5.6'
        : 'Deterministic extraction',
  };
}
