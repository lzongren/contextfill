import type { PageContext } from '../../../../packages/core/src/index.js';
import type { ActivityRecord, AutomationMode, AutomationSiteRule } from '../automation-settings.js';

export type AutomaticPageSignal = {
  intents: Array<'otp' | 'magic_link'>;
  reason: string;
};

export type AutomationOverlayView = {
  state: 'waiting' | 'found' | 'verified' | 'countdown' | 'success' | 'blocked' | 'error';
  mode: 'assisted' | 'auto';
  candidateType: 'otp' | 'magic_link' | 'none';
  title: string;
  detail: string;
  destination?: string;
  countdownSeconds?: number;
};

export type ContentRequest =
  | { type: 'SCAN_CONTEXT' }
  | {
      type: 'FILL_VALUE';
      value: string;
      purpose: 'verification_code' | 'reference';
      authorized: true;
    }
  | { type: 'SHOW_AUTOMATION_OVERLAY'; view: AutomationOverlayView }
  | { type: 'HIDE_AUTOMATION_OVERLAY' };
export type ContentResponse =
  | { ok: true; page?: PageContext; automation?: AutomaticPageSignal; filled?: true }
  | { ok: false; error: string };

export type BackgroundRequest =
  | { type: 'GET_USED_CANDIDATES' }
  | { type: 'MARK_CANDIDATE_USED'; candidateId: string }
  | { type: 'GET_AUTOMATION_OVERVIEW' }
  | { type: 'SET_SITE_MODE'; tabId: number; tabUrl: string; mode: AutomationMode }
  | { type: 'REMOVE_SITE_RULE'; originPattern: string }
  | { type: 'CLEAR_ACTIVITY_HISTORY' }
  | { type: 'RUN_AUTO_CONTINUE'; tabId: number }
  | { type: 'CONTENT_READY' }
  | {
      type: 'AUTOMATION_OVERLAY_ACTION';
      action: 'execute' | 'cancel' | 'dismiss' | 'retry';
    };

export type BackgroundResponse =
  | {
      ok: true;
      candidateIds?: string[];
      rules?: AutomationSiteRule[];
      history?: ActivityRecord[];
      activeRule?: AutomationSiteRule | null;
    }
  | { ok: false; error: string };
