import {
  applyExplicitFill,
  extractInboxDeterministic,
  findContextField,
  messagesForScenario,
  rankCandidates,
  type PageContext,
} from '../../../packages/core/src/index.js';
import './styles.css';

type Scenario = {
  id: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  hostname: string;
  service: string;
  kind: 'single' | 'split' | 'reference' | 'none';
  expectation: string;
  tone: 'safe' | 'danger' | 'neutral';
};

const scenarios: Scenario[] = [
  {
    id: 'magic-link',
    shortLabel: 'Allow · magic link',
    eyebrow: 'Expected: verified handoff',
    title: 'Check your email to continue',
    description:
      'Cedar Notes sent a one-time sign-in link. ContextFill can verify it without fetching it.',
    hostname: 'login.cedarnotes.test',
    service: 'Cedar Notes',
    kind: 'none',
    expectation:
      'ContextFill should show a masked destination and open the simulated verified link in this same tab only after approval.',
    tone: 'safe',
  },
  {
    id: 'magic-link-lookalike',
    shortLabel: 'Block · link lookalike',
    eyebrow: 'Expected: block',
    title: 'Check your email to continue',
    description:
      'This controlled fixture changes the destination brand spelling from “Cedar Notes” to “Cedar N0tes”.',
    hostname: 'login.cedarn0tes.test',
    service: 'Cedar Notes',
    kind: 'none',
    expectation:
      'ContextFill should block navigation because the initiating site and message link have different registrable domains.',
    tone: 'danger',
  },
  {
    id: 'reference',
    shortLabel: 'Allow · reference',
    eyebrow: 'Expected: trusted transfer',
    title: 'Manage your trip',
    description: 'Enter the booking reference from your Cedar Travel itinerary.',
    hostname: 'trips.cedartravel.test',
    service: 'Cedar Travel',
    kind: 'reference',
    expectation:
      'ContextFill should transfer CT-7K92Q into the labeled booking-reference field only after approval and never submit.',
    tone: 'safe',
  },
  {
    id: 'reference-lookalike',
    shortLabel: 'Block · reference site',
    eyebrow: 'Expected: block',
    title: 'Manage your trip',
    description: 'This controlled fixture adds a deceptive hyphen to the Cedar Travel domain.',
    hostname: 'trips.cedar-travel.test',
    service: 'Cedar Travel',
    kind: 'reference',
    expectation: 'ContextFill should show the mismatch and leave the reference field empty.',
    tone: 'danger',
  },
  {
    id: 'legitimate-single',
    shortLabel: 'Allow · single',
    eyebrow: 'Expected: allow',
    title: 'Confirm your sign-in',
    description: 'Enter the six-digit code sent for this Northstar sign-in.',
    hostname: 'account.northstar.test',
    service: 'Northstar',
    kind: 'single',
    expectation:
      'ContextFill should select 481203, explain the domain match, and fill only after approval.',
    tone: 'safe',
  },
  {
    id: 'legitimate-split',
    shortLabel: 'Allow · split',
    eyebrow: 'Expected: allow',
    title: 'Verify this browser',
    description: 'Enter each digit of the Northstar security code.',
    hostname: 'account.northstar.test',
    service: 'Northstar',
    kind: 'split',
    expectation:
      'ContextFill should fill exactly six adjacent fields in order and leave the form unsubmitted.',
    tone: 'safe',
  },
  {
    id: 'lookalike',
    shortLabel: 'Block · lookalike',
    eyebrow: 'Expected: block',
    title: 'Confirm your sign-in',
    description: 'This controlled fixture swaps the letter “o” for the digit “0”.',
    hostname: 'account.n0rthstar.test',
    service: 'Northstar',
    kind: 'single',
    expectation:
      'ContextFill should identify a different registrable domain and expose no Fill action.',
    tone: 'danger',
  },
  {
    id: 'mismatch',
    shortLabel: 'Block · service',
    eyebrow: 'Expected: block',
    title: 'Confirm your Northstar sign-in',
    description: 'The synthetic inbox slice contains only a recent BlueRail code.',
    hostname: 'account.northstar.test',
    service: 'Northstar',
    kind: 'single',
    expectation: 'ContextFill should explain that the page and claimed service differ.',
    tone: 'danger',
  },
  {
    id: 'expired',
    shortLabel: 'Block · expired',
    eyebrow: 'Expected: block',
    title: 'Confirm your sign-in',
    description: 'The only verification message is past its explicit expiration time.',
    hostname: 'account.northstar.test',
    service: 'Northstar',
    kind: 'single',
    expectation: 'ContextFill should report expiration and never mutate the field.',
    tone: 'danger',
  },
  {
    id: 'ambiguous',
    shortLabel: 'Warn · sender',
    eyebrow: 'Expected: warn',
    title: 'Confirm your sign-in',
    description:
      'The message references Northstar, but its sender uses a different registrable domain.',
    hostname: 'account.northstar.test',
    service: 'Northstar',
    kind: 'single',
    expectation:
      'ContextFill should require an explicit caution acknowledgement before an override is possible.',
    tone: 'neutral',
  },
  {
    id: 'empty',
    shortLabel: 'Empty',
    eyebrow: 'Expected: empty',
    title: 'Confirm your sign-in',
    description: 'The inbox slice contains only an unrelated receipt with several numbers.',
    hostname: 'account.northstar.test',
    service: 'Northstar',
    kind: 'single',
    expectation: 'ContextFill should offer no candidate and leave the page unchanged.',
    tone: 'neutral',
  },
  {
    id: 'magic-link-complete',
    shortLabel: 'Magic link · complete',
    eyebrow: 'Synthetic handoff complete',
    title: 'You continued in the same tab',
    description:
      'The judge fixture maps the non-resolving .test destination to this clearly labeled local completion page.',
    hostname: 'login.cedarnotes.test',
    service: 'Cedar Notes',
    kind: 'none',
    expectation:
      'This page proves explicit same-tab handoff without pretending localhost is the real destination.',
    tone: 'safe',
  },
];

