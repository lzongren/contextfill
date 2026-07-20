import type {
  CredentialStore,
  StoredCredential,
  StoredPairing,
} from '../../apps/local-service/src/credential-store.js';
import type { MailProvider } from '../../apps/local-service/src/mailbox.js';

export class FakeCredentialStore implements CredentialStore {
  readonly backend = 'os-keychain' as const;
  readonly mailboxes = new Map<MailProvider, StoredCredential>();
  pairing: StoredPairing | null = null;
  fail = false;

  async load(provider: MailProvider): Promise<StoredCredential | null> {
    if (this.fail) throw new Error('Keychain unavailable');
    return this.mailboxes.get(provider) ?? null;
  }

  async save(provider: MailProvider, credential: StoredCredential): Promise<void> {
    if (this.fail) throw new Error('Keychain unavailable');
    this.mailboxes.set(provider, structuredClone(credential));
  }

  async delete(provider: MailProvider): Promise<void> {
    if (this.fail) throw new Error('Keychain unavailable');
    this.mailboxes.delete(provider);
  }

  async loadPairing(): Promise<StoredPairing | null> {
    if (this.fail) throw new Error('Keychain unavailable');
    return this.pairing ? structuredClone(this.pairing) : null;
  }

  async savePairing(pairing: StoredPairing): Promise<void> {
    if (this.fail) throw new Error('Keychain unavailable');
    this.pairing = structuredClone(pairing);
  }

  async deletePairing(): Promise<void> {
    if (this.fail) throw new Error('Keychain unavailable');
    this.pairing = null;
  }
}
