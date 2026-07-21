import type {
  CapsulePolicyResult,
  ContextCapsule,
  ContextCapsuleFact,
  ContextCapsuleFactKey,
} from '../types.js';

export type CapsuleFieldMapping = {
  factKey: ContextCapsuleFactKey;
  targetField: HTMLInputElement;
  targetDescription: string;
  mappingConfidence: number;
  mappingEvidence: string[];
  previousValue: string;
};

export type CapsuleMappingPlan = {
  capsuleId: string;
  mappings: CapsuleFieldMapping[];
  decision: 'ready' | 'block';
  reasonCode:
    | 'mapped'
    | 'missing_field'
    | 'ambiguous_field'
    | 'unsafe_field'
    | 'non_empty_field'
    | 'value_too_long'
    | 'split_container';
  reason: string;
};

export type CapsuleTransferReceipt = {
  capsuleId: string;
  transferredCount: number;
  undo: () => boolean;
};

const forbiddenContext =
  /\b(password|passcode|security answer|security question|social security|ssn|passport|government|national id|credit card|card number|cvv|cvc|payment|bank|routing|account number|health|medical|diagnosis|one[- ]?time|otp)\b/i;

function visibleAndEnabled(input: HTMLInputElement): boolean {
  if (input.disabled || input.readOnly || input.hidden || input.type === 'hidden') return false;
  if (input.getAttribute('aria-hidden') === 'true') return false;
  const style = input.ownerDocument.defaultView?.getComputedStyle(input);
  if (style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0') {
    return false;
  }
  const view = input.ownerDocument.defaultView;
  if (view?.navigator.userAgent.includes('jsdom')) {
    return input.dataset.contextfillVisible === 'true';
  }
  const rectangle = input.getBoundingClientRect();
  if (rectangle.width < 2 || rectangle.height < 2) return false;
  if (rectangle.bottom <= 0 || rectangle.right <= 0) return false;
  if (view && (rectangle.top >= view.innerHeight || rectangle.left >= view.innerWidth))
    return false;
  return input.getClientRects().length > 0;
}

function labelFor(input: HTMLInputElement): string {
  return input.labels ? [...input.labels].map((label) => label.textContent ?? '').join(' ') : '';
}

