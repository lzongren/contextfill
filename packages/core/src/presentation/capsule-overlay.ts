import type {
  CapsuleFieldMapping,
  CapsuleMappingPlan,
  CapsuleTransferReceipt,
} from '../fields/capsule.js';
import { maskContextCapsuleFact, maskContextCapsuleText } from '../fields/capsule.js';
import type {
  CapsulePageContext,
  CapsulePolicyResult,
  ContextCapsule,
  MailboxMessage,
} from '../types.js';

export type CapsuleOverlayOptions = {
  capsule: ContextCapsule;
  message: MailboxMessage;
  page: CapsulePageContext;
  policy: CapsulePolicyResult;
  plan: CapsuleMappingPlan;
  reducedMotion?: boolean;
  sourceLabel?: string;
  onTransfer: () => CapsuleTransferReceipt | null | Promise<CapsuleTransferReceipt | null>;
  onDismiss?: () => void;
};

export type CapsuleOverlayController = { host: HTMLElement; dismiss: () => void };

const styles = `
  :host{all:initial;color-scheme:light}*{box-sizing:border-box}.panel{--ink:#17352f;--muted:#61736c;--cream:#fbfaf4;--mint:#caff8a;--green:#164b3d;position:fixed;z-index:2147483647;right:16px;top:16px;bottom:16px;width:min(430px,calc(100vw - 28px));overflow:auto;padding:14px 16px;color:var(--ink);background:rgba(251,250,244,.985);border:1px solid #cbd7cf;border-radius:24px;box-shadow:0 28px 90px rgba(8,30,24,.28);font:14px/1.4 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;transform:translateX(20px);opacity:0;transition:transform 240ms ease,opacity 240ms ease}.panel.visible{transform:none;opacity:1}.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.brand{display:flex;gap:9px;align-items:center;font-weight:800}.mark{width:27px;height:27px;border-radius:9px;display:grid;place-items:center;color:var(--mint);background:var(--green)}button{font:inherit}.close{border:0;background:transparent;color:var(--muted);width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:20px}.close:focus-visible,.button:focus-visible{outline:3px solid rgba(37,106,87,.3);outline-offset:2px}.eyebrow{margin:0 0 3px;color:#557468;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h2{margin:0;font-size:21px;line-height:1.1;letter-spacing:-.04em}.lede{margin:5px 0 9px;color:var(--muted);font-size:11px}.chain{display:grid;gap:3px}.node{padding:8px 10px;border:1px solid #dce4de;border-radius:13px;background:white;transition:transform 260ms ease,opacity 260ms ease,border-color 260ms ease}.node-label{color:#48685f;font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}.node strong{display:block;margin-top:3px;font-size:12px}.node p{margin:2px 0 0;color:var(--muted);font-size:10px}.source.compressed{transform:scale(.98);opacity:.72;border-style:dashed}.connector{height:5px;position:relative;opacity:.25;transition:opacity 180ms ease}.connector:before{content:"↓";position:absolute;left:11px;top:-8px;color:#557468;font-size:11px}.connector.active{opacity:1}.trust,.capsule,.mapping{opacity:.22}.trust.active,.capsule.active,.mapping.active{opacity:1;border-color:#8eb9a9}.trust.blocked{opacity:1;border-color:#dca9a5;background:#fff5f3}.checks{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}.check{display:flex;align-items:center;gap:4px;color:#536a62;font-size:9px}.check i{width:13px;height:13px;display:grid;place-items:center;border-radius:50%;color:white;background:#2d7662;font:900 8px/1 sans-serif}.blocked .check i{background:#b55850}.capsule.active{box-shadow:inset 3px 0 0 var(--mint)}.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.chip{padding:4px 7px;border:1px solid #c7d7cf;border-radius:9px;background:#eff6ef}.chip b{display:block;color:#416157;font-size:8px;letter-spacing:.07em;text-transform:uppercase}.chip code{color:#17352f;font:700 11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace}.map-row{display:grid;grid-template-columns:1fr auto 1.15fr;gap:6px;align-items:center;margin-top:4px;padding:4px 6px;border-radius:9px;background:#f5f6f1;font-size:9px}.map-row b{display:block;font-size:9px}.confidence{display:block;color:#697a74;font-size:8px}.arrow{color:#3e7b67;font-size:12px}.result{min-height:32px;margin:7px 0 0;padding:7px 9px;border-radius:10px;color:#31594d;background:#edf6ed;font-weight:700;font-size:11px}.result.blocked{color:#84352f;background:#fff0ed}.actions{display:flex;gap:7px;margin-top:7px}.button{min-height:38px;padding:8px 12px;border-radius:11px;border:1px solid #c6d2cb;cursor:pointer;font-weight:800}.button:disabled{opacity:.5;cursor:not-allowed}.primary{flex:1;color:white;border-color:var(--green);background:var(--green)}.secondary{color:#34594e;background:white}.privacy{margin:7px 2px 0;color:#74827d;font-size:9px}.disclaimer{display:block;margin-top:2px}@media(max-width:560px){.panel{right:8px;top:8px;bottom:8px;width:calc(100vw - 16px);border-radius:18px}}@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

const factLabel = (key: string) =>
  key === 'booking_reference' ? 'Booking reference' : 'Passenger surname';

function highlight(mapping: CapsuleFieldMapping, active: boolean): void {
  const input = mapping.targetField;
  if (active) {
    input.dataset.contextfillCapsuleTarget = 'true';
    input.style.setProperty('outline', '3px solid #89d46c', 'important');
    input.style.setProperty('outline-offset', '3px', 'important');
  } else {
    delete input.dataset.contextfillCapsuleTarget;
    input.style.removeProperty('outline');
    input.style.removeProperty('outline-offset');
  }
}

export function mountContextCapsuleOverlay(
  document: Document,
  options: CapsuleOverlayOptions,
): CapsuleOverlayController {
  document.querySelector('#contextfill-capsule-host')?.remove();
  const host = element(document, 'aside');
  host.id = 'contextfill-capsule-host';
  host.dataset.contextfillCapsuleUi = 'true';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = element(document, 'style');
  style.textContent = styles;
  const panel = element(document, 'section', 'panel');
  panel.tabIndex = -1;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'contextfill-capsule-title');

  const top = element(document, 'div', 'top');
  const brand = element(document, 'div', 'brand');
  const mark = element(document, 'span', 'mark', '↗');
  mark.setAttribute('aria-hidden', 'true');
  brand.append(mark, element(document, 'span', '', 'ContextFill'));
  const close = element(document, 'button', 'close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss context capsule');
  top.append(brand, close);
  const eyebrow = element(document, 'p', 'eyebrow', 'Verified context capsule');
  const title = element(document, 'h2', '', 'Transfer only what this page needs');
  title.id = 'contextfill-capsule-title';
  const lede = element(
    document,
    'p',
    'lede',
    'A temporary, origin-bound handoff from one synthetic booking message.',
  );

  const chain = element(document, 'div', 'chain');
  const source = element(document, 'div', 'node source');
  source.dataset.stage = 'message';
  source.append(
    element(document, 'span', 'node-label', '01 · Source message'),
    element(
      document,
      'strong',
      '',
      maskContextCapsuleText(options.message.subject, options.capsule),
    ),
    element(
      document,
      'p',
      '',
      `${options.message.senderName ?? 'Unknown sender'} · ${options.sourceLabel ?? 'Built-in inbox'}`,
    ),
  );
  const connectorOne = element(document, 'div', 'connector');
  const trust = element(document, 'div', 'node trust');
  trust.dataset.stage = 'trust';
  trust.append(
    element(document, 'span', 'node-label', '02 · Deterministic trust verification'),
    element(document, 'strong', '', 'Checking five trust signals…'),
  );
  const checks = element(document, 'div', 'checks');
  for (const label of [
    'Message sender',
    'Claimed airline',
    'Referenced domain',
    'Freshness',
    'Task intent',
  ]) {
    const check = element(document, 'span', 'check');
    const icon = element(document, 'i', '', options.policy.decision === 'allow' ? '✓' : '×');
    icon.setAttribute('aria-hidden', 'true');
    check.append(icon, document.createTextNode(label));
    checks.append(check);
  }
  trust.append(checks, element(document, 'p', '', options.policy.reason));
  const connectorTwo = element(document, 'div', 'connector');
  const capsuleNode = element(document, 'div', 'node capsule');
  capsuleNode.dataset.stage = 'capsule';
  capsuleNode.append(
    element(document, 'span', 'node-label', '03 · Context Capsule'),
    element(document, 'strong', '', '2 typed facts · values remain masked'),
  );
  const chips = element(document, 'div', 'chips');
  for (const fact of options.capsule.facts) {
    const chip = element(document, 'span', 'chip');
    chip.append(
      element(document, 'b', '', factLabel(fact.key)),
      element(document, 'code', '', maskContextCapsuleFact(fact)),
    );
    chips.append(chip);
  }
  capsuleNode.append(chips);
  const connectorThree = element(document, 'div', 'connector');
  const mapping = element(document, 'div', 'node mapping');
  mapping.dataset.stage = 'mapping';
  mapping.append(
    element(document, 'span', 'node-label', '04 · Destination fields'),
    element(
      document,
      'strong',
      '',
      options.plan.decision === 'ready' ? 'Unique field map ready' : 'Field mapping stopped',
    ),
  );
  for (const item of options.plan.mappings) {
    const row = element(document, 'div', 'map-row');
    const from = element(document, 'span');
    from.append(
      element(document, 'b', '', factLabel(item.factKey)),
      element(document, 'span', 'confidence', `${Math.round(item.mappingConfidence * 100)}% map`),
    );
    const arrow = element(document, 'span', 'arrow', '→');
    arrow.setAttribute('aria-hidden', 'true');
    row.append(
      from,
      arrow,
      element(
        document,
        'span',
        '',
        maskContextCapsuleText(item.targetDescription, options.capsule),
      ),
    );
    mapping.append(row);
  }
  if (options.plan.decision === 'block') {
    mapping.append(element(document, 'p', '', options.plan.reason));
  }
  chain.append(source, connectorOne, trust, connectorTwo, capsuleNode, connectorThree, mapping);

  const result = element(document, 'div', 'result', 'Preparing a privacy-preserving handoff…');
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  const actions = element(document, 'div', 'actions');
  const transfer = element(document, 'button', 'button primary', 'Transfer 2 verified facts');
  transfer.type = 'button';
  transfer.disabled = true;
  const cancel = element(document, 'button', 'button secondary', 'Cancel');
  cancel.type = 'button';
  actions.append(transfer, cancel);
  const privacy = element(
    document,
    'p',
    'privacy',
    'Memory-only · no clipboard · no raw-value logs · never submits',
  );
  privacy.append(
    element(
      document,
      'span',
      'disclaimer',
      'Hackathon prototype · not phishing-proof or production-ready',
    ),
  );
  panel.append(top, eyebrow, title, lede, chain, result, actions, privacy);
  shadow.append(style, panel);
  document.documentElement.append(host);

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const highlighted = new Set<CapsuleFieldMapping>();
  const step = options.reducedMotion ? 0 : 280;
  let receipt: CapsuleTransferReceipt | null = null;
  let dismissed = false;
  const later = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!dismissed) callback();
    }, delay);
    timers.add(timer);
  };
  const clearHighlights = () => {
    for (const item of highlighted) highlight(item, false);
    highlighted.clear();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') dismiss();
  };
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    for (const timer of timers) clearTimeout(timer);
    clearHighlights();
    document.removeEventListener('keydown', onKeyDown);
    host.remove();
    options.onDismiss?.();
  };
  close.addEventListener('click', dismiss);
  cancel.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKeyDown);
  requestAnimationFrame(() => panel.classList.add('visible'));
  later(() => {
    source.classList.add('compressed');
    connectorOne.classList.add('active');
    trust.classList.add(options.policy.decision === 'allow' ? 'active' : 'blocked');
    trust.querySelector('strong')!.textContent =
      options.policy.decision === 'allow' ? 'Trust signals aligned' : 'Transfer blocked';
    if (options.policy.decision === 'block') {
      result.classList.add('blocked');
      result.textContent = options.policy.reason;
      transfer.remove();
      cancel.textContent = 'Dismiss';
    }
  }, step);
  if (options.policy.decision === 'allow') {
    later(() => {
      connectorTwo.classList.add('active');
      capsuleNode.classList.add('active');
    }, step * 2);
    later(() => {
      connectorThree.classList.add('active');
      mapping.classList.add('active');
      if (options.plan.decision === 'ready') {
        result.textContent = 'Trust verified. Review the masked field map before transfer.';
        transfer.disabled = false;
        transfer.focus({ preventScroll: true });
      } else {
        result.classList.add('blocked');
        result.textContent = options.plan.reason;
        transfer.remove();
        cancel.textContent = 'Dismiss';
      }
    }, step * 3);
  }
  const expiryDelay = new Date(options.capsule.expiresAt).getTime() - Date.now();
  if (expiryDelay > 0) {
    later(() => {
      if (receipt) return;
      transfer.disabled = true;
      result.classList.add('blocked');
      result.textContent = 'This capsule expired. Dismiss it and run a fresh scan.';
      later(dismiss, 10_000);
    }, expiryDelay);
  }

  transfer.addEventListener('click', () => {
    void (async () => {
      if (receipt) {
        if (!receipt.undo()) {
          result.classList.add('blocked');
          result.textContent = 'Undo stopped because a transferred field changed.';
          return;
        }
        clearHighlights();
        result.textContent = 'Transfer undone. Both original field values were restored.';
        transfer.disabled = true;
        receipt = null;
        return;
      }
      transfer.disabled = true;
      result.textContent = 'Transferring the verified field map…';
      options.plan.mappings.forEach((item, index) => {
        later(
          () => {
            highlight(item, true);
            highlighted.add(item);
            item.targetField.focus({ preventScroll: true });
          },
          (options.reducedMotion ? 0 : 120) * index,
        );
      });
      receipt = await options.onTransfer();
      if (!receipt) {
        clearHighlights();
        result.classList.add('blocked');
        result.textContent = 'The page changed before transfer. No facts were handed off.';
        cancel.textContent = 'Dismiss';
        return;
      }
      result.textContent = `${receipt.transferredCount} verified facts transferred. Form not submitted.`;
      transfer.textContent = 'Undo entire handoff';
      transfer.className = 'button secondary';
      transfer.disabled = false;
      cancel.textContent = 'Dismiss';
    })();
  });
  panel.focus({ preventScroll: true });
  return { host, dismiss };
}
