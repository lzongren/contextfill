import { describe, expect, it } from 'vitest';
import { isAllowedAlaskaBookingPage } from '../../apps/extension/src/alaska-policy.js';

describe('Alaska Airlines live activation policy', () => {
  it('allows only the official HTTPS manage-reservation route', () => {
    expect(isAllowedAlaskaBookingPage('https://www.alaskaair.com/booking/reservation-lookup')).toBe(
      true,
    );
    expect(
      isAllowedAlaskaBookingPage(
        'https://alaskaair.com/BOOKING/RESERVATION-LOOKUP?source=manage-trip',
      ),
    ).toBe(true);
  });

  it('rejects lookalikes, other routes, insecure schemes, ports, and credentials', () => {
    expect(
      isAllowedAlaskaBookingPage('https://www.alaskaair-login.com/booking/reservation-lookup'),
    ).toBe(false);
    expect(
      isAllowedAlaskaBookingPage('https://alaskaair.com.example/booking/reservation-lookup'),
    ).toBe(false);
    expect(isAllowedAlaskaBookingPage('http://www.alaskaair.com/booking/reservation-lookup')).toBe(
      false,
    );
    expect(isAllowedAlaskaBookingPage('https://www.alaskaair.com/trips')).toBe(false);
    expect(
      isAllowedAlaskaBookingPage('https://www.alaskaair.com:444/booking/reservation-lookup'),
    ).toBe(false);
    expect(
      isAllowedAlaskaBookingPage('https://user@www.alaskaair.com/booking/reservation-lookup'),
    ).toBe(false);
  });
});
