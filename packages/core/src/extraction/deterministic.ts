import { normalizeHostname } from '../domains/index.js';
import {
  syntheticMessageSchema,
  verificationCandidateSchema,
  type SyntheticMessage,
  type VerificationCandidate,
} from '../types.js';

const verificationLanguage =
  /\b(verification|verify|one[- ]time|security code|sign[- ]?in code|login code|temporary code|authentication code|otp)\b/i;
const unrelatedLanguage = /\b(order|receipt|invoice|tracking|street|lane|customer care|phone)\b/i;
const magicLinkLanguage = /\b(magic link|sign[- ]?in link|login link)\b/i;
const codeAfterLanguage =
  /(?:verification|one[- ]time|security|sign[- ]?in|login|temporary|authentication|otp)\s+(?:code\s+)?(?:is\s+|:\s*|#\s*)?([A-Z0-9]{4,10})\b/i;
const plainCode = /\b([A-Z0-9]{6,8})\b/g;
const domainPattern = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,63})(?:[/:?#]|\b)/gi;

function inferService(message: SyntheticMessage): string | null {
  if (message.serviceHint) return message.serviceHint;
  const match = `${message.subject} ${message.body}`.match(
    /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s+(?:verification|account|sign-in)/,
  );
  return match?.[1] ?? null;
}

function findDomains(message: SyntheticMessage): string[] {
  const found = new Set<string>();
  for (const match of message.body.matchAll(domainPattern)) {
    const normalized = normalizeHostname(match[1] ?? '');
    if (normalized) found.add(normalized);
  }
  return [...found];
}

function isPlausibleCode(value: string): boolean {
  if (/^(?:19|20)\d{2}$/.test(value)) return false;
  if (/^(\d)\1+$/.test(value)) return false;
  if (/^\d{9,}$/.test(value)) return false;
  return (
    /^\d{6,8}$/.test(value) ||
    (/^[A-Z0-9]{6,8}$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value))
  );
}

function extractCode(text: string): string | null {
  const near = text.match(codeAfterLanguage)?.[1]?.toUpperCase();
  if (near && isPlausibleCode(near)) return near;
  for (const match of text.toUpperCase().matchAll(plainCode)) {
    if (match[1] && isPlausibleCode(match[1])) return match[1];
  }
  return null;
}

function excerptAround(text: string, needle: string | null): string[] {
  if (!needle) return [text.slice(0, 180)];
  const index = text.toUpperCase().indexOf(needle.toUpperCase());
  const start = Math.max(0, index - 55);
  return [text.slice(start, Math.min(text.length, index + needle.length + 90)).trim()];
}

export function isModelEligibleMessage(message: SyntheticMessage): boolean {
  const checked = syntheticMessageSchema.safeParse(message);
  if (!checked.success) return false;
  const text = `${message.subject}\n${message.body}`;
  return verificationLanguage.test(text) || magicLinkLanguage.test(text);
}

export function extractDeterministic(messageInput: SyntheticMessage): VerificationCandidate | null {
  const parsedMessage = syntheticMessageSchema.safeParse(messageInput);
  if (!parsedMessage.success) return null;
  const message = parsedMessage.data;
  const text = `${message.subject}\n${message.body}`;
  const hasVerificationLanguage = verificationLanguage.test(text);
  const hasUnrelatedLanguage = unrelatedLanguage.test(text);
  const code = hasVerificationLanguage ? extractCode(text) : null;
  const hasMagicLink = magicLinkLanguage.test(text) && /https?:\/\//i.test(message.body);

  if (!code && !hasMagicLink) return null;
  if (hasUnrelatedLanguage && !hasVerificationLanguage && !hasMagicLink) return null;

  const type = code ? 'otp' : 'magic_link';
  const confidence = code ? (codeAfterLanguage.test(text) ? 0.97 : 0.78) : 0.9;
  return verificationCandidateSchema.parse({
    id: `det:${message.id}`,
    messageId: message.id,
    type,
    value: code,
    claimedService: inferService(message),
    referencedDomains: findDomains(message),
    senderName: message.senderName,
    senderAddress: message.senderAddress,
    subject: message.subject,
    receivedAt: message.receivedAt,
    expiresAt: message.expiresAt,
    confidence,
    supportingText: excerptAround(message.body, code),
    extractionMethod: 'deterministic',
  });
}

export function extractInboxDeterministic(messages: SyntheticMessage[]): VerificationCandidate[] {
  return messages.flatMap((message) => {
    const candidate = extractDeterministic(message);
    return candidate ? [candidate] : [];
  });
}
