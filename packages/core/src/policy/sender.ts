import type { MailboxMessage } from '../types.js';

export function verifiedMailboxSenderAddress(message: MailboxMessage): string | null {
  if (!message.senderRelay) return message.senderAddress;
  if (message.senderRelay.kind !== 'apple_hide_my_email' || !message.senderAddress) return null;
  const relay = message.senderAddress.toLocaleLowerCase();
  const original = message.senderRelay.originalAddress.toLocaleLowerCase();
  const relayAt = relay.lastIndexOf('@');
  const originalAt = original.lastIndexOf('@');
  if (relayAt <= 0 || relay.slice(relayAt + 1) !== 'icloud.com' || originalAt <= 0) return null;
  const encodedDomain = original.slice(originalAt + 1).replace(/\./g, '_');
  const relayLocal = relay.slice(0, relayAt);
  return new RegExp(
    `(?:^|_)at_${encodedDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:_|$)`,
  ).test(relayLocal)
    ? original
    : null;
}
