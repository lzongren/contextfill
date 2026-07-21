# Decisions

## D-001: Vanilla DOM UI instead of React

The extension popup and demo use small TypeScript DOM renderers. Their state is compact, so React would add bundle and dependency surface without improving reliability.

## D-002: Programmatic injection with exact-site automation grants

The extension requests `activeTab` and `scripting` and declares optional HTTP(S) origins that receive no access by default. Manual mode injects after the user opens ContextFill. Assisted and Auto-Continue inject only on an exact origin the user explicitly granted and configured. Dynamic top-level DOM observation notices SPA wait states without a permanent all-sites content-script declaration. Trusted-site settings display and revoke each exact origin.

## D-003: Model extracts facts; policy stays deterministic

GPT-5.6 may classify one selected temporary-action message and extract structured evidence. Zod validates the result. URL safety, domain alignment, expiry, replay, and allow/warn/block remain deterministic.

## D-004: Reserved-domain simulation is explicit

Demo pages run on localhost and publish an explicit simulated hostname through page metadata. The popup labels it as a deterministic fixture; it never claims localhost is the represented domain.

## D-005: Fixed host permissions are limited to local product surfaces

Chrome extension pages need host permission for cross-origin `fetch`, and automated judge testing must inject into the fixed local lab without a browser permission prompt. The manifest therefore grants `http://127.0.0.1:4318/*` for the companion and `http://127.0.0.1:4173/*` for the judge lab. Real website access remains temporary through `activeTab` or an explicit exact-origin runtime grant.

## D-006: Replay identity is stable across extractors

GPT-5.6 and deterministic candidates share the same message-derived candidate ID. Replay prevention therefore survives a temporary change in extraction method without storing the sensitive value.

## D-007: Extension loading and page behavior use different browser channels

Playwright's bundled Chromium is used for command-line MV3 side-loading because stable Chrome removed that headless testing path. Functional judge-page acceptance remains on installed Chrome. Manual Chrome installation remains the judge workflow.

## D-008: Fast iteration CI and full tag-gated releases are separate

Pull requests and pushes to `main` run formatting, lint, type, and unit/integration checks under the existing required `verify` status. Version tags run the complete browser-inclusive release gate before packaging and publishing a version-derived ZIP and checksum to both workflow artifacts and GitHub Releases. This keeps feedback fast without weakening the release gate.

## D-009: Mailbox OAuth stays in a loopback companion service

Gmail and Outlook use authorization code flow with PKCE through the existing Node.js companion service. Access tokens remain in memory; refresh tokens are stored through the native OS credential manager and automatically fall back to visible session-only behavior if that backend is unavailable. Provider APIs return a bounded recent-message set that is normalized to the shared mailbox schema before extraction, ranking, deterministic policy, and explicit action.

Real mailbox messages use deterministic extraction by default. Model extraction is a separate explicit opt-in because configuring an OpenAI key must not silently cause personal message content to leave the device.

## D-010: Loopback access uses one-time capability pairing

An extension installation generates a random 256-bit capability after the user enters a six-digit code printed by the companion service. The service stores only the capability hash and binds it to the extension ID; subsequent mailbox and model-extraction requests require both. Pairing codes expire after 10 minutes and rate-limit after five failures. This replaces manual extension-ID configuration while providing actual authentication instead of treating a public extension ID as a secret.

## D-011: Releases include an installable companion CLI

Real-mail use must not require a source checkout or TypeScript toolchain. Release tags therefore publish a bundled Node.js companion `.tgz` beside the extension ZIP, with independent checksums. Its only runtime dependency is the platform keyring binding. The `contextfill-service --init` command creates an owner-only `.env` without overwriting an existing file.

## D-012: Exported `.eml` is the provider-independent real-message bridge

OAuth app registration is a deployment choice owned by the user's Google Cloud project or Microsoft tenant. ContextFill therefore also accepts one explicitly chosen RFC 5322 `.eml` file in the popup. A maintained, browser-compatible MIME parser handles common multipart and encoded messages under a 2 MB input cap and explicit nesting/header limits. Only normalized sender, subject, date, body text, and HTTP(S) link evidence enter the existing schema; attachments never enter extraction. The raw file and normalized body are dropped immediately after local deterministic candidate extraction, never enter optional model extraction, and are never written to extension storage.

## D-013: Live OAuth setup has a non-secret readiness gate

Provider registration errors should be detected before the user reaches a consent screen. The packaged companion therefore includes `--doctor`, which derives configuration from the same code used by the runtime, prints exact callback URIs and requested scopes, validates the service/callback port match, checks owner-only `.env` permissions on POSIX systems, and reports missing variable names without ever echoing client IDs or secrets. A nonzero exit means no provider is safely ready.

