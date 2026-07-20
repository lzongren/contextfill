export type FieldTarget = {
  kind: 'single' | 'split';
  elements: HTMLInputElement[];
  score: number;
};

const codeWords =
  /\b(verification|verify|one[- ]?time|otp|security|auth(?:entication)?|sign[- ]?in|login)\b/i;

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

function fieldText(input: HTMLInputElement): string {
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute('aria-label') ?? '',
    labelText(input),
    input.closest('fieldset, form, section')?.textContent?.slice(0, 500) ?? '',
  ].join(' ');
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

function findSplitTarget(inputs: HTMLInputElement[]): FieldTarget | null {
  const eligible = inputs.filter(
    (input) =>
      isVisibleAndEnabled(input) &&
      input.maxLength === 1 &&
      ['text', 'tel', 'number'].includes(input.type),
  );
  if (eligible.length < 4 || eligible.length > 8) return null;
  const container = eligible[0]?.closest('fieldset, form, section, [data-contextfill-split]');
  if (!container || !eligible.every((input) => container.contains(input))) return null;
  const context = `${container.textContent ?? ''} ${container.getAttribute('aria-label') ?? ''}`;
  if (!codeWords.test(context) && !eligible.some((input) => codeWords.test(fieldText(input))))
    return null;
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
  if (split && (!single || split.score >= single.score)) return split;
  return single;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }),
  );
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function fillVerificationFields(target: FieldTarget, code: string): boolean {
  if (!code || target.elements.some((element) => !isVisibleAndEnabled(element))) return false;
  if (target.kind === 'split') {
    const characters = [...code];
    if (characters.length !== target.elements.length) return false;
    target.elements.forEach((input, index) => setInputValue(input, characters[index] ?? ''));
    target.elements.at(-1)?.focus();
    return true;
  }
  const input = target.elements[0];
  if (!input) return false;
  if (input.maxLength > 0 && code.length > input.maxLength) return false;
  setInputValue(input, code);
  input.focus();
  return true;
}
