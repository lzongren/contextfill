import {
  fillVerificationFields,
  findVerificationFields,
} from '../../../packages/core/src/fields/index.js';
import type { PageContext } from '../../../packages/core/src/types.js';
import type { ContentRequest, ContentResponse } from './shared/messages.js';

function fixtureMeta(name: string): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null;
}

function scanPage(): PageContext {
  const target = findVerificationFields(document);
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
  if (request.type === 'FILL_CODE' && request.authorized === true) {
    const target = findVerificationFields(document);
    if (!target) return { ok: false, error: 'The verification field is no longer available.' };
    return fillVerificationFields(target, request.value)
      ? { ok: true, filled: true }
      : { ok: false, error: 'The code no longer fits the detected field.' };
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
