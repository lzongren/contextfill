# Test results

Release candidate checked on 2026-07-20 in the local macOS workspace.

| Check                | Command                                                      | Result                                          |
| -------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Fast iteration gate  | `npm run check`                                              | 13 files, 49 tests plus static checks passed    |
| Unit and integration | `npm test`                                                   | 13 files, 49 tests passed                       |
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
| Package integrity    | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.5.zip` | No errors                                       |
| Companion install    | `npm run test:package`                                       | Guided setup, doctor, startup, health passed    |

The browser suite covers legitimate single fill, split fill, no auto-submit, controlled lookalike block, different-service block, expiry block, and an unrelated-numeric empty state. The integration suite separately covers malformed model output, service failure fallback, and a real RFC 5322 import through extraction and deterministic trust policy. Import tests also cover HTML-only link evidence, active-content exclusion, invalid metadata, wrong extensions, and the 2 MB limit. The packaged extension test confirms the import control, one-time companion pairing, and actionable Gmail/Outlook setup links. Readiness tests verify exact callback reporting, Outlook-ready/Gmail-missing states, secret-value omission, callback-port rejection, runtime-derived Outlook instructions, validated public-client configuration, unrelated-setting preservation, duplicate removal, and mode-600 output.

No `OPENAI_API_KEY` or provider OAuth credentials were configured during release verification, so neither a paid Responses API request nor a live Gmail/Outlook authorization was made. The GPT path was validated with strict types, mocked SDK output, invented-evidence rejection, service boundary tests, and a production build. Gmail and Outlook were validated with mocked PKCE token exchange, provider API contracts, normalization, keychain restore/fallback tests, and capability-protected service routes. The packaged extension completed a real pairing flow against a temporary loopback service, including Chrome's privileged request behavior. A disposable native macOS Keychain item completed write/read/delete successfully. The companion `.tgz` was installed from scratch; its executable passed help, mode-600 initialization, guided Outlook setup, doctor failure/success, no-overwrite, actual startup, and a live `/health` check. Live user-owned provider OAuth remains the next beta validation step.

## Packaged artifact

- Path: `artifacts/contextfill-extension-v0.2.0-beta.5.zip`
- Size: 149,038 bytes
- Local SHA-256: `670329325973e22b1bc4405c48dcb5183b7b54fc8451b4038b86cb9b6fd556f4`
- ZIP contents: root-level `manifest.json`, popup HTML/CSS/JS, content script, and background worker

## Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.5.tgz`
- Size: 883,004 bytes
- Local SHA-256: `735310d5c8cd8cb789d440033d376b8a770762564554494732fe8201ea04dd66`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license
