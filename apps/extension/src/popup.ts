import {
  buildConfirmationViewModel,
  authorizeContextCapsule,
  capsulePageContextSchema,
  extractContextCapsulesDeterministic,
  extractInboxDeterministic,
  maskContextCapsuleFact,
  maskContextCapsuleText,
  messagesForScenario,
  pageContextSchema,
  rankCandidates,
  type PageContext,
  type RankedCandidate,
  type MailboxMessage,
  type ContextCapsule,
} from '../../../packages/core/src/index.js';
import { EmlImportError, parseEmlImport } from './eml-import.js';
import type { AutomationMode, AutomationSiteRule } from './automation-settings.js';
import { enhanceCandidatesWithModel } from './model-client.js';
import {
  beginMailConnection,
  disconnectMailProvider,
  fetchMailboxMessages,
  getMailProviderStatus,
  getPairingStatus,
  loadMailSource,
  loadRealMailModelOptIn,
  MailClientError,
  pairCompanionService,
  saveMailSource,
  saveRealMailModelOptIn,
  shouldUseModelForSource,
  sourceLabel,
  type MailProviderStatus,
  type PairingStatus,
  type MailProvider,
  type MailSource,
  type PersistentMailSource,
} from './mail-client.js';
import type {
  BackgroundRequest,
  BackgroundResponse,
  ContentRequest,
  ContentResponse,
} from './shared/messages.js';
import { isMissingHostPermission, siteAccessRequest } from './site-access.js';
import { performVerifiedNavigation } from './verified-navigation.js';
import { EASYJET_MAX_MESSAGE_AGE_MINUTES } from './easyjet-policy.js';
import { liveAirlineForUrl, type LiveAirlineProfile } from './live-airline-policy.js';

const app = document.querySelector<HTMLElement>('#app')!;
const mailboxSetupGuide =
  'https://github.com/lzongren/contextfill/blob/main/docs/MAILBOX_INTEGRATION.md';
let selected: {
  ranked: RankedCandidate;
  page: PageContext;
  tabId: number;
  scannedTabUrl: string;
} | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let mailSource: MailSource = 'synthetic';
let persistedMailSource: PersistentMailSource = 'synthetic';
let importedMessages: MailboxMessage[] = [];
let realMailModelOptIn = false;
let viewGeneration = 0;

type AirlineChoice = {
  capsule: ContextCapsule;
  message: MailboxMessage;
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shell(): { body: HTMLElement; footer: HTMLElement } {
  app.replaceChildren();
  const header = element('header', 'app-header');
  const brand = element('div', 'brand');
  const mark = element('span', 'brand-mark');
  mark.setAttribute('aria-hidden', 'true');
  brand.append(mark, element('strong', '', 'ContextFill'));
  const source = element('button', 'source-button', sourceLabel(mailSource));
  source.type = 'button';
  source.setAttribute('aria-label', `Message source: ${sourceLabel(mailSource)}. Change source.`);
  source.addEventListener('click', () => void renderMailSources());
  const automation = element('button', 'source-button automation-button', 'Automation');
  automation.type = 'button';
  automation.setAttribute('aria-label', 'Configure Auto-Continue for this site.');
  automation.addEventListener('click', () => void renderAutomationSettings());
  const headerActions = element('div', 'header-actions');
  headerActions.append(source, automation);
  header.append(brand, headerActions);
  const body = element('section', 'app-body');
  const footer = element('footer', 'app-footer');
  footer.append(
    element('span', '', 'Visible, cancellable actions'),
    element('span', '', 'Never submits'),
  );
  app.append(header, body, footer);
  return { body, footer };
}

function renderLoading(): void {
  const { body } = shell();
  const spinner = element('div', 'spinner');
  spinner.setAttribute('aria-hidden', 'true');
  body.append(
    element('p', 'kicker', 'Checking context'),
    element('h1', '', 'Looking for a trusted match…'),
    element('p', 'muted', `Scanning this page and ${sourceLabel(mailSource)}.`),
    spinner,
  );
}

function renderMessage(
  kind: 'success' | 'error' | 'empty' | 'timeout',
  title: string,
  copy: string,
): void {
  selected = null;
  const { body } = shell();
  const icon = element(
    'div',
    `message-icon message-icon--${kind}`,
    kind === 'success' ? '✓' : kind === 'error' ? '!' : '–',
  );
  icon.setAttribute('aria-hidden', 'true');
  body.append(
    icon,
    element('p', 'kicker', kind),
    element('h1', '', title),
    element('p', 'muted', copy),
  );
  if (kind !== 'success') {
    const retry = element('button', 'button button--primary', 'Scan again');
    retry.type = 'button';
    retry.addEventListener('click', () => void scan());
    body.append(retry);
  }
}

function renderSiteAccessRequest(tab: chrome.tabs.Tab): void {
  selected = null;
  const site = siteAccessRequest(tab.url);
  if (!site) {
    renderMessage(
      'error',
      'ContextFill cannot inspect this tab',
      'Open a normal HTTP or HTTPS webpage and try again.',
    );
    return;
  }
  const { body } = shell();
  const icon = element('div', 'message-icon message-icon--error', '!');
  icon.setAttribute('aria-hidden', 'true');
  const allow = element('button', 'button button--primary', `Allow on ${site.hostname}`);
  allow.type = 'button';
  allow.addEventListener('click', () => {
    void (async () => {
      try {
        const granted = await chrome.permissions.request({ origins: [site.originPattern] });
        if (!granted) {
          renderMessage(
            'error',
            'Site access was not granted',
            `ContextFill cannot inspect ${site.hostname} unless you explicitly allow this site.`,
          );
          return;
        }
        await scan();
      } catch (error) {
        renderMessage(
          'error',
          'Could not request site access',
          error instanceof Error ? error.message : 'Close the popup and try again.',
        );
      }
    })();
  });
  body.append(
    icon,
    element('p', 'kicker', 'Site access required'),
    element('h1', '', `Allow ContextFill on ${site.hostname}`),
    element(
      'p',
      'muted',
      'ContextFill needs access to this site only to inspect the requesting context and perform an action you explicitly approve. It never submits a form.',
    ),
    allow,
  );
}

function row(label: string, value: string): HTMLDivElement {
  const item = element('div', 'evidence-row');
  item.append(element('dt', '', label), element('dd', '', value));
  return item;
}

function clearSensitiveState(reason: 'timeout' | 'dismiss' | 'success'): void {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  selected = null;
  importedMessages = [];
  if (mailSource === 'import') mailSource = persistedMailSource;
  if (reason === 'timeout') {
    renderMessage(
      'timeout',
      'Sensitive details cleared',
      'Open ContextFill again to run a fresh scan.',
    );
  }
}

function scheduleClear(candidate: RankedCandidate): void {
  if (!candidate.candidate.value) return;
  if (clearTimer) clearTimeout(clearTimer);
  const expiryDelay = candidate.candidate.expiresAt
    ? new Date(candidate.candidate.expiresAt).getTime() - Date.now()
    : Number.POSITIVE_INFINITY;
  const delay = Math.max(0, Math.min(90_000, expiryDelay));
  clearTimer = setTimeout(() => clearSensitiveState('timeout'), delay);
}

async function backgroundMessage(request: BackgroundRequest): Promise<BackgroundResponse> {
  return (await chrome.runtime.sendMessage(request)) as BackgroundResponse;
}

function requireBackgroundSuccess(
  response: BackgroundResponse,
): Extract<BackgroundResponse, { ok: true }> {
  if (!response.ok) throw new Error(response.error);
  return response;
}

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active browser tab is available.');
  return tab;
}

