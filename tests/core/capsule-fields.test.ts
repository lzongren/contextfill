import { describe, expect, it, vi } from 'vitest';
import {
  authorizeContextCapsule,
  createCapsuleMappingPlan,
  executeContextCapsuleTransfer,
  extractContextCapsuleDeterministic,
  makeCapsuleInbox,
  type CapsulePageContext,
} from '../../packages/core/src/index.js';

const now = new Date('2026-07-21T18:00:00.000Z');
const message = makeCapsuleInbox(now)[0]!;
const capsule = extractContextCapsuleDeterministic(message, now)!;
const page: CapsulePageContext = {
  hostname: 'checkin.aurelia-air.test',
  serviceHint: 'Aurelia Air',
  simulated: true,
  scenario: 'capsule',
};

function renderFields(extra = '', surnameValue = ''): HTMLFormElement {
  document.body.innerHTML = `<form>
    <label>Booking reference<input id="bookingReference" name="bookingReference" maxlength="20" data-contextfill-visible="true"></label>
    <label>Passenger surname<input id="passengerSurname" name="passengerSurname" autocomplete="family-name" value="${surnameValue}" data-contextfill-visible="true"></label>
    ${extra}<button type="submit">Check in</button></form>`;
  return document.querySelector('form')!;
}

describe('capsule field mapping and transaction', () => {
  it('maps and transfers exactly two facts, never submits, and undoes the whole handoff', () => {
    const form = renderFields(
      '<input id="loyalty" aria-label="Loyalty number" data-contextfill-visible="true">',
    );
    const submit = vi.fn();
    form.addEventListener('submit', submit);
    const policy = authorizeContextCapsule(capsule, message, page, { now });
    const plan = createCapsuleMappingPlan(document, capsule);
    expect(plan).toMatchObject({ decision: 'ready', reasonCode: 'mapped' });
    expect(plan.mappings.map((mapping) => mapping.factKey)).toEqual([
      'booking_reference',
      'passenger_surname',
    ]);
    expect(plan.mappings.every((mapping) => mapping.mappingEvidence.length > 0)).toBe(true);
    const used = new Set<string>();
    const receipt = executeContextCapsuleTransfer(capsule, policy, plan, used)!;
    expect(receipt.transferredCount).toBe(2);
    expect(document.querySelector<HTMLInputElement>('#bookingReference')?.value).toBe('AU-47K2');
    expect(document.querySelector<HTMLInputElement>('#passengerSurname')?.value).toBe('Rivera');
    expect(document.querySelector<HTMLInputElement>('#loyalty')?.value).toBe('');
    expect(submit).not.toHaveBeenCalled();
    expect(used.has(capsule.id)).toBe(true);
    expect(receipt.undo()).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#bookingReference')?.value).toBe('');
    expect(document.querySelector<HTMLInputElement>('#passengerSurname')?.value).toBe('');
    expect(used.has(capsule.id)).toBe(true);
    expect(executeContextCapsuleTransfer(capsule, policy, plan, used)).toBeNull();
  });

  it('maps the current easyJet Find Booking labels without touching its consent checkbox or submit', () => {
    document.body.innerHTML = `<form action="https://www.easyjet.com/en?accntmdl=2">
      <input type="text" aria-label="Please enter a valid surname to find your booking" placeholder="Surname(s)" data-contextfill-visible="true">
      <input type="text" aria-label="Please enter a valid booking reference to find your booking" placeholder="Booking reference" data-contextfill-visible="true">
      <input id="consent" type="checkbox" aria-label="Confirm permission to manage this booking" data-contextfill-visible="true">
      <button type="submit">Find Booking</button>
    </form>`;
    const form = document.querySelector('form')!;
    const submitted = vi.fn();
    form.addEventListener('submit', submitted);
    const policy = authorizeContextCapsule(capsule, message, page, { now });
    const plan = createCapsuleMappingPlan(document, capsule);
    expect(plan).toMatchObject({ decision: 'ready', reasonCode: 'mapped' });
    const receipt = executeContextCapsuleTransfer(capsule, policy, plan)!;
    const textInputs = [...document.querySelectorAll<HTMLInputElement>('input[type="text"]')];
    expect(textInputs.map((input) => input.value)).toEqual(['Rivera', 'AU-47K2']);
    expect(document.querySelector<HTMLInputElement>('#consent')?.checked).toBe(false);
    expect(submitted).not.toHaveBeenCalled();
    expect(receipt.undo()).toBe(true);
    expect(textInputs.map((input) => input.value)).toEqual(['', '']);
  });

  it('ignores a hidden decoy and refuses ambiguous, sensitive, or non-empty targets', () => {
    renderFields('<label hidden>Booking reference<input name="hiddenBooking" hidden></label>');
    expect(createCapsuleMappingPlan(document, capsule).decision).toBe('ready');
    renderFields(
      '<label>Booking reference<input name="secondBooking" data-contextfill-visible="true"></label>',
    );
    expect(createCapsuleMappingPlan(document, capsule).reasonCode).toBe('ambiguous_field');
    renderFields('', 'Existing');
    expect(createCapsuleMappingPlan(document, capsule).reasonCode).toBe('non_empty_field');
    document.body.innerHTML = `<form><label>Booking reference credit card number<input type="text" data-contextfill-visible="true"></label><label>Passenger surname<input type="text" data-contextfill-visible="true"></label></form>`;
    expect(createCapsuleMappingPlan(document, capsule).reasonCode).toBe('unsafe_field');
  });

  it('ignores zero-size decoys and blocks targets split across forms', () => {
    renderFields('<label>Booking reference<input name="zeroSizeDecoy"></label>');
    expect(createCapsuleMappingPlan(document, capsule).decision).toBe('ready');

    document.body.innerHTML = `<form><label>Booking reference<input data-contextfill-visible="true"></label></form>
      <form><label>Passenger surname<input data-contextfill-visible="true"></label></form>`;
    expect(createCapsuleMappingPlan(document, capsule).reasonCode).toBe('split_container');
  });

  it('rolls back the entire transaction when a page rewrites one field', () => {
    renderFields();
    const passenger = document.querySelector<HTMLInputElement>('#passengerSurname')!;
    passenger.addEventListener('input', () => {
      if (passenger.value === 'Rivera') passenger.value = 'Rejected';
    });
    const policy = authorizeContextCapsule(capsule, message, page, { now });
    const plan = createCapsuleMappingPlan(document, capsule);
    expect(executeContextCapsuleTransfer(capsule, policy, plan)).toBeNull();
    expect(document.querySelector<HTMLInputElement>('#bookingReference')?.value).toBe('');
    expect(passenger.value).toBe('');
  });

  it('does not let model-extracted facts bypass deterministic authorization', () => {
    renderFields();
    const blocked = authorizeContextCapsule(
      { ...capsule, extractionMethod: 'gpt-5.6' },
      message,
      { ...page, hostname: 'checkin.aureliaair.test' },
      { now },
    );
    const plan = createCapsuleMappingPlan(document, capsule);
    expect(executeContextCapsuleTransfer(capsule, blocked, plan)).toBeNull();
    expect(document.querySelector<HTMLInputElement>('#bookingReference')?.value).toBe('');
    expect(document.querySelector<HTMLInputElement>('#passengerSurname')?.value).toBe('');
  });
});
