import { getDomain } from 'tldts';

export type HostAnalysis = {
  raw: string;
  normalized: string;
  registrableDomain: string | null;
  unicodeInput: boolean;
  punycode: boolean;
};

export function normalizeHostname(input: string): string {
  const trimmed = input.trim().normalize('NFKC').toLowerCase().replace(/\.$/, '');
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return '';
  }
}

export function registrableDomain(hostname: string): string | null {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;
  const parsed = getDomain(normalized, { allowPrivateDomains: true });
  if (parsed) return parsed;
  const labels = normalized.split('.').filter(Boolean);
  const finalLabel = labels.at(-1);
  if ((finalLabel === 'test' || finalLabel === 'localhost') && labels.length >= 2) {
    return labels.slice(-2).join('.');
  }
  return null;
}

export function analyzeHost(hostname: string): HostAnalysis {
  const normalized = normalizeHostname(hostname);
  return {
    raw: hostname,
    normalized,
    registrableDomain: registrableDomain(normalized),
    unicodeInput: [...hostname].some((character) => (character.codePointAt(0) ?? 0) > 127),
    punycode:
      /(?:^|\.)xn--/i.test(hostname) ||
      normalized.split('.').some((label) => label.startsWith('xn--')),
  };
}

export function domainsAlign(activeHostname: string, evidenceDomain: string): boolean {
  const active = analyzeHost(activeHostname);
  const evidence = analyzeHost(evidenceDomain);
  if (!active.registrableDomain || !evidence.registrableDomain) return false;
  return active.registrableDomain === evidence.registrableDomain;
}

function brandLabel(domain: string): string {
  return (registrableDomain(domain)?.split('.')[0] ?? domain.split('.')[0] ?? '').toLowerCase();
}

function confusableSkeleton(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[оο0]/g, 'o')
    .replace(/[іıɩ1]/g, 'i')
    .replace(/[ⅼӏ]/g, 'l')
    .replace(/-/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function detectLookalike(activeHostname: string, expectedDomains: string[]): string[] {
  const active = analyzeHost(activeHostname);
  const signals = new Set<string>();
  if (active.punycode) signals.add('The requesting hostname contains punycode.');
  if (active.unicodeInput) signals.add('The requesting hostname contains Unicode characters.');

  for (const expectedDomain of expectedDomains) {
    const expected = analyzeHost(expectedDomain);
    if (!expected.registrableDomain || !active.registrableDomain) continue;
    if (active.registrableDomain === expected.registrableDomain) continue;

    const activeBrand = brandLabel(active.registrableDomain);
    const expectedBrand = brandLabel(expected.registrableDomain);
    if (confusableSkeleton(activeBrand) === confusableSkeleton(expectedBrand)) {
      signals.add('The registrable domain uses a confusable spelling of the expected service.');
    }
    if (active.normalized.includes(expected.registrableDomain)) {
      signals.add('The expected domain appears only inside a different hostname.');
    }
    if (confusableSkeleton(active.normalized).includes(confusableSkeleton(expectedBrand))) {
      signals.add('A different registrable domain contains the expected service name.');
    }
  }
  return [...signals];
}

export function senderDomain(address: string | null): string | null {
  if (!address) return null;
  const domain = address.split('@').at(-1);
  return domain ? normalizeHostname(domain) : null;
}
