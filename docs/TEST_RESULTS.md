# Test results

## Local Gmail → Alaska Airlines beta.9 addendum

Checked on 2026-07-21 from `codex/alaska-capsules` without publishing or merging.

| Check                                        | Result                                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                             | Formatting, lint, types, 24 files / 134 tests, three builds, 10 packaged passes with 2 private specs skipped, and 12 installed-Chrome passes |
| Opt-in `alaska-live.spec.ts`                 | 1 private Gmail pass; masked choice, two values present, zero submission, raw booking values and credential contents never printed           |
| Packaged Alaska stability                    | 3 consecutive packaged passes after removing an invalid cross-world test-clock override                                                      |
| `npm run package` and `npm run test:package` | beta.9 extension and companion built; clean-install help/init/setup/doctor/no-overwrite/startup/health smoke passed                          |
| `npm audit --omit=dev`                       | 0 vulnerabilities                                                                                                                            |
| Archive and manifest inspection              | Both archives readable; extension contains `airline-content.js`; production manifest has no standing easyJet or Alaska permission            |
| Extension secret-name scan                   | No API-key or OAuth-client-secret identifiers found in `dist/extension`                                                                      |

- Extension: `artifacts/contextfill-extension-v0.2.0-beta.9.zip` — 532,584 bytes — SHA-256 `8aa61b11b59fb007009d1e762a11c328c5b618b97a80ec278102715cb32b0a4b`
- Companion: `artifacts/contextfill-companion-v0.2.0-beta.9.tgz` — 898,540 bytes — SHA-256 `b040417bc71e53a4b53c084654ba5117d2f7ecfd90cbf21f020ab9f06acceb54`

The private gate uses the real read-only Gmail adapter and an intercepted official Alaska origin containing only the current two-field form contract. It confirms the real confirmation format survives normalization, the exact Alaska mailbox purpose excludes generic temporary-code selection, the subject/body code agrees, one labeled traveler yields the surname, and the extension transfers both fields without invoking `Continue`. It does not submit to Alaska or claim that the completed reservation remains retrievable.

Final Capsule plus Gmail→easyJet candidate checked on 2026-07-21 in the local macOS workspace. The branch is based on latest `main` commit `e98473f4a10a95ef87d47ab10276cae97cad845b`, which records the independently verified beta.8 release built from product commit `8f1025007ef153b8b66c7449c4026201f73420f6`.

| Check                         | Command                                                      | Result                                                                             |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Fast iteration gate           | `npm run check`                                              | Formatting, lint, types, 23 files / 128 tests passed                               |
| Unit and integration          | `npm test`                                                   | 23 files, 128 tests passed                                                         |
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

The private easyJet conformance was repeated explicitly after a live confirmation showed that its `Hi, Name` greeting used the recipient's given name and did not state the surname required by easyJet. The corrected temporary test build showed several real confirmations only as masked reference choices, required user selection, filled only the exactly labeled booking-reference field in the captured current easyJet DOM contract, left surname and consent untouched, recorded zero submissions, and told the user to enter surname manually. No raw value was logged. The normal extension was rebuilt immediately afterward; its manifest contains no standing easyJet host permission. The live `https://www.easyjet.com/en?accntmdl=2` DOM had previously been inspected separately without entering data or submitting.

The installed-Chrome suite covers the complete masked Capsule trust trace, exact two-fact transfer, truthful no-submit receipt, Undo, controlled lookalike blocking, hidden decoys, conflict/stale/nonempty preservation, reduced motion, single/split OTP filling, service mismatch, expiry, sender ambiguity, unrelated numeric mail, aligned/lookalike magic links, and aligned/lookalike trusted references. Unit and integration coverage adds Capsule schema/evidence grounding, expiry/replay, model isolation, same-container mapping, sensitive/hidden/disabled/offscreen/ambiguous/nonempty rejection, atomic verify-and-rollback, subject/target masking, forged-loopback activation denial, Auto action-time revalidation, history privacy, purpose-bound Gmail lookup, Apple Hide My Email relay verification and forgery rejection, greeting-name false-positive rejection, exact local booking-reference field selection, exact easyJet route policy, explicit Gmail Spam/Trash exclusion, and Outlook Inbox-only retrieval.

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
- Size: 531,322 bytes
- Local SHA-256: `d192fc3e6f37f3c7c17cb1c1685c394b76fc99c510d4085cd46d555200e76e32`
- ZIP contents: root-level manifest, popup/options HTML/CSS/JS, content/background workers, and separate Capsule/easyJet content bundles

### Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.8.tgz`
- Size: 897,845 bytes
- Local SHA-256: `ff95da63d70669d01c25dce66daea7b0bdac9da81254109be6e13359c55efd52`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license

These integration artifacts are local verification outputs only. The Capsule/easyJet work creates no competing tag or release; PR #17 is the review and integration boundary.
