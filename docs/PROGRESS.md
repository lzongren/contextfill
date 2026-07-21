# Progress

## 2026-07-21

- [x] Corrected the live easyJet greeting-name false positive: `Hi, Zongren` is no longer treated as a passenger surname when the confirmation does not state one.
- [x] Added a masked, user-selected easyJet reference-only fallback that verifies the Apple relay/domain/origin and historical lookup window, fills only the booking reference, leaves surname and consent manual, and never submits.
- [x] Added the isolated private Gmail → easyJet path: purpose-bounded historical confirmation retrieval, explicit labeled-surname extraction, strict Apple Hide My Email relay evidence, and masked user choice across multiple bookings.
- [x] Added exact-route `https://www.easyjet.com/en?accntmdl=2` activation with runtime-only production permission, action-time policy/DOM revalidation, atomic transfer, replay-before-Undo, and no submit.
- [x] Inspected the live easyJet Find Booking DOM: visible surname, booking-reference, and consent-checkbox controls share one form; the mapper selects only the two text inputs.
- [x] Repeated the private packaged conformance run after the live greeting-name mismatch. It required masked booking selection, filled only the evidenced booking-reference field, left surname and consent untouched, recorded zero submits, and logged no raw values.

- [x] Implemented Verified Context Capsules as the airline-check-in hero flow: exactly one booking reference and passenger surname, a compact Message → trust checks → capsule → destination trace, explicit two-field transfer, truthful no-submit receipt, and Undo.
- [x] Added strict Zod schemas and deterministic/model extraction boundaries; GPT-5.6 can return source-grounded facts only and cannot authorize or choose fields.
- [x] Added deterministic sender/service/origin/freshness/expiry/replay policy with controlled lookalike blocking and action-time revalidation.
- [x] Added conservative two-field mapping that rejects sensitive, hidden, disabled, zero-size, offscreen, ambiguous, nonempty, overlong, and split-container targets.
- [x] Made execution atomic through post-set verification and reverse rollback; successful transfer marks replay before Undo, and Undo never makes the capsule reusable.
- [x] Added masked Shadow DOM presentation with keyboard/Escape support, reduced-motion behavior, and no raw booking reference or surname in the overlay DOM.
- [x] Added aligned, lookalike, decoy, conflict, stale, nonempty, and reduced-motion judge scenarios plus packaged-extension activation limited to exact judge/test origins and allowlisted metadata.
- [x] Added focused schema, extraction, policy, mapping, rollback, masking, activation, service, packaged-extension, and installed-Chrome regressions.
- [x] Passed the final combined release gate (128 unit/integration, 9 default packaged-extension, 1 private Gmail/easyJet, and 12 installed-Chrome tests), companion clean-install smoke, archive integrity and secret-name scans, and a zero-vulnerability production audit.
- [x] Rebased the Capsule integration onto latest beta.8 `main` commit `e98473f4`, repeated the complete release/package/audit gates, and retained the independently reviewed 1280×720 success, Undo, Escape, and lookalike experiences.
- [x] Opened focused draft PR #17 without merging or publishing a competing release and completed its beta.8 rebase locally for the final review push.

## 2026-07-20