async function contentMessage(tabId: number, request: ContentRequest): Promise<ContentResponse> {
  return (await chrome.tabs.sendMessage(tabId, request)) as ContentResponse;
}

function modeCopy(mode: AutomationMode): { title: string; status: string; copy: string } {
  if (mode === 'assisted') {
    return {
      title: 'Assisted',
      status: 'Confirm in page',
      copy: 'ContextFill detects and verifies the message automatically, then waits for an in-page confirmation.',
    };
  }
  if (mode === 'auto') {
    return {
      title: 'Auto-Continue',
      status: '3-second countdown',
      copy: 'A high-confidence verified code fills or verified link opens in this tab after a visible, cancellable countdown.',
    };
  }
  return {
    title: 'Manual',
    status: 'Default',
    copy: 'Nothing runs in the page until you open this popup and approve the action.',
  };
}

function ruleForActiveSite(
  rules: AutomationSiteRule[],
  originPattern: string,
): AutomationSiteRule | null {
  return rules.find((rule) => rule.originPattern === originPattern) ?? null;
}

async function setActiveSiteMode(tab: chrome.tabs.Tab, mode: AutomationMode): Promise<void> {
  const site = siteAccessRequest(tab.url);
  if (!tab.id || !tab.url || !site) throw new Error('Open a normal HTTP or HTTPS page first.');
  if (mode !== 'manual') {
    const alreadyGranted = await chrome.permissions.contains({ origins: [site.originPattern] });
    const granted =
      alreadyGranted || (await chrome.permissions.request({ origins: [site.originPattern] }));
    if (!granted) throw new Error(`Exact-site access was not granted for ${site.hostname}.`);
  }
  requireBackgroundSuccess(
    await backgroundMessage({ type: 'SET_SITE_MODE', tabId: tab.id, tabUrl: tab.url, mode }),
  );
}

