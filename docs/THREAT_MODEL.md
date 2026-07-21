# ContextFill threat model

## Scope

This review covers the Chrome MV3 extension, synthetic fixtures, one-time `.eml` import, Gmail and Outlook connectors, loopback companion service, deterministic core, and localhost judge pages. ContextFill is evolving toward personal real-mailbox use; it is not a production authentication control.

## Assets

- One-time link tokens, verification codes, trusted references, and the facts inside a short-lived context capsule.
- The relationship between a message, sender, service, destination, and initiating site.
- The user's explicit consent to open or fill.
- The optional OpenAI API key.
- Gmail and Microsoft OAuth access and refresh tokens.
- The per-install loopback pairing capability.
- Integrity of the deterministic policy, field map, atomic transfer, rollback receipt, and replay state.
- Privacy of inbox and browsing context.

## Trust boundaries

1. **Webpage → isolated content script:** the page DOM, labels, metadata, layout, fields, event listeners, scenario attributes, and simulated host/service metadata are untrusted. Capsule fixture activation additionally requires an exact allowlisted origin and scenario/host/service tuple.
2. **Mailbox provider, imported file, or synthetic message → normalization and extraction:** provider JSON, MIME structure, subject, body, sender, URLs, attachments, and any instructions in a message are untrusted data.
3. **Extension popup → content script or initiating tab:** only an explicit popup action carries a value to a currently detected field or navigates the exact tab and URL captured during inspection.
4. **Popup → loopback service:** model extraction and mailbox requests use a fixed loopback endpoint. Real-mail endpoints require a paired capability and matching extension installation ID; browser `Origin` is cross-checked when present.
5. **Loopback service → OS credential manager:** refresh tokens and the hashed pairing record persist through the native platform keychain; access tokens remain in memory.
6. **Loopback service → Gmail/Microsoft APIs:** only bounded recent-message queries are made with delegated read-only scopes.
7. **Loopback service → OpenAI API:** the API key remains server-side; a bounded message slice leaves the machine only when configured.
8. **Model output → application state:** every field is schema-validated and evidence-checked before ranking or policy.
9. **Policy and field plan → mutation/navigation:** action-time policy and replay are rechecked, and the complete field plan is regenerated against the current DOM. An allow decision is required before link navigation or capsule transfer. An allow decision, or an acknowledged eligible warning, is required before legacy single-value filling. Link warnings and all block decisions cannot be overridden.

## Threats and mitigations

### Multi-field capsule leaks or over-collects message data

**Threat:** A capsule collects extra passenger or itinerary details, renders raw facts in the overlay, or allows one fact to be transferred without the other.

**Mitigations:** The capsule schema is strict and closed: one travel-check-in intent, exactly two unique keys (`booking_reference` and `passenger_surname`), bounded source-grounded values, and no unknown fields. Message bodies and model output are untrusted. The presentation layer masks both values everywhere, including occurrences inside the subject. Transfer is all-or-nothing and the receipt reports only the count and target labels. No capsule fact is copied, logged, put in analytics, or persisted.

**Residual risk:** The two permitted facts are still sensitive while present in extension/page memory and become visible in the destination fields after the user explicitly transfers them. A hostile page or local browser debugging session can inspect its own field values.

### Field confusion, malicious labels, and decoy controls

**Threat:** A hostile page labels a password, payment, hidden, offscreen, zero-size, disabled, ambiguous, or unrelated input as the booking reference or surname and tricks ContextFill into targeting it.

**Mitigations:** Mapping is deterministic and separate from extraction and policy. It rejects password and sensitive/payment/account signals, hidden/disabled/read-only controls, zero-size or offscreen geometry, ambiguous same-key matches, nonempty targets, overlong constraints, and targets that do not share one form or explicit form-like container. Only the two exact key-specific field plans are accepted. The plan is regenerated at action time before mutation. Unit and browser fixtures cover hidden decoys, zero-size controls, split forms, ambiguity, and sensitive labels.

