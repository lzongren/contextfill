import { fillTransferValue, findContextField } from '../../../packages/core/src/fields/index.js';
import type { PageContext } from '../../../packages/core/src/types.js';
import type { ContentRequest, ContentResponse } from './shared/messages.js';

function fixtureMeta(name: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null;
}

function scanPage(): PageContext {
  const target = findContextField(document);
  const isLoopback = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
  const simulatedHostname = isLoopback ? fixtureMeta('contextfill-simulated-host') : null;
  return {
    hostname: simulatedHostname ?? window.location.hostname,
    serviceHint: isLoopback ? fixtureMeta('contextfill-service') : null,
    simulated: Boolean(simulatedHostname),
    scenario: isLoopback ? fixtureMeta('contextfill-scenario') : null,
    fieldKind: target?.kind ?? 'none',
    fieldCount: target?.elements.length ?? 0,
  };
}

function handleRequest(request: ContentRequest): ContentResponse {
  if (request.type === 'SCAN_CONTEXT') {
    return { ok: true, page: scanPage() };
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
    return fillTransferValue(target, request.value)
      ? { ok: true, filled: true }
      : { ok: false, error: 'The value no longer fits the detected field.' };
  }
  return { ok: false, error: 'Unsupported request.' };
}

if (!window.__contextfillContentInstalled) {
  window.__contextfillContentInstalled = true;
  chrome.runtime.onMessage.addListener((request: ContentRequest, _sender, sendResponse) => {
    sendResponse(handleRequest(request));
    return false;
  });
}

declare global {
  interface Window {
    __contextfillContentInstalled?: boolean;
  }
}
