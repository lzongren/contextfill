import { z } from 'zod';
import { siteAccessRequest } from './site-access.js';

export const automationModeSchema = z.enum(['manual', 'assisted', 'auto']);
export type AutomationMode = z.infer<typeof automationModeSchema>;

export const automationSiteRuleSchema = z
  .object({
    hostname: z.string().trim().min(1).max(253),
    originPattern: z.string().trim().min(1).max(320),
    mode: z.enum(['assisted', 'auto']),
    enabledAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type AutomationSiteRule = z.infer<typeof automationSiteRuleSchema>;

export const activityRecordSchema = z
  .object({
    id: z.string().min(1).max(160),
    hostname: z.string().trim().min(1).max(253),
    candidateType: z.enum(['otp', 'magic_link', 'none']),
    action: z.enum(['blocked', 'cancelled', 'filled', 'opened', 'error']),
    reasonCode: z.string().trim().min(1).max(80),
    occurredAt: z.string().datetime(),
  })
  .strict();

export type ActivityRecord = z.infer<typeof activityRecordSchema>;

const ruleListSchema = z.array(automationSiteRuleSchema).max(100);
const activityListSchema = z.array(activityRecordSchema).max(50);
const RULES_KEY = 'automationSiteRules';
const HISTORY_KEY = 'automationActivityHistory';
const HISTORY_LIMIT = 24;
const HISTORY_TTL_MS = 7 * 24 * 60 * 60_000;

function canonicalHostname(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\.$/, '');
}

export function automationIdentity(url: string | undefined): {
  hostname: string;
  originPattern: string;
} | null {
  const request = siteAccessRequest(url);
  if (!request) return null;
  return {
    hostname: canonicalHostname(request.hostname),
    originPattern: request.originPattern,
  };
}

export function parseAutomationRules(value: unknown): AutomationSiteRule[] {
  const parsed = ruleListSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function parseActivityHistory(value: unknown, now = new Date()): ActivityRecord[] {
  const parsed = activityListSchema.safeParse(value);
  if (!parsed.success) return [];
  const cutoff = now.getTime() - HISTORY_TTL_MS;
  return parsed.data.filter((record) => new Date(record.occurredAt).getTime() >= cutoff);
}

export async function loadAutomationRules(): Promise<AutomationSiteRule[]> {
  const stored = await chrome.storage.local.get(RULES_KEY);
  return parseAutomationRules(stored[RULES_KEY]);
}

export async function loadActivityHistory(now = new Date()): Promise<ActivityRecord[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  return parseActivityHistory(stored[HISTORY_KEY], now);
}

export function ruleForUrl(
  rules: AutomationSiteRule[],
  url: string | undefined,
): AutomationSiteRule | null {
  const identity = automationIdentity(url);
  if (!identity) return null;
  return (
    rules.find(
      (rule) =>
        canonicalHostname(rule.hostname) === identity.hostname &&
        rule.originPattern === identity.originPattern,
    ) ?? null
  );
}

export async function saveAutomationMode(
  url: string,
  mode: AutomationMode,
  now = new Date(),
): Promise<AutomationSiteRule | null> {
  const identity = automationIdentity(url);
  if (!identity) throw new Error('Automation is available only on normal HTTP or HTTPS sites.');
  const rules = await loadAutomationRules();
  const existing = ruleForUrl(rules, url);
  const withoutSite = rules.filter(
    (rule) =>
      !(
        canonicalHostname(rule.hostname) === identity.hostname &&
        rule.originPattern === identity.originPattern
      ),
  );
  if (mode === 'manual') {
    await chrome.storage.local.set({ [RULES_KEY]: withoutSite });
    return null;
  }
  const timestamp = now.toISOString();
  const rule = automationSiteRuleSchema.parse({
    ...identity,
    mode,
    enabledAt: existing?.enabledAt ?? timestamp,
    updatedAt: timestamp,
  });
  await chrome.storage.local.set({ [RULES_KEY]: [...withoutSite, rule] });
  return rule;
}

export async function removeAutomationRule(originPattern: string): Promise<AutomationSiteRule[]> {
  const rules = await loadAutomationRules();
  const removed = rules.filter((rule) => rule.originPattern === originPattern);
  const remaining = rules.filter((rule) => rule.originPattern !== originPattern);
  await chrome.storage.local.set({ [RULES_KEY]: remaining });
  return removed;
}

export async function recordActivity(
  input: Omit<ActivityRecord, 'id' | 'occurredAt'>,
  now = new Date(),
): Promise<ActivityRecord> {
  const record = activityRecordSchema.parse({
    ...input,
    id: `${now.getTime()}:${crypto.randomUUID()}`,
    occurredAt: now.toISOString(),
  });
  const history = await loadActivityHistory(now);
  await chrome.storage.local.set({
    [HISTORY_KEY]: [record, ...history].slice(0, HISTORY_LIMIT),
  });
  return record;
}

export async function clearActivityHistory(): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}
