# Test results

Final post-rebase candidate checked on 2026-07-21 in the local macOS workspace. The Capsule branch is based on latest `main` commit `e98473f4a10a95ef87d47ab10276cae97cad845b`, which records the independently verified beta.8 release built from product commit `8f1025007ef153b8b66c7449c4026201f73420f6`.

| Check                         | Command                                                      | Result                                                                             |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Fast iteration gate           | `npm run check`                                              | Formatting, lint, types, 22 files / 119 tests passed                               |
| Unit and integration          | `npm test`                                                   | 22 files, 119 tests passed                                                         |
| Production builds             | `npm run build`                                              | Demo, MV3 extension, and local service built                                       |
| Packaged MV3 acceptance       | `npm run test:extension`                                     | 9 Chromium tests passed                                                            |
| Judge-browser acceptance      | `npm run test:browser`                                       | 12 installed-Chrome tests passed                                                   |
| Full release gate             | `npm run verify`                                             | Passed after the final beta.8 rebase                                               |
| Extension and companion build | `npm run package`                                            | Both beta.8-versioned integration artifacts produced                               |
| Companion clean install       | `npm run test:package`                                       | Help/init/Gmail+Outlook setup/doctor/no-overwrite/startup/health smoke passed      |
| Production dependency audit   | `npm audit --omit=dev --audit-level=moderate`                | 0 vulnerabilities                                                                  |
| Extension archive integrity   | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.8.zip` | No errors; Auto-Continue, options, popup, background, content, and Capsule bundles |
| Companion archive integrity   | `tar -tzf artifacts/contextfill-companion-v0.2.0-beta.8.tgz` | Six expected package files listed successfully                                     |
| Extension secret-name scan    | `rg` over `dist/extension`                                   | No API-key, OAuth-client-secret, refresh-token, or key-shaped names found          |

The packaged-extension suite covers Assisted detection and confirmation, a late SPA wait state, Auto OTP filling with zero extension submit clicks, aligned same-tab magic-link navigation, fresh lookalike blocking, countdown cancellation and exact-origin revocation, Capsule activation/lookalike/two-field transfer/Undo/replay, extension boot with companion pairing, and the legacy explicit magic-link/reference path.

The installed-Chrome suite covers the complete masked Capsule trust trace, exact two-fact transfer, truthful no-submit receipt, Undo, controlled lookalike blocking, hidden decoys, conflict/stale/nonempty preservation, reduced motion, single/split OTP filling, service mismatch, expiry, sender ambiguity, unrelated numeric mail, aligned/lookalike magic links, and aligned/lookalike trusted references. Unit and integration coverage adds Capsule schema/evidence grounding, expiry/replay, model isolation, same-container mapping, sensitive/hidden/disabled/offscreen/ambiguous/nonempty rejection, atomic verify-and-rollback, subject/target masking, forged-loopback activation denial, Auto action-time revalidation, history privacy, explicit Gmail Spam/Trash exclusion, and Outlook Inbox-only retrieval.

The automated release gate uses injected provider/model responses and makes no paid OpenAI or external mailbox calls. Separately, the user completed beta.8 real-provider acceptance with a read-only Gmail connection: popup-free Medium Auto opened a verified magic-login link in the same tab after the visible cancellable countdown; popup-free Substack Auto filled all six split OTP fields and let the site own its post-final-digit behavior; and a competing-message Medium run failed closed before a clean retry passed. No acceptance record exposes a real token, fallback code, address, or message.

## Verified beta.8 base release

- URL: [ContextFill v0.2.0-beta.8](https://github.com/lzongren/contextfill/releases/tag/v0.2.0-beta.8)
- Release state: public prerelease, built from merged `main` commit `8f1025007ef153b8b66c7449c4026201f73420f6`
- Published extension SHA-256: `b60e0bfcb4421a75acee3db713477ae4ae4d281a927cb653554d1d72a866fb66`
- Published companion SHA-256: `d70a614b49bafb997de8bae5050ce7a09cc4c08296708afb2366c808f90241d9`
- Download verification: all four public assets were downloaded independently; both checksum files passed, both archive structures were readable, and embedded versions matched beta.8.

## Final local Capsule integration artifacts

### Packaged extension

- Path: `artifacts/contextfill-extension-v0.2.0-beta.8.zip`
- Size: 406,626 bytes
- Local SHA-256: `f5e5869a9d6ecd7b2eaa9e30be368c411e69083f0423e9c0b93c27cd8dcdfe91`
- ZIP contents: root-level manifest, popup/options HTML/CSS/JS, content/background workers, and the separate Capsule content bundle

### Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.8.tgz`
- Size: 895,846 bytes
- Local SHA-256: `e580ecce4c8a6f49c2357615b18767d2e1c35b67dfbae5b59435e15516b8b961`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license

These integration artifacts are local verification outputs only. The Capsule work creates no competing tag or release; PR #17 is the review and integration boundary.
