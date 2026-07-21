import { extractHttpUrls, isSupportedMagicLinkText } from '../actions/links.js';
import { normalizeHostname } from '../domains/index.js';
import {
  syntheticMessageSchema,
  verificationCandidateSchema,
  type SyntheticMessage,
  type VerificationCandidate,
} from '../types.js';

const verificationLanguage =
  /\b(verification|verify|one[- ]time|security code|sign[- ]?in code|login code|temporary code|authentication code|auth code|access code|confirmation code|passcode|two[- ]factor|2fa|otp)\b/i;
const unrelatedLanguage = /\b(order|receipt|invoice|tracking|street|lane|customer care|phone)\b/i;
const magicLinkLanguage =
  /\b(magic link|sign[- ]?in link|login link|email confirmation|confirm (?:your )?email|verify (?:your )?email|activate (?:your )?account|continue (?:to )?(?:sign[- ]?in|login))\b/i;
const referenceLanguage =
  /\b(booking|reservation|application|support|case|ticket)\s+(?:reference|confirmation|number|id)\b/i;
const referenceAfterLanguage =
  /\b(?:booking|reservation|application|support|case|ticket)\s+(?:reference|confirmation|number|id)\s*(?:is\s+|:\s*|#\s*)?([A-Z0-9][A-Z0-9-]{4,19})\b/i;
const codeAfterLanguage =
  /(?:verification|one[- ]time|security|sign[- ]?in|login|temporary|authentication|auth|access|confirmation|two[- ]factor|2fa|otp)\s+(?:code|passcode)?\s*(?:is\s+|:\s*|#\s*)?([A-Z0-9]{4,10})\b/i;
const plainCode = /\b([A-Z0-9]{6,8})\b/g;
const domainPattern = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,63})(?:[/:?#]|\b)/gi;

function inferService(message: SyntheticMessage): string | null {
  if (message.serviceHint) return message.serviceHint;
  const match = `${message.subject} ${message.body}`.match(
    /\b(?:Your\s+)?([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)\s+(?:verification|account|sign-in)/,
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

function extractMagicLink(text: string): string | null {
  const links = extractHttpUrls(text);
  if (links.length === 0) return null;
  return (
    links
      .map((link) => {
        const index = text.indexOf(link);
        const context = text.slice(Math.max(0, index - 180), index + link.length + 100);
        let score = magicLinkLanguage.test(context) ? 20 : 0;
        try {
          const url = new URL(link);
          if (/\b(magic|login|signin|sign-in|verify|confirm|activate)\b/i.test(url.pathname)) {
            score += 8;
          }
        } catch {
          score -= 20;
        }
        if (/\b(unsubscribe|privacy policy|manage preferences)\b/i.test(context)) score -= 40;
        return { link, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.link ?? null
  );
}

function extractReference(text: string): string | null {
  const value = text.match(referenceAfterLanguage)?.[1]?.toUpperCase() ?? null;
  if (!value || /^\d+$/.test(value) || /^(?:19|20)\d{2}$/.test(value)) return null;
  return value;
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
  return (
    verificationLanguage.test(text) || magicLinkLanguage.test(text) || referenceLanguage.test(text)
  );
}

export function extractDeterministic(messageInput: SyntheticMessage): VerificationCandidate | null {
  const parsedMessage = syntheticMessageSchema.safeParse(messageInput);
  if (!parsedMessage.success) return null;
  const message = parsedMessage.data;
  const text = `${message.subject}\n${message.body}`;
  const hasVerificationLanguage = verificationLanguage.test(text);
  const hasUnrelatedLanguage = unrelatedLanguage.test(text);
  const code = hasVerificationLanguage ? extractCode(text) : null;
  const magicLink = isSupportedMagicLinkText(text) ? extractMagicLink(message.body) : null;
  const reference = referenceLanguage.test(text) ? extractReference(text) : null;

  if (!code && !magicLink && !reference) return null;
  if (hasUnrelatedLanguage && !hasVerificationLanguage && !magicLink && !reference) return null;

  const type = code ? 'otp' : magicLink ? 'magic_link' : 'reference';
  const confidence = code ? (codeAfterLanguage.test(text) ? 0.97 : 0.78) : magicLink ? 0.9 : 0.94;
  return verificationCandidateSchema.parse({
    id: `candidate:${message.id}`,
    messageId: message.id,
    type,
    value: code ?? magicLink ?? reference,
    claimedService: inferService(message),
    referencedDomains: findDomains(message),
    senderName: message.senderName,
    senderAddress: message.senderAddress,
    subject: message.subject,
    receivedAt: message.receivedAt,
    expiresAt: message.expiresAt,
    confidence,
    supportingText: excerptAround(message.body, code ?? magicLink ?? reference),
    extractionMethod: 'deterministic',
  });
}

export function extractInboxDeterministic(messages: SyntheticMessage[]): VerificationCandidate[] {
  return messages.flatMap((message) => {
    const candidate = extractDeterministic(message);
    return candidate ? [candidate] : [];
  });
}
