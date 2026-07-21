export const capsuleFixtureOrigins = new Set(['http://127.0.0.1:4173', 'http://127.0.0.1:4179']);

const capsuleFixtures = new Map<string, { hostname: string; service: string }>([
  ['capsule', { hostname: 'checkin.aurelia-air.test', service: 'Aurelia Air' }],
  ['capsule-lookalike', { hostname: 'checkin.aureliaair.test', service: 'Aurelia Air' }],
  ['capsule-decoy', { hostname: 'checkin.aurelia-air.test', service: 'Aurelia Air' }],
  ['capsule-conflict', { hostname: 'checkin.aurelia-air.test', service: 'Aurelia Air' }],
  ['capsule-stale', { hostname: 'checkin.aurelia-air.test', service: 'Aurelia Air' }],
  ['capsule-non-empty', { hostname: 'checkin.aurelia-air.test', service: 'Aurelia Air' }],
  ['capsule-reduced-motion', { hostname: 'checkin.aurelia-air.test', service: 'Aurelia Air' }],
]);

export function isAllowedCapsuleFixture(
  origin: string,
  pathname: string,
  scenario: string | null,
  simulatedHostname: string | null,
  service: string | null,
): boolean {
  if (!capsuleFixtureOrigins.has(origin) || pathname !== '/' || !scenario) return false;
  const fixture = capsuleFixtures.get(scenario);
  return Boolean(fixture && fixture.hostname === simulatedHostname && fixture.service === service);
}
