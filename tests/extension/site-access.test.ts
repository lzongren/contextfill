import { describe, expect, it } from 'vitest';
import {
  isMissingHostPermission,
  siteAccessRequest,
} from '../../apps/extension/src/site-access.js';

describe('runtime site access', () => {
  it('derives an exact HTTP(S) host permission without retaining paths or query data', () => {
    expect(
      siteAccessRequest(
        'https://myid.vialto.com/login?ReturnUrl=%2Fconnect%2Fauthorize%2Fcallback',
      ),
    ).toEqual({
      hostname: 'myid.vialto.com',
      originPattern: 'https://myid.vialto.com/*',
    });
    expect(siteAccessRequest('http://127.0.0.1:4173/?scenario=legitimate-single')).toEqual({
      hostname: '127.0.0.1',
      originPattern: 'http://127.0.0.1:4173/*',
    });
  });

  it('rejects privileged, malformed, and missing tab URLs', () => {
    expect(siteAccessRequest('chrome://extensions')).toBeNull();
    expect(siteAccessRequest('file:///private/tmp/message.html')).toBeNull();
    expect(siteAccessRequest('not a url')).toBeNull();
    expect(siteAccessRequest(undefined)).toBeNull();
  });

  it('recognizes Chromium host-permission failures without treating unrelated errors as access issues', () => {
    expect(
      isMissingHostPermission(
        new Error(
          'Cannot access contents of the page. Extension manifest must request permission to access the respective host.',
        ),
      ),
    ).toBe(true);
    expect(isMissingHostPermission(new Error('The mailbox service is unavailable.'))).toBe(false);
    expect(isMissingHostPermission('host permission')).toBe(false);
  });
});
