import {
  authorizeContextCapsule,
  capsulePageContextSchema,
  contextCapsuleSchema,
  createCapsuleMappingPlan,
  executeContextCapsuleTransfer,
  mailboxMessageSchema,
  mountContextCapsuleOverlay,
  type CapsuleTransferReceipt,
} from '../../../packages/core/src/index.js';
import { liveAirlineProfile } from './live-airline-policy.js';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  ContentResponse,
} from './shared/messages.js';

async function backgroundMessage(request: BackgroundRequest): Promise<BackgroundResponse> {
  return (await chrome.runtime.sendMessage(request)) as BackgroundResponse;
}

async function usedCapsuleIds(): Promise<Set<string>> {
  const response = await backgroundMessage({ type: 'GET_USED_CANDIDATES' });
  return new Set(response.ok ? response.candidateIds : []);
}

async function showAirlineCapsule(
  request: Extract<ContentRequest, { type: 'SHOW_AIRLINE_CAPSULE' }>,
): Promise<'shown' | 'invalid_payload' | 'wrong_page'> {
  const capsuleResult = contextCapsuleSchema.safeParse(request.capsule);
  const messageResult = mailboxMessageSchema.safeParse(request.message);
  if (!capsuleResult.success || !messageResult.success) return 'invalid_payload';
  const profile = liveAirlineProfile(request.airline);
  if (!profile.isAllowedBookingPage(window.location.href)) return 'wrong_page';
  const capsule = capsuleResult.data;
  const message = messageResult.data;
  const page = capsulePageContextSchema.parse({
    hostname: window.location.hostname,
    serviceHint: profile.serviceHint,
    simulated: false,
    scenario: null,
  });
  const initialUsedIds = await usedCapsuleIds();
  const policy = authorizeContextCapsule(capsule, message, page, {
    now: new Date(),
    usedCapsuleIds: initialUsedIds,
    maxMessageAgeMinutes: profile.maxMessageAgeMinutes,
  });
  const plan = createCapsuleMappingPlan(document, capsule);
  mountContextCapsuleOverlay(document, {
    capsule,
    message,
    page,
    policy,
    plan,
    sourceLabel:
      message.senderRelay && profile.id === 'easyjet'
        ? 'Gmail · Apple Hide My Email relay'
        : 'Gmail',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onTransfer: async (): Promise<CapsuleTransferReceipt | null> => {
      if (!profile.isAllowedBookingPage(window.location.href)) return null;
      const actionUsedIds = await usedCapsuleIds();
      const actionPage = capsulePageContextSchema.parse({
        hostname: window.location.hostname,
        serviceHint: profile.serviceHint,
        simulated: false,
        scenario: null,
      });
      const actionPolicy = authorizeContextCapsule(capsule, message, actionPage, {
        now: new Date(),
        usedCapsuleIds: actionUsedIds,
        maxMessageAgeMinutes: profile.maxMessageAgeMinutes,
      });
      const actionPlan = createCapsuleMappingPlan(document, capsule);
      const receipt = executeContextCapsuleTransfer(
        capsule,
        actionPolicy,
        actionPlan,
        actionUsedIds,
      );
      if (!receipt) return null;
      const marked = await backgroundMessage({
        type: 'MARK_CANDIDATE_USED',
        candidateId: capsule.id,
      });
      if (!marked.ok) {
        receipt.undo();
        return null;
      }
      return receipt;
    },
  });
  return 'shown';
}

if (!window.__contextfillAirlineInstalled) {
  window.__contextfillAirlineInstalled = true;
  chrome.runtime.onMessage.addListener(
    (request: ContentRequest, _sender, sendResponse: (response: ContentResponse) => void) => {
      if (request.type !== 'SHOW_AIRLINE_CAPSULE') return false;
      const profile = liveAirlineProfile(request.airline);
      void showAirlineCapsule(request)
        .then((result) =>
          sendResponse(
            result === 'shown'
              ? { ok: true, capsuleShown: true }
              : {
                  ok: false,
                  error:
                    result === 'wrong_page'
                      ? `The tab is not the approved ${profile.displayName} booking route.`
                      : `The ${profile.displayName} capsule payload failed strict validation.`,
                },
          ),
        )
        .catch(() =>
          sendResponse({
            ok: false,
            error: `The ${profile.displayName} booking page changed before review.`,
          }),
        );
      return true;
    },
  );
}

declare global {
  interface Window {
    __contextfillAirlineInstalled?: boolean;
  }
}
