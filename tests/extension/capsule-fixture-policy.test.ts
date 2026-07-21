import { describe, expect, it } from 'vitest';
import { isAllowedCapsuleFixture } from '../../apps/extension/src/capsule-fixture-policy.js';

describe('capsule fixture activation policy', () => {
  it('allows only exact judge origins, scenarios, and fixture metadata', () => {
    expect(
      isAllowedCapsuleFixture(
        'http://127.0.0.1:4173',
        '/',
        'capsule',
        'checkin.aurelia-air.test',
        'Aurelia Air',
      ),
    ).toBe(true);
    expect(
      isAllowedCapsuleFixture(
        'http://127.0.0.1:4179',
        '/',
        'capsule-lookalike',
        'checkin.aureliaair.test',
        'Aurelia Air',
      ),
    ).toBe(true);
    expect(
      isAllowedCapsuleFixture(
        'http://127.0.0.1:4180',
        '/',
        'capsule',
        'checkin.aurelia-air.test',
        'Aurelia Air',
      ),
    ).toBe(false);
    expect(
      isAllowedCapsuleFixture(
        'http://127.0.0.1:4173',
        '/',
        'capsule-invented',
        'checkin.aurelia-air.test',
        'Aurelia Air',
      ),
    ).toBe(false);
    expect(
      isAllowedCapsuleFixture('http://127.0.0.1:4173', '/', 'capsule', 'evil.test', 'Aurelia Air'),
    ).toBe(false);
    expect(
      isAllowedCapsuleFixture(
        'http://127.0.0.1:4173',
        '/untrusted.html',
        'capsule',
        'checkin.aurelia-air.test',
        'Aurelia Air',
      ),
    ).toBe(false);
  });
});