function evidenceFor(input: HTMLInputElement): string {
  const fieldset = input.closest('fieldset');
  return [
    labelFor(input),
    input.getAttribute('aria-label') ?? '',
    input.placeholder,
    input.name,
    input.id,
    fieldset?.querySelector('legend')?.textContent ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function forbidden(input: HTMLInputElement, evidence: string): boolean {
  const autocomplete = input.autocomplete.toLocaleLowerCase();
  return (
    !['text', 'search'].includes(input.type || 'text') ||
    forbiddenContext.test(evidence) ||
    /^(?:current-password|new-password|cc-|one-time-code)/.test(autocomplete)
  );
}

function scoreField(
  input: HTMLInputElement,
  key: ContextCapsuleFactKey,
): { score: number; evidence: string[]; unsafe: boolean } {
  if (!visibleAndEnabled(input)) return { score: -Infinity, evidence: [], unsafe: false };
  const text = evidenceFor(input);
  if (forbidden(input, text)) return { score: -Infinity, evidence: [], unsafe: true };
  const signals: string[] = [];
  let score = 0;
  if (key === 'booking_reference') {
    if (/\b(?:booking|reservation)\s+(?:reference|confirmation|number|code)\b/i.test(text)) {
      score += 100;
      signals.push('explicit booking-reference label');
    } else if (/\bconfirmation code(?:\s+or\s+e-?ticket(?:\s*(?:#|number))?)?\b/i.test(text)) {
      score += 92;
      signals.push('airline confirmation-code label');
    } else if (/booking.*(?:ref|confirmation|code)|(?:ref|confirmation).*booking/i.test(text)) {
      score += 86;
      signals.push('booking-reference field identifier');
    }
  } else if (/\bpassenger(?:'s|’s|s')?\s+(?:surname|last name)\b/i.test(text)) {
    score += 100;
    signals.push('explicit passenger-surname label');
  } else if (/\b(?:surname|family name)\b/i.test(text)) {
    score += 92;
    signals.push('surname field label');
  } else if (/\blast name\b|last[-_ ]?name/i.test(text)) {
    score += 84;
    signals.push('last-name field label');
  }
  if (input.autocomplete === 'family-name' && key === 'passenger_surname') {
    score += 10;
    signals.push('family-name autocomplete');
  }
  if (input.maxLength >= 4 && input.maxLength <= 80) {
    score += 3;
    signals.push('compatible length constraint');
  }
  return { score, evidence: signals, unsafe: false };
}

function targetDescription(input: HTMLInputElement, factKey: ContextCapsuleFactKey): string {
  const label = labelFor(input).replace(/\s+/g, ' ').trim();
  if (label) return label;
  return factKey === 'booking_reference' ? 'Booking reference field' : 'Passenger surname field';
}

function block(
  capsuleId: string,
  reasonCode: CapsuleMappingPlan['reasonCode'],
  reason: string,
): CapsuleMappingPlan {
  return { capsuleId, mappings: [], decision: 'block', reasonCode, reason };
}

export function createCapsuleMappingPlan(
  document: Document,
  capsule: ContextCapsule,
): CapsuleMappingPlan {
  const inputs = [...document.querySelectorAll<HTMLInputElement>('input')];
  const mappings: CapsuleFieldMapping[] = [];
  for (const fact of capsule.facts) {
    const candidates = inputs
      .map((input) => ({ input, ...scoreField(input, fact.key) }))
      .filter((candidate) => candidate.score >= 80)
      .sort((left, right) => right.score - left.score);
    if (candidates.length === 0) {
      const unsafeMatch = inputs.some((input) => scoreField(input, fact.key).unsafe);
      return block(
        capsule.id,
        unsafeMatch ? 'unsafe_field' : 'missing_field',
        unsafeMatch
          ? 'A similarly labeled field is sensitive or unsafe, so the capsule cannot be mapped.'
          : `No unambiguous ${fact.key.replaceAll('_', ' ')} field was found.`,
      );
    }
    if (candidates.length > 1) {
      return block(
        capsule.id,
        'ambiguous_field',
        `Multiple plausible ${fact.key.replaceAll('_', ' ')} fields were found.`,
      );
    }
    const match = candidates[0]!;
    if (mappings.some((mapping) => mapping.targetField === match.input)) {
      return block(
        capsule.id,
        'ambiguous_field',
        'Two facts resolved to the same destination field.',
      );
    }
    if (match.input.value.length > 0) {
      return block(
        capsule.id,
        'non_empty_field',
        `${targetDescription(match.input, fact.key)} already contains a value and will not be overwritten.`,
      );
    }
    if (match.input.maxLength > 0 && fact.value.length > match.input.maxLength) {
      return block(
        capsule.id,
        'value_too_long',
        `The ${fact.key.replaceAll('_', ' ')} does not fit its destination field.`,
      );
    }
    mappings.push({
      factKey: fact.key,
      targetField: match.input,
      targetDescription: targetDescription(match.input, fact.key),
      mappingConfidence: Math.min(1, match.score / 100),
      mappingEvidence: match.evidence,
      previousValue: match.input.value,
    });
  }
  if (mappings.length !== capsule.facts.length) {
    return block(capsule.id, 'missing_field', 'Not every capsule fact has a safe destination.');
  }
  const ownerContainers = new Set(
    mappings.map(
      (mapping) =>
        mapping.targetField.form ?? mapping.targetField.closest<HTMLElement>('[role="form"]'),
    ),
  );
  if (ownerContainers.size !== 1 || ownerContainers.has(null)) {
    return block(
      capsule.id,
      'split_container',
      'The two destination fields do not belong to the same form or form container.',
    );
  }
  return {
    capsuleId: capsule.id,
    mappings,
    decision: 'ready',
    reasonCode: 'mapped',
    reason: `${mappings.length} facts have unique, strongly labeled destination fields.`,
  };
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }),
  );
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function valueFor(capsule: ContextCapsule, key: ContextCapsuleFactKey): string | null {
  return capsule.facts.find((fact) => fact.key === key)?.value ?? null;
}

export function executeContextCapsuleTransfer(
  capsule: ContextCapsule,
  policy: CapsulePolicyResult,
  plan: CapsuleMappingPlan,
  usedCapsuleIds?: Set<string>,
): CapsuleTransferReceipt | null {
  if (
    policy.decision !== 'allow' ||
    policy.capsuleId !== capsule.id ||
    plan.decision !== 'ready' ||
    plan.capsuleId !== capsule.id ||
    plan.mappings.length !== capsule.facts.length ||
    usedCapsuleIds?.has(capsule.id)
  ) {
    return null;
  }
  for (const mapping of plan.mappings) {
    const value = valueFor(capsule, mapping.factKey);
    if (
      !value ||
      !visibleAndEnabled(mapping.targetField) ||
      mapping.targetField.value !== mapping.previousValue ||
      mapping.previousValue.length > 0 ||
      (mapping.targetField.maxLength > 0 && value.length > mapping.targetField.maxLength)
    ) {
      return null;
    }
  }
  const applied: Array<{ mapping: CapsuleFieldMapping; value: string }> = [];
  for (const mapping of plan.mappings) {
    const value = valueFor(capsule, mapping.factKey)!;
    applied.push({ mapping, value });
    setInputValue(mapping.targetField, value);
    if (mapping.targetField.value !== value) {
      for (const appliedItem of [...applied].reverse()) {
        setInputValue(appliedItem.mapping.targetField, appliedItem.mapping.previousValue);
        delete appliedItem.mapping.targetField.dataset.contextfillCapsuleFilled;
      }
      return null;
    }
    mapping.targetField.dataset.contextfillCapsuleFilled = 'true';
  }
  usedCapsuleIds?.add(capsule.id);
  let undone = false;
  return {
    capsuleId: capsule.id,
    transferredCount: applied.length,
    undo: () => {
      if (undone || applied.some(({ mapping, value }) => mapping.targetField.value !== value)) {
        return false;
      }
      for (const { mapping } of applied) {
        setInputValue(mapping.targetField, mapping.previousValue);
        delete mapping.targetField.dataset.contextfillCapsuleFilled;
      }
      applied[0]?.mapping.targetField.focus();
      undone = true;
      return true;
    },
  };
}

export function maskContextCapsuleFact(fact: ContextCapsuleFact): string {
  if (fact.key === 'passenger_surname') {
    const characters = [...fact.value];
    return characters.length <= 2
      ? '••'
      : `${characters[0]}${'•'.repeat(Math.min(6, characters.length - 1))}`;
  }
  const suffix = fact.value.slice(-3);
  return `${'•'.repeat(Math.max(4, Math.min(8, fact.value.length - suffix.length)))}${suffix}`;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function maskContextCapsuleText(text: string, capsule: ContextCapsule): string {
  return capsule.facts.reduce(
    (masked, fact) =>
      masked.replace(
        new RegExp(escapeRegularExpression(fact.value), 'giu'),
        maskContextCapsuleFact(fact),
      ),
    text,
  );
}
