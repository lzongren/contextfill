import type { ActivityRecord, AutomationSiteRule } from './automation-settings.js';
import type { BackgroundRequest, BackgroundResponse } from './shared/messages.js';

const app = document.querySelector<HTMLElement>('#app')!;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function backgroundMessage(request: BackgroundRequest): Promise<BackgroundResponse> {
  return (await chrome.runtime.sendMessage(request)) as BackgroundResponse;
}

function requireSuccess(response: BackgroundResponse): Extract<BackgroundResponse, { ok: true }> {
  if (!response.ok) throw new Error(response.error);
  return response;
}

function relativeTime(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function activityLabel(record: ActivityRecord): string {
  if (record.action === 'filled') return 'Verified code filled';
  if (record.action === 'opened') return 'Verified link opened';
  if (record.action === 'blocked') return 'Automatic action blocked';
  if (record.action === 'cancelled') return 'Automatic action cancelled';
  return 'Automatic action paused';
}

function renderRules(container: HTMLElement, rules: AutomationSiteRule[]): void {
  container.replaceChildren();
  if (rules.length === 0) {
    container.append(
      element(
        'p',
        'empty',
        'No sites have Assisted or Auto-Continue access. Every new site starts in Manual mode.',
      ),
    );
    return;
  }
  for (const rule of [...rules].sort((a, b) => a.hostname.localeCompare(b.hostname))) {
    const originLabel = rule.originPattern.replace(/\/\*$/, '');
    const row = element('div', 'row');
    const copy = element('div');
    copy.append(element('strong', '', originLabel));
    const meta = element('div', 'meta');
    const badge = element('span', 'badge', rule.mode === 'auto' ? 'Auto-Continue' : 'Assisted');
    meta.append(
      badge,
      document.createTextNode(`Exact-site access · updated ${relativeTime(rule.updatedAt)}`),
    );
    copy.append(meta);
    const remove = element('button', 'button button--danger', 'Revoke');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Revoke ContextFill automation on ${originLabel}`);
    remove.addEventListener('click', () => {
      void (async () => {
        remove.disabled = true;
        try {
          requireSuccess(
            await backgroundMessage({
              type: 'REMOVE_SITE_RULE',
              originPattern: rule.originPattern,
            }),
          );
          await render();
        } catch (error) {
          remove.disabled = false;
          window.alert(error instanceof Error ? error.message : 'Could not revoke this site.');
        }
      })();
    });
    row.append(copy, remove);
    container.append(row);
  }
}

function renderHistory(container: HTMLElement, history: ActivityRecord[]): void {
  container.replaceChildren();
  if (history.length === 0) {
    container.append(element('p', 'empty', 'No recent Auto-Continue activity.'));
    return;
  }
  for (const record of history) {
    const row = element('div', 'row');
    const copy = element('div');
    copy.append(element('strong', '', activityLabel(record)));
    copy.append(
      element(
        'div',
        'meta',
        `${record.hostname} · ${relativeTime(record.occurredAt)} · ${record.reasonCode.replaceAll('_', ' ')}`,
      ),
    );
    row.append(copy);
    container.append(row);
  }
}

async function render(): Promise<void> {
  const overview = requireSuccess(await backgroundMessage({ type: 'GET_AUTOMATION_OVERVIEW' }));
  app.replaceChildren();
  const header = element('header', 'header');
  const hero = element('div');
  const brand = element('div', 'brand');
  const mark = element('span', 'brand-mark');
  mark.setAttribute('aria-hidden', 'true');
  brand.append(mark, document.createTextNode('ContextFill'));
  hero.append(
    brand,
    element('p', 'eyebrow', 'Verified Auto-Continue'),
    element('h1', '', 'Automation you can see and revoke.'),
    element(
      'p',
      'intro',
      'ContextFill runs automatically only on sites listed below. Deterministic trust checks still decide every action, and a visible countdown can be cancelled before execution.',
    ),
  );
  header.append(
    hero,
    element(
      'aside',
      'privacy',
      'Activity records contain no codes, magic-link tokens, message subjects, sender addresses, or page paths. They expire after seven days.',
    ),
  );

  const sites = element('section', 'section');
  const sitesHeading = element('div', 'section-heading');
  const sitesTitle = element('div');
  sitesTitle.append(
    element('h2', '', 'Trusted sites'),
    element('p', '', 'Choose a site in the popup to enable Assisted or Auto-Continue mode.'),
  );
  sitesHeading.append(sitesTitle);
  const sitesList = element('div', 'list');
  sites.append(sitesHeading, sitesList);
  renderRules(sitesList, overview.rules ?? []);

  const activity = element('section', 'section');
  const activityHeading = element('div', 'section-heading');
  const activityTitle = element('div');
  activityTitle.append(
    element('h2', '', 'Privacy-preserving activity'),
    element('p', '', 'Only site, action type, outcome, and time are retained.'),
  );
  const clear = element('button', 'button', 'Clear activity');
  clear.type = 'button';
  clear.disabled = (overview.history ?? []).length === 0;
  clear.addEventListener('click', () => {
    void (async () => {
      requireSuccess(await backgroundMessage({ type: 'CLEAR_ACTIVITY_HISTORY' }));
      await render();
    })();
  });
  activityHeading.append(activityTitle, clear);
  const historyList = element('div', 'list');
  activity.append(activityHeading, historyList);
  renderHistory(historyList, overview.history ?? []);
  app.append(header, sites, activity);
}

void render().catch((error: unknown) => {
  app.replaceChildren(
    element('p', 'eyebrow', 'ContextFill settings'),
    element('h1', '', 'Settings could not be loaded'),
    element(
      'p',
      'intro',
      error instanceof Error ? error.message : 'Reopen this page to try again.',
    ),
  );
});
