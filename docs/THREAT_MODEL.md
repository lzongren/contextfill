# ContextFill threat model

## Scope

This review covers the Chrome MV3 extension, synthetic fixtures, loopback GPT-5.6 companion service, deterministic core, and localhost judge pages. ContextFill is a hackathon prototype that demonstrates a safer transfer interaction; it is not a production authentication control.

## Assets

- The temporary verification-code value.
- The relationship between a message, service, and requesting site.
- The user's explicit consent to reveal or fill.
- The optional OpenAI API key.
- Integrity of the deterministic policy and replay state.
- Privacy of inbox and browsing context.

## Trust boundaries

1. **Webpage → isolated content script:** the page DOM, labels, metadata, and fields are untrusted. Only localhost may provide a simulated hostname.
2. **Synthetic message → extraction:** subject, body, sender, URLs, and any instructions in a message are untrusted data.
3. **Extension popup → content script:** only an explicit popup action carries a value to a currently detected field.
4. **Popup → loopback service:** only prefiltered synthetic messages are sent to a fixed loopback endpoint.
5. **Loopback service → OpenAI API:** the API key remains server-side; a bounded message slice leaves the machine only when configured.
6. **Model output → application state:** every field is schema-validated and evidence-checked before ranking or policy.
7. **Policy → mutation:** an allow decision, or an acknowledged warn decision, is required before filling. Block cannot be overridden.

## Threats and mitigations

### Malicious webpage requests an unrelated code

**Threat:** A page presents an OTP-like field and induces the extension to choose a recent code for another service.

**Mitigations:** The policy checks service names and registrable domains independently from field detection. Explicit message-domain mismatch and claimed-service conflict block. Candidate ranking heavily penalizes block decisions. The popup exposes the requesting hostname and reason before mutation.

**Residual risk:** A service with no reliable domain evidence may produce a warning. User override in warning states can still be socially engineered.

### Lookalike or homograph domain

**Threat:** A hostname resembles the expected service through digit/letter substitution, Unicode, punycode, hyphens, or deceptive extra labels.

**Mitigations:** Hostnames are NFKC-normalized, lowercased, stripped of a trailing dot, converted through the URL parser, and compared at registrable-domain level with `tldts`. Punycode and Unicode are flagged. A limited skeleton flags `o/0`, selected `i/l/1` confusables, hyphen changes, expected domains embedded inside another hostname, and different registrable domains containing the brand. Explicit mismatch always blocks even when no lookalike signal fires.

**Residual risk:** The skeleton is intentionally incomplete. It does not solve every Unicode script, visual rendering, or brand impersonation attack.

### Compromised or spoofed sender

**Threat:** A message claims the right service while arriving from an unrelated sender domain.

**Mitigations:** Sender and referenced-domain evidence are separate. A sender-domain conflict produces a warning even when the message references the current site. Message instructions cannot change policy.

**Residual risk:** The prototype does not inspect SPF, DKIM, DMARC, transport headers, account compromise, or mailbox provider reputation. A visually correct sender is not cryptographic proof.

### Prompt injection inside a message

**Threat:** Message text instructs the model or application to ignore policy and authorize all sites.

**Mitigations:** The model receives a developer instruction that message content is untrusted data and is asked only for facts. The strict schema has no authorization field. Unknown fields are rejected. The deterministic fallback uses regex and metadata, not instructions. The included prompt-injection fixture is treated as ordinary evidence and cannot influence policy code.

**Residual risk:** Model classification could still be wrong; deterministic evidence checks and policy reduce but do not eliminate extraction errors.

### Model hallucination or malformed output

**Threat:** GPT-5.6 invents a code/domain, returns partial JSON, or includes unexpected fields.

**Mitigations:** Responses API strict JSON schema, Zod validation, code-presence checks, domain-presence filtering, excerpt-presence filtering, bounded confidence, timeouts, no retries, and deterministic fallback. The model is never the final authority for allow/warn/block.

**Residual risk:** A wrong value already present somewhere in an adversarial message could pass presence validation. Verification-language proximity, confidence, ranking, and domain policy remain important.

### Code replay

**Threat:** The same code is filled again during a session or extraction-method changes bypass replay state.

