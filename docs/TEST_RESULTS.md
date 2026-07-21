# Test results

The integrated `codex/wow-experiment` branch was independently checked on 2026-07-21 in the local macOS workspace after the Capsule commit was cherry-picked. These artifacts are branch evidence only; no new release was published.

| Check                         | Command                                                      | Result                                                                       |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Fast iteration gate           | `npm run check`                                              | Formatting, lint, types, 19 files / 104 tests passed                         |
| Unit and integration          | `npm test`                                                   | 19 files, 104 tests passed                                                   |
| Production builds             | `npm run build`                                              | Demo, MV3 extension, and local service built                                 |
| Packaged MV3 acceptance       | `npm run test:extension`                                     | 3 Chromium tests passed                                                      |
| Installed-Chrome acceptance   | `npm run test:browser`                                       | 12 Chrome tests passed                                                       |
| Full release gate             | `npm run verify`                                             | Passed on the final post-conformance code                                    |
| Extension and companion build | `npm run package`                                            | Capsule-bearing local artifacts produced                                     |
| Companion clean install       | `npm run test:package`                                       | Setup, doctor, startup, and health smoke passed                              |
| Production dependency audit   | `npm audit --omit=dev --audit-level=moderate`                | 0 vulnerabilities                                                            |
| Extension archive integrity   | `unzip -t artifacts/contextfill-extension-v0.2.0-beta.7.zip` | No errors                                                                    |
| Extension secret-name scan    | `rg` over `dist/extension`                                   | No API-key/OAuth-secret names found                                          |
| Visual judge-path QA          | In-app browser at 1280×720                                   | Full chain, transfer, no-submit receipt, Undo, and lookalike block inspected |

The packaged-extension acceptance suite proves that a forged page on another path cannot mount the capsule UI even when it copies valid fixture metadata. The allowlisted judge fixture blocks the airline-domain lookalike, then transfers exactly the booking reference and passenger surname on the aligned decoy fixture, leaves hidden/unrelated fields unchanged, reports zero submissions, restores both values with Undo, and keeps replay blocked. Existing packaged coverage still proves inert masked magic-link inspection, explicit same-tab navigation, narrow reference transfer, extension boot, message-source UI, one-time companion pairing, and Gmail/Outlook setup guidance.

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
- Size: 275,222 bytes
- SHA-256: `affa702d2bf4bd1c8397a380c6f3de3bb33af523f63c34c349bf3f665cac6dd3`
- ZIP contents: root-level `manifest.json`, popup HTML/CSS/JS, capsule and general content scripts, and background worker
- Publication state: isolated branch artifact only; not uploaded or released

## Packaged companion service

- Path: `artifacts/contextfill-companion-v0.2.0-beta.7.tgz`
- Size: 895,777 bytes
- SHA-256: `44538be636426ea89473f16bc1562301e2120e01367ccdd96fe271a021e1dc95`
- Package contents: executable bundled service, source map, installation guide, environment template, package metadata, and license