async function renderAutomationSettings(tabOverride?: chrome.tabs.Tab): Promise<void> {
  viewGeneration += 1;
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  selected = null;
  const { body } = shell();
  try {
    const tab = tabOverride ?? (await activeTab());
    const site = siteAccessRequest(tab.url);
    if (!site) {
      body.append(
        element('p', 'kicker', 'Automation'),
        element('h1', '', 'Open a normal webpage'),
        element('p', 'muted', 'Per-site automation cannot run on browser or extension pages.'),
      );
      return;
    }
    const overview = requireBackgroundSuccess(
      await backgroundMessage({ type: 'GET_AUTOMATION_OVERVIEW' }),
    );
    const activeRule = ruleForActiveSite(overview.rules ?? [], site.originPattern);
    const activeMode: AutomationMode = activeRule?.mode ?? 'manual';
    body.append(
      element('p', 'kicker', 'Verified Auto-Continue'),
      element('h1', '', `Choose how ContextFill works on ${site.hostname}`),
      element(
        'p',
        'muted',
        'New sites stay Manual. Assisted and Auto-Continue require exact-site access and can be revoked at any time.',
      ),
    );

    for (const mode of ['manual', 'assisted', 'auto'] as const) {
      const details = modeCopy(mode);
      const card = sourceCard(
        details.title,
        activeMode === mode ? 'Enabled' : details.status,
        details.copy,
      );
      const choose = sourceAction(
        activeMode === mode
          ? `${details.title} is enabled`
          : mode === 'manual'
            ? 'Use Manual mode'
            : `Enable ${details.title}`,
        activeMode !== mode,
      );
      choose.disabled = activeMode === mode;
      if (mode === 'auto' && activeMode !== 'auto') {
        const consent = element('label', 'automation-consent');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        consent.append(
          checkbox,
          document.createTextNode(
            ' I understand that verified links may navigate this tab and some sites submit automatically after the last OTP digit.',
          ),
        );
        choose.disabled = true;
        checkbox.addEventListener('change', () => {
          choose.disabled = !checkbox.checked;
        });
        card.card.insertBefore(consent, card.actions);
      }
      choose.addEventListener('click', () => {
        void (async () => {
          try {
            await setActiveSiteMode(tab, mode);
            await renderAutomationSettings(tab);
          } catch (error) {
            renderMessage(
              'error',
              'Could not change automation mode',
              error instanceof Error ? error.message : 'Try again on the requesting page.',
            );
          }
        })();
      });
      card.actions.append(choose);
      body.append(card.card);
    }

    const manage = sourceAction('Manage trusted sites and activity');
    manage.addEventListener('click', () => void chrome.runtime.openOptionsPage());
    const back = sourceAction('Back to scan');
    back.addEventListener('click', () => void scan());
    body.append(manage, back);
  } catch (error) {
    body.append(
      element('p', 'kicker', 'Automation'),
      element('h1', '', 'Settings are unavailable'),
      element('p', 'muted', error instanceof Error ? error.message : 'Try reopening the popup.'),
    );
  }
}

function renderConfirmation(ranked: RankedCandidate, page: PageContext): void {
  const view = buildConfirmationViewModel(ranked.candidate, ranked.policy, page);
  const { body } = shell();
  const status = element('div', `trust trust--${ranked.policy.decision}`);
  const statusIcon = element(
    'span',
    'trust-icon',
    ranked.policy.decision === 'allow' ? '✓' : ranked.policy.decision === 'warn' ? '!' : '×',
  );
  statusIcon.setAttribute('aria-hidden', 'true');
  const statusCopy = element('div');
  statusCopy.append(
    element('span', 'trust-label', `Trust decision · ${view.statusLabel}`),
    element('p', '', view.explanation),
  );
  status.append(statusIcon, statusCopy);

  const heading = element('div', 'candidate-heading');
  const valueWrap = element('div');
  valueWrap.append(element('span', 'field-label', view.candidateLabel));
  const value = element(
    'strong',
    `candidate-value${view.candidateType === 'magic_link' ? ' candidate-value--link' : ''}`,
    view.maskedValue,
  );
  valueWrap.append(value);
  heading.append(valueWrap);
  if (
    ranked.candidate.type !== 'magic_link' &&
    ranked.policy.decision !== 'block' &&
    ranked.candidate.value
  ) {
    const reveal = element('button', 'text-button', 'Reveal');
    reveal.type = 'button';
    let revealed = false;
    reveal.addEventListener('click', () => {
      revealed = !revealed;
      value.textContent = revealed ? ranked.candidate.value : view.maskedValue;
      reveal.textContent = revealed ? 'Mask' : 'Reveal';
    });
    heading.append(reveal);
  }

  const evidence = element('dl', 'evidence');
  evidence.append(
    row('Sender', view.sender),
    row('Subject', view.subject),
    row('Received', view.age),
    row('Claimed service', view.claimedService),
    row('Requesting website', view.activeDomain),
  );
  if (view.destination) evidence.append(row('Link destination', view.destination));
  const simulation = view.simulationLabel
    ? element('p', 'simulation-note', `Fixture · ${view.simulationLabel}`)
    : null;
  const extraction = element(
    'p',
    'extraction-note',
    `${sourceLabel(mailSource)} · ${
      ranked.candidate.extractionMethod === 'gpt-5.6'
        ? 'GPT-5.6 extracted message facts · deterministic policy decided'
        : 'Deterministic extraction · policy decided locally'
    }`,
  );
  const easyJetSurnameNote =
    ranked.candidate.type === 'reference' && page.serviceHint?.toLocaleLowerCase() === 'easyjet'
      ? element(
          'p',
          'simulation-note',
          'This confirmation does not state a passenger surname. Only the verified booking reference will be filled; enter the surname yourself on easyJet.',
        )
      : null;
  const actions = element('div', 'actions');
  const dismiss = element('button', 'button button--secondary', 'Dismiss');
  dismiss.type = 'button';
  dismiss.addEventListener('click', () => {
    clearSensitiveState('dismiss');
    window.close();
  });

  if (ranked.policy.decision === 'allow') {
    const approve = element(
      'button',
      'button button--primary',
      ranked.candidate.type === 'magic_link'
        ? 'Open verified link in this tab'
        : ranked.candidate.type === 'reference'
          ? 'Fill reference'
          : `Fill ${page.fieldCount === 1 ? 'code' : `${page.fieldCount} fields`}`,
    );
    approve.type = 'button';
    approve.addEventListener(
      'click',
      () =>
        void (ranked.candidate.type === 'magic_link'
          ? openSelectedMagicLink()
          : fillSelected(false)),
    );
    actions.append(approve, dismiss);
  } else if (
    ranked.candidate.type !== 'magic_link' &&
    ranked.policy.decision === 'warn' &&
    ranked.policy.canOverride
  ) {
    const overrideLabel = element('label', 'override');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    overrideLabel.append(
      checkbox,
      document.createTextNode(' I understand the missing or conflicting evidence.'),
    );
    const fill = element('button', 'button button--warning', 'Fill with caution');
    fill.type = 'button';
    fill.disabled = true;
    checkbox.addEventListener('change', () => {
      fill.disabled = !checkbox.checked;
    });
    fill.addEventListener('click', () => void fillSelected(true));
    actions.append(overrideLabel, fill, dismiss);
  } else {
    const blocked = element(
      'p',
      'blocked-note',
      ranked.candidate.type === 'magic_link'
        ? 'Opening is unavailable for this security decision.'
        : 'Fill is unavailable for this security decision.',
    );
    actions.append(blocked, dismiss);
  }

  body.append(status, heading, evidence);
  if (simulation) body.append(simulation);
  if (easyJetSurnameNote) body.append(easyJetSurnameNote);
  body.append(extraction, actions);
  scheduleClear(ranked);
}

