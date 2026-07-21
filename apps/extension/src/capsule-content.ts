import {
  authorizeContextCapsule,
  capsuleMessagesForScenario,
  createCapsuleMappingPlan,
  executeContextCapsuleTransfer,
  extractContextCapsulesDeterministic,
  hasConflictingTravelCapsules,
  mountContextCapsuleOverlay,
  type CapsulePageContext,
} from '../../../packages/core/src/index.js';
import type { BackgroundRequest, BackgroundResponse } from './shared/messages.js';
import { isAllowedCapsuleFixture } from './capsule-fixture-policy.js';

function fixtureMeta(name: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null;
}

async function backgroundMessage(request: BackgroundRequest): Promise<BackgroundResponse> {
  return (await chrome.runtime.sendMessage(request)) as BackgroundResponse;
}

async function usedCapsuleIds(): Promise<Set<string>> {
  const response = await backgroundMessage({ type: 'GET_USED_CANDIDATES' });
  return new Set(response.ok ? response.candidateIds : []);
}

async function launchCapsule(): Promise<void> {
  const scenario = fixtureMeta('contextfill-scenario');
  const simulatedHostname = fixtureMeta('contextfill-simulated-host');
  const service = fixtureMeta('contextfill-service');
  if (
    !isAllowedCapsuleFixture(
      window.location.origin,
      window.location.pathname,
      scenario,
      simulatedHostname,
      service,
    )
  ) {
    return;
  }
  const now = new Date();
  const messages = capsuleMessagesForScenario(scenario, now);
  const capsules = extractContextCapsulesDeterministic(messages, now);
  const capsule = capsules[0];
  const sourceMessage = messages.find((message) => message.id === capsule?.messageId);
  if (!capsule || !sourceMessage) return;
  const page: CapsulePageContext = {
    hostname: simulatedHostname!,
    serviceHint: service,
    simulated: true,
    scenario,
  };
  const initialUsedIds = await usedCapsuleIds();
  const policy = authorizeContextCapsule(capsule, sourceMessage, page, {
    now,
    usedCapsuleIds: initialUsedIds,
    hasConflictingRecentMessages: hasConflictingTravelCapsules(capsules),
  });
  const plan = createCapsuleMappingPlan(document, capsule);
  mountContextCapsuleOverlay(document, {
    capsule,
    message: sourceMessage,
    page,
    policy,
    plan,
    sourceLabel: 'Built-in synthetic inbox',
    reducedMotion:
      scenario === 'capsule-reduced-motion' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onTransfer: async () => {
      if (
        !isAllowedCapsuleFixture(
          window.location.origin,
          window.location.pathname,
          fixtureMeta('contextfill-scenario'),
          fixtureMeta('contextfill-simulated-host'),
          fixtureMeta('contextfill-service'),
        )
      ) {
        return null;
      }
      const actionUsedIds = await usedCapsuleIds();
      const actionPolicy = authorizeContextCapsule(capsule, sourceMessage, page, {
        now: new Date(),
        usedCapsuleIds: actionUsedIds,
        hasConflictingRecentMessages: hasConflictingTravelCapsules(capsules),
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
}

if (!window.__contextfillCapsuleInstalled) {
  window.__contextfillCapsuleInstalled = true;
  document.addEventListener('contextfill:show-capsule', () => void launchCapsule());
  void launchCapsule();
}

declare global {
  interface Window {
    __contextfillCapsuleInstalled?: boolean;
  }
}