- [x] Read the full Build Week specification.
- [x] Confirmed the repository was empty and initialized the implementation plan.
- [x] Selected an intentionally small TypeScript architecture with a bundled MV3 extension, Vite demo, shared core, and optional Hono service.
- [x] Proved the extraction → policy → fill vertical slice with 19 passing unit/integration tests.
- [x] Added realistic synthetic fixtures, strict schemas, public-suffix-aware parsing, controlled lookalike checks, replay/expiry logic, transparent ranking, and conservative field filling.
- [x] Completed and visually checked the judge lab with explicit localhost simulation.
- [x] Completed the MV3 popup, active-tab injection, masked confirmation, allow/warn/block states, replay tracking, and 90-second sensitive-state lifecycle.
- [x] Completed the loopback GPT-5.6 Responses API service, strict schema/evidence validation, no-key health path, and fallback tests.
- [x] Passed 26 unit/integration tests, 5 installed-Chrome cases, and 1 packaged-extension load test.
- [x] Completed required README, judge, threat, demo, collaboration, screenshot, test-result, and Devpost draft documentation.
- [x] Passed the final `npm run verify` release gate.
- [x] Produced and integrity-tested `artifacts/contextfill-extension-v0.1.0.zip`.
- [x] Confirmed the extension bundle contains no API-key references, only `.env.example` exists, and the production dependency audit reports zero vulnerabilities.
- [x] Published the project at `https://github.com/lzongren/contextfill` with CI and public-repository standards.
- [x] Split fast iteration CI from full release verification and automated tagged GitHub Release artifacts with checksums.
- [x] Added provider-neutral mailbox messages, Gmail and Outlook read-only OAuth adapters, bounded recent-message ingestion, source controls, and connector tests.
- [x] Prepared the real-mailbox connector artifact as `v0.2.0-beta.1`; prerelease tags are labeled as GitHub prereleases.
- [x] Added OS-keychain refresh-token persistence with explicit session fallback and one-time per-install loopback capability pairing.
- [x] Verified packaged-extension pairing against a real temporary loopback service, including privileged extension fetches that omit `Origin`.
- [x] Verified a disposable native macOS Keychain write/read/delete and prepared `v0.2.0-beta.2` with 39 unit/integration tests.
- [x] Added an installable `contextfill-service` companion package with safe `--init`; tagged releases publish it beside the extension with a separate checksum.
- [x] Added a provider-independent one-time `.eml` import that parses a bounded exported Gmail/Outlook message locally, ignores attachments during extraction, persists no message data, and reuses the same deterministic trust/explicit-fill path.
- [x] Passed the `v0.2.0-beta.3` release gate with 43 unit/integration tests, the packaged-extension load/pairing check, 5 installed-Chrome scenarios, companion clean-install smoke test, archive integrity checks, and a zero-vulnerability production audit.
- [x] Added a non-secret mailbox OAuth doctor for exact callback/scope reporting, loopback validation, provider readiness, and private-config permission checks.
- [x] Corrected the installed-companion smoke test so it actually starts the packaged binary and probes `/health`, in addition to help/init/doctor/no-overwrite checks.
- [x] Passed the `v0.2.0-beta.4` local release gate with 46 unit/integration tests, packaged-extension and installed-Chrome checks, companion runtime smoke, artifact integrity, and a zero-vulnerability production audit.
- [x] Added a guided Outlook setup command and extension setup links so first-time users get runtime-derived registration instructions and owner-only configuration instead of a disabled Connect button.
- [x] Passed the `v0.2.0-beta.5` local release gate with 49 unit/integration tests, packaged-extension and five installed-Chrome checks, guided companion clean-install smoke, artifact integrity, and a zero-vulnerability production audit.
- [x] Reproduced the personal-Outlook `AADSTS50020` path and corrected the CLI, extension, and integration guide to distinguish Entra registration ownership from personal-account sign-in support.
- [x] Added a secret-safe Gmail setup path that validates Google's downloaded OAuth web-client JSON and exact callback before privately importing credentials.
- [x] Passed the `v0.2.0-beta.6` local release gate with 52 unit/integration tests, packaged-extension and five installed-Chrome checks, Gmail/Outlook companion clean-install smoke, artifact integrity, and a zero-vulnerability production audit.
- [x] Completed a user-owned Gmail OAuth connection with read-only scope, OS-keychain refresh-token persistence, bounded recent-message retrieval, and a confirmed real Vialto OTP fill in ChatGPT Atlas.
- [x] Added exact-origin runtime permission requests and expanded nonsemantic OTP field detection after real-site testing exposed both gaps.
- [x] Implemented Verified Magic-Link Handoff as the differentiated core: exact URL extraction, HTML-anchor preservation, permanent token masking, local-only URL inspection, sender/page/destination alignment, explicit captured-tab navigation, and replay blocking.
- [x] Added adversarial magic-link gates for insecure schemes, embedded credentials, IP/local destinations, nonstandard ports, punycode, shorteners, opaque redirect wrappers, domain mismatch, lookalikes, sender conflict, expiry/staleness, and reuse.
- [x] Added deterministic Trusted Reference Transfer for explicitly labeled booking, application, and support references, including aligned and lookalike judge fixtures and no-submit browser coverage.
- [x] Passed the beta.7 full release gate: formatting/lint/types, 90 unit/integration tests, three production builds, two packaged-extension acceptance tests, and seven installed-Chrome scenarios.
- [x] Packaged and integrity-checked the beta.7 extension and companion, completed the clean-install companion smoke, scanned the extension bundle for secret names, and confirmed zero production audit vulnerabilities.
- [x] Completed a user-observed real Gmail-to-Medium magic-link handoff: local no-fetch inspection, masked URL, aligned sender/page/destination decision, explicit click, and successful same-tab sign-in.
- [x] Hardened real-provider compatibility after the live run: mixed code/link messages prefer verified handoff, long URLs are removed from bounded supporting evidence, and fallback codes embedded in subjects are masked.
- [x] Published `v0.2.0-beta.7` as a public GitHub prerelease after the complete Linux release gate; downloaded all four public assets and verified both checksums and archive structures.
- [x] Implemented Verified Auto-Continue with per-origin Manual, Assisted, and Auto modes; Auto requires separate acknowledgement and a visible cancellable three-second in-page countdown.
- [x] Added popup-free OTP fill and same-tab verified magic-link navigation with execution-time URL, hostname, visible-intent, permission, mode, freshness, replay, and deterministic-policy revalidation.
- [x] Added dynamic SPA wait-state detection, hidden/disabled decoy rejection, competing-message fail-closed selection, page-removed countdown cancellation, reduced-motion support, and exact-origin revocation.
- [x] Added privacy-preserving local activity history with a strict secret-free schema, 24-record cap, seven-day TTL, clear control, and trusted-site management page.
- [x] Passed the pre-release Auto-Continue gate: formatting/lint/types, 105 unit/integration tests, three production builds, eight packaged-extension scenarios, and seven judge-browser regressions.
- [x] Completed fresh real Gmail acceptance in Auto mode: Medium opened a verified magic-login link in the same tab and Substack filled a split OTP after the visible cancellable countdown, without reopening the extension after each exact-site opt-in or exposing a code/token.
- [x] Published `v0.2.0-beta.8` as a public GitHub prerelease from the merged Auto-Continue commit; independently downloaded all four assets and verified both checksums, archive structures, and embedded versions.
- [ ] Complete a live Outlook connection when an Entra app registration is available; this is not required for the Gmail-backed release.
- [ ] Human-only submission work: clean-profile walkthrough, record/upload the public video, edit the remaining Devpost placeholders, and run `/feedback`.
