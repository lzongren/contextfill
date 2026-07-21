import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activityRecordSchema,
  automationIdentity,
  loadAutomationRules,
  parseActivityHistory,
  removeAutomationRule,
  saveAutomationMode,
} from '../../apps/extension/src/automation-settings.js';

afterEach(() => vi.unstubAllGlobals());

function mockStorage(): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: values[key] })),
        set: vi.fn(async (updates: Record<string, unknown>) => Object.assign(values, updates)),
      },
    },
  });
  return values;
}

describe('Auto-Continue settings', () => {
  it('derives exact-site identities without retaining paths or query parameters', () => {
    expect(automationIdentity('https://medium.com/m/signin?next=%2Fme')).toEqual({
      hostname: 'medium.com',
      originPattern: 'https://medium.com/*',
    });
    expect(automationIdentity('chrome://extensions')).toBeNull();
  });

  it('preserves the first opt-in time while changing mode and removes the rule in Manual mode', async () => {
    mockStorage();
    const url = 'https://medium.com/m/signin';
    const first = await saveAutomationMode(url, 'assisted', new Date('2026-07-21T08:00:00Z'));
    const second = await saveAutomationMode(url, 'auto', new Date('2026-07-21T08:10:00Z'));
    expect(first?.enabledAt).toBe('2026-07-21T08:00:00.000Z');
    expect(second).toMatchObject({
      mode: 'auto',
      enabledAt: '2026-07-21T08:00:00.000Z',
      updatedAt: '2026-07-21T08:10:00.000Z',
    });
    expect(await loadAutomationRules()).toHaveLength(1);
    await saveAutomationMode(url, 'manual', new Date('2026-07-21T08:20:00Z'));
    expect(await loadAutomationRules()).toEqual([]);
  });

  it('revokes only the exact stored origin when hostnames are shared', async () => {
    const storage = mockStorage();
    storage.automationSiteRules = [
      {
        hostname: 'example.com',
        originPattern: 'https://example.com/*',
        mode: 'auto',
        enabledAt: '2026-07-21T08:00:00.000Z',
        updatedAt: '2026-07-21T08:00:00.000Z',
      },
      {
        hostname: 'example.com',
        originPattern: 'http://example.com:8080/*',
        mode: 'assisted',
        enabledAt: '2026-07-21T08:00:00.000Z',
        updatedAt: '2026-07-21T08:00:00.000Z',
      },
    ];
    const removed = await removeAutomationRule('https://example.com/*');
    expect(removed.map((rule) => rule.originPattern)).toEqual(['https://example.com/*']);
    expect(storage.automationSiteRules).toEqual([
      expect.objectContaining({ originPattern: 'http://example.com:8080/*' }),
    ]);
  });

  it('rejects activity records containing secret values and expires metadata after seven days', () => {
    const base = {
      id: 'activity-1',
      hostname: 'medium.com',
      candidateType: 'magic_link' as const,
      action: 'opened' as const,
      reasonCode: 'aligned',
      occurredAt: '2026-07-20T08:00:00.000Z',
    };
    expect(activityRecordSchema.safeParse({ ...base, value: 'private-token' }).success).toBe(false);
    expect(parseActivityHistory([base], new Date('2026-07-21T08:00:00Z'))).toEqual([base]);
    expect(parseActivityHistory([base], new Date('2026-07-28T08:00:01Z'))).toEqual([]);
  });
});
