import { z } from 'zod';

const nullableShortString = z.string().trim().max(320).nullable();

export const verificationCandidateSchema = z
  .object({
    id: z.string().min(1).max(160),
    messageId: z.string().min(1).max(160),
    type: z.enum(['otp', 'magic_link', 'reference', 'unknown']),
    value: z.string().trim().min(1).max(128).nullable(),
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
  .strict();

export type VerificationCandidate = z.infer<typeof verificationCandidateSchema>;

export const mailboxMessageSchema = z
  .object({
    id: z.string().min(1).max(160),
    source: z.enum(['synthetic', 'gmail', 'outlook', 'import']).optional(),
    senderName: z.string().max(320).nullable(),
    senderAddress: z.string().email().max(320).nullable(),
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
    fieldKind: z.enum(['single', 'split', 'none']),
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
