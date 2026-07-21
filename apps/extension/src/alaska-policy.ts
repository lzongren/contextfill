export const ALASKA_MAX_MESSAGE_AGE_MINUTES = 13 * 31 * 24 * 60;

export function isAllowedAlaskaBookingPage(input: string | null | undefined): boolean {
  if (!input) return false;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    ['alaskaair.com', 'www.alaskaair.com'].includes(url.hostname.toLowerCase()) &&
    url.pathname.toLowerCase() === '/booking/reservation-lookup'
  );
}
