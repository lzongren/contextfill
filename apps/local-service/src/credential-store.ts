import { AsyncEntry } from '@napi-rs/keyring';
import { z } from 'zod';
import type { MailProvider } from './mailbox.js';

const serviceName = 'ContextFill Mailbox OAuth';

const storedCredentialSchema = z
  .object({
    version: z.literal(1),
    refreshToken: z.string().min(1),
    account: z.string().max(320).nullable(),
  })
  .strict();

export type StoredCredential = z.infer<typeof storedCredentialSchema>;

const storedPairingSchema = z
  .object({
    version: z.literal(1),
    extensionOrigin: z.string().regex(/^chrome-extension:\/\/[a-p]{32}$/),
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type StoredPairing = z.infer<typeof storedPairingSchema>;

export type CredentialStore = {
  readonly backend: 'os-keychain';
  load(provider: MailProvider): Promise<StoredCredential | null>;
  save(provider: MailProvider, credential: StoredCredential): Promise<void>;
  delete(provider: MailProvider): Promise<void>;
  loadPairing(): Promise<StoredPairing | null>;
  savePairing(pairing: StoredPairing): Promise<void>;
  deletePairing(): Promise<void>;
};

export class KeyringCredentialStore implements CredentialStore {
  readonly backend = 'os-keychain' as const;

  private entry(account: string): AsyncEntry {
    return new AsyncEntry(serviceName, account);
  }

  async load(provider: MailProvider): Promise<StoredCredential | null> {
    const raw = await this.entry(`mailbox:${provider}`).getPassword();
    if (!raw) return null;
    try {
      const parsed = storedCredentialSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async save(provider: MailProvider, credential: StoredCredential): Promise<void> {
    await this.entry(`mailbox:${provider}`).setPassword(
      JSON.stringify(storedCredentialSchema.parse(credential)),
    );
  }

  async delete(provider: MailProvider): Promise<void> {
    await this.entry(`mailbox:${provider}`).deletePassword();
  }

  async loadPairing(): Promise<StoredPairing | null> {
    const raw = await this.entry('companion-pairing').getPassword();
    if (!raw) return null;
    try {
      const parsed = storedPairingSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async savePairing(pairing: StoredPairing): Promise<void> {
    await this.entry('companion-pairing').setPassword(
      JSON.stringify(storedPairingSchema.parse(pairing)),
    );
  }

  async deletePairing(): Promise<void> {
    await this.entry('companion-pairing').deletePassword();
  }
}

export function createCredentialStore(): CredentialStore {
  return new KeyringCredentialStore();
}
