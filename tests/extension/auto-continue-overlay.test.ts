import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoContinueOverlay } from '../../apps/extension/src/auto-continue-overlay.js';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('Auto-Continue in-page overlay', () => {
  it('shows masked verification progress and exposes an explicit Assisted action', () => {
    const action = vi.fn();
    const overlay = new AutoContinueOverlay(document, 'open');
    overlay.show(
      {
        state: 'verified',
        mode: 'assisted',
        candidateType: 'otp',
        title: 'Verified code ready',
        detail: 'The code stays masked.',
        destination: 'northstar.test',
      },
      action,
    );
    const shadow = document.querySelector<HTMLElement>('#contextfill-auto-continue')!.shadowRoot!;
    expect(shadow.textContent).toContain('Verified code ready');
    expect(shadow.textContent).toContain('The code stays masked.');
    expect(shadow.textContent).not.toMatch(/481203|private-token/);
    const fill = [...shadow.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Fill verified code'),
    );
    fill?.click();
    expect(action).toHaveBeenCalledWith('execute');
    overlay.destroy();
  });

  it('provides a cancellable countdown and executes only after it reaches zero', () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const overlay = new AutoContinueOverlay(document, 'open');
    overlay.show(
      {
        state: 'countdown',
        mode: 'auto',
        candidateType: 'magic_link',
        title: 'Opening in 3…',
        detail: 'Cancel now to keep this tab on the current page.',
        destination: 'medium.com',
        countdownSeconds: 3,
      },
      action,
    );
    const shadow = document.querySelector<HTMLElement>('#contextfill-auto-continue')!.shadowRoot!;
    expect(shadow.textContent).toContain('Cancel auto action');
    vi.advanceTimersByTime(2_000);
    expect(action).not.toHaveBeenCalledWith('execute');
    vi.advanceTimersByTime(1_000);
    expect(action).toHaveBeenCalledWith('execute');
    overlay.destroy();
  });

  it('fails closed if a page removes the visible countdown before execution', () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const overlay = new AutoContinueOverlay(document, 'open');
    overlay.show(
      {
        state: 'countdown',
        mode: 'auto',
        candidateType: 'otp',
        title: 'Filling in 3…',
        detail: 'Cancel now to leave every field unchanged.',
        countdownSeconds: 3,
      },
      action,
    );
    document.querySelector('#contextfill-auto-continue')?.remove();
    vi.advanceTimersByTime(3_000);
    expect(action).toHaveBeenCalledWith('cancel');
    expect(action).not.toHaveBeenCalledWith('execute');
    overlay.destroy();
  });
});