async function openSelectedMagicLink(): Promise<void> {
  const current = selected;
  if (!current || current.ranked.candidate.type !== 'magic_link') return;
  try {
    await performVerifiedNavigation(
      {
        candidate: current.ranked.candidate,
        policy: current.ranked.policy,
        page: current.page,
        source: mailSource,
        tabId: current.tabId,
        scannedTabUrl: current.scannedTabUrl,
        userApproved: true,
      },
      {
        getTab: async (tabId) => chrome.tabs.get(tabId),
        markUsed: async (candidateId) => {
          const response = await backgroundMessage({
            type: 'MARK_CANDIDATE_USED',
            candidateId,
          });
          if (!response.ok) throw new Error('Could not record one-time link use.');
        },
        clearSensitiveState: () => clearSensitiveState('success'),
        navigate: async (tabId, url) => {
          await chrome.tabs.update(tabId, { url });
        },
      },
    );
  } catch (error) {
    renderMessage(
      'error',
      'Could not open this verified link',
      error instanceof Error ? error.message : 'The initiating tab changed. Scan again.',
    );
  }
}

function sourceAction(label: string, primary = false): HTMLButtonElement {
  const button = element(
    'button',
    `button ${primary ? 'button--primary' : 'button--secondary'}`,
    label,
  );
  button.type = 'button';
  return button;
}

function sourceCard(
  title: string,
  status: string,
  copy: string,
): { card: HTMLDivElement; actions: HTMLDivElement } {
  const card = element('div', 'source-card');
  const heading = element('div', 'source-card__heading');
  heading.append(element('strong', '', title), element('span', 'source-status', status));
  const actions = element('div', 'source-card__actions');
  card.append(heading, element('p', 'muted', copy), actions);
  return { card, actions };
}

function appendPairingCard(body: HTMLElement, status: PairingStatus): void {
  const copy =
    status.mode === 'paired'
      ? 'This service is paired with another installation or its browser capability was lost. Restart once with CONTEXTFILL_PAIRING_RESET=1 to create a new code.'
      : status.mode === 'legacy-env'
        ? 'The extension ID in CONTEXTFILL_EXTENSION_ID does not match this installation. Remove it to use one-time pairing.'
        : 'Enter the six-digit pairing code printed by npm run service. The code expires after 10 minutes.';
  const pairing = sourceCard('Companion service', 'Pairing required', copy);
  if (status.mode === 'unpaired') {
    const code = element('input', 'pairing-input');
    code.type = 'text';
    code.inputMode = 'numeric';
    code.pattern = '[0-9]*';
    code.maxLength = 6;
    code.autocomplete = 'one-time-code';
    code.placeholder = '6-digit code';
    code.setAttribute('aria-label', 'Companion service pairing code');
    const pair = sourceAction('Pair service', true);
    pair.addEventListener('click', () => {
      void (async () => {
        try {
          await pairCompanionService(code.value.trim());
          await renderMailSources();
        } catch (error) {
          renderMessage(
            'error',
            'Could not pair companion service',
            error instanceof Error ? error.message : 'Check the terminal code and try again.',
          );
        }
      })();
    });
    pairing.actions.append(code, pair);
  }
  body.append(pairing.card);
}

