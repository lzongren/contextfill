import type {
  ContextCapsule,
  MailboxMessage,
  PageContext,
} from '../../../../packages/core/src/index.js';

export type ContentRequest =
  | { type: 'SCAN_CONTEXT' }
  | {
      type: 'FILL_VALUE';
      value: string;
      purpose: 'verification_code' | 'reference';
      authorized: true;
    }
  | {
      type: 'SHOW_EASYJET_CAPSULE';
      capsule: ContextCapsule;
      message: MailboxMessage;
    };
export type ContentResponse =
  | { ok: true; page?: PageContext; filled?: true; capsuleShown?: true }
  | { ok: false; error: string };

export type BackgroundRequest =
  { type: 'GET_USED_CANDIDATES' } | { type: 'MARK_CANDIDATE_USED'; candidateId: string };

export type BackgroundResponse = { ok: true; candidateIds: string[] } | { ok: false };