**Residual risk:** DOM semantics and layout are page-controlled. A malicious page can change labels or geometry after inspection; action-time revalidation narrows but cannot eliminate every time-of-check/time-of-use race inside hostile page code.

### Partial capsule mutation or framework rewrite

**Threat:** The first field accepts its value but an input listener or framework rejects, rewrites, removes, or redirects the second assignment, leaving a misleading partial transfer.

**Mitigations:** Execution revalidates the entire plan, snapshots both previous values, uses the native value setter, dispatches only `input` and `change`, and verifies the post-set value after each mutation. Any mismatch triggers reverse-order rollback of every prior mutation and no success receipt. A successful transfer marks replay before the receipt is exposed. Undo restores only values that still equal the transferred facts, so it does not overwrite later user edits.

**Residual risk:** Page-owned listeners can cause side effects in response to input/change events even when values are rolled back. ContextFill cannot make an arbitrary hostile document transactionally isolated.

### Capsule overwrite, persistence, expiry, or replay

**Threat:** ContextFill overwrites user input, retains capsule facts, transfers an expired capsule, or lets Undo make a used capsule reusable.

**Mitigations:** Both target fields must be empty before approval and again at execution. Capsule facts live in short-lived variables, expire after 90 seconds, and are never put in browser storage. Action-time policy checks current time and background replay state. Successful execution records only the stable capsule ID; Undo restores prior values but deliberately preserves replay. Dismissal, expiry, and failure clear the presentation state without submission.

**Residual risk:** MV3 in-memory replay can reset after browser or extension restart, and destination fields retain transferred facts until the page or user clears them.

### Arbitrary loopback page impersonates a trusted fixture

**Threat:** Because the manifest can inject a content script on loopback pages, an unrelated local page supplies `contextfill-scenario`, simulated host, and service metadata to mount a trusted-looking capsule overlay.

**Mitigations:** Content-script activation uses a closed code-level allowlist: only the root path on exact origins `http://127.0.0.1:4173` and `http://127.0.0.1:4179`, known capsule scenario names, and each scenario's exact simulated host/service tuple are accepted. Scheme, hostname aliases, ports, other paths, foreign metadata, and arbitrary `capsule*` strings fail closed. Unit and packaged-browser tests include negative activation assertions.

**Residual risk:** The local judge server and built extension remain trusted development artifacts. An attacker who replaces those files or controls the allowlisted port can imitate the fixture; code signing and production-origin deployment are outside this prototype.

### Malicious webpage requests an unrelated code

**Threat:** A page presents an OTP-like field and induces the extension to choose a recent code for another service.

**Mitigations:** The policy checks service names and registrable domains independently from field detection. Explicit message-domain mismatch and claimed-service conflict block. Candidate ranking heavily penalizes block decisions. The popup exposes the requesting hostname and reason before mutation.

**Residual risk:** A service with no reliable domain evidence may produce a warning. User override in warning states can still be socially engineered.

### Lookalike or homograph domain

**Threat:** A hostname resembles the expected service through digit/letter substitution, Unicode, punycode, hyphens, or deceptive extra labels.

**Mitigations:** Hostnames are NFKC-normalized, lowercased, stripped of a trailing dot, converted through the URL parser, and compared at registrable-domain level with `tldts`. Punycode and Unicode are flagged. A limited skeleton flags `o/0`, selected `i/l/1` confusables, hyphen changes, expected domains embedded inside another hostname, and different registrable domains containing the brand. Explicit mismatch always blocks even when no lookalike signal fires.

**Residual risk:** The skeleton is intentionally incomplete. It does not solve every Unicode script, visual rendering, or brand impersonation attack.

### One-time link is consumed, redirected, or opened on the wrong site

**Threat:** Inspection consumes a one-time token, an opaque tracking wrapper hides the real destination, a link targets a different service, or an allowed link opens automatically or in a new tab that loses the initiating context.

