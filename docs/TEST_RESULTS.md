# Test results

Release candidate checked on 2026-07-21 in the local macOS workspace.

| Check                         | Command                                                      | Result                                                |
| ----------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Fast iteration gate           | `npm run check`                                              | Formatting, lint, types, 19 files / 104 tests passed  |
| Unit and integration          | `npm test`                                                   | 19 files, 104 tests passed                            |
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

The packaged-extension acceptance suite proves that Assisted mode discovers and verifies an OTP without the popup but waits for in-page confirmation; a dynamically inserted SPA dialog triggers the same path; Auto-Continue fills an OTP after a visible countdown without clicking Submit; an aligned magic link opens only the captured tab while a lookalike blocks; cancellation prevents navigation; exact-origin revocation prevents future scanning; and privacy-safe history contains no candidate value. Separate packaged tests cover extension boot and the legacy explicit magic-link/reference path.

The installed-Chrome suite covers aligned magic-link context, no navigation during inspection, link lookalike block, trusted reference fill, reference-domain lookalike block, single and split OTP filling, no automatic submission, service mismatch, expiry, sender warning, and unrelated-numeric empty state. Unit and integration coverage adds exact URL extraction, permanent display masking, unsafe scheme/credentials/IP/local/port/punycode/shortener/redirect rejection, destination mismatch, sender conflict, expiry/staleness, replay, model high-risk-action rejection, HTML-only Gmail anchor preservation, mixed code/link precedence, bounded token-free supporting excerpts, subject-level fallback-code masking, strict schema validation, model fallback, and real field mutation events.

The automated release gate uses injected provider/model responses and does not make paid OpenAI or external mailbox calls. Separately, a user-owned Gmail OAuth connection was completed with read-only scope and OS-keychain refresh persistence, the connector retrieved bounded recent mail, and the user confirmed both a real Gmail-to-Vialto OTP fill and a real Gmail-to-Medium magic-link handoff in ChatGPT Atlas under the prior Manual flow. Fresh real-site Auto-Continue acceptance is required before beta.8 publication. No public media should expose a real token, fallback code, address, or personal message.

## Current public release (beta.7)

- URL: [ContextFill v0.2.0-beta.7](https://github.com/lzongren/contextfill/releases/tag/v0.2.0-beta.7)
- Release state: public prerelease, built from `e503c6d7e2384ceaf35bb4fd38ea6db963bb57c4`
- Extension SHA-256: `642861199b27b8043f3e5eedf8da84bba88b13e1ac5488f90f32bc6f432136d4`
- Companion SHA-256: `a11848e3cd7a0a5896beb51e84550bc4db722e5654f8529d12908780537d6912`
- Download verification: both published `.sha256` files passed; the ZIP and TGZ structures were read successfully.

## Packaged extension

- Path: `artifacts/contextfill-extension-v0.2.0-beta.8.zip`
- Size: 284,476 bytes
- Local SHA-256: `b9204a34ccc732a68cdd70ad6aca2af03398d300dd2d40ea9318c3fecd32c791`
- ZIP contents: root-level manifest, popup/options HTML/CSS/JS, content script, and background worker

## Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.8.tgz`
- Size: 890,582 bytes
- Local SHA-256: `d0c77734ed7061dff1b75782681f9c35206edfb9a512d9aae4b5954d610e10ad`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license
