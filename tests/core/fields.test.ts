import { describe, expect, it, vi } from 'vitest';
import {
  findVerificationFields,
  fillVerificationFields,
  scoreVerificationField,
} from '../../packages/core/src/index.js';

describe('field detection and filling', () => {
  it('scores a single one-time-code field above unrelated numbers', () => {
    document.body.innerHTML = `
      <label>Quantity <input id="quantity" type="number" data-contextfill-visible="true"></label>
      <label>Verification code <input id="otp" autocomplete="one-time-code" maxlength="6" data-contextfill-visible="true"></label>`;
    const otp = document.querySelector<HTMLInputElement>('#otp')!;
    const quantity = document.querySelector<HTMLInputElement>('#quantity')!;
    expect(scoreVerificationField(otp)).toBeGreaterThan(scoreVerificationField(quantity));
    expect(findVerificationFields(document)?.elements).toEqual([otp]);
  });

  it('fills split fields in order, emits events, and does not submit', () => {
    document.body.innerHTML = `
      <form><fieldset><legend>Verification code</legend>
        ${Array.from({ length: 6 }, (_, index) => `<input aria-label="Digit ${index + 1}" maxlength="1" data-contextfill-visible="true">`).join('')}
        <input id="other" value="keep" data-contextfill-visible="true">
        <button type="submit">Verify</button>
      </fieldset></form>`;
    const form = document.querySelector('form')!;
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener('submit', submit);
    const inputs = [...document.querySelectorAll<HTMLInputElement>('fieldset input:not(#other)')];
    const inputEvents = vi.fn();
    inputs.forEach((input) => input.addEventListener('input', inputEvents));
    const target = findVerificationFields(document)!;
    expect(target.kind).toBe('split');
    expect(fillVerificationFields(target, '481203')).toBe(true);
    expect(inputs.map((input) => input.value).join('')).toBe('481203');
    expect(document.querySelector<HTMLInputElement>('#other')?.value).toBe('keep');
    expect(inputEvents).toHaveBeenCalledTimes(6);
    expect(submit).not.toHaveBeenCalled();
  });
});
