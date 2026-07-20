# Test results

Release candidate checked on 2026-07-20 in the local macOS workspace.

| Check                | Command                                                      | Result                                          |
| -------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Fast iteration gate  | `npm run check`                                              | 10 files, 32 tests plus static checks passed    |
| Unit and integration | `npm test`                                                   | 10 files, 32 tests passed                       |
| TypeScript           | `npm run typecheck`                                          | Passed                                          |
| ESLint               | `npm run lint`                                               | Passed                                          |
| Production builds    | `npm run build`                                              | Demo, MV3 extension, and local service built    |
| MV3 load             | `npm run test:extension`                                     | 1 bundled-Chromium extension-load test passed   |
| Browser acceptance   | `npm run test:browser`                                       | 5 installed-Chrome tests passed                 |
| Dependency audit     | `npm install`                                                | 0 vulnerabilities reported                      |
| Production audit     | `npm audit --omit=dev --audit-level=moderate`                | 0 vulnerabilities reported                      |
| Live no-key service  | `curl --fail --silent http://127.0.0.1:4318/health`          | `ok: true`, model `gpt-5.6`, configured `false` |
| Full release gate    | `npm run verify`                                             | Passed                                          |
| Package integrity    | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.1.zip` | No errors                                       |

The browser suite covers legitimate single fill, split fill, no auto-submit, controlled lookalike block, different-service block, expiry block, and an unrelated-numeric empty state. The integration suite separately covers malformed model output and service failure fallback.

No `OPENAI_API_KEY` or provider OAuth credentials were configured during release verification, so neither a paid Responses API request nor a live Gmail/Outlook authorization was made. The GPT path was validated with strict types, mocked SDK output, invented-evidence rejection, service boundary tests, and a production build. Gmail and Outlook were validated with mocked PKCE token exchange, provider API contracts, normalization, strict-origin service tests, and extension source-screen loading. Live user-owned OAuth remains the next beta validation step.

## Packaged artifact

- Path: `artifacts/contextfill-extension-v0.2.0-beta.1.zip`
- Size: 124,519 bytes
- Local SHA-256: `25c7ebbd63f5fd22d248e8cfca8b157af56d7640d6623538c6660226fd8af327`
- ZIP contents: root-level `manifest.json`, popup HTML/CSS/JS, content script, and background worker
