# Test results

Final Capsule plus Gmail→easyJet candidate checked on 2026-07-21 in the local macOS workspace. The branch is based on latest `main` commit `e98473f4a10a95ef87d47ab10276cae97cad845b`, which records the independently verified beta.8 release built from product commit `8f1025007ef153b8b66c7449c4026201f73420f6`.

| Check                         | Command                                                      | Result                                                                             |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Fast iteration gate           | `npm run check`                                              | Formatting, lint, types, 23 files / 126 tests passed                               |
| Unit and integration          | `npm test`                                                   | 23 files, 126 tests passed                                                         |
| Production builds             | `npm run build`                                              | Demo, MV3 extension, and local service built                                       |
| Packaged MV3 acceptance       | `npm run test:extension`                                     | 9 Chromium tests passed; private easyJet conformance skipped by default            |
| Private Gmail/easyJet E2E     | Opt-in `easyjet-live.spec.ts`                                | 1 passed on the combined branch with private environment contents never printed    |
| Judge-browser acceptance      | `npm run test:browser`                                       | 12 installed-Chrome tests passed                                                   |
| Full release gate             | `npm run verify`                                             | Passed after the final beta.8 rebase                                               |
| Extension and companion build | `npm run package`                                            | Both beta.8-versioned integration artifacts produced                               |
| Companion clean install       | `npm run test:package`                                       | Help/init/Gmail+Outlook setup/doctor/no-overwrite/startup/health smoke passed      |
| Production dependency audit   | `npm audit --omit=dev --audit-level=moderate`                | 0 vulnerabilities                                                                  |
| Extension archive integrity   | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.8.zip` | No errors; Auto, options, Capsule, and easyJet bundles; no standing easyJet access |
| Companion archive integrity   | `tar -tzf artifacts/contextfill-companion-v0.2.0-beta.8.tgz` | Six expected package files listed successfully                                     |
| Extension secret-name scan    | `rg` over `dist/extension`                                   | No API-key, OAuth-client-secret, refresh-token, or key-shaped names found          |

The default packaged-extension suite covers Assisted detection and confirmation, a late SPA wait state, Auto OTP filling with zero extension submit clicks, aligned same-tab magic-link navigation, fresh lookalike blocking, countdown cancellation and exact-origin revocation, Capsule activation/lookalike/two-field transfer/Undo/replay, extension boot with companion pairing, and the legacy explicit magic-link/reference path.

The private easyJet conformance was repeated explicitly on the combined branch using the user-owned read-only Gmail environment and a temporary test build limited to `https://www.easyjet.com/*`. Several real confirmations appeared only as masked choices. The selected confirmation transferred exactly the surname and booking reference into the current captured easyJet DOM contract, left consent unchecked, recorded zero submissions, displayed the truthful no-submit receipt, restored both values with Undo, and kept replay disabled. The normal extension was rebuilt immediately afterward; its manifest contains no standing easyJet host permission. The live `https://www.easyjet.com/en?accntmdl=2` DOM had previously been inspected separately without entering data or submitting.

The installed-Chrome suite covers the complete masked Capsule trust trace, exact two-fact transfer, truthful no-submit receipt, Undo, controlled lookalike blocking, hidden decoys, conflict/stale/nonempty preservation, reduced motion, single/split OTP filling, service mismatch, expiry, sender ambiguity, unrelated numeric mail, aligned/lookalike magic links, and aligned/lookalike trusted references. Unit and integration coverage adds Capsule schema/evidence grounding, expiry/replay, model isolation, same-container mapping, sensitive/hidden/disabled/offscreen/ambiguous/nonempty rejection, atomic verify-and-rollback, subject/target masking, forged-loopback activation denial, Auto action-time revalidation, history privacy, purpose-bound Gmail lookup, Apple Hide My Email relay verification and forgery rejection, exact easyJet route policy, explicit Gmail Spam/Trash exclusion, and Outlook Inbox-only retrieval.

The automated release gate uses injected provider/model responses and makes no paid OpenAI or external mailbox calls. Separately, the user completed beta.8 real-provider acceptance with a read-only Gmail connection: popup-free Medium Auto opened a verified magic-login link in the same tab after the visible cancellable countdown; popup-free Substack Auto filled all six split OTP fields and let the site own its post-final-digit behavior; and a competing-message Medium run failed closed before a clean retry passed. No acceptance record exposes a real token, fallback code, address, or message.

## Verified beta.8 base release

- URL: [ContextFill v0.2.0-beta.8](https://github.com/lzongren/contextfill/releases/tag/v0.2.0-beta.8)
- Release state: public prerelease, built from merged `main` commit `8f1025007ef153b8b66c7449c4026201f73420f6`
- Published extension SHA-256: `b60e0bfcb4421a75acee3db713477ae4ae4d281a927cb653554d1d72a866fb66`
- Published companion SHA-256: `d70a614b49bafb997de8bae5050ce7a09cc4c08296708afb2366c808f90241d9`
- Download verification: all four public assets were downloaded independently; both checksum files passed, both archive structures were readable, and embedded versions matched beta.8.

## Final local Capsule and easyJet integration artifacts

### Packaged extension

- Path: `artifacts/contextfill-extension-v0.2.0-beta.8.zip`
- Size: 530,745 bytes
- Local SHA-256: `95af32d79fef7794a6ca386eb6999416ff7bf0359dd4a7399263012590789cfe`
- ZIP contents: root-level manifest, popup/options HTML/CSS/JS, content/background workers, and separate Capsule/easyJet content bundles

### Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.8.tgz`
- Size: 897,910 bytes
- Local SHA-256: `1612b80af4250acba002ed997c11b707d35ac038d5d339d34d38da1079095d54`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license

These integration artifacts are local verification outputs only. The Capsule/easyJet work creates no competing tag or release; PR #17 is the review and integration boundary.
