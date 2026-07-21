import {
  extractInboxDeterministic,
  inspectMagicLink,
  messagesForScenario,
  pageContextSchema,
  rankCandidates,
  type PageContext,
  type RankedCandidate,
} from '../../../packages/core/src/index.js';
import { selectAutomaticCandidate } from './automation-selection.js';
import {
  automationIdentity,
  clearActivityHistory,
  loadActivityHistory,
  loadAutomationRules,
  recordActivity,
  removeAutomationRule,
  ruleForUrl,
  saveAutomationMode,
  type AutomationSiteRule,
} from './automation-settings.js';
import {
  fetchMailboxMessages,
  loadMailSource,
  loadRealMailModelOptIn,
  MailClientError,
  shouldUseModelForSource,
  type PersistentMailSource,
} from './mail-client.js';
import { enhanceCandidatesWithModel } from './model-client.js';
import type {
  AutomationOverlayView,
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  ContentResponse,
} from './shared/messages.js';
import { performVerifiedNavigation } from './verified-navigation.js';

void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
void chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });

const USED_KEY = 'usedCandidateRecords';
const USED_TTL_MS = 15 * 60_000;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 12;

type UsedCandidateRecord = { candidateId: string; usedAt: number };

type PendingAction = {
  ranked: RankedCandidate;
  page: PageContext;
  source: PersistentMailSource;
  tabId: number;
  scannedTabUrl: string;
  mode: AutomationSiteRule['mode'];
};

const pendingActions = new Map<number, PendingAction>();
const pollTimers = new Map<number, ReturnType<typeof setTimeout>>();
const runningScans = new Map<number, Promise<void>>();
const scanGenerations = new Map<number, number>();

function isUsedRecord(value: unknown): value is UsedCandidateRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UsedCandidateRecord).candidateId === 'string' &&
    typeof (value as UsedCandidateRecord).usedAt === 'number'
  );
}

async function usedRecords(now = Date.now()): Promise<UsedCandidateRecord[]> {
  const stored = await chrome.storage.session.get(USED_KEY);
  const records = Array.isArray(stored[USED_KEY]) ? stored[USED_KEY].filter(isUsedRecord) : [];
  const fresh = records.filter((record) => record.usedAt >= now - USED_TTL_MS);
  if (fresh.length !== records.length) {
    await chrome.storage.session.set({ [USED_KEY]: fresh });
  }
  return fresh;
}

async function usedCandidateIds(): Promise<Set<string>> {
  return new Set((await usedRecords()).map((record) => record.candidateId));
}

async function markCandidateUsed(candidateId: string): Promise<void> {
  const records = (await usedRecords()).filter((record) => record.candidateId !== candidateId);
  await chrome.storage.session.set({
    [USED_KEY]: [...records, { candidateId, usedAt: Date.now() }],
  });
}

async function contentMessage(tabId: number, request: ContentRequest): Promise<ContentResponse> {
  return (await chrome.tabs.sendMessage(tabId, request)) as ContentResponse;
}

async function showOverlay(tabId: number, view: AutomationOverlayView): Promise<void> {
  await contentMessage(tabId, { type: 'SHOW_AUTOMATION_OVERLAY', view });
}

async function hideOverlay(tabId: number): Promise<void> {
  await contentMessage(tabId, { type: 'HIDE_AUTOMATION_OVERLAY' }).catch(() => undefined);
}

function clearPoll(tabId: number): void {
  const timer = pollTimers.get(tabId);
  if (timer) clearTimeout(timer);
  pollTimers.delete(tabId);
}

function clearTabState(tabId: number): void {
  clearPoll(tabId);
  pendingActions.delete(tabId);
  scanGenerations.set(tabId, (scanGenerations.get(tabId) ?? 0) + 1);
  runningScans.delete(tabId);
}

function schedulePoll(tabId: number, scannedTabUrl: string, attempt: number): void {
  clearPoll(tabId);
  const timer = setTimeout(() => {
    pollTimers.delete(tabId);
    queueAutomaticScan(tabId, scannedTabUrl, attempt);
  }, POLL_INTERVAL_MS);
  pollTimers.set(tabId, timer);
}

