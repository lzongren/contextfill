# Test results

Release candidate checked on 2026-07-20 in the local macOS workspace.

| Check                | Command                                               | Result                                          |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Fast iteration gate  | `npm run check`                                       | 9 files, 26 tests plus static checks passed     |
| Unit and integration | `npm test`                                            | 9 files, 26 tests passed                        |
| TypeScript           | `npm run typecheck`                                   | Passed                                          |
| ESLint               | `npm run lint`                                        | Passed                                          |
| Production builds    | `npm run build`                                       | Demo, MV3 extension, and local service built    |
| MV3 load             | `npm run test:extension`                              | 1 bundled-Chromium extension-load test passed   |
| Browser acceptance   | `npm run test:browser`                                | 5 installed-Chrome tests passed                 |
| Dependency audit     | `npm install`                                         | 0 vulnerabilities reported                      |
| Production audit     | `npm audit --omit=dev --audit-level=moderate`         | 0 vulnerabilities reported                      |
| Live no-key service  | `curl --fail --silent http://127.0.0.1:4318/health`   | `ok: true`, model `gpt-5.6`, configured `false` |
| Full release gate    | `npm run verify`                                      | Passed                                          |
| Package integrity    | `unzip -t artifacts/contextfill-extension-v0.1.0.zip` | No errors                                       |

The browser suite covers legitimate single fill, split fill, no auto-submit, controlled lookalike block, different-service block, expiry block, and an unrelated-numeric empty state. The integration suite separately covers malformed model output and service failure fallback.

No `OPENAI_API_KEY` was configured during release verification, so a real paid Responses API request was not made. The GPT path was validated with strict types, mocked SDK output, invented-evidence rejection, service boundary tests, and a production build. Live validation remains an optional pre-recording step for the repository owner.

## Packaged artifact

- Path: `artifacts/contextfill-extension-v0.1.0.zip`
- Size on disk: approximately 120 KB
- SHA-256: `bbb516757211eb2991ec967b347d7145dfe7276f1080ac484c6e4c7e5dca4ca0`
- ZIP contents: root-level `manifest.json`, popup HTML/CSS/JS, content script, and background worker