**Mitigations:** Inspection uses only the URL string already present in the normalized message. ContextFill performs no `fetch`, `HEAD`, preconnect, prefetch, redirect resolution, Safe Browsing lookup, image load, or clipboard copy. The deterministic inspector requires HTTPS and a registrable hostname; rejects embedded credentials, IP and local destinations, nonstandard ports, punycode/internationalized hosts, known shorteners, and opaque click/redirect paths; masks the final path segment plus all query/fragment data; and requires the destination registrable domain to align with both the initiating page and sender. The policy must be **allow**, the candidate must be fresh and unused, and the user must click **Open verified link in this tab**. The controller rechecks that the captured tab still has the exact scanned URL, records replay state, clears candidate state, and calls `chrome.tabs.update` only for that captured tab. Synthetic `.test` links map to an explicitly labeled localhost completion fixture without fetching or pretending to visit the represented domain.

**Residual risk:** A same-domain endpoint can redirect after the explicit navigation, DNS or server ownership can change, and the destination service ultimately controls the response. ContextFill deliberately refuses links whose destination cannot be established locally, but it cannot prove future network behavior without consuming the link. Public-suffix, URL-parser, browser, and extension integrity remain trusted dependencies.

### Compromised or spoofed sender

**Threat:** A message claims the right service while arriving from an unrelated sender domain.

**Mitigations:** Sender and referenced-domain evidence are separate. A sender-domain conflict produces a warning even when the message references the current site. Magic-link warnings cannot be overridden; navigation requires sender, destination, and page alignment. Message instructions cannot change policy.

**Residual risk:** The prototype does not inspect SPF, DKIM, DMARC, transport headers, account compromise, or mailbox provider reputation. A visually correct sender is not cryptographic proof.

### Prompt injection inside a message

**Threat:** Message text instructs the model or application to ignore policy and authorize all sites.

**Mitigations:** The model receives a developer instruction that message content is untrusted data and is asked only for facts. The strict schema has no authorization field. Unknown fields are rejected. The deterministic fallback uses regex and metadata, not instructions. The included prompt-injection fixture is treated as ordinary evidence and cannot influence policy code.

**Residual risk:** Model classification could still be wrong; deterministic evidence checks and policy reduce but do not eliminate extraction errors.

### Model hallucination or malformed output

**Threat:** GPT-5.6 invents a code/domain, returns partial JSON, or includes unexpected fields.

**Mitigations:** Responses API strict JSON schema, Zod validation, value-presence checks, domain-presence filtering, excerpt-presence filtering, bounded confidence, timeouts, no retries, and deterministic fallback. Model-selected link intents are independently checked against the full source message; password reset, recovery, payment, and signing actions are rejected. Every selected URL still passes deterministic URL inspection and policy. The model is never the final authority for allow/warn/block.

**Residual risk:** A wrong value already present somewhere in an adversarial message could pass presence validation. Verification-language proximity, confidence, ranking, and domain policy remain important.

### Temporary-action replay

**Threat:** The same code, link, or reference is used again during a session or an extraction-method change bypasses replay state.

**Mitigations:** Both model and fallback use a stable message-derived candidate ID. Successful fill or link opening records only that ID in the MV3 background worker for 15 minutes. The policy blocks used IDs before domain evaluation.

**Residual risk:** Browser/extension restart can clear in-memory replay state. No durable replay database is used by design.

### Expired or stale action

**Threat:** An old but otherwise matching code, link, or reference is transferred.

**Mitigations:** Explicit `expiresAt` at or before the current time blocks. OTP and magic-link messages older than 15 minutes block; the narrowly scoped reference path uses a documented 24-hour freshness window. Expired values are removed from retained confirmation state immediately.

**Residual risk:** Real providers use varying validity wording. The connectors infer common minute/hour phrases, but absent or unusual expiry evidence still falls back to the general freshness window.

### Mailbox OAuth token theft or provider overreach

**Threat:** A local attacker steals a refresh token, a connector requests write access, or an API response causes broad mailbox disclosure.

