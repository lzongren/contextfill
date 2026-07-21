import { describe, expect, it, vi } from 'vitest';
import {
  fillTransferValue,
  detectAutomaticPageSignal,
  findContextField,
  findReferenceField,
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

  it('recognizes a nested six-box access-code widget without semantic form containers', () => {
    document.body.innerHTML = `
      <main>
        <h1>Access Code Sent</h1>
        <div>
          <p>Enter your one-time access code</p>
          <div class="visual-code-row">
            ${Array.from({ length: 6 }, (_, index) => `<span><input type="tel" inputmode="numeric" maxlength="1" aria-label="Access code digit ${index + 1}" data-contextfill-visible="true"></span>`).join('')}
          </div>
        </div>
        <button type="button">Login</button>
      </main>`;

    const target = findVerificationFields(document);
    expect(target?.kind).toBe('split');
    expect(target?.elements).toHaveLength(6);
    expect(fillVerificationFields(target!, '730418')).toBe(true);
    expect(target?.elements.map((input) => input.value).join('')).toBe('730418');
  });

  it('does not group unrelated one-character controls without verification context', () => {
    document.body.innerHTML = `
      <main>
        <h1>Preference survey</h1>
        <div>${Array.from({ length: 6 }, (_, index) => `<input maxlength="1" aria-label="Rating ${index + 1}" data-contextfill-visible="true">`).join('')}</div>
      </main>`;

    expect(findVerificationFields(document)).toBeNull();
  });

  it('recognizes numeric digit boxes whose one-character limit is enforced by script', () => {
    document.body.innerHTML = `
      <main>
        <h1>Access Code Sent</h1>
        <div class="access-code-widget">
          ${Array.from({ length: 6 }, () => '<span><input type="tel" inputmode="numeric" data-contextfill-visible="true"></span>').join('')}
        </div>
      </main>`;

    const target = findVerificationFields(document);
    expect(target?.kind).toBe('split');
    expect(target?.elements).toHaveLength(6);
  });

  it('recognizes a single access-code input inside non-semantic layout containers', () => {
    document.body.innerHTML = `
      <main>
        <div><h1>Access Code Sent</h1><div><input type="tel" maxlength="6" data-contextfill-visible="true"></div></div>
      </main>`;

    const target = findVerificationFields(document);
    expect(target?.kind).toBe('single');
    expect(target?.elements).toHaveLength(1);
  });

  it('does not treat a generic multi-input login form as a split access code', () => {
    document.body.innerHTML = `
      <main>
        <h1>Login details</h1>
        <div>${Array.from({ length: 6 }, (_, index) => `<input type="number" aria-label="Preference ${index + 1}" data-contextfill-visible="true">`).join('')}</div>
      </main>`;

    expect(findVerificationFields(document)).toBeNull();
  });

  it('recognizes one explicitly labeled booking-reference field without confusing generic text', () => {
    document.body.innerHTML = `
      <form>
        <label>Last name<input name="lastName" data-contextfill-visible="true"></label>
        <label>Booking reference<input name="bookingReference" maxlength="20" data-contextfill-visible="true"></label>
        <button>Find trip</button>
      </form>`;

    const target = findReferenceField(document);
    expect(target?.kind).toBe('reference');
    expect(target?.elements[0]?.name).toBe('bookingReference');
    expect(findContextField(document)?.kind).toBe('reference');
    expect(fillTransferValue(target!, 'CT-7K92Q')).toBe(true);
    expect(target?.elements[0]?.value).toBe('CT-7K92Q');
  });

  it('does not classify a generic order-number input as a trusted reference target', () => {
    document.body.innerHTML = `<label>Order number<input name="orderNumber" data-contextfill-visible="true"></label>`;
    expect(findReferenceField(document)).toBeNull();
  });

  it('detects OTP and visible magic-link wait states without treating generic pages as eligible', () => {
    document.body.innerHTML = `
      <main><h1>Check your email inbox</h1>
        <p>To sign in, click the magic link or enter the code we sent.</p>
        <label>Verification code<input autocomplete="one-time-code" maxlength="6" data-contextfill-visible="true"></label>
      </main>`;
    expect(detectAutomaticPageSignal(document).intents).toEqual(['otp', 'magic_link']);

    document.body.innerHTML = `<main><h1>Welcome back</h1><p>Read the latest product news.</p></main>`;
    expect(detectAutomaticPageSignal(document).intents).toEqual([]);
  });

  it('documents site-owned auto-submit behavior triggered by the final input event', () => {
    document.body.innerHTML = `
      <form><label>Verification code<input autocomplete="one-time-code" maxlength="6" data-contextfill-visible="true"></label><button>Submit</button></form>`;
    const form = document.querySelector('form')!;
    const input = document.querySelector<HTMLInputElement>('input')!;
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener('submit', submit);
    input.addEventListener('input', () => {
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    });
    expect(fillTransferValue(findVerificationFields(document)!, '481203')).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('481203');
  });

  it('ignores hidden and disabled decoy OTP fields during automatic detection', () => {
    document.body.innerHTML = `
      <main><h1>Account overview</h1>
        <input type="hidden" autocomplete="one-time-code" value="decoy">
        <input disabled autocomplete="one-time-code" maxlength="6" value="decoy" data-contextfill-visible="true">
      </main>`;
    expect(findVerificationFields(document)).toBeNull();
    expect(detectAutomaticPageSignal(document).intents).toEqual([]);
  });
});