function appendProviderCards(body: HTMLElement, statuses: MailProviderStatus[]): void {
  for (const status of statuses) {
    const label = sourceLabel(status.provider);
    const state = status.connected
      ? mailSource === status.provider
        ? 'Using'
        : 'Connected'
      : status.configured
        ? 'Ready to connect'
        : 'Needs setup';
    const copy = status.connected
      ? `Connected${status.account ? ` as ${status.account}` : ''}. ${
          status.sessionOnly
            ? 'Authorization lasts only while the companion service is running.'
            : 'Refresh authorization is protected by your OS keychain.'
        }`
      : status.configured
        ? `Connect ${label} with read-only mail access. ContextFill fetches only recent temporary-action messages.`
        : status.provider === 'outlook'
          ? 'Requires an app registration owned by an Entra tenant. A standalone personal Outlook.com account can use the finished connector but cannot create the registration.'
          : 'Run contextfill-service --setup gmail for an exact callback, then import Google’s downloaded web-client JSON without copying its secret.';
    const providerCard = sourceCard(label, state, copy);
    if (status.connected) {
      const use = sourceAction(
        mailSource === status.provider ? `Using ${label}` : `Use ${label}`,
        mailSource !== status.provider,
      );
      use.disabled = mailSource === status.provider;
      use.addEventListener('click', () => void chooseSource(status.provider));
      const disconnect = sourceAction('Disconnect');
      disconnect.addEventListener('click', () => {
        void (async () => {
          try {
            await disconnectMailProvider(status.provider);
            if (mailSource === status.provider) {
              mailSource = 'synthetic';
              await saveMailSource('synthetic');
            }
            await renderMailSources();
          } catch (error) {
            renderMessage(
              'error',
              `Could not disconnect ${label}`,
              error instanceof Error
                ? error.message
                : 'The saved mailbox credential could not be removed.',
            );
          }
        })();
      });
      providerCard.actions.append(use, disconnect);
    } else {
      if (status.configured) {
        const connect = sourceAction(`Connect ${label}`, true);
        connect.addEventListener('click', () => void connectProvider(status.provider));
        providerCard.actions.append(connect);
      } else {
        const setup = sourceAction(`Open ${label} setup guide`, true);
        setup.addEventListener('click', () => {
          const section = status.provider === 'gmail' ? '#gmail' : '#outlook-and-microsoft-365';
          void chrome.tabs.create({ url: `${mailboxSetupGuide}${section}` });
        });
        providerCard.actions.append(setup);
      }
    }
    body.append(providerCard.card);
  }
}

async function chooseSource(source: MailSource): Promise<void> {
  if (source === 'import') return;
  mailSource = source;
  persistedMailSource = source;
  importedMessages = [];
  await saveMailSource(source);
  await scan();
}

async function importEml(file: File): Promise<void> {
  try {
    const message = await parseEmlImport(file);
    importedMessages = [message];
    mailSource = 'import';
    await scan();
  } catch (error) {
    importedMessages = [];
    mailSource = persistedMailSource;
    renderMessage(
      'error',
      'Could not import this email',
      error instanceof EmlImportError ? error.message : 'Choose a valid exported .eml message.',
    );
  }
}

async function connectProvider(provider: MailProvider): Promise<void> {
  try {
    await saveMailSource(provider);
    mailSource = provider;
    persistedMailSource = provider;
    const authorizationUrl = await beginMailConnection(provider);
    await chrome.tabs.create({ url: authorizationUrl });
    renderMessage(
      'success',
      `Finish connecting ${sourceLabel(provider)}`,
      'Complete the provider consent screen, then reopen ContextFill on the page requesting an action.',
    );
  } catch (error) {
    renderMessage(
      'error',
      `Could not connect ${sourceLabel(provider)}`,
      error instanceof Error ? error.message : 'The local companion service is unavailable.',
    );
  }
}

