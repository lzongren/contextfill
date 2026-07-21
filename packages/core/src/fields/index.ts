export type FieldTarget = {
  kind: 'single' | 'split' | 'reference';
  elements: HTMLInputElement[];
  score: number;
};

export type AutomaticPageSignal = {
  intents: Array<'otp' | 'magic_link'>;
  reason: string;
};

const codeWords =
  /\b(verification|verify|one[- ]?time|otp|security|auth(?:entication)?|sign[- ]?in|login|access\s+code|confirmation\s+code|passcode)\b/i;
const strongCodeWords =
  /\b(verification(?:\s+code)?|one[- ]?time(?:\s+(?:access\s+)?code)?|otp|security\s+code|auth(?:entication)?\s+code|access\s+code|confirmation\s+code|passcode|two[- ]factor|2fa)\b/i;
const referenceWords =
  /\b((?:booking|reservation|application|support|case|ticket)\s+(?:reference|confirmation|number|id)|reference\s+(?:number|id))\b/i;

function isVisibleAndEnabled(input: HTMLInputElement): boolean {
  if (input.disabled || input.readOnly || input.type === 'hidden' || input.hidden) return false;
  if (input.getAttribute('aria-hidden') === 'true') return false;
  const style = input.ownerDocument.defaultView?.getComputedStyle(input);
  if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  if (input.dataset.contextfillVisible === 'true') return true;
  if (input.getClientRects().length > 0) return true;
  return input.ownerDocument.defaultView?.navigator.userAgent.includes('jsdom') ?? false;
}

function labelText(input: HTMLInputElement): string {
  const labels = input.labels ? [...input.labels].map((label) => label.textContent ?? '') : [];
  return labels.join(' ');
}

function ancestorText(element: HTMLElement): string {
  const context: string[] = [];
  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; current && depth < 5; depth += 1) {
    context.push(
      current.getAttribute('aria-label') ?? '',
      current.getAttribute('aria-labelledby') ?? '',
      current.textContent?.slice(0, 1_000) ?? '',
    );
    current = current.parentElement;
  }
  return context.join(' ');
}

function fieldText(input: HTMLInputElement): string {
  return [localFieldText(input), ancestorText(input)].join(' ');
}

function localFieldText(input: HTMLInputElement): string {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label') ?? '',
    labelText(input),
  ].join(' ');
}

function lowestCommonAncestor(inputs: HTMLInputElement[]): HTMLElement | null {
  let ancestor = inputs[0]?.parentElement ?? null;
  while (ancestor && !inputs.every((input) => ancestor!.contains(input))) {
    ancestor = ancestor.parentElement;
  }
  return ancestor;
}

function splitContext(container: HTMLElement, inputs: HTMLInputElement[]): string {
  const context: string[] = [];
  let current: HTMLElement | null = container;
  for (let depth = 0; current && depth < 5; depth += 1) {
    context.push(
      current.getAttribute('aria-label') ?? '',
      current.getAttribute('aria-labelledby') ?? '',
      current.textContent?.slice(0, 1_000) ?? '',
    );
    current = current.parentElement;
  }
  context.push(...inputs.map(fieldText));
  return context.join(' ');
}

function isDigitBox(input: HTMLInputElement): boolean {
  if (!isVisibleAndEnabled(input)) return false;
  if (!['text', 'tel', 'number', 'password'].includes(input.type || 'text')) return false;
  if (input.maxLength > 1) return false;
  const pattern = input.getAttribute('pattern') ?? '';
  return (
    input.maxLength === 1 ||
    input.inputMode === 'numeric' ||
    input.type === 'tel' ||
    input.type === 'number' ||
    /\\d|0-9/.test(pattern) ||
    /digit/i.test(`${input.name} ${input.id} ${input.getAttribute('aria-label') ?? ''}`)
  );
}

export function scoreVerificationField(input: HTMLInputElement): number {
  if (!isVisibleAndEnabled(input)) return -Infinity;
  if (!['text', 'tel', 'number', 'password'].includes(input.type || 'text')) return -Infinity;
  let score = 0;
  if (input.autocomplete === 'one-time-code') score += 90;
  if (codeWords.test(fieldText(input))) score += 45;
  if (input.maxLength >= 4 && input.maxLength <= 10) score += 15;
  if (input.inputMode === 'numeric') score += 8;
  if (/code|otp|verification/i.test(`${input.name} ${input.id}`)) score += 20;
  if (input.maxLength === 1) score -= 25;
  return score;
}

