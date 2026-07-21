import { describe, expect, it, vi } from 'vitest';
import {
  performVerifiedNavigation,
  resolveVerifiedNavigationTarget,
  type VerifiedNavigationDependencies,
  type VerifiedNavigationRequest,
} from '../../apps/extension/src/verified-navigation.js';
import {
  evaluateTrust,
  extractDeterministic,
  makeSyntheticInbox,
  type PageContext,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-20T19:00:00.000Z');
const candidate = extractDeterministic(
  makeSyntheticInbox(now).find((message) => message.id === 'magic-link')!,
)!;
const page: PageContext = {
  hostname: 'login.cedarnotes.test',
  serviceHint: 'Cedar Notes',
  simulated: true,
  scenario: 'magic-link',
  fieldKind: 'none',
  fieldCount: 0,
};
const scannedTabUrl = 'http://127.0.0.1:4173/?scenario=magic-link';
const request: VerifiedNavigationRequest = {
  candidate,
  policy: evaluateTrust(candidate, page, { now }),
  page,
  source: 'synthetic',
  tabId: 42,
  scannedTabUrl,
  userApproved: true,
};

function dependencies(currentUrl = scannedTabUrl): {
  dependencies: VerifiedNavigationDependencies;
  calls: string[];
  navigate: ReturnType<typeof vi.fn>;
} {
  const calls: string[] = [];
  const navigate = vi.fn(async () => {
    calls.push('navigate');
  });
  return {
    calls,
    navigate,
    dependencies: {
      getTab: async (tabId) => ({ id: tabId, url: currentUrl }),
      markUsed: async () => {
        calls.push('mark-used');
      },
      clearSensitiveState: () => {
        calls.push('clear');
      },
      navigate,
    },
  };
}

describe('explicit verified navigation', () => {
  it('has no navigation side effect until the explicit action function is invoked', () => {
    const harness = dependencies();
    expect(harness.navigate).not.toHaveBeenCalled();
  });

  it('maps the synthetic .test link honestly and updates only the captured tab', async () => {
    expect(resolveVerifiedNavigationTarget(request)).toEqual({
      url: 'http://127.0.0.1:4173/?scenario=magic-link-complete',
      targetKind: 'synthetic-fixture',
    });
    const harness = dependencies();
    await expect(performVerifiedNavigation(request, harness.dependencies)).resolves.toEqual({
      targetKind: 'synthetic-fixture',
    });
    expect(harness.calls).toEqual(['mark-used', 'clear', 'navigate']);
    expect(harness.navigate).toHaveBeenCalledWith(
      42,
      'http://127.0.0.1:4173/?scenario=magic-link-complete',
    );
  });

  it('uses the exact inspected message URL for real mail', async () => {
    const realRequest = {
      ...request,
      source: 'gmail' as const,
      page: { ...page, simulated: false },
    };
    const harness = dependencies();
    await performVerifiedNavigation(realRequest, harness.dependencies);
    expect(harness.navigate).toHaveBeenCalledWith(42, candidate.value);
  });

  it('blocks navigation if the initiating tab changed or policy is not allow', async () => {
    const changed = dependencies('http://127.0.0.1:4173/?scenario=lookalike');
    await expect(performVerifiedNavigation(request, changed.dependencies)).rejects.toThrow(
      'initiating tab changed',
    );
    expect(changed.calls).toEqual([]);

    const blocked = dependencies();
    await expect(
      performVerifiedNavigation(
        { ...request, policy: { ...request.policy, decision: 'block' } },
        blocked.dependencies,
      ),
    ).rejects.toThrow('User authorization');
    expect(blocked.calls).toEqual([]);
  });

  it('accepts a locally authorized Auto-Continue handoff bound to the checked page hostname', async () => {
    const automaticRequest = {
      candidate: request.candidate,
      policy: request.policy,
      page: request.page,
      source: request.source,
      tabId: request.tabId,
      scannedTabUrl: request.scannedTabUrl,
    };
    const harness = dependencies();
    await performVerifiedNavigation(
      {
        ...automaticRequest,
        autoContinue: { pageHostname: page.hostname },
      },
      harness.dependencies,
    );
    expect(harness.calls).toEqual(['mark-used', 'clear', 'navigate']);

    const rejected = dependencies();
    await expect(
      performVerifiedNavigation(
        {
          ...automaticRequest,
          autoContinue: { pageHostname: 'lookalike.test' },
        },
        rejected.dependencies,
      ),
    ).rejects.toThrow('User authorization');
    expect(rejected.calls).toEqual([]);
  });
});
