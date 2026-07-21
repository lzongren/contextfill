# Test results

Release candidate checked on 2026-07-21 in the local macOS workspace.

| Check                         | Command                                                      | Result                                                |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Fast iteration gate           | `npm run check`                                              | Formatting, lint, types, 19 files / 105 tests passed  |
| Unit and integration          | `npm test`                                                   | 19 files, 105 tests passed                            |
| Production builds             | `npm run build`                                              | Demo, MV3 extension, and local service built          |
| Packaged MV3 acceptance       | `npm run test:extension`                                     | 8 Chromium tests passed                               |
| Judge-browser acceptance      | `npm run test:browser`                                       | 7 Chromium tests passed                               |
| Full release gate             | `npm run verify`                                             | Passed on the final beta.8 candidate                  |
| Extension and companion build | `npm run package`                                            | Both beta.8 artifacts produced                        |
| Companion clean install       | `npm run test:package`                                       | Setup, doctor, startup, and health smoke passed       |
| Production dependency audit   | `npm audit --omit=dev --audit-level=moderate`                | 0 vulnerabilities                                     |
| Extension archive integrity   | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.8.zip` | No errors; options and Auto-Continue bundles included |
| Extension secret-name scan    | `rg` over `dist/extension`                                   | No API-key/OAuth-secret names found                   |
| Public GitHub prerelease      | Release workflow and downloaded `v0.2.0-beta.8` assets       | Pending tag publication and independent verification  |

The packaged-extension acceptance suite proves that Assisted mode discovers and verifies an OTP without the popup but waits for in-page confirmation; a dynamically inserted SPA dialog triggers the same path; Auto-Continue fills an OTP after a visible countdown without clicking Submit and suppresses field animation under reduced-motion; an aligned magic link opens only the captured tab while a fresh lookalike blocks before navigation; cancellation prevents navigation; exact-origin revocation prevents future scanning; and privacy-safe history contains no candidate value. Separate packaged tests cover extension boot and the legacy explicit magic-link/reference path.

The installed-Chrome suite covers aligned magic-link context, no navigation during inspection, link lookalike block, trusted reference fill, reference-domain lookalike block, single and split OTP filling, no automatic submission, service mismatch, expiry, sender warning, and unrelated-numeric empty state. Unit and integration coverage adds exact URL extraction, permanent display masking, unsafe scheme/credentials/IP/local/port/punycode/shortener/redirect rejection, destination mismatch, sender-conflict automatic blocking, expired and stale links, replay, competing messages, hidden/disabled decoys, explicit Gmail Spam/Trash exclusion, Outlook Inbox-only retrieval, model high-risk-action rejection, HTML-only Gmail anchor preservation, mixed code/link precedence, bounded token-free supporting excerpts, subject-level fallback-code masking, strict schema validation, model fallback, and real field mutation events.

The automated release gate uses injected provider/model responses and does not make paid OpenAI or external mailbox calls. Separately, a user-owned Gmail OAuth connection was completed with read-only scope and OS-keychain refresh persistence, and the connector retrieved bounded recent mail. In ChatGPT Atlas, the user then enabled Auto-Continue once for each exact site and completed two popup-free real-mail acceptance flows: Medium displayed the cancellable three-second overlay and opened the verified magic-login link in the same tab, while Substack displayed the same countdown and filled all six split OTP fields without ContextFill clicking Submit. Substack continued after the final digit according to its own page behavior. The user also observed the competing-message safeguard fail closed when multiple fresh Medium emails were eligible, then completed a clean retry after the ambiguity window. No acceptance record or public media exposes a real token, fallback code, address, or personal message.

## Current public release (beta.7)

- URL: [ContextFill v0.2.0-beta.7](https://github.com/lzongren/contextfill/releases/tag/v0.2.0-beta.7)
- Release state: public prerelease, built from `e503c6d7e2384ceaf35bb4fd38ea6db963bb57c4`
- Extension SHA-256: `642861199b27b8043f3e5eedf8da84bba88b13e1ac5488f90f32bc6f432136d4`
- Companion SHA-256: `a11848e3cd7a0a5896beb51e84550bc4db722e5654f8529d12908780537d6912`
- Download verification: both published `.sha256` files passed; the ZIP and TGZ structures were read successfully.

## Packaged extension

- Path: `artifacts/contextfill-extension-v0.2.0-beta.8.zip`
- Size: 284,476 bytes
- Local SHA-256: `332b018430ee3cfc8f24ce7f9ab6a04046fa617d0cc90477acb1e76a42374a24`
- ZIP contents: root-level manifest, popup/options HTML/CSS/JS, content script, and background worker

## Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.8.tgz`
- Size: 890,658 bytes
- Local SHA-256: `9432975a350816595b21f3d37fbc575b74f067c5eb05616033ce341d0beea8e4`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license
