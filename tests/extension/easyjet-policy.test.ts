import { describe, expect, it } from 'vitest';
import { isAllowedEasyJetBookingPage } from '../../apps/extension/src/easyjet-policy.js';

describe('easyJet live activation policy', () => {
  it('allows only the official HTTPS booking-dialog route', () => {
    expect(isAllowedEasyJetBookingPage('https://www.easyjet.com/en?accntmdl=2')).toBe(true);
    expect(isAllowedEasyJetBookingPage('https://easyjet.com/en/?accntmdl=2')).toBe(true);
  });

  it('rejects lookalikes, other routes, insecure schemes, and missing dialog intent', () => {
    expect(isAllowedEasyJetBookingPage('https://www.easyjet-login.com/en?accntmdl=2')).toBe(false);
    expect(isAllowedEasyJetBookingPage('https://easyjet.com.example/en?accntmdl=2')).toBe(false);
    expect(isAllowedEasyJetBookingPage('http://www.easyjet.com/en?accntmdl=2')).toBe(false);
    expect(isAllowedEasyJetBookingPage('https://www.easyjet.com/en/manage/my-bookings')).toBe(
      false,
    );
    expect(isAllowedEasyJetBookingPage('https://www.easyjet.com/en?accntmdl=1')).toBe(false);
  });
});
