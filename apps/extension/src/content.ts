import {
  detectAutomaticPageSignal,
  fillTransferValue,
  findContextField,
  type FieldTarget,
} from '../../../packages/core/src/fields/index.js';
import type { PageContext } from '../../../packages/core/src/types.js';
import { AutoContinueOverlay } from './auto-continue-overlay.js';
import type { BackgroundRequest } from './shared/messages.js';
import type { ContentRequest, ContentResponse } from './shared/messages.js';
import { isAllowedEasyJetBookingPage } from './easyjet-policy.js';

const overlay = new AutoContinueOverlay(document);

function fixtureMeta(name: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null;
}

function scanPage(): PageContext {
  const target = findContextField(document);
  const isLoopback = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  const simulatedHostname = isLoopback ? fixtureMeta('contextfill-simulated-host') : null;
  return {
    hostname: simulatedHostname ?? window.location.hostname,
    serviceHint: isLoopback
      ? fixtureMeta('contextfill-service')
      : isAllowedEasyJetBookingPage(window.location.href)
        ? 'easyJet'
        : null,
    simulated: Boolean(simulatedHostname),
    scenario: isLoopback ? fixtureMeta('contextfill-scenario') : null,
    fieldKind: target?.kind ?? 'none',
    fieldCount: target?.elements.length ?? 0,
  };
}

function highlightFilledTarget(target: FieldTarget): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const previous = target.elements.map((input) => ({
    input,
    outline: input.style.outline,
    outlineOffset: input.style.outlineOffset,
    transition: input.style.transition,
  }));
  for (const { input } of previous) {
    input.dataset.contextfillFilled = 'true';
    input.style.transition = reduceMotion
      ? 'none'
      : 'outline-color 160ms ease, outline-offset 160ms ease';
    input.style.outline = '3px solid #8abf34';
    input.style.outlineOffset = '3px';
  }
  setTimeout(() => {
    for (const item of previous) {
      item.input.style.outline = item.outline;
      item.input.style.outlineOffset = item.outlineOffset;
      item.input.style.transition = item.transition;
      delete item.input.dataset.contextfillFilled;
    }
  }, 1_800);
}

function sendOverlayAction(action: 'execute' | 'cancel' | 'dismiss' | 'retry'): void {
  const request: BackgroundRequest = { type: 'AUTOMATION_OVERLAY_ACTION', action };
  void chrome.runtime.sendMessage(request).catch(() => undefined);
}

function handleRequest(request: ContentRequest): ContentResponse | null {
  if (request.type === 'SCAN_CONTEXT') {
    const target = findContextField(document);
    return {
      ok: true,
      page: scanPage(),
      automation: detectAutomaticPageSignal(document, target),
    };
  }
  if (request.type === 'FILL_VALUE' && request.authorized === true) {
    const target = findContextField(document);
    const targetMatchesPurpose =
      target &&
      (request.purpose === 'reference'
        ? target.kind === 'reference'
        : target.kind === 'single' || target.kind === 'split');
    if (!targetMatchesPurpose) {
      return { ok: false, error: 'The matching transfer field is no longer available.' };
    }
    const filled = fillTransferValue(target, request.value);
    if (filled) highlightFilledTarget(target);
    return filled
      ? { ok: true, filled: true }
      : { ok: false, error: 'The value no longer fits the detected field.' };
  }
  if (request.type === 'SHOW_AUTOMATION_OVERLAY') {
    overlay.show(request.view, sendOverlayAction);
    return { ok: true };
  }
  if (request.type === 'HIDE_AUTOMATION_OVERLAY') {
    overlay.destroy();
    return { ok: true };
  }
  return null;
}

if (!window.__contextfillContentInstalled) {
  window.__contextfillContentInstalled = true;
  chrome.runtime.onMessage.addListener((request: ContentRequest, _sender, sendResponse) => {
    const response = handleRequest(request);
    if (!response) return false;
    sendResponse(response);
    return false;
  });
  let lastAutomaticSignal = detectAutomaticPageSignal(document).intents.join('|');
  let signalTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (signalTimer) clearTimeout(signalTimer);
    signalTimer = setTimeout(() => {
      signalTimer = null;
      const nextSignal = detectAutomaticPageSignal(document).intents.join('|');
      if (nextSignal === lastAutomaticSignal) return;
      lastAutomaticSignal = nextSignal;
      const changed: BackgroundRequest = { type: 'CONTENT_READY' };
      void chrome.runtime.sendMessage(changed).catch(() => undefined);
    }, 180);
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'aria-hidden',
      'autocomplete',
      'class',
      'disabled',
      'hidden',
      'inputmode',
      'maxlength',
      'readonly',
      'style',
      'type',
    ],
  });
  const ready: BackgroundRequest = { type: 'CONTENT_READY' };
  void chrome.runtime.sendMessage(ready).catch(() => undefined);
}

declare global {
  interface Window {
    __contextfillContentInstalled?: boolean;
  }
}