const selectedId =
  new URLSearchParams(window.location.search).get('scenario') ?? 'legitimate-single';
const selected = scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0]!;

function setFixtureMetadata(scenario: Scenario): void {
  document.documentElement.dataset.contextfillHost = scenario.hostname;
  document.body.dataset.contextfillHost = scenario.hostname;
  document.body.dataset.contextfillService = scenario.service;
  document.body.dataset.contextfillScenario = scenario.id;
  const metaEntries: Array<[string, string]> = [
    ['contextfill-simulated-host', scenario.hostname],
    ['contextfill-service', scenario.service],
    ['contextfill-scenario', scenario.id],
  ];
  for (const [name, value] of metaEntries) {
    const meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
    if (meta) meta.content = value;
  }
}

function fieldMarkup(kind: Scenario['kind']): string {
  if (kind === 'none')
    return '<p class="no-field">This fixture intentionally has no verification field.</p>';
  if (kind === 'split') {
    return `<fieldset class="split-field" data-contextfill-split>
      <legend>Verification code</legend>
      <div class="digit-row">
        ${Array.from({ length: 6 }, (_, index) => `<input type="text" inputmode="numeric" maxlength="1" autocomplete="${index === 0 ? 'one-time-code' : 'off'}" aria-label="Digit ${index + 1} of 6" />`).join('')}
      </div>
    </fieldset>`;
  }
  if (kind === 'reference') {
    return `<label class="code-field" for="bookingReference">
      Booking reference
      <input id="bookingReference" name="bookingReference" type="text" maxlength="20" autocomplete="off" placeholder="Example: AB-12CDE" />
    </label>`;
  }
  return `<label class="code-field" for="verificationCode">
    Verification code
    <input id="verificationCode" name="verificationCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" />
  </label>`;
}

