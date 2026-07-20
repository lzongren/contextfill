# Test results

Release candidate checked on 2026-07-20 in the local macOS workspace.

| Check                | Command                                                      | Result                                          |
| -------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Fast iteration gate  | `npm run check`                                              | 12 files, 39 tests plus static checks passed    |
| Unit and integration | `npm test`                                                   | 12 files, 39 tests passed                       |
| TypeScript           | `npm run typecheck`                                          | Passed                                          |
| ESLint               | `npm run lint`                                               | Passed                                          |
| Production builds    | `npm run build`                                              | Demo, MV3 extension, and local service built    |
| MV3 pairing flow     | `npm run test:extension`                                     | Packaged extension paired with loopback service |
| Browser acceptance   | `npm run test:browser`                                       | 5 installed-Chrome tests passed                 |
| Dependency audit     | `npm install`                                                | 0 vulnerabilities reported                      |
| Production audit     | `npm audit --omit=dev --audit-level=moderate`                | 0 vulnerabilities reported                      |
| Native keychain      | Disposable `@napi-rs/keyring` write/read/delete              | macOS backend verified; test item deleted       |
| Live no-key service  | `curl --fail --silent http://127.0.0.1:4318/health`          | `ok: true`, model `gpt-5.6`, configured `false` |
| Full release gate    | `npm run verify`                                             | Passed                                          |
| Package integrity    | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.2.zip` | No errors                                       |
| Companion install    | `npm run test:package`                                       | Fresh install, help, init, no-overwrite passed  |

The browser suite covers legitimate single fill, split fill, no auto-submit, controlled lookalike block, different-service block, expiry block, and an unrelated-numeric empty state. The integration suite separately covers malformed model output and service failure fallback.

No `OPENAI_API_KEY` or provider OAuth credentials were configured during release verification, so neither a paid Responses API request nor a live Gmail/Outlook authorization was made. The GPT path was validated with strict types, mocked SDK output, invented-evidence rejection, service boundary tests, and a production build. Gmail and Outlook were validated with mocked PKCE token exchange, provider API contracts, normalization, keychain restore/fallback tests, and capability-protected service routes. The packaged extension completed a real pairing flow against a temporary loopback service, including Chrome's privileged request behavior. A disposable native macOS Keychain item completed write/read/delete successfully. The companion `.tgz` was installed from scratch; its executable passed help, mode-600 initialization, no-overwrite, startup, and live `/health` checks. Live user-owned provider OAuth remains the next beta validation step.

## Packaged artifact

- Path: `artifacts/contextfill-extension-v0.2.0-beta.2.zip`
- Size: 125,463 bytes
- Local SHA-256: `783303bda5edf50ce131668387a67e9eb18eec27e3df975d807ac70d46eb6550`
- ZIP contents: root-level `manifest.json`, popup HTML/CSS/JS, content script, and background worker

## Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.2.tgz`
- Size: 875,702 bytes
- Local SHA-256: `9120dff08231b2ce802b7eacd6a3ad8bd225af7168916c554a9f3791daf69592`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license
