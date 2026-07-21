import { z } from 'zod';
import { normalizeHostname } from '../domains/index.js';
import {
  contextCapsuleSchema,
  mailboxMessageSchema,
  type ContextCapsule,
  type ContextCapsuleFact,
  type MailboxMessage,
} from '../types.js';

const travelLanguage =
  /\b(check[- ]?in|flight|airline|boarding|booking confirmation|booking reference|itinerary|easyJet)\b/i;
const bookingReferencePattern =
  /\b(?:booking|reservation)\s+(?:reference|confirmation|number|code)\s*(?:is\s+|:\s*|#\s*)([A-Z0-9][A-Z0-9-]{3,19})\b/i;
const passengerSurnamePattern =
  /\b(?:passenger\s+(?:surname|last name)|surname|family name|last name)\s*(?:is\s+|:\s*)?([\p{L}][\p{L}\p{M}'’ -]{0,78}[\p{L}\p{M}])(?=\s*(?:[.\n,;]|$))/iu;
const domainPattern = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,63})(?:[/:?#]|\b)/gi;

export const modelContextCapsuleFactsSchema = z
  .object({
    intent: z.enum(['travel_check_in', 'unknown']),
    claimedService: z.string().trim().max(320).nullable(),
    referencedDomains: z.array(z.string().trim().min(1).max(253)).max(12),
    facts: z
      .array(
        z
          .object({
            key: z.enum(['booking_reference', 'passenger_surname']),
            value: z.string().trim().min(1).max(80),
            confidence: z.number().min(0).max(1),
            supportingText: z.array(z.string().trim().min(1).max(300)).min(1).max(4),
          })
          .strict(),
      )
      .max(2),
  })
  .strict();

export type ModelContextCapsuleFacts = z.infer<typeof modelContextCapsuleFactsSchema>;

function domainsIn(message: MailboxMessage): string[] {
  const found = new Set<string>();
  for (const match of `${message.subject}\n${message.body}`.matchAll(domainPattern)) {
    const domain = normalizeHostname(match[1] ?? '');
    if (domain) found.add(domain);
  }
  return [...found];
}

function excerpt(text: string, value: string): string {
  const index = text.toLocaleLowerCase().indexOf(value.toLocaleLowerCase());
  if (index < 0) return text.slice(0, 260).trim();
  return text
    .slice(Math.max(0, index - 70), index + value.length + 90)
    .trim()
    .slice(0, 300);
}

function capsuleExpiry(message: MailboxMessage, now: Date): string {
  const promptExpiry = now.getTime() + 90_000;
  const messageExpiry = message.expiresAt ? new Date(message.expiresAt).getTime() : Infinity;
  return new Date(Math.min(promptExpiry, messageExpiry)).toISOString();
}

function fact(
  key: ContextCapsuleFact['key'],
  value: string,
  body: string,
  confidence: number,
): ContextCapsuleFact {
  return { key, value: value.trim(), confidence, supportingText: [excerpt(body, value)] };
}

export function extractContextCapsuleDeterministic(
  messageInput: MailboxMessage,
  now = new Date(),
): ContextCapsule | null {
  const parsed = mailboxMessageSchema.safeParse(messageInput);
  if (!parsed.success) return null;
  const message = parsed.data;
  const text = `${message.subject}\n${message.body}`;
  if (!travelLanguage.test(text)) return null;
  const bookingReference = text.match(bookingReferencePattern)?.[1]?.toUpperCase();
  const passengerSurname = text.match(passengerSurnamePattern)?.[1];
  if (!bookingReference || !passengerSurname) return null;
  return contextCapsuleSchema.parse({
    id: `capsule:${message.id}`,
    messageId: message.id,
    intent: 'travel_check_in',
    claimedService: message.serviceHint,
    referencedDomains: domainsIn(message),
    expiresAt: capsuleExpiry(message, now),
    facts: [
      fact('booking_reference', bookingReference, text, 0.99),
      fact('passenger_surname', passengerSurname, text, 0.98),
    ],
    extractionMethod: 'deterministic',
  });
}

export function extractContextCapsulesDeterministic(
  messages: MailboxMessage[],
  now = new Date(),
): ContextCapsule[] {
  return messages.flatMap((message) => {
    const capsule = extractContextCapsuleDeterministic(message, now);
    return capsule ? [capsule] : [];
  });
}

function presentInMessage(value: string, message: MailboxMessage): boolean {
  return `${message.subject}\n${message.body}`
    .toLocaleLowerCase()
    .includes(value.toLocaleLowerCase());
}

export function createContextCapsuleFromModelFacts(
  messageInput: MailboxMessage,
  rawFacts: unknown,
  now = new Date(),
): ContextCapsule {
  const message = mailboxMessageSchema.parse(messageInput);
  const extracted = modelContextCapsuleFactsSchema.parse(rawFacts);
  if (extracted.intent !== 'travel_check_in') {
    throw new Error('The model did not identify the supported travel check-in intent.');
  }
  if (
    extracted.claimedService &&
    extracted.claimedService !== message.serviceHint &&
    !presentInMessage(extracted.claimedService, message)
  ) {
    throw new Error('The model claimed a service that was not present in the source message.');
  }
  for (const domain of extracted.referencedDomains) {
    if (!presentInMessage(domain, message)) {
      throw new Error(
        'The model returned domain evidence that was not present in the source message.',
      );
    }
  }
  for (const extractedFact of extracted.facts) {
    if (!presentInMessage(extractedFact.value, message)) {
      throw new Error(
        'The model returned a fact value that was not present in the source message.',
      );
    }
    if (extractedFact.supportingText.some((text) => !presentInMessage(text, message))) {
      throw new Error(
        'The model returned supporting text that was not present in the source message.',
      );
    }
  }
  return contextCapsuleSchema.parse({
    id: `capsule:${message.id}`,
    messageId: message.id,
    intent: extracted.intent,
    claimedService: extracted.claimedService,
    referencedDomains: extracted.referencedDomains.map(normalizeHostname).filter(Boolean),
    expiresAt: capsuleExpiry(message, now),
    facts: extracted.facts,
    extractionMethod: 'gpt-5.6',
  });
}

export function hasConflictingTravelCapsules(capsules: ContextCapsule[]): boolean {
  if (capsules.length < 2) return false;
  const fingerprints = new Set(
    capsules.map((capsule) =>
      [...capsule.facts]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((factValue) => `${factValue.key}:${factValue.value.toLocaleLowerCase()}`)
        .join('|'),
    ),
  );
  return fingerprints.size > 1;
}