async function renderMailSources(): Promise<void> {
  viewGeneration += 1;
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  selected = null;
  const { body } = shell();
  body.append(
    element('p', 'kicker', 'Message source'),
    element('h1', '', 'Choose where messages come from'),
    element(
      'p',
      'muted',
      'Import one exported message entirely in this popup, or connect read-only mailbox access through the loopback companion. Deterministic policy always decides; per-site settings control whether execution is manual, assisted, or automatic.',
    ),
  );

  const demo = sourceCard(
    'Demo inbox',
    mailSource === 'synthetic' ? 'Using' : 'Available',
    'Bundled synthetic messages for the judge scenarios. No account connection required.',
  );
  const useDemo = sourceAction(mailSource === 'synthetic' ? 'Using demo inbox' : 'Use demo inbox');
  useDemo.disabled = mailSource === 'synthetic';
  useDemo.addEventListener('click', () => void chooseSource('synthetic'));
  demo.actions.append(useDemo);
  body.append(demo.card);

  const imported = sourceCard(
    'Import email file',
    'No account needed',
    'Export one Gmail or Outlook message as .eml. It is parsed locally, used once, and never saved; attachments are ignored.',
  );
  const fileLabel = element('label', 'button button--secondary file-button', 'Choose .eml file');
  const fileInput = element('input', 'file-input');
  fileInput.type = 'file';
  fileInput.accept = '.eml,message/rfc822';
  fileInput.setAttribute('aria-label', 'Choose exported email file');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void importEml(file);
  });
  fileLabel.append(fileInput);
  imported.actions.append(fileLabel);
  body.append(imported.card);

  try {
    const pairing = await getPairingStatus();
    if (!pairing.authenticated) {
      appendPairingCard(body, pairing);
    } else {
      if (pairing.mode === 'paired' && !pairing.persistent) {
        const warning = sourceCard(
          'Companion pairing',
          'Session-only',
          'The OS keychain is unavailable. Pairing and mailbox authorization will be lost when the service stops.',
        );
        body.append(warning.card);
      }
      appendProviderCards(body, await getMailProviderStatus());
    }
  } catch (error) {
    const unavailable = sourceCard(
      'Companion service',
      'Unavailable',
      error instanceof Error
        ? error.message
        : 'Start the local service to configure a real mailbox.',
    );
    body.append(unavailable.card);
  }

  const model = sourceCard(
    'GPT-5.6 for real mail',
    realMailModelOptIn ? 'Enabled' : 'Local-only',
    realMailModelOptIn
      ? 'One prefiltered Gmail or Outlook message at a time may be sent through your configured OpenAI API for fact extraction. Imported files always stay local. Deterministic policy still decides.'
      : 'Real Gmail, Outlook, and imported messages use deterministic extraction and stay local. The synthetic demo can still exercise GPT-5.6.',
  );
  const toggleModel = sourceAction(
    realMailModelOptIn ? 'Disable for real mail' : 'Enable for real mail',
  );
  toggleModel.addEventListener('click', () => {
    void (async () => {
      realMailModelOptIn = !realMailModelOptIn;
      await saveRealMailModelOptIn(realMailModelOptIn);
      await renderMailSources();
    })();
  });
  model.actions.append(toggleModel);
  body.append(model.card);

  const back = sourceAction('Back to scan');
  back.addEventListener('click', () => void scan());
  body.append(back);
}

async function fillSelected(warningOverride: boolean): Promise<void> {
  const current = selected;
  if (!current?.ranked.candidate.value) return;
  const allowed =
    current.ranked.policy.decision === 'allow' ||
    (warningOverride &&
      current.ranked.policy.decision === 'warn' &&
      current.ranked.policy.canOverride);
  if (!allowed) return;
  try {
    const tab = await chrome.tabs.get(current.tabId);
    if (tab.url !== current.scannedTabUrl) {
      throw new Error('The initiating tab changed after ContextFill checked it. Scan again.');
    }
    const response = await contentMessage(current.tabId, {
      type: 'FILL_VALUE',
      value: current.ranked.candidate.value,
      purpose: current.ranked.candidate.type === 'reference' ? 'reference' : 'verification_code',
      authorized: true,
    });
    if (!response.ok || !response.filled)
      throw new Error(response.ok ? 'Fill was not confirmed.' : response.error);
    await backgroundMessage({
      type: 'MARK_CANDIDATE_USED',
      candidateId: current.ranked.candidate.id,
    });
    clearSensitiveState('success');
    renderMessage(
      'success',
      current.ranked.candidate.type === 'reference' ? 'Reference filled' : 'Code filled',
      current.ranked.candidate.type === 'reference' &&
        current.page.serviceHint?.toLocaleLowerCase() === 'easyjet'
        ? 'The booking reference changed. This email does not state the passenger surname, so enter it yourself. ContextFill did not submit the form.'
        : 'The matching field changed. ContextFill did not submit the form.',
    );
  } catch (error) {
    renderMessage(
      'error',
      'Could not fill this page',
      error instanceof Error ? error.message : 'The page changed before filling.',
    );
  }
}

async function openAirlineChoice(
  tabId: number,
  profile: LiveAirlineProfile,
  choice: AirlineChoice,
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!profile.isAllowedBookingPage(tab.url)) {
      throw new Error(
        `The initiating tab is no longer the approved ${profile.displayName} booking page.`,
      );
    }
    await chrome.scripting.executeScript({ target: { tabId }, files: ['airline-content.js'] });
    const response = await contentMessage(tabId, {
      type: 'SHOW_AIRLINE_CAPSULE',
      airline: profile.id,
      capsule: choice.capsule,
      message: choice.message,
    });
    if (!response.ok || !response.capsuleShown) {
      throw new Error(response.ok ? 'The capsule overlay was not confirmed.' : response.error);
    }
    clearSensitiveState('success');
    window.close();
  } catch (error) {
    renderMessage(
      'error',
      `Could not open the ${profile.displayName} capsule`,
      error instanceof Error ? error.message : 'The page changed before review.',
    );
  }
}