function automaticTitle(type: 'otp' | 'magic_link', seconds?: number): string {
  if (seconds) return type === 'magic_link' ? `Opening in ${seconds}…` : `Filling in ${seconds}…`;
  return type === 'magic_link' ? 'Verified link ready' : 'Verified code ready';
}

async function waitForPaint(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function currentRule(tabUrl: string | undefined): Promise<AutomationSiteRule | null> {
  const rule = ruleForUrl(await loadAutomationRules(), tabUrl);
  if (!rule) return null;
  const permitted = await chrome.permissions.contains({ origins: [rule.originPattern] });
  return permitted ? rule : null;
}

async function recordForPending(
  pending: PendingAction | null,
  action: 'blocked' | 'cancelled' | 'filled' | 'opened' | 'error',
  reasonCode: string,
  fallbackHostname?: string,
): Promise<void> {
  const hostname = pending?.page.hostname ?? fallbackHostname;
  if (!hostname) return;
  const candidateType = pending?.ranked.candidate.type;
  await recordActivity({
    hostname,
    candidateType:
      candidateType === 'otp' || candidateType === 'magic_link' ? candidateType : 'none',
    action,
    reasonCode,
  });
}

async function runAutomaticScan(
  tabId: number,
  expectedUrl: string | undefined,
  attempt: number,
  generation: number,
): Promise<void> {
  const isCurrent = () => scanGenerations.get(tabId) === generation;
  const tab = await chrome.tabs.get(tabId);
  if (!isCurrent()) return;
  const tabUrl = tab.url;
  if (!tabUrl || (expectedUrl && tabUrl !== expectedUrl)) return;
  const rule = await currentRule(tabUrl);
  if (!rule) return;

  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  if (!isCurrent()) return;
  await showOverlay(tabId, {
    state: 'waiting',
    mode: rule.mode,
    candidateType: 'none',
    title: attempt === 0 ? 'Waiting for email' : 'Still waiting for email',
    detail: 'Watching the selected mailbox for a recent message that belongs with this page.',
  });

  const response = await contentMessage(tabId, { type: 'SCAN_CONTEXT' });
  if (!isCurrent()) return;
  if (!response.ok || !response.page || !response.automation) {
    throw new Error(response.ok ? 'Page context was unavailable.' : response.error);
  }
  const page = pageContextSchema.parse(response.page);
  const intents = response.automation.intents;
  if (intents.length === 0) {
    await hideOverlay(tabId);
    return;
  }

  const source = await loadMailSource();
  if (source === 'synthetic' && !page.simulated) {
    await showOverlay(tabId, {
      state: 'error',
      mode: rule.mode,
      candidateType: 'none',
      title: 'Connect a mailbox first',
      detail:
        'The demo inbox works only with the local Judge Lab. Choose Gmail or Outlook for this site.',
    });
    await recordForPending(null, 'error', 'mailbox_required', page.hostname);
    return;
  }

  const messages =
    source === 'synthetic'
      ? messagesForScenario(page.scenario)
      : await fetchMailboxMessages(source);
  if (!isCurrent()) return;
  if (messages.length > 0) {
    await showOverlay(tabId, {
      state: 'found',
      mode: rule.mode,
      candidateType: 'none',
      title: 'Message found',
      detail: 'Checking sender, service, freshness, destination, and this page locally.',
    });
    await waitForPaint(140);
    if (!isCurrent()) return;
  }

  const deterministic = extractInboxDeterministic(messages);
  const realMailModelOptIn = await loadRealMailModelOptIn();
  const enhanced =
    source !== 'synthetic' && shouldUseModelForSource(source, realMailModelOptIn)
      ? await enhanceCandidatesWithModel(messages, deterministic)
      : { candidates: deterministic, modelUsed: false, fallbackReason: null };
  if (!isCurrent()) return;
  const ranked = rankCandidates(enhanced.candidates, page, {
    usedCandidateIds: await usedCandidateIds(),
  });
  const selection = selectAutomaticCandidate(ranked, intents);

  if (selection.status === 'empty') {
    if (!isCurrent()) return;
    if (attempt + 1 >= MAX_POLL_ATTEMPTS) {
      await showOverlay(tabId, {
        state: 'error',
        mode: rule.mode,
        candidateType: 'none',
        title: 'No matching email arrived',
        detail: 'Nothing was filled or opened. Try again after requesting a new message.',
      });
      await recordForPending(null, 'error', 'poll_timeout', page.hostname);
      return;
    }
    await showOverlay(tabId, {
      state: 'waiting',
      mode: rule.mode,
      candidateType: 'none',
      title: 'Waiting for the right message',
      detail:
        'No recent trusted match yet. ContextFill will check again without exposing message contents.',
    });
    schedulePoll(tabId, tabUrl, attempt + 1);
    return;
  }

  const pending: PendingAction = {
    ranked: selection.ranked,
    page,
    source,
    tabId,
    scannedTabUrl: tabUrl,
    mode: rule.mode,
  };
  if (selection.status === 'blocked') {
    if (!isCurrent()) return;
    pendingActions.delete(tabId);
    await showOverlay(tabId, {
      state: 'blocked',
      mode: rule.mode,
      candidateType: selection.ranked.candidate.type === 'otp' ? 'otp' : 'magic_link',
      title: 'Auto-Continue stopped',
      detail: selection.reason,
      ...(selection.ranked.policy.matchedDomain
        ? { destination: selection.ranked.policy.matchedDomain }
        : {}),
    });
    await recordForPending(pending, 'blocked', selection.reasonCode);
    return;
  }

  pendingActions.set(tabId, pending);
  const type = selection.ranked.candidate.type as 'otp' | 'magic_link';
  const destination =
    type === 'magic_link'
      ? (inspectMagicLink(selection.ranked.candidate.value ?? '').hostname ?? undefined)
      : (selection.ranked.policy.matchedDomain ?? undefined);
  await showOverlay(tabId, {
    state: 'verified',
    mode: rule.mode,
    candidateType: type,
    title: automaticTitle(type),
    detail:
      type === 'magic_link'
        ? 'The page, sender, and masked link destination align.'
        : 'The page, sender, and recent message align. The code stays masked.',
    ...(destination ? { destination } : {}),
  });
  if (rule.mode === 'auto') {
    await waitForPaint(320);
    if (!isCurrent() || pendingActions.get(tabId) !== pending) return;
    await showOverlay(tabId, {
      state: 'countdown',
      mode: rule.mode,
      candidateType: type,
      title: automaticTitle(type, 3),
      detail:
        type === 'magic_link'
          ? 'Cancel now to keep this tab on the current page.'
          : 'Cancel now to leave every field unchanged.',
      ...(destination ? { destination } : {}),
      countdownSeconds: 3,
    });
  }
}

function queueAutomaticScan(tabId: number, expectedUrl?: string, attempt = 0): Promise<void> {
  const pending = pendingActions.get(tabId);
  if (pending && (!expectedUrl || pending.scannedTabUrl === expectedUrl)) {
    return Promise.resolve();
  }
  const running = runningScans.get(tabId);
  if (running) return running;
  const generation = (scanGenerations.get(tabId) ?? 0) + 1;
  scanGenerations.set(tabId, generation);
  const scan = runAutomaticScan(tabId, expectedUrl, attempt, generation)
    .catch(async (error: unknown) => {
      if (scanGenerations.get(tabId) !== generation) return;
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      const rule = tab ? await currentRule(tab.url) : null;
      if (!rule) return;
      await showOverlay(tabId, {
        state: 'error',
        mode: rule.mode,
        candidateType: 'none',
        title:
          error instanceof MailClientError ? 'Could not read the mailbox' : 'Auto-Continue paused',
        detail:
          error instanceof Error
            ? error.message
            : 'The page or mailbox changed before the trust check completed.',
      }).catch(() => undefined);
      await recordForPending(null, 'error', 'scan_error', automationIdentity(tab?.url)?.hostname);
    })
    .finally(() => {
      if (runningScans.get(tabId) === scan) runningScans.delete(tabId);
    });
  runningScans.set(tabId, scan);
  return scan;
}

async function executePending(tabId: number): Promise<void> {
  const pending = pendingActions.get(tabId);
  if (!pending) return;
  clearPoll(tabId);
  const tab = await chrome.tabs.get(tabId);
  if (tab.url !== pending.scannedTabUrl) throw new Error('The initiating tab changed.');
  const rule = await currentRule(tab.url);
  if (!rule || rule.mode !== pending.mode) throw new Error('Auto-Continue is no longer enabled.');

  const scan = await contentMessage(tabId, { type: 'SCAN_CONTEXT' });
  if (!scan.ok || !scan.page || !scan.automation) {
    throw new Error(scan.ok ? 'Page context was unavailable.' : scan.error);
  }
  const currentPage = pageContextSchema.parse(scan.page);
  const expectedIntent = pending.ranked.candidate.type === 'otp' ? 'otp' : 'magic_link';
  if (
    currentPage.hostname !== pending.page.hostname ||
    !scan.automation.intents.includes(expectedIntent)
  ) {
    throw new Error('The page no longer requests the verified action.');
  }
  const reranked = rankCandidates([pending.ranked.candidate], currentPage, {
    usedCandidateIds: await usedCandidateIds(),
  })[0];
  if (!reranked || reranked.policy.decision !== 'allow') {
    throw new Error(reranked?.policy.reason ?? 'The trust decision is no longer valid.');
  }

  if (pending.ranked.candidate.type === 'otp') {
    const value = pending.ranked.candidate.value;
    if (!value) throw new Error('The verified code is no longer available.');
    const response = await contentMessage(tabId, {
      type: 'FILL_VALUE',
      value,
      purpose: 'verification_code',
      authorized: true,
    });
    if (!response.ok || !response.filled) {
      throw new Error(response.ok ? 'Fill was not confirmed.' : response.error);
    }
    await markCandidateUsed(pending.ranked.candidate.id);
    pendingActions.delete(tabId);
    await recordForPending(pending, 'filled', 'aligned');
    await showOverlay(tabId, {
      state: 'success',
      mode: rule.mode,
      candidateType: 'otp',
      title: 'Code filled',
      detail: 'The matching field changed. ContextFill did not click a Submit or Login button.',
    });
    return;
  }

  await performVerifiedNavigation(
    {
      candidate: pending.ranked.candidate,
      policy: reranked.policy,
      page: currentPage,
      source: pending.source,
      tabId,
      scannedTabUrl: pending.scannedTabUrl,
      autoContinue: { pageHostname: currentPage.hostname },
    },
    {
      getTab: async (id) => chrome.tabs.get(id),
      markUsed: markCandidateUsed,
      clearSensitiveState: () => clearTabState(tabId),
      navigate: async (id, url) => {
        await chrome.tabs.update(id, { url });
      },
    },
  );
  await recordForPending(pending, 'opened', 'aligned');
}

async function handleOverlayAction(
  tabId: number,
  action: 'execute' | 'cancel' | 'dismiss' | 'retry',
): Promise<void> {
  if (action === 'execute') {
    try {
      await executePending(tabId);
    } catch (error) {
      const pending = pendingActions.get(tabId) ?? null;
      pendingActions.delete(tabId);
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      const rule = tab ? await currentRule(tab.url) : null;
      if (rule) {
        await showOverlay(tabId, {
          state: 'error',
          mode: rule.mode,
          candidateType: pending?.ranked.candidate.type === 'otp' ? 'otp' : 'magic_link',
          title: 'Auto-Continue paused',
          detail: error instanceof Error ? error.message : 'The page changed before execution.',
        });
      }
      await recordForPending(pending, 'error', 'execution_revalidation_failed');
    }
    return;
  }
  if (action === 'retry') {
    clearTabState(tabId);
    const tab = await chrome.tabs.get(tabId);
    await queueAutomaticScan(tabId, tab.url, 0);
    return;
  }
  const pending = pendingActions.get(tabId) ?? null;
  clearTabState(tabId);
  if (action === 'dismiss') {
    await hideOverlay(tabId);
    return;
  }
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const rule = tab ? await currentRule(tab.url) : null;
  if (rule) {
    await showOverlay(tabId, {
      state: 'success',
      mode: rule.mode,
      candidateType: 'none',
      title: 'Auto-Continue cancelled',
      detail: 'Nothing was filled or opened.',
    });
  }
  await recordForPending(
    pending,
    'cancelled',
    'user_cancelled',
    automationIdentity(tab?.url)?.hostname,
  );
}

async function setSiteMode(
  tabId: number,
  tabUrl: string,
  mode: 'manual' | 'assisted' | 'auto',
): Promise<AutomationSiteRule | null> {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url !== tabUrl) throw new Error('The active tab changed. Open settings again.');
  const identity = automationIdentity(tabUrl);
  if (!identity) throw new Error('This page cannot use Auto-Continue.');
  if (mode !== 'manual') {
    const permitted = await chrome.permissions.contains({ origins: [identity.originPattern] });
    if (!permitted) throw new Error('Grant exact-site access before enabling this mode.');
  }
  const rule = await saveAutomationMode(tabUrl, mode);
  clearTabState(tabId);
  if (mode === 'manual') {
    await chrome.permissions.remove({ origins: [identity.originPattern] }).catch(() => false);
    await hideOverlay(tabId);
  } else {
    await queueAutomaticScan(tabId, tabUrl, 0);
  }
  return rule;
}

