import type { AutomationOverlayView } from './shared/messages.js';

export type OverlayAction = 'execute' | 'cancel' | 'dismiss' | 'retry';

const styles = `
  :host { all: initial; color-scheme: light; }
  * { box-sizing: border-box; }
  .card {
    position: fixed;
    z-index: 2147483647;
    top: 20px;
    right: 20px;
    width: min(360px, calc(100vw - 32px));
    overflow: hidden;
    border: 1px solid rgba(16, 35, 31, .18);
    border-radius: 18px;
    color: #10231f;
    background: #f5f7f1;
    box-shadow: 0 20px 60px rgba(16, 35, 31, .24);
    font-family: Avenir Next, Avenir, Inter, ui-sans-serif, system-ui, sans-serif;
    animation: contextfill-enter 180ms ease-out both;
  }
  .accent { height: 5px; background: linear-gradient(90deg, #173e35, #8fc63e, #c9f27b); }
  .body { padding: 17px 18px 15px; }
  .brand { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .brand strong { font-size: 13px; letter-spacing: -.01em; }
  .mode {
    padding: 4px 8px;
    border: 1px solid #bdc8ba;
    border-radius: 999px;
    color: #53645e;
    font: 700 9px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .progress { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin: 15px 0 16px; }
  .progress span { height: 3px; border-radius: 99px; background: #d4dbd1; transition: background 160ms ease; }
  .progress span.done { background: #7cac2f; }
  .state { display: grid; grid-template-columns: 36px 1fr; gap: 11px; align-items: start; }
  .icon {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 2px solid currentColor;
    border-radius: 50%;
    color: #527b14;
    font-size: 18px;
    font-weight: 850;
  }
  .card[data-state="blocked"] .icon,
  .card[data-state="error"] .icon { color: #9c3430; }
  .card[data-state="countdown"] .icon { color: #173e35; }
  h2 { margin: 0; font-size: 17px; line-height: 1.2; letter-spacing: -.025em; }
  p { margin: 5px 0 0; color: #596963; font-size: 12px; line-height: 1.45; }
  .destination {
    margin-top: 10px;
    padding: 7px 9px;
    border-radius: 8px;
    color: #35534a;
    background: #e2eae0;
    font: 600 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow-wrap: anywhere;
  }
  .actions { display: flex; gap: 8px; margin-top: 15px; }
  button {
    min-height: 38px;
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #aebaae;
    border-radius: 10px;
    color: #354841;
    background: rgba(255,255,255,.72);
    font: 750 12px/1.2 Avenir Next, Avenir, Inter, ui-sans-serif, system-ui, sans-serif;
    cursor: pointer;
  }
  button.primary { border-color: #173e35; color: white; background: #173e35; }
  button:focus-visible { outline: 3px solid #8abf34; outline-offset: 2px; }
  .privacy {
    margin-top: 12px;
    color: #718079;
    font: 600 9px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  @keyframes contextfill-enter {
    from { opacity: 0; transform: translateY(-8px) scale(.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @media (max-width: 520px) {
    .card { top: 12px; right: 12px; width: calc(100vw - 24px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .card { animation: none; }
    .progress span { transition: none; }
  }
`;

function progressCount(state: AutomationOverlayView['state']): number {
  if (state === 'waiting') return 1;
  if (state === 'found') return 2;
  if (state === 'verified' || state === 'countdown') return 3;
  return 4;
}

function stateIcon(state: AutomationOverlayView['state'], countdown?: number): string {
  if (state === 'blocked' || state === 'error') return '!';
  if (state === 'success') return '✓';
  if (state === 'countdown') return String(countdown ?? 3);
  if (state === 'verified') return '✓';
  return '•';
}

