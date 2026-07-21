import {
  inspectMagicLink,
  type PageContext,
  type PolicyResult,
  type VerificationCandidate,
} from '../../../packages/core/src/index.js';

export type NavigationSource = 'synthetic' | 'gmail' | 'outlook' | 'import';

export type VerifiedNavigationRequest = {
  candidate: VerificationCandidate;
  policy: PolicyResult;
  page: PageContext;
  source: NavigationSource;
  tabId: number;
  scannedTabUrl: string;
} & (
  | { userApproved: true; autoContinue?: never }
  | { userApproved?: never; autoContinue: { pageHostname: string } }
);

export type VerifiedNavigationDependencies = {
  getTab: (tabId: number) => Promise<{ id?: number | undefined; url?: string | undefined }>;
  markUsed: (candidateId: string) => Promise<void>;
  clearSensitiveState: () => void;
  navigate: (tabId: number, url: string) => Promise<void>;
};

export type VerifiedNavigationResult = {
  targetKind: 'message-link' | 'synthetic-fixture';
};

function isLoopbackDemoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(url.hostname) &&
      url.port === '4173'
    );
  } catch {
    return false;
  }
}

export function resolveVerifiedNavigationTarget(request: VerifiedNavigationRequest): {
  url: string;
  targetKind: VerifiedNavigationResult['targetKind'];
} {
  if (request.candidate.type !== 'magic_link' || !request.candidate.value) {
    throw new Error('The selected candidate is not an action link.');
  }
  const inspected = inspectMagicLink(request.candidate.value);
  if (!inspected.safe || !inspected.url) {
    throw new Error('The selected action link did not pass local URL inspection.');
  }

  if (
    request.source === 'synthetic' &&
    request.page.simulated &&
    request.candidate.messageId === 'magic-link' &&
    isLoopbackDemoUrl(request.scannedTabUrl)
  ) {
    const localTarget = new URL(request.scannedTabUrl);
    localTarget.search = '?scenario=magic-link-complete';
    localTarget.hash = '';
    return { url: localTarget.toString(), targetKind: 'synthetic-fixture' };
  }

  return { url: inspected.url, targetKind: 'message-link' };
}

export async function performVerifiedNavigation(
  request: VerifiedNavigationRequest,
  dependencies: VerifiedNavigationDependencies,
): Promise<VerifiedNavigationResult> {
  const authorized =
    request.userApproved === true || request.autoContinue?.pageHostname === request.page.hostname;
  if (!authorized || request.policy.decision !== 'allow') {
    throw new Error('User authorization and an allowed trust decision are required.');
  }

  const currentTab = await dependencies.getTab(request.tabId);
  if (currentTab.id !== request.tabId || currentTab.url !== request.scannedTabUrl) {
    throw new Error('The initiating tab changed after ContextFill checked it. Scan again.');
  }

  const target = resolveVerifiedNavigationTarget(request);
  await dependencies.markUsed(request.candidate.id);
  dependencies.clearSensitiveState();
  await dependencies.navigate(request.tabId, target.url);
  return { targetKind: target.targetKind };
}
