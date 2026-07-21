import { describe, expect, it } from 'vitest';
import { extractHttpUrls, inspectMagicLink, maskMagicLink } from '../../packages/core/src/index.js';

describe('magic-link inspection', () => {
  it('extracts an exact HTTPS link without sentence punctuation', () => {
    expect(
      extractHttpUrls(
        'Continue at https://login.cedarnotes.test/magic/sample-token?nonce=secret-value.',
      ),
    ).toEqual(['https://login.cedarnotes.test/magic/sample-token?nonce=secret-value']);
  });

  it('keeps the action URL in memory while masking path and query secrets for display', () => {
    const raw =
      'https://login.cedarnotes.test/magic/very-secret-token-123?nonce=another-secret#state';
    const inspected = inspectMagicLink(raw);
    expect(inspected).toMatchObject({
      safe: true,
      url: raw,
      hostname: 'login.cedarnotes.test',
      registrableDomain: 'cedarnotes.test',
    });
    expect(inspected.maskedUrl).toBe('https://login.cedarnotes.test/magic/••••?…#…');
    expect(inspected.maskedUrl).not.toContain('secret');
    expect(maskMagicLink(raw)).toBe(inspected.maskedUrl);
  });

  it.each([
    ['HTTP', 'http://cedarnotes.test/magic/token', 'insecure_scheme'],
    ['credentials', 'https://user:pass@cedarnotes.test/magic/token', 'embedded_credentials'],
    ['IP literal', 'https://127.0.0.1/magic/token', 'ip_literal'],
    ['nonstandard port', 'https://cedarnotes.test:8443/magic/token', 'nonstandard_port'],
    ['punycode', 'https://xn--cedarnte-90a.test/magic/token', 'internationalized_hostname'],
    ['shortener', 'https://bit.ly/opaque-token', 'opaque_shortener'],
    [
      'redirect wrapper',
      'https://click.cedarnotes.test/redirect?url=https%3A%2F%2Felsewhere.test%2Ftoken',
      'redirect_wrapper',
    ],
    [
      'opaque click endpoint',
      'https://links.cedarnotes.test/click/opaque-token',
      'redirect_wrapper',
    ],
  ])('rejects an unsafe %s destination without fetching it', (_label, value, riskCode) => {
    expect(inspectMagicLink(value)).toMatchObject({ safe: false, riskCode, url: null });
  });
});
