import {
  buildConfirmationViewModel,
  extractInboxDeterministic,
  messagesForScenario,
  pageContextSchema,
  rankCandidates,
  type PageContext,
  type RankedCandidate,
  type MailboxMessage,
} from '../../../packages/core/src/index.js';
import { EmlImportError, parseEmlImport } from './eml-import.js';
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

const app = document.querySelector<HTMLElement>('#app')!;
let selected: { ranked: RankedCandidate; page: PageContext } | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let mailSource: MailSource = 'synthetic';
let persistedMailSource: PersistentMailSource = 'synthetic';
let importedMessages: MailboxMessage[] = [];
let realMailModelOptIn = false;

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
  header.append(brand, source);
  const body = element('section', 'app-body');
  const footer = element('footer', 'app-footer');
  footer.append(element('span', '', 'Explicit fill only'), element('span', '', 'Never submits'));
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

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active browser tab is available.');
  return tab;
}

async function contentMessage(tabId: number, request: ContentRequest): Promise<ContentResponse> {
  return (await chrome.tabs.sendMessage(tabId, request)) as ContentResponse;
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
  valueWrap.append(element('span', 'field-label', 'Candidate code'));
  const value = element('strong', 'candidate-value', view.maskedValue);
  valueWrap.append(value);
  heading.append(valueWrap);
  if (ranked.policy.decision !== 'block' && ranked.candidate.value) {
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
  const actions = element('div', 'actions');
  const dismiss = element('button', 'button button--secondary', 'Dismiss');
  dismiss.type = 'button';
  dismiss.addEventListener('click', () => {
    clearSensitiveState('dismiss');
    window.close();
  });

  if (ranked.policy.decision === 'allow') {
    const fill = element(
      'button',
      'button button--primary',
      `Fill ${page.fieldCount === 1 ? 'code' : `${page.fieldCount} fields`}`,
    );
    fill.type = 'button';
    fill.addEventListener('click', () => void fillSelected(false));
    actions.append(fill, dismiss);
  } else if (ranked.policy.decision === 'warn' && ranked.policy.canOverride) {
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
    const blocked = element('p', 'blocked-note', 'Fill is unavailable for this security decision.');
    actions.append(blocked, dismiss);
  }

  body.append(status, heading, evidence);
  if (simulation) body.append(simulation);
  body.append(extraction, actions);
  scheduleClear(ranked);
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
        ? `Connect ${label} with read-only mail access. ContextFill fetches only recent verification-like messages.`
        : `Add the ${label} OAuth client settings to .env, then restart the companion service.`;
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
      const connect = sourceAction(`Connect ${label}`, true);
      connect.disabled = !status.configured;
      connect.addEventListener('click', () => void connectProvider(status.provider));
      providerCard.actions.append(connect);
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
      'Complete the provider consent screen, then reopen ContextFill on the page requesting a code.',
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
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  selected = null;
  const { body } = shell();
  body.append(
    element('p', 'kicker', 'Message source'),
    element('h1', '', 'Choose where codes come from'),
    element(
      'p',
      'muted',
      'Import one exported message entirely in this popup, or connect read-only mailbox access through the loopback companion. Every source still requires explicit fill approval.',
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
    const tab = await activeTab();
    const response = await contentMessage(tab.id!, {
      type: 'FILL_CODE',
      value: current.ranked.candidate.value,
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
      'Code filled',
      'The verification fields changed. ContextFill did not submit the form.',
    );
  } catch (error) {
    renderMessage(
      'error',
      'Could not fill this page',
      error instanceof Error ? error.message : 'The page changed before filling.',
    );
  }
}

async function scan(): Promise<void> {
  renderLoading();
  try {
    const tab = await activeTab();
    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'] });
    const response = await contentMessage(tab.id!, { type: 'SCAN_CONTEXT' });
    if (!response.ok || !response.page)
      throw new Error(response.ok ? 'Page context was unavailable.' : response.error);
    const page = pageContextSchema.parse(response.page);
    const messages =
      mailSource === 'synthetic'
        ? messagesForScenario(page.scenario)
        : mailSource === 'import'
          ? importedMessages
          : await fetchMailboxMessages(mailSource);
    const deterministic = extractInboxDeterministic(messages);
    if (mailSource === 'import') importedMessages = [];
    const enhanced = shouldUseModelForSource(mailSource, realMailModelOptIn)
      ? await enhanceCandidatesWithModel(messages, deterministic)
      : { candidates: deterministic, modelUsed: false, fallbackReason: null };
    const usedResponse = await backgroundMessage({ type: 'GET_USED_CANDIDATES' });
    const usedCandidateIds = new Set(usedResponse.ok ? usedResponse.candidateIds : []);
    const ranked = rankCandidates(enhanced.candidates, page, { usedCandidateIds });
    const first = ranked[0];
    if (!first) {
      renderMessage(
        'empty',
        'No usable verification code',
        `${sourceLabel(mailSource)} contains no recent verification candidate for this page.`,
      );
      return;
    }
    const displayCandidate =
      first.policy.reasonCode === 'expired'
        ? { ...first, candidate: { ...first.candidate, value: null } }
        : first;
    selected = { ranked: displayCandidate, page };
    renderConfirmation(displayCandidate, page);
  } catch (error) {
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