## D-014: Outlook registration gets a guided local setup path

Microsoft public-client registrations do not use a client secret, so the companion may safely guide the registration and accept the public Application (client) ID. `--setup outlook` derives its callback and delegated permissions from runtime configuration, validates the UUID and tenant, updates only the Microsoft keys, removes duplicate assignments, preserves unrelated settings, locks `.env` to owner-only permissions, and runs the doctor without echoing the ID.

## D-015: Registration ownership is distinct from supported sign-in accounts

Setting the Microsoft authority to `common` lets a correctly registered application accept personal and organizational accounts; it does not grant a standalone personal Outlook.com account permission to create that registration. The live beta attempt produced `AADSTS50020` in Microsoft's fixed `Microsoft Services` tenant. The CLI, extension, and integration guide therefore state the Entra tenant-role prerequisite before directing a user to the admin center and offer Azure-tenant, administrator, Gmail, and `.eml` alternatives.

## D-016: Gmail credentials import from Google's downloaded web-client JSON

Copying a Gmail client secret into a command argument leaks it into shell history, while an ordinary prompt may echo it. ContextFill instead accepts Google's downloaded OAuth web-client JSON with `--setup gmail --credentials`. It rejects symlinks, non-files, files over 64 KB, malformed or non-web clients, invalid credential shapes, and registrations missing the exact runtime callback. Only the ID and secret are written to the owner-only `.env`; the command prints neither and immediately runs the non-secret readiness doctor. The user deletes Google's source JSON after import.

## D-017: Verified Auto-Continue is the differentiated core

OTP fill alone is already a crowded interaction. The public product story is the whole “check your email” interruption: ContextFill detects the wait state, locates an OTP or magic-login/email-confirmation link, verifies why its sender, destination, and initiating page align, and visibly continues the task under a per-site mode. Verified magic links remain the differentiated action, while Trusted Reference Transfer is the secondary proof that the architecture is a general message-to-page boundary rather than an OTP-specific feature.

## D-018: One-time links are inspected without network activity

A preflight request can consume a link or follow an attacker-controlled redirect. Link inspection therefore operates only on the URL string already present in the normalized message. It requires HTTPS and locally verifiable domain evidence, permanently masks token-bearing path/query/fragment data in the UI, and refuses credentials, IP/local hosts, nonstandard ports, internationalized hosts, shorteners, and opaque click/redirect endpoints. The extension performs no fetch, HEAD request, preconnect, prefetch, or redirect resolution.

## D-019: Every navigation is bound to the scanned tab and URL

Manual mode records the initiating tab ID and exact URL at scan time. Assisted and Auto-Continue record the same context when the page wait state is detected. The navigation controller requires either an explicit manual action or an exact-host Auto-Continue authorization, rechecks the tab ID and exact URL, records candidate use, clears sensitive state, and calls `chrome.tabs.update` with that same ID. Filling performs the same current-page revalidation. A synthetic `.test` action maps only to the fixed localhost completion scenario and is visibly identified as simulation; real-mail links use the exact inspected destination.

## D-020: Reference transfer is narrow and field-driven

Generic numbers and order IDs create unacceptable false positives. Deterministic reference extraction is limited to explicit booking, reservation, application, support, case, or ticket-reference language; the page must expose a correspondingly labeled field. The same domain, service, sender, replay, and user-confirmation policy applies, with a documented 24-hour freshness window and no automatic submission.

## D-021: Mixed login messages prefer the verified link without duplicating secrets

Real providers may send a fallback OTP and a one-time link in the same message. When both are present, ContextFill selects the verified-link action; OTP-only messages retain their existing behavior. Supporting excerpts replace the exact URL with a fixed withheld marker and remain schema-bounded, while confirmation subjects mask embedded fallback codes. Gmail's normal bounded query intentionally does not opt into Spam or Trash; a legitimate message must be moved to the inbox before ContextFill will act on it.

## D-022: Automation is mode-based, visible, cancellable, and revalidated

Every new origin starts Manual. Assisted and Auto-Continue require an exact-origin optional permission; Auto additionally requires an acknowledgement that same-tab magic-link navigation and site-owned OTP auto-submit may occur. Assisted stops at an in-page action button. Auto shows waiting, found, verified, and three-second countdown states in a closed Shadow DOM card with a visible Cancel action, keyboard access, ARIA live updates, and reduced-motion behavior. If the card is removed or hidden, execution is cancelled.

Immediately before an automatic fill or navigation, the background worker rechecks the exact tab URL, page hostname, current OTP/link intent, current exact-origin rule and permission, freshness, expiry, replay state, and deterministic `allow` decision. Warning, block, ambiguous competing-message, stale, changed-page, or revoked states fail closed. The extension dispatches field events but never clicks a button or invokes form submission; destination-page listeners remain outside its control.

