import {
  isModelEligibleMessage,
  verificationCandidateSchema,
  type SyntheticMessage,
  type VerificationCandidate,
} from '../../../packages/core/src/index.js';
import { companionServiceHeaders } from './mail-client.js';

export type ExtractionBatch = {
  candidates: VerificationCandidate[];
  modelUsed: boolean;
  fallbackReason: 'service_unavailable' | 'not_configured' | 'invalid_response' | null;
};

type ServiceBody = { candidate?: unknown; fallback?: boolean; reason?: string };

export async function requestModelCandidate(
  message: SyntheticMessage,
  fetcher: typeof fetch = fetch,
): Promise<{ candidate: VerificationCandidate | null; reason: ExtractionBatch['fallbackReason'] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetcher('http://127.0.0.1:4318/extract', {
      method: 'POST',
      headers: await companionServiceHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as ServiceBody;
    if (!response.ok) {
      return {
        candidate: null,
        reason: body.reason === 'not_configured' ? 'not_configured' : 'service_unavailable',
      };
    }
    const parsed = verificationCandidateSchema.safeParse(body.candidate);
    return parsed.success
      ? { candidate: parsed.data, reason: null }
      : { candidate: null, reason: 'invalid_response' };
  } catch {
    return { candidate: null, reason: 'service_unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enhanceCandidatesWithModel(
  messages: SyntheticMessage[],
  deterministicCandidates: VerificationCandidate[],
  fetcher: typeof fetch = fetch,
): Promise<ExtractionBatch> {
  const eligible = messages
    .filter(isModelEligibleMessage)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, 4);
  if (eligible.length === 0) {
    return { candidates: deterministicCandidates, modelUsed: false, fallbackReason: null };
  }
  const modelResults = await Promise.all(
    eligible.map((message) => requestModelCandidate(message, fetcher)),
  );
  const byMessageId = new Map(
    deterministicCandidates.map((candidate) => [candidate.messageId, candidate]),
  );
  for (const result of modelResults) {
    if (result.candidate?.type === 'otp' && result.candidate.value) {
      byMessageId.set(result.candidate.messageId, result.candidate);
    }
  }
  const modelUsed = [...byMessageId.values()].some(
    (candidate) => candidate.extractionMethod === 'gpt-5.6',
  );
  const fallbackReason = modelUsed
    ? null
    : (modelResults.find((result) => result.reason !== null)?.reason ?? null);
  return { candidates: [...byMessageId.values()], modelUsed, fallbackReason };
}
