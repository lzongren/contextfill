import { z } from 'zod';

const nullableShortString = z.string().trim().max(320).nullable();

export const verificationCandidateSchema = z
  .object({
    id: z.string().min(1).max(160),
    messageId: z.string().min(1).max(160),
    type: z.enum(['otp', 'magic_link', 'reference', 'unknown']),
    value: z.string().trim().min(1).max(2_048).nullable(),
    claimedService: nullableShortString,
    referencedDomains: z.array(z.string().trim().min(1).max(253)).max(12),
    senderName: nullableShortString,
    senderAddress: z.string().email().max(320).nullable(),
    subject: z.string().trim().min(1).max(500),
    receivedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    confidence: z.number().min(0).max(1),
    supportingText: z.array(z.string().trim().min(1).max(300)).max(8),
    extractionMethod: z.enum(['gpt-5.6', 'deterministic']),
  })
  .strict()
  .superRefine((candidate, context) => {
    const maxLength =
      candidate.type === 'magic_link' ? 2_048 : candidate.type === 'reference' ? 320 : 128;
    if (candidate.value && candidate.value.length > maxLength) {
      context.addIssue({
        code: 'too_big',
        maximum: maxLength,
        origin: 'string',
        inclusive: true,
        path: ['value'],
        message: `Candidate value must contain at most ${maxLength} characters.`,
      });
    }
  });

export type VerificationCandidate = z.infer<typeof verificationCandidateSchema>;

export const mailboxMessageSchema = z
  .object({
    id: z.string().min(1).max(160),
    source: z.enum(['synthetic', 'gmail', 'outlook', 'import']).optional(),
    senderName: z.string().max(320).nullable(),
    senderAddress: z.string().email().max(320).nullable(),
    senderRelay: z
      .object({
        kind: z.literal('apple_hide_my_email'),
        originalAddress: z.string().email().max(320),
      })
      .strict()
      .nullable()
      .optional(),
    subject: z.string().min(1).max(500),
    body: z.string().min(1).max(10_000),
    receivedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
    serviceHint: z.string().max(120).nullable(),
  })
  .strict();

export type MailboxMessage = z.infer<typeof mailboxMessageSchema>;

// Kept as an alias while the synthetic judge fixtures and older integrations migrate to the
// provider-neutral mailbox terminology.
export const syntheticMessageSchema = mailboxMessageSchema;
export type SyntheticMessage = MailboxMessage;

export const pageContextSchema = z
  .object({
    hostname: z.string().min(1).max(500),
    serviceHint: z.string().max(120).nullable(),
    simulated: z.boolean(),
    scenario: z.string().max(120).nullable(),
    fieldKind: z.enum(['single', 'split', 'reference', 'none']),
    fieldCount: z.number().int().min(0).max(12),
  })
  .strict();

export type PageContext = z.infer<typeof pageContextSchema>;

export type TrustDecision = 'allow' | 'warn' | 'block';

export type PolicyResult = {
  decision: TrustDecision;
  reason: string;
  reasonCode:
    | 'aligned'
    | 'missing_domain_evidence'
    | 'sender_conflict'
    | 'moderate_confidence'
    | 'domain_mismatch'
    | 'lookalike'
    | 'service_mismatch'
    | 'expired'
    | 'stale'
    | 'used'
    | 'unsafe_link'
    | 'destination_mismatch'
    | 'unsupported_candidate'
    | 'no_field';
  activeRegistrableDomain: string | null;
  matchedDomain: string | null;
  lookalikeSignals: string[];
  canOverride: boolean;
};

export type RankedCandidate = {
  candidate: VerificationCandidate;
  policy: PolicyResult;
  score: number;
  rationale: string[];
};

export const contextCapsuleFactKeySchema = z.enum(['booking_reference', 'passenger_surname']);

export const contextCapsuleFactSchema = z
  .object({
    key: contextCapsuleFactKeySchema,
    value: z.string().trim().min(1).max(80),
    confidence: z.number().min(0).max(1),
    supportingText: z.array(z.string().trim().min(1).max(300)).min(1).max(4),
  })
  .strict()
  .superRefine((fact, context) => {
    if (fact.key === 'booking_reference' && !/^[A-Z0-9][A-Z0-9-]{3,19}$/i.test(fact.value)) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Booking references must be 4-20 letters, digits, or hyphens.',
      });
    }
    if (
      fact.key === 'passenger_surname' &&
      !/^[\p{L}][\p{L}\p{M}'’ -]{0,78}[\p{L}\p{M}]$/u.test(fact.value)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Passenger surnames may contain only name characters.',
      });
    }
  });

export const contextCapsuleSchema = z
  .object({
    id: z.string().min(1).max(160),
    messageId: z.string().min(1).max(160),
    intent: z.literal('travel_check_in'),
    claimedService: nullableShortString,
    referencedDomains: z.array(z.string().trim().min(1).max(253)).max(12),
    expiresAt: z.string().datetime(),
    facts: z.array(contextCapsuleFactSchema).length(2),
    extractionMethod: z.enum(['gpt-5.6', 'deterministic']),
  })
  .strict()
  .superRefine((capsule, context) => {
    const keys = capsule.facts.map((fact) => fact.key);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({ code: 'custom', path: ['facts'], message: 'Fact keys must be unique.' });
    }
    for (const required of contextCapsuleFactKeySchema.options) {
      if (!keys.includes(required)) {
        context.addIssue({
          code: 'custom',
          path: ['facts'],
          message: `The travel capsule is missing ${required}.`,
        });
      }
    }
  });

export type ContextCapsuleFactKey = z.infer<typeof contextCapsuleFactKeySchema>;
export type ContextCapsuleFact = z.infer<typeof contextCapsuleFactSchema>;
export type ContextCapsule = z.infer<typeof contextCapsuleSchema>;

export const capsulePageContextSchema = z
  .object({
    hostname: z.string().min(1).max(500),
    serviceHint: z.string().max(120).nullable(),
    simulated: z.boolean(),
    scenario: z.string().max(120).nullable(),
  })
  .strict();

export type CapsulePageContext = z.infer<typeof capsulePageContextSchema>;

export type CapsulePolicyResult = {
  capsuleId: string;
  decision: 'allow' | 'block';
  reason: string;
  reasonCode:
    | 'aligned'
    | 'invalid_capsule'
    | 'unsupported_intent'
    | 'message_mismatch'
    | 'invented_evidence'
    | 'low_confidence'
    | 'missing_domain_evidence'
    | 'sender_conflict'
    | 'domain_mismatch'
    | 'lookalike'
    | 'service_mismatch'
    | 'expired'
    | 'stale'
    | 'used'
    | 'conflicting_messages';
  activeRegistrableDomain: string | null;
  matchedDomain: string | null;
  lookalikeSignals: string[];
};
