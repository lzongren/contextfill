# Test results

Release candidate checked on 2026-07-20 in the local macOS workspace.

| Check                         | Command                                                      | Result                                                   |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| Fast iteration gate           | `npm run check`                                              | Formatting, lint, types, 16 files / 88 tests passed      |
| Unit and integration          | `npm test`                                                   | 16 files, 88 tests passed                                |
| Production builds             | `npm run build`                                              | Demo, MV3 extension, and local service built             |
| Packaged MV3 acceptance       | `npm run test:extension`                                     | 2 Chromium tests passed                                  |
| Installed-Chrome acceptance   | `npm run test:browser`                                       | 7 Chrome tests passed                                    |
| Full release gate             | `npm run verify`                                             | Passed in one clean rerun after one stale test label fix |
| Extension and companion build | `npm run package`                                            | Both beta.7 artifacts produced                           |
| Companion clean install       | `npm run test:package`                                       | Setup, doctor, startup, and health smoke passed          |
| Production dependency audit   | `npm audit --omit=dev --audit-level=moderate`                | 0 vulnerabilities                                        |
| Extension archive integrity   | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.7.zip` | No errors                                                |
| Extension secret-name scan    | `rg` over `dist/extension`                                   | No API-key/OAuth-secret names found                      |

The packaged-extension acceptance suite proves that an aligned magic link remains inert and token-masked until explicit approval, then navigates only the captured initiating tab to the honest synthetic completion fixture. It immediately blocks replay. The same installed extension then fills only the explicitly labeled booking-reference field and leaves submit count at zero. The second packaged test covers extension boot, message-source UI, one-time companion pairing, and Gmail/Outlook setup guidance.

The installed-Chrome suite covers aligned magic-link context, no navigation during inspection, link lookalike block, trusted reference fill, reference-domain lookalike block, single and split OTP filling, no automatic submission, service mismatch, expiry, sender warning, and unrelated-numeric empty state. Unit and integration coverage adds exact URL extraction, permanent display masking, unsafe scheme/credentials/IP/local/port/punycode/shortener/redirect rejection, destination mismatch, sender conflict, expiry/staleness, replay, model high-risk-action rejection, HTML-only Gmail anchor preservation, strict schema validation, model fallback, and real field mutation events.

The automated release gate uses injected provider/model responses and does not make paid OpenAI or external mailbox calls. Separately, a user-owned Gmail OAuth connection was completed with read-only scope and OS-keychain refresh persistence, the connector retrieved bounded recent mail, and the user confirmed a real Gmail-to-Vialto OTP fill in ChatGPT Atlas. A real Gmail magic-login or email-confirmation handoff remains the final manual conformance checkpoint; no public media should expose a real token or personal message.

## Packaged extension

- Path: `artifacts/contextfill-extension-v0.2.0-beta.7.zip`
- Size: 153,179 bytes
- SHA-256: `9311ccf0f8e1700a483c6a3d8fc951fc66dae16634bd475b5a46498736b6a3d1`
- ZIP contents: root-level `manifest.json`, popup HTML/CSS/JS, content script, and background worker

## Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.7.tgz`
- Size: 890,312 bytes
- SHA-256: `dd577ea17144544024eeaeb48b7b70f19c3d4930e1906f3115650fa8e8ce018f`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license
