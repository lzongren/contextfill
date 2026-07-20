import type { BackgroundRequest, BackgroundResponse } from './shared/messages.js';

void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });

const usedCandidates = new Map<string, number>();
const USED_TTL_MS = 15 * 60_000;

function purgeExpired(): void {
  const cutoff = Date.now() - USED_TTL_MS;
  for (const [candidateId, usedAt] of usedCandidates) {
    if (usedAt < cutoff) usedCandidates.delete(candidateId);
  }
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
  purgeExpired();
  if (request.type === 'MARK_CANDIDATE_USED') {
    usedCandidates.set(request.candidateId, Date.now());
  }
  const response: BackgroundResponse = { ok: true, candidateIds: [...usedCandidates.keys()] };
  sendResponse(response);
  return false;
});
