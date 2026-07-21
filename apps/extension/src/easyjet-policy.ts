export const EASYJET_MAX_MESSAGE_AGE_MINUTES = 5 * 365 * 24 * 60;

export function isAllowedEasyJetBookingPage(input: string | null | undefined): boolean {
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
    ['easyjet.com', 'www.easyjet.com'].includes(url.hostname.toLowerCase()) &&
    (url.pathname === '/en' || url.pathname === '/en/') &&
    url.searchParams.get('accntmdl') === '2'
  );
}
