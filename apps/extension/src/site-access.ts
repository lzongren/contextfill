export type SiteAccessRequest = {
  hostname: string;
  originPattern: string;
};

export function siteAccessRequest(urlInput: string | undefined): SiteAccessRequest | null {
  if (!urlInput) return null;
  try {
    const url = new URL(urlInput);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
    return {
      hostname: url.hostname,
      originPattern: `${url.protocol}//${url.hostname}/*`,
    };
  } catch {
    return null;
  }
}

export function isMissingHostPermission(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /cannot access contents|host permission|manifest must request permission/i.test(
    error.message,
  );
}
