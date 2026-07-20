import type { PageContext } from '../../../../packages/core/src/index.js';

export type ContentRequest =
  { type: 'SCAN_CONTEXT' } | { type: 'FILL_CODE'; value: string; authorized: true };
export type ContentResponse =
  { ok: true; page?: PageContext; filled?: true } | { ok: false; error: string };

export type BackgroundRequest =
  { type: 'GET_USED_CANDIDATES' } | { type: 'MARK_CANDIDATE_USED'; candidateId: string };

export type BackgroundResponse = { ok: true; candidateIds: string[] } | { ok: false };