async function renderAirlineChoices(
  messages: MailboxMessage[],
  tabId: number,
  page: PageContext,
  profile: LiveAirlineProfile,
): Promise<boolean> {
  const now = new Date();
  const capsulePage = capsulePageContextSchema.parse({
    hostname: page.hostname,
    serviceHint: profile.serviceHint,
    simulated: false,
    scenario: null,
  });
  const usedResponse = await backgroundMessage({ type: 'GET_USED_CANDIDATES' });
  const usedCapsuleIds = new Set(usedResponse.ok ? usedResponse.candidateIds : []);
  const capsules = extractContextCapsulesDeterministic(messages, now);
  if (capsules.length === 0) return false;
  const evaluated = capsules.flatMap(
    (
      capsule,
    ): Array<{
      choice: AirlineChoice;
      decision: ReturnType<typeof authorizeContextCapsule>;
    }> => {
      const message = messages.find((candidate) => candidate.id === capsule.messageId);
      if (!message) return [];
      return [
        {
          choice: { capsule, message },
          decision: authorizeContextCapsule(capsule, message, capsulePage, {
            now,
            usedCapsuleIds,
            maxMessageAgeMinutes: profile.maxMessageAgeMinutes,
          }),
        },
      ];
    },
  );
  const allowed = evaluated.filter((item) => item.decision.decision === 'allow');
  if (allowed.length === 0) {
    const explanation =
      evaluated[0]?.decision.reason ??
      `No ${profile.displayName} confirmation contained both a booking reference and passenger surname with matching sender and domain evidence.`;
    renderMessage('empty', `No verified ${profile.displayName} booking found`, explanation);
    return true;
  }

  selected = null;
  const { body } = shell();
  body.append(
    element('p', 'kicker', `Gmail → ${profile.displayName}`),
    element('h1', '', allowed.length === 1 ? 'Choose this booking' : 'Choose a booking'),
    element(
      'p',
      'muted',
      allowed.length === 1
        ? `ContextFill found one confirmation that matches this official ${profile.displayName} booking page.`
        : 'ContextFill found several matching confirmations. It will not choose between different bookings automatically.',
    ),
  );
  const list = element('div', 'capsule-choice-list');
  for (const { choice } of allowed) {
    const card = element('article', 'capsule-choice');
    const heading = element('div', 'capsule-choice__heading');
    heading.append(
      element('strong', '', maskContextCapsuleText(choice.message.subject, choice.capsule)),
      element('span', 'source-status', choice.message.receivedAt.slice(0, 10)),
    );
    const sender = element(
      'p',
      'muted capsule-choice__sender',
      choice.message.senderRelay && profile.id === 'easyjet'
        ? 'easyJet · verified Apple Hide My Email relay'
        : `${profile.displayName} · verified Gmail sender`,
    );
    const facts = element('div', 'capsule-choice__facts');
    for (const fact of choice.capsule.facts) {
      const chip = element('span', 'capsule-choice__fact');
      chip.append(
        element(
          'b',
          '',
          fact.key === 'booking_reference' ? 'Booking reference' : 'Passenger surname',
        ),
        element('code', '', maskContextCapsuleFact(fact)),
      );
      facts.append(chip);
    }
    const use = element('button', 'button button--primary', 'Review verified transfer');
    use.type = 'button';
    use.addEventListener('click', () => void openAirlineChoice(tabId, profile, choice));
    card.append(heading, sender, facts, use);
    list.append(card);
  }
  body.append(
    list,
    element(
      'p',
      'extraction-note',
      `Deterministic extraction · exact ${profile.displayName} origin · values stay masked until transfer · never submits`,
    ),
  );
  return true;
}

