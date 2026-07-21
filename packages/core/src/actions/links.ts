import { analyzeHost, registrableDomain } from '../domains/index.js';

export type MagicLinkRiskCode =
  | 'malformed'
  | 'insecure_scheme'
  | 'embedded_credentials'
  | 'ip_literal'
  | 'local_destination'
  | 'nonstandard_port'
  | 'internationalized_hostname'
  | 'opaque_shortener'
  | 'redirect_wrapper'
  | 'unregistrable_destination';

export type MagicLinkInspection = {
  safe: boolean;
  riskCode: MagicLinkRiskCode | null;
  reason: string | null;
  url: string | null;
  hostname: string | null;
  registrableDomain: string | null;
  maskedUrl: string;
};

const httpUrlPattern = /https?:\/\/[^\s<>"'`]+/gi;
const shortenerDomains = new Set([
  'bit.ly',
  'bitly.com',
  'buff.ly',
  'goo.gl',
  'is.gd',
  'ow.ly',
  'rebrand.ly',
  'shorturl.at',
  't.co',
  'tinyurl.com',
]);
const redirectParameterNames = new Set([
  'continue',
  'destination',
  'redirect',
  'redirect_uri',
  'target',
  'url',
]);
const redirectPathPattern = /\/(?:click|out|redir(?:ect)?|track|url)(?:\/|$)/i;
const supportedActionLanguage =
  /\b(magic link|sign[- ]?in link|login link|email confirmation|confirm (?:your )?email|verify (?:your )?email|activate (?:your )?account|continue (?:to )?(?:sign[- ]?in|login))\b/i;
const highRiskActionLanguage =
  /\b(password reset|reset (?:your )?password|account recovery|recover (?:your )?account|payment authorization|approve (?:a )?payment|wire transfer|sign (?:this |the )?(?:document|agreement)|e-?signature)\b/i;

export function isSupportedMagicLinkText(text: string): boolean {
  return supportedActionLanguage.test(text) && !highRiskActionLanguage.test(text);
}

function trimUrlPunctuation(value: string): string {
  let trimmed = value;
  while (/[.,;:!?]$/.test(trimmed)) trimmed = trimmed.slice(0, -1);
  while (trimmed.endsWith(')') && !trimmed.includes('(')) trimmed = trimmed.slice(0, -1);
  while (trimmed.endsWith(']') && !trimmed.includes('[')) trimmed = trimmed.slice(0, -1);
  return trimmed;
}

export function extractHttpUrls(text: string): string[] {
  return [...text.matchAll(httpUrlPattern)]
    .map((match) => trimUrlPunctuation(match[0]))
    .filter(Boolean);
}

function isIpLiteral(hostname: string): boolean {
  if (hostname.includes(':')) return true;
  const parts = hostname.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  );
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('127.') ||
    hostname === '::1'
  );
}

function isRedirectWrapper(url: URL): boolean {
  if (redirectPathPattern.test(url.pathname)) return true;
  for (const [name, value] of url.searchParams) {
    if (!redirectParameterNames.has(name.toLowerCase())) continue;
    try {
      const nested = new URL(value);
      if (nested.protocol === 'http:' || nested.protocol === 'https:') return true;
    } catch {
      // A non-URL parameter is not a redirect destination.
    }
  }
  return false;
}

function maskPathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '';
  return `/${segments
    .map((segment, index) => {
      const decoded = (() => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      })();
      const looksSensitive =
        index === segments.length - 1 ||
        decoded.length >= 12 ||
        /[A-Za-z].*\d|\d.*[A-Za-z]/.test(decoded) ||
        /[_=-]/.test(decoded);
      return looksSensitive ? '••••' : decoded.slice(0, 24);
    })
    .join('/')}`;
}

export function maskMagicLink(value: string): string {
  try {
    const url = new URL(value);
    const maskedPath = maskPathname(url.pathname);
    return `${url.protocol}//${url.host}${maskedPath}${url.search ? '?…' : ''}${url.hash ? '#…' : ''}`;
  } catch {
    return 'Unsafe link withheld';
  }
}

function rejected(
  riskCode: MagicLinkRiskCode,
  reason: string,
  url: URL | null = null,
): MagicLinkInspection {
  return {
    safe: false,
    riskCode,
    reason,
    url: null,
    hostname: url?.hostname ?? null,
    registrableDomain: url ? registrableDomain(url.hostname) : null,
    maskedUrl: url ? maskMagicLink(url.toString()) : 'Unsafe link withheld',
  };
}

export function inspectMagicLink(value: string): MagicLinkInspection {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return rejected('malformed', 'The message contains a malformed link.');
  }

  if (url.protocol !== 'https:') {
    return rejected('insecure_scheme', 'Verified action links must use HTTPS.', url);
  }
  if (url.username || url.password) {
    return rejected(
      'embedded_credentials',
      'The link embeds credentials in its destination and cannot be opened safely.',
      url,
    );
  }
  if (isIpLiteral(url.hostname)) {
    return rejected('ip_literal', 'The link uses an IP-literal destination.', url);
  }
  if (isLocalHostname(url.hostname)) {
    return rejected('local_destination', 'The link targets a local browser address.', url);
  }
  if (url.port && url.port !== '443') {
    return rejected('nonstandard_port', 'The link uses a nonstandard network port.', url);
  }
  const host = analyzeHost(url.hostname);
  if (host.punycode || host.unicodeInput) {
    return rejected(
      'internationalized_hostname',
      'The link destination uses an internationalized or punycode hostname.',
      url,
    );
  }
  const destinationDomain = registrableDomain(url.hostname);
  if (!destinationDomain) {
    return rejected(
      'unregistrable_destination',
      'The link has no verifiable registrable destination domain.',
      url,
    );
  }
  if (shortenerDomains.has(destinationDomain)) {
    return rejected(
      'opaque_shortener',
      'The link uses an opaque URL shortener, so its destination cannot be verified locally.',
      url,
    );
  }
  if (isRedirectWrapper(url)) {
    return rejected(
      'redirect_wrapper',
      'The link is an opaque redirect wrapper, so its final destination cannot be verified without fetching it.',
      url,
    );
  }

  return {
    safe: true,
    riskCode: null,
    reason: null,
    url: url.toString(),
    hostname: url.hostname,
    registrableDomain: destinationDomain,
    maskedUrl: maskMagicLink(url.toString()),
  };
}
