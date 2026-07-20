import { describe, expect, it, vi } from 'vitest';
import {
  applyExplicitFill,
  buildConfirmationViewModel,
  extractInboxDeterministic,
  findVerificationFields,
  messagesForScenario,
  rankCandidates,
  type PageContext,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-20T19:00:00.000Z');
const basePage: PageContext = {
  hostname: 'account.northstar.test',
  serviceHint: 'Northstar',
  simulated: true,
  scenario: 'legitimate-single',
  fieldKind: 'single',
  fieldCount: 1,
};

describe('fixture-to-page flow', () => {
  it('produces a transparent confirmation and fills only after explicit action', () => {
    document.body.innerHTML = `<form><label>Verification code<input autocomplete="one-time-code" maxlength="6" data-contextfill-visible="true"></label><button>Verify</button></form>`;
    const submit = vi.fn();
    document.querySelector('form')?.addEventListener('submit', submit);
    const target = findVerificationFields(document)!;
    const ranked = rankCandidates(
      extractInboxDeterministic(messagesForScenario('legitimate-single', now)),
      basePage,
      {
        now,
      },
    );
    const selected = ranked[0]!;
    const view = buildConfirmationViewModel(selected.candidate, selected.policy, basePage, now);
    expect(view).toMatchObject({
      statusLabel: 'Allowed',
      activeDomain: 'account.northstar.test',
      canFill: true,
    });
    expect(document.querySelector('input')?.value).toBe('');
    expect(applyExplicitFill(selected.policy, target, selected.candidate.value!)).toBe(true);
    expect(document.querySelector('input')?.value).toBe('481203');
    expect(submit).not.toHaveBeenCalled();
  });

  it('prevents page mutation for a lookalike block', () => {
    document.body.innerHTML = `<label>Verification code<input autocomplete="one-time-code" maxlength="6" data-contextfill-visible="true"></label>`;
    const target = findVerificationFields(document)!;
    const page = { ...basePage, hostname: 'account.n0rthstar.test', scenario: 'lookalike' };
    const selected = rankCandidates(
      extractInboxDeterministic(messagesForScenario('lookalike', now)),
      page,
      { now },
    )[0]!;
    expect(selected.policy.decision).toBe('block');
    expect(applyExplicitFill(selected.policy, target, selected.candidate.value!)).toBe(false);
    expect(document.querySelector('input')?.value).toBe('');
  });

  it('requires an explicit caution override for a warning', () => {
    document.body.innerHTML = `<form><label>Verification code<input autocomplete="one-time-code" maxlength="6" data-contextfill-visible="true"></label><button>Verify</button></form>`;
    const target = findVerificationFields(document)!;
    const selected = rankCandidates(
      extractInboxDeterministic(messagesForScenario('ambiguous', now)),
      { ...basePage, scenario: 'ambiguous' },
      { now },
    )[0]!;
    expect(selected.policy.decision).toBe('warn');
    expect(applyExplicitFill(selected.policy, target, selected.candidate.value!)).toBe(false);
    expect(document.querySelector('input')?.value).toBe('');
    expect(applyExplicitFill(selected.policy, target, selected.candidate.value!, true)).toBe(true);
    expect(document.querySelector('input')?.value).toBe('773804');
  });
});