**Mitigations:** Gmail uses only `gmail.readonly`; Microsoft uses delegated `Mail.Read`, never application or write permissions. OAuth uses PKCE, random state, exact loopback redirects, and bounded pending-state lifetime. The non-secret readiness doctor derives callbacks and scopes from runtime configuration, rejects service/callback port drift, and checks private `.env` permissions before consent. Access tokens stay in service memory; refresh tokens use the native OS credential manager and are deleted on disconnect. A failed durable deletion is surfaced to the extension instead of being reported as success. Gmail normally searches one day of temporary-action phrases and retrieves at most 12 bodies; Outlook filters 25 recent summaries to at most 10 code, magic-link, or reference-like results. The explicit easyJet booking-lookup purpose is the sole historical exception: it activates only on the exact allowlisted easyJet booking-dialog route, uses a five-year subject-bound Gmail query with spam and trash excluded, caps retrieval at 12, and then requires the exact subject/body shape plus a verified easyJet sender before extraction. Apple Hide My Email relay senders are accepted only when the actual `@icloud.com` relay address encodes the apparent easyJet address; a forged or conflicting relay fails closed. If several eligible bookings remain, the popup shows masked choices and requires the user to select one. HTML-only message normalization preserves HTTPS anchor destinations as inert text without loading them. Provider responses are normalized through strict schemas before reaching extraction. Real messages use deterministic extraction unless the user separately opts into sending prefiltered content through the configured OpenAI service.

**Residual risk:** Local malware running as the user can inspect process memory or invoke the same credential APIs. Gmail's scope still permits broad read access and requires provider review for public distribution. Historical airline mail and relay formats can change, causing legitimate bookings to be rejected until the deterministic parser is updated. Live provider audit verification remains required before general release.

### Malicious or resource-exhausting `.eml` import

**Threat:** A selected email file is oversized, malformed, deeply nested, carries executable HTML, hides domain evidence in a link, or embeds sensitive attachments.

**Mitigations:** Import is an explicit one-file gesture and accepts only a `.eml` filename up to 2 MB. The browser-compatible MIME parser has explicit 30-level nesting and 256 KB header limits. Scripts, styles, and templates are removed from the HTML string without rendering it; only text and HTTP(S) `href` values enter the bounded mailbox schema. Parsed attachments are never included in extraction, ranking, model input, or UI. Missing Subject/Date/body metadata and invalid normalized sender data fail closed. The raw file and normalized body are dropped immediately after local deterministic candidate extraction and cannot enter the optional model path.

**Residual risk:** The parser must still inspect the bounded attachment bytes contained in the selected file, and complex or encrypted MIME may be rejected. MIME parser supply-chain integrity and worst-case performance require continued review. A malicious but schema-valid message can still present misleading evidence, so deterministic domain policy and user review remain mandatory.

### Sensitive logs, clipboard, storage, and analytics

**Threat:** A full code, reference, or one-time link token leaks through UI, logs, clipboard, persistent extension storage, telemetry, or screenshots.

**Mitigations:** Production code does not log candidate values, never touches the clipboard, and has no analytics. Extension storage contains only the selected persistent source, model opt-in, and random pairing capability; access is restricted to trusted extension contexts. Imported files, candidate values, message bodies, and OAuth tokens are excluded. Codes and references are masked by default and cannot be revealed on blocks; link path/query/fragment secrets are never revealed. Candidate state clears after action/dismissal/expiry/90 seconds. Refresh tokens and only the hash of the pairing capability use the OS keychain.

**Residual risk:** A user can intentionally reveal or photograph a code. Browser developer tooling or local profile access can expose extension memory and its pairing capability.

### Overbroad browser permissions

**Threat:** A compromised extension can read arbitrary sites continuously.

**Mitigations:** `activeTab` grants temporary page access only after invocation; `scripting` injects the general content path on demand into the main frame. The only declarative content script is the synthetic capsule overlay on loopback, and its code-level origin/scenario/metadata allowlist fails closed outside the two fixed judge/test ports. Fixed host access is limited to the loopback companion and judge lab. Optional HTTP(S) patterns are declared but not granted by default; if injection lacks access, the popup requests one exact origin at runtime and continues only after the user grants it.

