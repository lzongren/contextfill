# Test results

The isolated `codex/easyjet-e2e` branch was checked on 2026-07-21 in the local macOS workspace after the reviewed Capsule commit was integrated. These artifacts are branch evidence only; no new release was published.

| Check                         | Command                                                      | Result                                                                       |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Fast iteration gate           | `npm run check`                                              | Formatting, lint, types, 20 files / 111 tests passed                         |
| Unit and integration          | `npm test`                                                   | 20 files, 111 tests passed                                                   |
| Production builds             | `npm run build`                                              | Demo, MV3 extension, and local service built                                 |
| Packaged MV3 acceptance       | `npm run test:extension`                                     | 3 Chromium tests passed; private easyJet conformance skipped by default      |
| Installed-Chrome acceptance   | `npm run test:browser`                                       | 12 Chrome tests passed                                                       |
| Full release gate             | `npm run verify`                                             | Passed on the final post-conformance code                                    |
| Extension and companion build | `npm run package`                                            | Capsule-bearing local artifacts produced                                     |
| Companion clean install       | `npm run test:package`                                       | Setup, doctor, startup, and health smoke passed                              |
| Production dependency audit   | `npm audit --omit=dev --audit-level=moderate`                | 0 vulnerabilities                                                            |
| Extension archive integrity   | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.7.zip` | No errors                                                                    |
| Extension secret-name scan    | `rg` over `dist/extension`                                   | No API-key/OAuth-secret names found                                          |
| Visual judge-path QA          | In-app browser at 1280×720                                   | Full chain, transfer, no-submit receipt, Undo, and lookalike block inspected |

The private easyJet conformance was also run explicitly with a user-owned Gmail OAuth environment and `CONTEXTFILL_LIVE_EASYJET=1`; its single packaged-extension test passed. The read-only companion retrieved bounded easyJet confirmations, the test selected one without logging its subject, surname, or reference, transferred only the two expected values into the current easyJet booking-dialog DOM contract, left consent unchecked, recorded zero submissions, showed the truthful no-submit receipt, cleared both fields with Undo, and kept replay disabled. The Gmail readiness doctor separately confirmed `gmail.readonly`, the exact loopback callback, and private environment-file permissions.

The real page at `https://www.easyjet.com/en?accntmdl=2` was inspected separately in the in-app browser on the same date. It exposed the expected surname input, booking-reference input, consent checkbox, and Find Booking button in one form. No personal values were entered and the form was not submitted. Chrome for Testing received an empty live response from easyJet, so the automated private test routes that exact official URL to a captured current DOM contract; this verifies the packaged extension and real Gmail path without claiming a live network submission.

The packaged-extension acceptance suite proves that a forged page on another path cannot mount the capsule UI even when it copies valid fixture metadata. The allowlisted judge fixture blocks the airline-domain lookalike, then transfers exactly the booking reference and passenger surname on the aligned decoy fixture, leaves hidden/unrelated fields unchanged, reports zero submissions, restores both values with Undo, and keeps replay blocked. The easyJet unit and private conformance coverage additionally rejects lookalike hosts and routes, requires an exact purpose-bound Gmail query, verifies Apple Hide My Email relay encoding, uses masked user selection when multiple bookings match, revalidates policy and the field plan at action time, and never checks consent or submits. Existing packaged coverage still proves inert masked magic-link inspection, explicit same-tab navigation, narrow reference transfer, extension boot, message-source UI, one-time companion pairing, and Gmail/Outlook setup guidance.

The installed-Chrome suite adds the aligned capsule sequence, lookalike block, hidden/unrelated decoys, conflict/stale/nonempty preservation, reduced-motion presentation, exact two-field transfer, no submission, and Undo. It also preserves aligned magic-link context, no navigation during inspection, link lookalike block, trusted reference fill, reference-domain lookalike block, single and split OTP filling, service mismatch, expiry, sender warning, and unrelated-numeric empty state. Unit and integration coverage adds strict capsule schemas, deterministic and model fact extraction, full-value and subject masking, expiry/replay, controlled lookalikes, same-container mapping, zero-size/offscreen and sensitive-field rejection, atomic framework-rewrite rollback, and proof that model facts cannot bypass deterministic authorization, alongside all prior link, MIME, mailbox, schema, fallback, and field-mutation cases.

The automated release gate uses injected provider/model responses and does not make paid OpenAI or external mailbox calls. Separately, a user-owned Gmail OAuth connection was completed with read-only scope and OS-keychain refresh persistence, the connector retrieved bounded recent mail, and the user confirmed both a real Gmail-to-Vialto OTP fill and a real Gmail-to-Medium magic-link handoff in ChatGPT Atlas. For the Medium flow, ContextFill inspected the URL locally, displayed a masked destination and aligned sender/page/destination evidence, remained inert until explicit approval, and then opened the exact link in the initiating Medium tab, which completed sign-in. No public media should expose a real token, fallback code, address, or personal message.

## Public release

- URL: [ContextFill v0.2.0-beta.7](https://github.com/lzongren/contextfill/releases/tag/v0.2.0-beta.7)
- Release state: public prerelease, built from `e503c6d7e2384ceaf35bb4fd38ea6db963bb57c4`
- Extension SHA-256: `642861199b27b8043f3e5eedf8da84bba88b13e1ac5488f90f32bc6f432136d4`
- Companion SHA-256: `a11848e3cd7a0a5896beb51e84550bc4db722e5654f8529d12908780537d6912`
- Download verification: both published `.sha256` files passed; the ZIP and TGZ structures were read successfully.

## Packaged extension

- Path: `artifacts/contextfill-extension-v0.2.0-beta.7.zip`
- Size: 399,242 bytes
- SHA-256: `04c22b680d0f3762f08e01fbd96e57437ebe388f598d954cb6c888657e0e7fd4`
- ZIP contents: root-level `manifest.json`, popup HTML/CSS/JS, capsule and general content scripts, and background worker
- Publication state: isolated branch artifact only; not uploaded or released

## Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.7.tgz`
- Size: 897,850 bytes
- SHA-256: `dc8e8f39c026529a68bfdf18142b2d494bf8c7a19c6719c195fbc1cfd558f325`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license
