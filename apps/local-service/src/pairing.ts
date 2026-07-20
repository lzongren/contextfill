import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  createCredentialStore,
  type CredentialStore,
  type StoredPairing,
} from './credential-store.js';

const extensionOriginSchema = z.string().regex(/^chrome-extension:\/\/[a-p]{32}$/);
export const pairingCodeSchema = z.string().regex(/^\d{6}$/);
export const pairingSecretSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type PairingStatus = {
  mode: 'unpaired' | 'paired' | 'legacy-env';
  authenticated: boolean;
  persistent: boolean;
};

export type PairingResult =
  { ok: true } | { ok: false; error: string; message: string; status: 400 | 401 | 403 | 429 | 503 };

type PendingCode = {
  code: string;
  expiresAt: number;
  failedAttempts: number;
};

function tokenHash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function sameToken(expectedHex: string, secret: string | undefined): boolean {
  if (!secret || !pairingSecretSchema.safeParse(secret).success) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const received = Buffer.from(tokenHash(secret), 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export class PairingManager {
  private pairing: StoredPairing | null = null;
  private pending: PendingCode | null = null;
  private initialization: Promise<void> | null = null;
  private persistent = true;

  constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly credentialStore: CredentialStore = createCredentialStore(),
    private readonly now: () => number = Date.now,
    private readonly makeCode: () => string = () => String(randomInt(100_000, 1_000_000)),
  ) {}

  async bootstrapCode(): Promise<string | null> {
    await this.initialize();
    if (this.legacyOrigin() || this.pairing) return null;
    if (!this.pending || this.pending.expiresAt <= this.now()) {
      this.pending = {
        code: this.makeCode(),
        expiresAt: this.now() + 10 * 60_000,
        failedAttempts: 0,
      };
    }
    return this.pending.code;
  }

  async status(origin: string | undefined, secret: string | undefined): Promise<PairingStatus> {
    await this.initialize();
    const legacy = this.legacyOrigin();
    if (legacy) {
      return {
        mode: 'legacy-env',
        authenticated: origin === legacy,
        persistent: false,
      };
    }
    return {
      mode: this.pairing ? 'paired' : 'unpaired',
      authenticated: Boolean(
        this.pairing &&
        origin === this.pairing.extensionOrigin &&
        sameToken(this.pairing.tokenHash, secret),
      ),
      persistent: Boolean(this.pairing && this.persistent),
    };
  }

  async authorize(origin: string | undefined, secret: string | undefined): Promise<PairingResult> {
    const status = await this.status(origin, secret);
    if (status.authenticated) return { ok: true };
    return {
      ok: false,
      error: 'pairing_required',
      message:
        status.mode === 'paired'
          ? 'This extension is not paired with the ContextFill companion service.'
          : 'Pair ContextFill with the companion service before accessing mailbox data.',
      status: 401,
    };
  }

  async pair(origin: string | undefined, code: string, secret: string): Promise<PairingResult> {
    await this.initialize();
    if (!extensionOriginSchema.safeParse(origin).success) {
      return {
        ok: false,
        error: 'invalid_extension_origin',
        message: 'Pairing is available only to a Chrome extension origin.',
        status: 403,
      };
    }
    if (
      !pairingCodeSchema.safeParse(code).success ||
      !pairingSecretSchema.safeParse(secret).success
    ) {
      return {
        ok: false,
        error: 'invalid_pairing_request',
        message: 'Enter the six-digit terminal code and try again.',
        status: 400,
      };
    }
    if (this.legacyOrigin()) {
      return {
        ok: false,
        error: 'legacy_pairing_configured',
        message: 'Remove CONTEXTFILL_EXTENSION_ID to use capability pairing.',
        status: 503,
      };
    }
    if (this.pairing) {
      return {
        ok: false,
        error: 'already_paired',
        message: 'The companion service is already paired with an extension installation.',
        status: 403,
      };
    }
    const pending = this.pending;
    if (!pending || pending.expiresAt <= this.now()) {
      this.pending = null;
      return {
        ok: false,
        error: 'pairing_code_expired',
        message: 'The pairing code expired. Restart the service to generate a new code.',
        status: 401,
      };
    }
    if (pending.failedAttempts >= 5) {
      return {
        ok: false,
        error: 'pairing_rate_limited',
        message: 'Too many pairing attempts. Restart the service to generate a new code.',
        status: 429,
      };
    }
    if (code !== pending.code) {
      pending.failedAttempts += 1;
      return {
        ok: false,
        error: 'invalid_pairing_code',
        message: 'The pairing code did not match.',
        status: 401,
      };
    }
    const pairing: StoredPairing = {
      version: 1,
      extensionOrigin: origin!,
      tokenHash: tokenHash(secret),
    };
    try {
      await this.credentialStore.savePairing(pairing);
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
    this.pairing = pairing;
    this.pending = null;
    return { ok: true };
  }

  async reset(): Promise<void> {
    await this.initialize();
    this.pairing = null;
    this.pending = null;
    try {
      await this.credentialStore.deletePairing();
    } catch {
      this.persistent = false;
    }
  }

  private async initialize(): Promise<void> {
    if (!this.initialization) this.initialization = this.restore();
    await this.initialization;
  }

  private async restore(): Promise<void> {
    if (this.legacyOrigin()) return;
    if (this.environment.CONTEXTFILL_PAIRING_RESET === '1') {
      try {
        await this.credentialStore.deletePairing();
      } catch {
        this.persistent = false;
      }
      return;
    }
    try {
      this.pairing = await this.credentialStore.loadPairing();
    } catch {
      this.persistent = false;
    }
  }

  private legacyOrigin(): string | null {
    const extensionId = this.environment.CONTEXTFILL_EXTENSION_ID?.trim();
    return extensionId && /^[a-p]{32}$/.test(extensionId)
      ? `chrome-extension://${extensionId}`
      : null;
  }
}

export function createPairingManager(): PairingManager {
  return new PairingManager();
}