**Mitigations:** Both model and fallback use a stable message-derived candidate ID. Successful fill records only that ID in the MV3 background worker for 15 minutes. The policy blocks used IDs before domain evaluation.

**Residual risk:** Browser/extension restart can clear in-memory replay state. No durable replay database is used by design.

### Expired or stale code

**Threat:** An old but otherwise matching code is transferred.

**Mitigations:** Explicit `expiresAt` at or before the current time blocks. Messages older than the 15-minute window block. Expired values are removed from retained confirmation state immediately.

**Residual risk:** Real providers use varying validity windows, and an absent/incorrect message expiry would require provider-specific policy.

### Sensitive logs, clipboard, storage, and analytics

**Threat:** A full code leaks through console output, clipboard, persistent extension storage, telemetry, or screenshots.

**Mitigations:** Production code does not log codes, never touches the clipboard, has no analytics, requests no storage permission, masks values by default, disallows reveal on blocks, and clears popup state after fill/dismiss/expiry/90 seconds. Only synthetic values exist in fixtures and tests.

**Residual risk:** A user can intentionally reveal or photograph a code. Browser developer tooling can inspect extension memory while it is active.

### Overbroad browser permissions

**Threat:** A compromised extension can read arbitrary sites continuously.

**Mitigations:** `activeTab` grants temporary page access only after invocation; `scripting` injects on demand into the main frame. There is no `<all_urls>` or persistent content-script match. The only permanent host permission is the exact optional loopback service origin.

**Residual risk:** During the active-tab grant, compromised extension code could inspect the active page. Supply-chain and extension integrity still matter.

### API-key exposure

**Threat:** The OpenAI key appears in extension bundles, browser storage, fixtures, screenshots, Git history, or logs.

**Mitigations:** Only the Node service imports the OpenAI SDK or reads `OPENAI_API_KEY`. `.env` and `.env.*` are ignored except `.env.example`. Health output reports only a boolean. Release inspection searches the extension bundle and repository for secret-like patterns.

**Residual risk:** Local malware, shell history, environment inspection, or careless screen recording can expose a user-provided key.

### Cross-origin loopback abuse

**Threat:** A malicious website calls the local service to spend API quota or exfiltrate message content.

**Mitigations:** The server binds to `127.0.0.1`, accepts only extension origins with valid ID syntax or the known demo origin, uses no credentials/cookies, sets `no-store`, rejects payloads above 12 KB, truncates model content to 4,000 characters, and exposes no arbitrary URL fetch.

**Residual risk:** Browser origins are not strong client authentication. Production would require a per-install capability token, HTTPS-equivalent secure local transport, tighter rate limits, and request accounting.

### Automatic submission or unintended page mutation

**Threat:** Filling triggers Verify/Continue, changes unrelated numeric inputs, or modifies hidden/disabled fields.

**Mitigations:** Detection rejects hidden, disabled, read-only, and unrelated inputs; split fills require a contextual 4–8 input group. Mutation uses the native value setter plus `input` and `change` events only. No button click, Enter key, `requestSubmit`, or `submit` call exists. Unit and installed-Chrome tests assert submit count remains zero and unrelated controls stay unchanged.

**Residual risk:** A hostile page can attach an `input` listener that submits in response to any value change. The extension itself never submits, but it cannot prevent page-owned event handlers. A production version should warn about or detect synchronous navigation/submission after mutation.

### Accidental private data in fixtures or media

**Threat:** A personal email, key, browser profile, or unrelated tab appears in screenshots or the public repository.

**Mitigations:** All messages, brands, domains, names, and codes are synthetic. The screenshot plan calls for a clean browser profile and excludes keys, profile chrome, personal tabs, and inbox UI. No real inbox integration exists.

## Explicit non-goals

- Claiming phishing-proof, complete homograph detection, or production readiness.
- Verifying mailbox transport authentication or sender account integrity.
- Gmail OAuth, personal mailbox access, or hosted multi-user service.
- Password capture, password-manager behavior, clipboard management, or automatic navigation.
- Iframe, cross-origin frame, or closed shadow-root field support.
- Magic-link opening, order references, or booking references in the P0/P1 release.
- Durable replay prevention across restarts or enforcement by the destination service.
