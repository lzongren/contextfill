import { describe, expect, it } from 'vitest';
import { enhanceCandidatesWithModel } from '../../apps/extension/src/model-client.js';
import {
  extractInboxDeterministic,
  messagesForScenario,
  type VerificationCandidate,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-20T19:00:00.000Z');
const messages = messagesForScenario('legitimate-single', now);
const deterministic = extractInboxDeterministic(messages);

describe('extension model fallback', () => {
  it('remains functional when the local service is unavailable', async () => {
    const unavailable: typeof fetch = async () => {
      throw new TypeError('connection refused');
    };
    const result = await enhanceCandidatesWithModel(messages, deterministic, unavailable);
    expect(result.modelUsed).toBe(false);
    expect(result.fallbackReason).toBe('service_unavailable');
    expect(
      result.candidates.find((candidate) => candidate.messageId === 'northstar-current')?.value,
    ).toBe('481203');
  });

  it('rejects malformed model output and keeps deterministic candidates', async () => {
    const malformed: typeof fetch = async () =>
      new Response(JSON.stringify({ candidate: { value: 'invented', authorize: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const result = await enhanceCandidatesWithModel(messages, deterministic, malformed);
    expect(result.modelUsed).toBe(false);
    expect(result.fallbackReason).toBe('invalid_response');
    expect(result.candidates).toEqual<VerificationCandidate[]>(deterministic);
  });
});