function navMarkup(): string {
  return scenarios
    .map(
      (
        scenario,
      ) => `<a class="scenario-link ${scenario.id === selected.id ? 'is-active' : ''}" href="?scenario=${scenario.id}" ${scenario.id === selected.id ? 'aria-current="page"' : ''}>
        <span class="scenario-dot scenario-dot--${scenario.tone}"></span>${scenario.shortLabel}
      </a>`,
    )
    .join('');
}

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="?scenario=legitimate-single" aria-label="ContextFill judge lab home">
      <span class="brand-mark" aria-hidden="true"><span></span></span>
      <span>ContextFill</span><small>Judge Lab</small>
    </a>
    <div class="privacy-pill"><span aria-hidden="true">●</span> Synthetic data only</div>
  </header>
  <main>
    <aside class="lab-panel" aria-label="Demo scenarios">
      <p class="section-kicker">Deterministic fixtures</p>
      <h1>Trust should be visible.</h1>
      <p>Switch scenarios, then open the ContextFill extension. Localhost never pretends to be the simulated domain.</p>
      <nav>${navMarkup()}</nav>
      <div class="lab-note">
        <strong>Quick judge path</strong>
        <span>Run Allow · magic link, Block · link lookalike, then Allow · reference. No account or API key required.</span>
      </div>
    </aside>
    <section class="stage">
      <div class="simulation-banner" role="note">
        <span>SIMULATED ACTIVE DOMAIN</span>
        <code>${selected.hostname}</code>
        <small>served from ${window.location.host}</small>
      </div>
      <article class="service-card service-card--${selected.tone}">
        <div class="service-brand"><span class="service-glyph" aria-hidden="true">${selected.service.slice(0, 1)}</span><span>${selected.service}</span></div>
        <p class="eyebrow">${selected.eyebrow}</p>
        <h2>${selected.title}</h2>
        <p class="lead">${selected.description}</p>
        ${
          selected.kind === 'none'
            ? `<div class="email-waiting" role="status">
                <span aria-hidden="true">↗</span>
                <strong>${selected.id === 'magic-link-complete' ? 'Verified handoff completed' : 'Waiting for your explicit email action'}</strong>
                <p>${selected.id === 'magic-link-complete' ? 'No form was submitted and no link was prefetched.' : 'Open ContextFill to inspect the message and destination locally.'}</p>
              </div>`
            : `<form id="verification-form" novalidate>
                ${fieldMarkup(selected.kind)}
                <label class="remember"><input id="remember" type="checkbox" /> Remember this browser</label>
                <button class="verify-button" type="submit">Verify &amp; continue</button>
                <p id="submit-status" class="submit-status" role="status">The form has not been submitted.</p>
              </form>`
        }
        <div class="fixture-expectation">
          <span>Fixture contract</span>
          <p>${selected.expectation}</p>
        </div>
      </article>
    </section>
  </main>`;

setFixtureMetadata(selected);

const form = document.querySelector<HTMLFormElement>('#verification-form');
if (form) {
  form.dataset.submitCount = '0';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const count = Number(form.dataset.submitCount ?? 0) + 1;
    form.dataset.submitCount = String(count);
    document.querySelector('#submit-status')!.textContent =
      `Manual submit clicked ${count} time${count === 1 ? '' : 's'}.`;
  });
}

function pageContext(): PageContext {
  const target = findContextField(document);
  return {
    hostname: selected.hostname,
    serviceHint: selected.service,
    simulated: true,
    scenario: selected.id,
    fieldKind: target?.kind ?? 'none',
    fieldCount: target?.elements.length ?? 0,
  };
}

window.contextFillHarness = {
  inspect() {
    const page = pageContext();
    const candidates = extractInboxDeterministic(messagesForScenario(selected.id));
    const ranked = rankCandidates(candidates, page);
    return {
      decision: ranked[0]?.policy.decision ?? 'empty',
      reasonCode: ranked[0]?.policy.reasonCode ?? 'no_candidate',
      fieldKind: page.fieldKind,
      fieldCount: page.fieldCount,
    };
  },
  fill() {
    const target = findContextField(document);
    if (!target) return false;
    const page = pageContext();
    const ranked = rankCandidates(
      extractInboxDeterministic(messagesForScenario(selected.id)),
      page,
    );
    const first = ranked[0];
    if (!first?.candidate.value) return false;
    return applyExplicitFill(first.policy, target, first.candidate.value);
  },
};

declare global {
  interface Window {
    contextFillHarness: {
      inspect: () => {
        decision: string;
        reasonCode: string;
        fieldKind: string;
        fieldCount: number;
      };
      fill: () => boolean;
    };
  }
}