## D-023: Activity history must be useful without retaining message secrets

Settings keep at most 24 records for seven days. The strict schema allows only hostname, candidate type, outcome, bounded reason code, timestamp, and a random record ID. Codes, link URLs/tokens, subjects, sender addresses, bodies, and page paths are structurally rejected. Users can clear history independently of trusted-site revocation. Replay IDs remain separate in session-only storage and never contain candidate values.

## D-024: Verified Context Capsules are the multi-fact hero flow

The differentiated product story is now an origin-bound, short-lived capsule that carries exactly the facts a current task needs. The first capsule is deliberately narrow: one recent airline check-in message, one booking reference, one passenger surname, one aligned service/domain, and exactly two safe targets. Its compact presentation makes the complete chain visible as Message → deterministic trust checks → masked capsule → destination plan. Existing magic-link, reference, and OTP flows remain supported examples of the same boundary.

## D-025: Extraction, authorization, mapping, and execution remain separate authorities

Deterministic extraction or GPT-5.6 may produce only strict source-grounded facts. Neither path can return selectors, field targets, or an authorization result. Deterministic policy owns sender/service/origin/freshness/expiry/replay checks; a separate conservative mapper owns visible, enabled, empty, same-container target selection; execution revalidates both at action time. This separation ensures a high-confidence model output cannot bypass domain policy or choose a malicious field.

## D-026: Capsule transfer is atomic, reversible, and non-replayable after Undo

A two-fact handoff is useful only if its receipt is truthful. Execution therefore snapshots both targets, applies values using native setters, verifies every post-set value, and rolls back all prior changes when either assignment is rejected or rewritten. Successful execution marks the capsule used before presenting a receipt. Undo restores only unchanged transferred values and intentionally preserves replay state; it is a page-state reversal, not renewed authorization. No path submits the form.

## D-027: Synthetic capsule activation uses a closed allowlist

The manifest injects the capsule entry on loopback so the packaged judge flow is automatic, but loopback metadata is untrusted. The entry therefore mounts only for the root path on exact origins `http://127.0.0.1:4173` and `http://127.0.0.1:4179` plus a closed scenario-to-host-and-service mapping. Prefix matching, arbitrary ports, localhost aliases, other paths, and caller-provided host/service combinations are rejected. Port `4173` is the human judge lab; `4179` is dedicated to automated acceptance tests so concurrent development servers cannot be mistaken for the product fixture.

## D-028: Real easyJet lookup is explicit, exact-origin, and user-selected

Ordinary Gmail ingestion remains a one-day temporary-action query. A user who opens ContextFill on the exact HTTPS easyJet booking-dialog route may request a separate five-year subject-bounded lookup because historical bookings are legitimate inputs to easyJet's Find Booking form. The service excludes Spam and Trash, caps body retrieval, requires easyJet subject/body/domain evidence, and stamps the service hint only after direct or verified Apple Hide My Email sender evidence passes. Multiple confirmations become masked user choices rather than a policy conflict or automatic selection. The resulting capsule still expires after 90 seconds and is reauthorized and remapped at action time.

Production keeps `easyjet.com` as an optional exact-origin runtime grant. A test-only build flag may add that host to an ephemeral conformance artifact because command-line-opened extension popups do not receive `activeTab`; the normal build and shipped manifest never consume that flag.

## D-029: A greeting name is not passenger-surname evidence

Real easyJet confirmations can greet the recipient by given name while deliberately omitting the passenger surname required by Find Booking. ContextFill must not reinterpret `Hi, Name` as a surname. A two-fact Capsule is available only when the message explicitly labels a surname or last name. When the otherwise verified confirmation contains only a booking reference, the popup preserves masked user selection, explains the missing evidence, and offers a reference-only transfer; the user enters the surname directly on easyJet. The fallback retains exact-origin, sender/domain, freshness, replay, empty-field, and no-submit checks.

## D-030: Each live airline gets a closed origin, mailbox, and evidence profile

Live airline support does not reuse the generic temporary-code scan. easyJet and Alaska Airlines each bind an exact HTTPS booking route to a purpose-specific Gmail query, strict sender/message validation, a fixed service hint, and an explicit historical lookup window. Alaska accepts only `reservation@email.alaskaair.com` confirmations whose subject and body contain the expected booking structure and Alaska domain evidence. Its surname may come only from exactly one two-part name in the labeled `Traveler(s)` section; greetings, multiple travelers, compound-name ambiguity, and unlabeled names block. Production keeps website access runtime-only, while packaged tests temporarily add only the two official hosts.