export class AutoContinueOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private callback: ((action: OverlayAction) => void) | null = null;
  private escapeAction: OverlayAction | null = null;
  private readonly keydownListener = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !event.isTrusted || !this.escapeAction) return;
    event.preventDefault();
    event.stopPropagation();
    const action = this.escapeAction;
    this.escapeAction = null;
    this.callback?.(action);
  };

  constructor(
    private readonly document: Document,
    private readonly shadowMode: ShadowRootMode = 'closed',
  ) {}

  private ensureRoot(): ShadowRoot {
    if (this.host?.isConnected && this.shadow) return this.shadow;
    this.host = this.document.createElement('aside');
    this.host.id = 'contextfill-auto-continue';
    this.host.dataset.contextfillUi = 'true';
    this.host.tabIndex = 0;
    this.host.setAttribute('aria-label', 'ContextFill Auto-Continue');
    this.shadow = this.host.attachShadow({ mode: this.shadowMode, delegatesFocus: true });
    (this.document.documentElement ?? this.document.body).append(this.host);
    return this.shadow;
  }

  private clearCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  private remainsVisible(): boolean {
    if (!this.host?.isConnected) return false;
    const style = this.document.defaultView?.getComputedStyle(this.host);
    return (
      !style || (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0')
    );
  }

  show(view: AutomationOverlayView, callback: (action: OverlayAction) => void): void {
    this.clearCountdown();
    this.callback = callback;
    this.escapeAction =
      view.state === 'waiting' ||
      view.state === 'found' ||
      view.state === 'countdown' ||
      (view.state === 'verified' && view.mode === 'auto')
        ? 'cancel'
        : null;
    this.document.removeEventListener('keydown', this.keydownListener, true);
    this.document.addEventListener('keydown', this.keydownListener, true);
    const shadow = this.ensureRoot();
    this.host!.dataset.state = view.state;
    let seconds = Math.max(1, Math.min(10, view.countdownSeconds ?? 3));

    const style = this.document.createElement('style');
    style.textContent = styles;
    const card = this.document.createElement('section');
    card.className = 'card';
    card.dataset.state = view.state;
    card.setAttribute(
      'role',
      view.state === 'blocked' || view.state === 'error' ? 'alert' : 'status',
    );
    card.setAttribute('aria-live', view.state === 'countdown' ? 'assertive' : 'polite');

    const accent = this.document.createElement('div');
    accent.className = 'accent';
    accent.setAttribute('aria-hidden', 'true');
    const body = this.document.createElement('div');
    body.className = 'body';
    const brand = this.document.createElement('div');
    brand.className = 'brand';
    const brandName = this.document.createElement('strong');
    brandName.textContent = 'ContextFill';
    const mode = this.document.createElement('span');
    mode.className = 'mode';
    mode.textContent = view.mode === 'auto' ? 'Auto-Continue' : 'Assisted';
    brand.append(brandName, mode);

    const progress = this.document.createElement('div');
    progress.className = 'progress';
    progress.setAttribute('aria-hidden', 'true');
    const completed = progressCount(view.state);
    for (let index = 0; index < 4; index += 1) {
      const segment = this.document.createElement('span');
      if (index < completed) segment.className = 'done';
      progress.append(segment);
    }

    const state = this.document.createElement('div');
    state.className = 'state';
    const icon = this.document.createElement('span');
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = stateIcon(view.state, seconds);
    const copy = this.document.createElement('div');
    const title = this.document.createElement('h2');
    title.textContent = view.title;
    const detail = this.document.createElement('p');
    detail.textContent = view.detail;
    copy.append(title, detail);
    if (view.destination) {
      const destination = this.document.createElement('div');
      destination.className = 'destination';
      destination.textContent = `Verified destination · ${view.destination}`;
      copy.append(destination);
    }
    state.append(icon, copy);

    const actions = this.document.createElement('div');
    actions.className = 'actions';
    const addButton = (label: string, action: OverlayAction, primary = false) => {
      const button = this.document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      if (primary) button.className = 'primary';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callback?.(action);
      });
      actions.append(button);
    };
    if (view.state === 'verified' && view.mode === 'assisted') {
      addButton(
        view.candidateType === 'magic_link' ? 'Open verified link' : 'Fill verified code',
        'execute',
        true,
      );
      addButton('Cancel', 'cancel');
    } else if (
      view.state === 'waiting' ||
      view.state === 'found' ||
      view.state === 'countdown' ||
      (view.state === 'verified' && view.mode === 'auto')
    ) {
      addButton(view.state === 'countdown' ? 'Cancel auto action' : 'Stop', 'cancel');
    } else if (view.state === 'error') {
      addButton('Try again', 'retry', true);
      addButton('Dismiss', 'dismiss');
    } else {
      addButton('Dismiss', 'dismiss');
    }

    const privacy = this.document.createElement('div');
    privacy.className = 'privacy';
    privacy.textContent = 'Local trust decision · secrets stay masked · never clicks Submit';
    body.append(brand, progress, state, actions, privacy);
    card.append(accent, body);
    shadow.replaceChildren(style, card);

    if (view.state === 'countdown') {
      this.countdownTimer = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
          this.clearCountdown();
          this.callback?.(this.remainsVisible() ? 'execute' : 'cancel');
          return;
        }
        icon.textContent = String(seconds);
        title.textContent =
          view.candidateType === 'magic_link' ? `Opening in ${seconds}…` : `Filling in ${seconds}…`;
      }, 1_000);
    }
  }

  destroy(): void {
    this.clearCountdown();
    this.callback = null;
    this.escapeAction = null;
    this.document.removeEventListener('keydown', this.keydownListener, true);
    this.host?.remove();
    this.host = null;
    this.shadow = null;
  }
}