async function renderEasyJetReferenceChoices(
  messages: MailboxMessage[],
  tabId: number,
  tabUrl: string,
  page: PageContext,
): Promise<void> {
  const usedResponse = await backgroundMessage({ type: 'GET_USED_CANDIDATES' });
  const usedCandidateIds = new Set(usedResponse.ok ? usedResponse.candidateIds : []);
  const ranked = rankCandidates(extractInboxDeterministic(messages), page, {
    now: new Date(),
    usedCandidateIds,
    maxAgeMinutes: EASYJET_MAX_MESSAGE_AGE_MINUTES,
  }).filter(
    (candidate) =>
      candidate.candidate.type === 'reference' && candidate.policy.decision === 'allow',
  );
  if (ranked.length === 0) {
    renderMessage(
      'empty',
      'No verified easyJet booking found',
      'No easyJet confirmation contained a reference with matching sender and domain evidence.',
    );
    return;
  }

  selected = null;
  const { body } = shell();
  body.append(
    element('p', 'kicker', 'Gmail → easyJet'),
    element(
      'h1',
      '',
      ranked.length === 1 ? 'Choose this booking reference' : 'Choose a booking reference',
    ),
    element(
      'p',
      'muted',
      'These confirmations do not state a passenger surname. ContextFill can verify and fill only the booking reference; enter the surname yourself on easyJet.',
    ),
  );
  const list = element('div', 'capsule-choice-list');
  for (const candidate of ranked) {
    const view = buildConfirmationViewModel(candidate.candidate, candidate.policy, page);
    const card = element('article', 'capsule-choice');
    const heading = element('div', 'capsule-choice__heading');
    heading.append(
      element('strong', '', 'easyJet confirmation'),
      element('span', 'source-status', candidate.candidate.receivedAt.slice(0, 10)),
    );
    const sender = element('p', 'muted capsule-choice__sender', 'easyJet · verified Gmail sender');
    const facts = element('div', 'capsule-choice__facts');
    const chip = element('span', 'capsule-choice__fact');
    chip.append(element('b', '', 'Booking reference'), element('code', '', view.maskedValue));
    facts.append(chip);
    const use = element('button', 'button button--primary', 'Review reference-only transfer');
    use.type = 'button';
    use.addEventListener('click', () => {
      selected = { ranked: candidate, page, tabId, scannedTabUrl: tabUrl };
      renderConfirmation(candidate, page);
    });
    card.append(heading, sender, facts, use);
    list.append(card);
  }
  body.append(
    list,
    element(
      'p',
      'extraction-note',
      'Exact easyJet origin · verified reference only · surname stays manual · never submits',
    ),
  );
}

async function scan(): Promise<void> {
  const generation = ++viewGeneration;
  renderLoading();
  let tab: chrome.tabs.Tab | null = null;
  try {
    tab = await activeTab();
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'] });
    const response = await contentMessage(tab.id!, { type: 'SCAN_CONTEXT' });
    if (!response.ok || !response.page)
      throw new Error(response.ok ? 'Page context was unavailable.' : response.error);
    const page = pageContextSchema.parse(response.page);
    const liveAirline = mailSource === 'gmail' ? liveAirlineForUrl(tab.url) : null;
    const messages =
      mailSource === 'synthetic'
        ? messagesForScenario(page.scenario)
        : mailSource === 'import'
          ? importedMessages
          : await fetchMailboxMessages(
              mailSource,
              liveAirline?.mailboxPurpose ?? 'temporary_action',
            );
    if (liveAirline) {
      const renderedCapsule = await renderAirlineChoices(messages, tab.id!, page, liveAirline);
      if (!renderedCapsule && liveAirline.allowsReferenceOnly) {
        await renderEasyJetReferenceChoices(messages, tab.id!, tab.url ?? '', page);
      } else if (!renderedCapsule) {
        renderMessage(
          'empty',
          `No verified ${liveAirline.displayName} booking found`,
          `No ${liveAirline.displayName} confirmation contained an unambiguous confirmation code and passenger surname with matching sender and domain evidence.`,
        );
      }
      return;
    }
    const deterministic = extractInboxDeterministic(messages);
    if (mailSource === 'import') importedMessages = [];
    const enhanced = shouldUseModelForSource(mailSource, realMailModelOptIn)
      ? await enhanceCandidatesWithModel(messages, deterministic)
      : { candidates: deterministic, modelUsed: false, fallbackReason: null };
    const usedResponse = await backgroundMessage({ type: 'GET_USED_CANDIDATES' });
    const usedCandidateIds = new Set(usedResponse.ok ? usedResponse.candidateIds : []);
    const ranked = rankCandidates(enhanced.candidates, page, { usedCandidateIds });
    if (generation !== viewGeneration) return;
    const first = ranked[0];
    if (!first) {
      renderMessage(
        'empty',
        'No usable temporary action',
        `${sourceLabel(mailSource)} contains no recent code, verified link, or reference for this page.`,
      );
      return;
    }
    const displayCandidate =
      first.policy.reasonCode === 'expired'
        ? { ...first, candidate: { ...first.candidate, value: null } }
        : first;
    selected = {
      ranked: displayCandidate,
      page,
      tabId: tab.id!,
      scannedTabUrl: tab.url ?? '',
    };
    renderConfirmation(displayCandidate, page);
  } catch (error) {
    if (generation !== viewGeneration) return;
    if (!(error instanceof MailClientError) && tab && isMissingHostPermission(error)) {
      renderSiteAccessRequest(tab);
      return;
    }
    renderMessage(
      'error',
      error instanceof MailClientError
        ? `Could not read ${sourceLabel(mailSource)}`
        : 'ContextFill cannot inspect this tab',
      error instanceof Error ? error.message : 'Open a normal webpage and try again.',
    );
  }
}

window.addEventListener('unload', () => clearSensitiveState('dismiss'));
void (async () => {
  [mailSource, realMailModelOptIn] = await Promise.all([
    loadMailSource(),
    loadRealMailModelOptIn(),
  ]);
  persistedMailSource = mailSource;
  await scan();
})();