export function scoreReferenceField(input: HTMLInputElement): number {
  if (!isVisibleAndEnabled(input)) return -Infinity;
  if (!['text', 'search'].includes(input.type || 'text')) return -Infinity;
  // Reference evidence must belong to this control. Shared form text can mention a booking
  // reference beside an unrelated surname field and must never make both inputs candidates.
  const text = localFieldText(input);
  let score = 0;
  if (referenceWords.test(text)) score += 75;
  if (
    /\b(ref(?:erence)?|booking|reservation|application|support|case|ticket)\b/i.test(
      `${input.name} ${input.id} ${input.getAttribute('aria-label') ?? ''}`,
    )
  ) {
    score += 30;
  }
  if (input.maxLength >= 5 && input.maxLength <= 32) score += 10;
  if (codeWords.test(text) && !referenceWords.test(text)) score -= 80;
  return score;
}

function findSplitTarget(inputs: HTMLInputElement[]): FieldTarget | null {
  const eligible = inputs.filter(isDigitBox);
  if (eligible.length < 4 || eligible.length > 8) return null;
  const container = lowestCommonAncestor(eligible);
  if (!container || !strongCodeWords.test(splitContext(container, eligible))) return null;
  return { kind: 'split', elements: eligible, score: 95 + eligible.length };
}

export function findVerificationFields(document: Document): FieldTarget | null {
  const inputs = [...document.querySelectorAll<HTMLInputElement>('input')];
  const split = findSplitTarget(inputs);
  const singles = inputs
    .map((input) => ({ input, score: scoreVerificationField(input) }))
    .filter(({ score }) => score >= 60)
    .sort((a, b) => b.score - a.score);
  const single = singles[0]
    ? { kind: 'single' as const, elements: [singles[0].input], score: singles[0].score }
    : null;
  // A contextual group of 4–8 adjacent one-character controls is more specific
  // than the autocomplete signal on its first member.
  if (split) return split;
  return single;
}

export function findReferenceField(document: Document): FieldTarget | null {
  const matches = [...document.querySelectorAll<HTMLInputElement>('input')]
    .map((input) => ({ input, score: scoreReferenceField(input) }))
    .filter(({ score }) => score >= 75)
    .sort((a, b) => b.score - a.score);
  const best = matches[0];
  return best ? { kind: 'reference', elements: [best.input], score: best.score } : null;
}

export function findContextField(document: Document): FieldTarget | null {
  return findVerificationFields(document) ?? findReferenceField(document);
}

function visiblePageText(document: Document): string {
  const body = document.body;
  if (!body) return '';
  // innerText excludes most hidden content in a real browser. textContent keeps the helper
  // deterministic under JSDOM, where layout and innerText are not fully implemented.
  return ((body as HTMLElement).innerText || body.textContent || '').slice(0, 20_000);
}

export function detectAutomaticPageSignal(
  document: Document,
  target: FieldTarget | null = findContextField(document),
): AutomaticPageSignal {
  const intents: Array<'otp' | 'magic_link'> = [];
  if (target?.kind === 'single' || target?.kind === 'split') intents.push('otp');

  const text = visiblePageText(document);
  const mentionsEmailHandoff =
    /\b(check|open)\s+(?:your\s+)?email(?:\s+inbox)?\b|\b(?:sent|send|sending)\b[^.\n]{0,100}\bemail\b|\bemail\b[^.\n]{0,100}\b(?:sent|inbox)\b/i.test(
      text,
    );
  const mentionsLinkAction =
    /\bmagic\s+link\b|\b(?:sign[- ]?in|log ?in|verification|confirmation|secure access)\s+link\b|\bclick\b[^.\n]{0,80}\b(?:link|email)\b|\bverify\s+(?:your\s+)?email\b/i.test(
      text,
    );
  if (mentionsEmailHandoff && mentionsLinkAction) intents.push('magic_link');

  return {
    intents: [...new Set(intents)],
    reason:
      intents.length > 0
        ? 'The page visibly requests an email verification action.'
        : 'No supported email-verification wait state was detected.',
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

export function fillTransferValue(target: FieldTarget, value: string): boolean {
  if (!value || target.elements.some((element) => !isVisibleAndEnabled(element))) return false;
  if (target.kind === 'split') {
    const characters = [...value];
    if (characters.length !== target.elements.length) return false;
    target.elements.forEach((input, index) => setInputValue(input, characters[index] ?? ''));
    target.elements.at(-1)?.focus();
    return true;
  }
  const input = target.elements[0];
  if (!input) return false;
  if (input.maxLength > 0 && value.length > input.maxLength) return false;
  setInputValue(input, value);
  input.focus();
  return true;
}

export const fillVerificationFields = fillTransferValue;
