import { describe, expect, it } from 'vitest';
import { parseEmlImport, MAX_EML_BYTES } from '../../apps/extension/src/eml-import.js';
import { shouldUseModelForSource } from '../../apps/extension/src/mail-client.js';
import {
  extractInboxDeterministic,
  rankCandidates,
  type PageContext,
} from '../../packages/core/src/index.js';

const rawEmail = [
  'From: Northstar Access <security@northstar.test>',
  'To: Person <person@example.com>',
  'Date: Mon, 20 Jul 2026 12:54:00 -0700',
  'Message-ID: <verification-481203@northstar.test>',
  'Subject: Your Northstar verification code',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Your verification code is 481203.',
  'It expires in 10 minutes.',
  'Continue at https://account.northstar.test/verify',
].join('\r\n');

function eml(contents: string, name = 'message.eml'): File {
  return new File([contents], name, { type: 'message/rfc822' });
}

describe('.eml import', () => {
  it('cannot enter optional model extraction even when real-mail opt-in is enabled', () => {
    expect(shouldUseModelForSource('import', true)).toBe(false);
    expect(shouldUseModelForSource('gmail', true)).toBe(true);
    expect(shouldUseModelForSource('outlook', false)).toBe(false);
    expect(shouldUseModelForSource('synthetic', false)).toBe(true);
  });

  it('normalizes a real exported message and supports the trust policy', async () => {
    const message = await parseEmlImport(eml(rawEmail));
    expect(message).toMatchObject({
      source: 'import',
      senderName: 'Northstar Access',
      senderAddress: 'security@northstar.test',
      subject: 'Your Northstar verification code',
      receivedAt: '2026-07-20T19:54:00.000Z',
      expiresAt: '2026-07-20T20:04:00.000Z',
    });
    expect(message.id).toMatch(/^import:[a-f0-9]{40}$/);
    const page: PageContext = {
      hostname: 'account.northstar.test',
      serviceHint: 'Northstar',
      simulated: false,
      scenario: null,
      fieldKind: 'single',
      fieldCount: 1,
    };
    const ranked = rankCandidates(extractInboxDeterministic([message]), page, {
      now: new Date('2026-07-20T19:56:00.000Z'),
    });
    expect(ranked[0]?.candidate.value).toBe('481203');
    expect(ranked[0]?.policy).toMatchObject({ decision: 'allow', reasonCode: 'aligned' });
  });

  it('extracts visible text and HTTPS link evidence from HTML-only mail', async () => {
    const html = [
      'From: Northstar <security@northstar.test>',
      'Date: Mon, 20 Jul 2026 12:54:00 -0700',
      'Subject: Northstar sign-in code',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<style>.secret { display: none }</style>',
      '<p>Your sign-in code is <strong>481203</strong>.</p>',
      '<a href="https://account.northstar.test/verify">Continue</a>',
      '<script>fetch("https://attacker.example")</script>',
    ].join('\r\n');
    const message = await parseEmlImport(eml(html));
    expect(message.body).toContain('Your sign-in code is 481203.');
    expect(message.body).toContain('https://account.northstar.test/verify');
    expect(message.body).not.toContain('attacker.example');
  });

  it('rejects wrong extensions, oversized input, and incomplete metadata', async () => {
    await expect(parseEmlImport(eml(rawEmail, 'message.txt'))).rejects.toThrow('.eml extension');
    await expect(
      parseEmlImport(new File([new Uint8Array(MAX_EML_BYTES + 1)], 'large.eml')),
    ).rejects.toThrow('2 MB');
    await expect(
      parseEmlImport(eml('From: sender@example.com\r\nSubject: No date\r\n\r\nCode 481203')),
    ).rejects.toThrow('Date header');
  });
});
