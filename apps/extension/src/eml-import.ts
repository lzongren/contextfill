import PostalMime, { type Address, type Mailbox } from 'postal-mime';
import { mailboxMessageSchema, type MailboxMessage } from '../../../packages/core/src/index.js';

export const MAX_EML_BYTES = 2 * 1024 * 1024;

export class EmlImportError extends Error {}

function compact(value: string | undefined, maximum: number): string | null {
  const normalized = value
    ?.replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

function isMailbox(address: Address | undefined): address is Mailbox {
  return Boolean(address && !('group' in address));
}

function firstMailbox(address: Address | undefined): Mailbox | null {
  if (!address) return null;
  if (isMailbox(address)) return address;
  return address.group[0] ?? null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function htmlToText(html: string): string {
  const inert = html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ');
  const links = [...inert.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)]
    .map((match) => decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim())
    .filter((href) => /^https?:\/\//i.test(href));
  const text = decodeEntities(
    inert
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/(?:p|div|li|tr|td|th|h[1-6])\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
  return [text, ...links].join('\n');
}

function inferExpiresAt(body: string, receivedAt: string): string | null {
  const duration = body.match(
    /\b(?:expires?|valid)(?:\s+(?:in|for))?\s+(\d{1,3})\s*(minutes?|mins?|hours?|hrs?)\b/i,
  );
  if (!duration?.[1] || !duration[2]) return null;
  const amount = Number(duration[1]);
  const multiplier = /^h/i.test(duration[2]) ? 60 * 60_000 : 60_000;
  const received = new Date(receivedAt).getTime();
  if (!Number.isFinite(received) || amount < 1 || amount > 1440) return null;
  return new Date(received + amount * multiplier).toISOString();
}

async function importId(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `import:${hex.slice(0, 40)}`;
}

async function readFile(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error('Unexpected file reader result.')),
    );
    reader.addEventListener('error', () => reject(reader.error ?? new Error('File read failed.')));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseEmlImport(file: File): Promise<MailboxMessage> {
  if (file.size < 1) throw new EmlImportError('Choose a non-empty .eml message file.');
  if (file.size > MAX_EML_BYTES) {
    throw new EmlImportError('The email is larger than the 2 MB import limit.');
  }
  if (!file.name.toLowerCase().endsWith('.eml')) {
    throw new EmlImportError('Choose an exported email with the .eml extension.');
  }

  try {
    const bytes = new Uint8Array(await readFile(file));
    const email = await PostalMime.parse(bytes, {
      maxNestingDepth: 30,
      maxHeadersSize: 256 * 1024,
      rfc822Attachments: true,
      attachmentEncoding: 'arraybuffer',
    });
    const subject = compact(email.subject, 500);
    if (!subject) throw new EmlImportError('The imported email has no subject.');
    if (!email.date) throw new EmlImportError('The imported email has no Date header.');
    const received = new Date(email.date);
    if (!Number.isFinite(received.getTime())) {
      throw new EmlImportError('The imported email has an invalid Date header.');
    }
    const receivedAt = received.toISOString();
    const body = compact(
      [email.text ?? '', email.html ? htmlToText(email.html) : ''].filter(Boolean).join('\n'),
      10_000,
    );
    if (!body) throw new EmlImportError('The imported email has no readable message body.');
    const sender = firstMailbox(email.from) ?? firstMailbox(email.sender);
    const normalized = mailboxMessageSchema.safeParse({
      id: await importId(bytes),
      source: 'import',
      senderName: compact(sender?.name, 320),
      senderAddress: compact(sender?.address, 320)?.toLowerCase() ?? null,
      subject,
      body,
      receivedAt,
      expiresAt: inferExpiresAt(body, receivedAt),
      serviceHint: null,
    });
    if (!normalized.success) {
      throw new EmlImportError('The imported email contains unsupported sender or message data.');
    }
    return normalized.data;
  } catch (error) {
    if (error instanceof EmlImportError) throw error;
    throw new EmlImportError('ContextFill could not parse this .eml message.');
  }
}