**Residual risk:** During the active-tab grant, compromised extension code could inspect the active page. Supply-chain and extension integrity still matter.

### API-key exposure

**Threat:** The OpenAI key appears in extension bundles, browser storage, fixtures, screenshots, Git history, or logs.

**Mitigations:** Only the Node service imports the OpenAI SDK or reads `OPENAI_API_KEY`. `.env` and `.env.*` are ignored except `.env.example`. Health output reports only a boolean. Release inspection searches the extension bundle and repository for secret-like patterns.

**Residual risk:** Local malware, shell history, environment inspection, or careless screen recording can expose a user-provided key.

### Cross-origin loopback abuse

**Threat:** A malicious website calls the local service to spend API quota or exfiltrate message content.

**Mitigations:** The server binds to `127.0.0.1`, uses no cookies, sets `no-store`, rejects model payloads above 12 KB, truncates model content to 4,000 characters, and exposes no arbitrary URL fetch. Mailbox and model-extraction endpoints require a random 256-bit capability bound to the extension installation ID. The one-time six-digit bootstrap code expires after 10 minutes and rate-limits after five failures. Only a SHA-256 capability hash reaches the service keychain. OAuth callbacks separately require one-time random state.

**Residual risk:** A local process running as the user can call loopback directly and may be able to inspect browser profile storage. Pairing authenticates the intended browser client against ordinary web-origin requests; it is not a sandbox against local malware. Request accounting and packaged-service integrity remain future hardening.

### Automatic navigation, submission, or unintended page mutation

**Threat:** Merely opening ContextFill navigates or consumes a link, or filling triggers Verify/Continue, changes unrelated inputs, or modifies hidden/disabled fields.

**Mitigations:** Scanning and confirmation never call the navigation controller. Only the explicit Open button can invoke same-tab navigation. Detection rejects hidden, disabled, read-only, and unrelated inputs; split fills require a contextual 4–8 input group, reference fill requires an explicit booking/application/support-reference label, and a capsule requires exactly two empty safe targets in one container. Mutation uses the native value setter plus `input` and `change` events only. Capsule execution verifies every post-set value and atomically rolls back on mismatch. Fill and navigation recheck captured/action-time context. No button click, Enter key, `requestSubmit`, or `submit` call exists. Unit, packaged-extension, and installed-Chrome tests assert inert inspection, same-tab handoff, replay block, capsule rollback and Undo, zero submit count, and unchanged unrelated controls.

**Residual risk:** A hostile page can attach an `input` listener that submits in response to any value change. The extension itself never submits, but it cannot prevent page-owned event handlers. A production version should warn about or detect synchronous navigation/submission after mutation.

### Accidental private data in fixtures or media

**Threat:** A personal email, OAuth consent screen, key, browser profile, or unrelated tab appears in screenshots or the public repository.

**Mitigations:** Committed fixtures remain synthetic. The screenshot plan calls for a clean browser profile and excludes keys, provider account identifiers, profile chrome, personal tabs, and inbox UI. Real-mail testing must not be used for public hackathon media.

## Explicit non-goals

- Claiming phishing-proof, complete homograph detection, or production readiness.
- Verifying mailbox transport authentication or sender account integrity.
- Hosted multi-user mailbox service or server-side storage of user mail.
- Hosted synchronization of OAuth credentials or mailbox content.
- Password capture, password-manager behavior, clipboard management, link prefetch, automatic navigation, or automatic submission.
- Password-reset, account-recovery, payment-authorization, wire-transfer, document-signing, or e-signature links.
- URL shorteners, opaque click/redirect wrappers, IP/local destinations, nonstandard link ports, or internationalized link destinations.
- Iframe, cross-origin frame, or closed shadow-root field support.
- Generic order-number extraction or arbitrary message-to-form automation; references are limited to explicitly labeled booking, application, and support workflows.
- Durable replay prevention across restarts or enforcement by the destination service.
