import { describe, expect, it } from 'vitest';
import {
  analyzeHost,
  detectLookalike,
  domainsAlign,
  registrableDomain,
} from '../../packages/core/src/index.js';

describe('domain handling', () => {
  it('compares registrable domains and accepts real subdomains', () => {
    expect(registrableDomain('account.northstar.test')).toBe('northstar.test');
    expect(registrableDomain('login.example.co.uk')).toBe('example.co.uk');
    expect(domainsAlign('account.northstar.test', 'notify.northstar.test')).toBe(true);
    expect(domainsAlign('northstar.test.evil.example', 'northstar.test')).toBe(false);
  });

  it('flags punycode and Unicode representations', () => {
    expect(analyzeHost('xn--nrtstar-90g.test').punycode).toBe(true);
    expect(analyzeHost('nоrthstar.test').unicodeInput).toBe(true);
  });

  it('detects controlled substitution and deceptive-label fixtures', () => {
    expect(detectLookalike('account.n0rthstar.test', ['northstar.test'])).not.toHaveLength(0);
    expect(detectLookalike('northstar.test.evil.example', ['northstar.test'])).not.toHaveLength(0);
  });
});