async function handleRequest(
  request: BackgroundRequest,
  sender: chrome.runtime.MessageSender,
): Promise<BackgroundResponse> {
  if (request.type === 'GET_USED_CANDIDATES') {
    return { ok: true, candidateIds: [...(await usedCandidateIds())] };
  }
  if (request.type === 'MARK_CANDIDATE_USED') {
    await markCandidateUsed(request.candidateId);
    return { ok: true, candidateIds: [...(await usedCandidateIds())] };
  }
  if (request.type === 'GET_AUTOMATION_OVERVIEW') {
    return {
      ok: true,
      rules: await loadAutomationRules(),
      history: await loadActivityHistory(),
    };
  }
  if (request.type === 'SET_SITE_MODE') {
    const activeRule = await setSiteMode(request.tabId, request.tabUrl, request.mode);
    return { ok: true, activeRule };
  }
  if (request.type === 'REMOVE_SITE_RULE') {
    const removed = await removeAutomationRule(request.originPattern);
    await Promise.all(
      removed.map((rule) =>
        chrome.permissions.remove({ origins: [rule.originPattern] }).catch(() => false),
      ),
    );
    return { ok: true, rules: await loadAutomationRules(), history: await loadActivityHistory() };
  }
  if (request.type === 'CLEAR_ACTIVITY_HISTORY') {
    await clearActivityHistory();
    return { ok: true, rules: await loadAutomationRules(), history: [] };
  }
  if (request.type === 'RUN_AUTO_CONTINUE') {
    const tab = await chrome.tabs.get(request.tabId);
    await queueAutomaticScan(request.tabId, tab.url, 0);
    return { ok: true };
  }
  if (request.type === 'CONTENT_READY') {
    if (sender.tab?.id) await queueAutomaticScan(sender.tab.id, sender.tab.url, 0);
    return { ok: true };
  }
  if (request.type === 'AUTOMATION_OVERLAY_ACTION') {
    if (!sender.tab?.id) throw new Error('The in-page action did not come from a browser tab.');
    await handleOverlayAction(sender.tab.id, request.action);
    return { ok: true };
  }
  throw new Error('Unsupported request.');
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  void handleRequest(request, sender)
    .then(sendResponse)
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error:
          error instanceof Error ? error.message : 'ContextFill could not complete the request.',
      } satisfies BackgroundResponse),
    );
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) clearTabState(tabId);
  if (changeInfo.status === 'complete' && tab.url) {
    void queueAutomaticScan(tabId, tab.url, 0);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs
    .get(tabId)
    .then((tab) => queueAutomaticScan(tabId, tab.url, 0))
    .catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId) => clearTabState(tabId));

chrome.permissions.onRemoved.addListener((permissions) => {
  if (!permissions.origins?.length) return;
  void loadAutomationRules().then(async (rules) => {
    for (const rule of rules) {
      if (permissions.origins?.includes(rule.originPattern)) {
        await removeAutomationRule(rule.originPattern);
      }
    }
  });
});
