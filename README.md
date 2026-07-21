# ContextFill

[![CI](https://github.com/lzongren/contextfill/actions/workflows/ci.yml/badge.svg)](https://github.com/lzongren/contextfill/actions/workflows/ci.yml)

> **ContextFill safely bridges the gap between “check your email” and continuing the task—starting with verified magic links.**

ContextFill is a privacy-first Chrome extension for **Verified Magic-Link Handoff**. It finds a magic-login or email-confirmation link in its built-in synthetic inbox, a one-time imported `.eml` file, or an explicitly connected Gmail/Outlook account; verifies that the sender, claimed service, link destination, freshness, and initiating tab align; explains an **allow**, **warn**, or **block** decision; and opens an allowed link in that same tab only after explicit approval. It never fetches or prefollows the link during inspection.

The same deterministic message-to-page engine also supports verification codes and one narrowly scoped **Trusted Reference Transfer** for booking, application, and support references. It never automatically navigates, copies a value, submits a form, or lets a model authorize an action.

This is a judge-testable hackathon prototype, not a production security product.

## The problem

“Check your email” interrupts sign-in, confirmation, booking, and support flows. Users must locate the right message, distinguish the real action from lookalikes, and carry a one-time link or reference back to the correct page. Existing OTP autofill handles one narrow shape but does not provide a transparent, general message-to-page trust decision.

ContextFill demonstrates a different interaction model. Extraction and authorization are separate:

- An extractor identifies a bounded temporary action in one recent message.
- Deterministic code checks the page hostname, registrable domain, sender evidence, claimed service, recency, expiry, replay state, and controlled lookalike signals.
- A confirmation card makes the evidence and decision visible.
- The user—not the model—chooses whether an allowed link opens in the initiating tab or a value fills the detected field.

## Five-minute demo

Requirements: Node.js 20+, npm, and Chrome 114 or newer.

```bash
npm install
npm run build
npm run demo
```

Then:

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose `dist/extension`.
4. Open [http://127.0.0.1:4173/?scenario=magic-link](http://127.0.0.1:4173/?scenario=magic-link).
5. Click ContextFill. Confirm that the one-time path and query are masked, the sender/page/destination evidence aligns, and the tab has not navigated.
6. Click **Open verified link in this tab**. The same tab reaches a clearly labeled local completion fixture; ContextFill never fetched the synthetic `.test` link.
7. Open [http://127.0.0.1:4173/?scenario=magic-link-lookalike](http://127.0.0.1:4173/?scenario=magic-link-lookalike). Confirm that the lookalike initiating domain is blocked and no Open action exists.
8. Open [http://127.0.0.1:4173/?scenario=reference](http://127.0.0.1:4173/?scenario=reference). Confirm that **Fill reference** changes only the booking-reference field and never submits.

No email account, cloud setup, personal data, paid service, or OpenAI API key is required. See [Judge testing](docs/JUDGE_TESTING.md) for every fixture and expected result.

For a real-message test without cloud setup, export one message from Gmail or Outlook as `.eml`, open **Message source → Import email file**, and choose it. The bounded file is parsed locally inside the popup, used once, and never persisted. For ongoing use, ContextFill can connect to Gmail or Outlook through its loopback companion service. Outlook has a guided `contextfill-service --setup outlook` path that prints the exact callback and permissions, then privately saves the public client ID. Creating that registration requires a work/school account with an Entra tenant role or a personal account backed by its own Azure tenant; a standalone Outlook.com account can use the finished multitenant connector but cannot own its registration. Gmail's guided `contextfill-service --setup gmail` path prints its exact callback and imports Google's downloaded web-client JSON directly into owner-only configuration without printing the secret. Tagged releases include both the extension ZIP and an installable `contextfill-companion` package, each with a SHA-256 checksum. See [Real mailbox integration](docs/MAILBOX_INTEGRATION.md) for both paths, least-privilege OAuth setup, current security boundaries, and provider limitations.

## Architecture

```mermaid
flowchart LR
  U["User opens popup"] --> C["On-demand content script"]
  C --> F["Field and initiating-page context"]
  S["Synthetic inbox"] --> X["Candidate extraction"]
  I["One-time .eml import"] --> X
  X --> R["Transparent ranking"]
  F --> P["Deterministic trust policy"]
  R --> P
  P --> UI["Evidence and allow, warn, or block"]
  UI -->|"Explicit Open"| T["Captured initiating tab"]
  UI -->|"Explicit Fill"| C
  C --> M["Detected input mutation only"]
  T --> O["Same-tab navigation"]
  M -. "never" .-> N["Form submission"]
  UI -. "never" .-> Q["Link prefetch"]
  L["Optional loopback service"] -->|"GPT-5.6 facts"| X
  X -->|"failure"| D["Deterministic fallback"]
```

The main boundaries are deliberately small:

- `packages/core` owns schemas, fixtures, extraction, ranking, domains, policy, confirmation data, and field mutation.
- `apps/demo` owns honest localhost fixtures and their visible simulated hostnames.
- `apps/extension` owns user activation, local MIME import, evidence presentation, explicit approval, and short-lived state.
- `apps/local-service` owns the API key and optional GPT-5.6 Responses API call.
- The same loopback service owns Gmail/Outlook OAuth tokens and normalizes a bounded recent-message set; tokens never enter the extension bundle.
- The model never returns or influences an allow/warn/block decision.

## Synthetic inbox

The in-memory provider includes:

- Current and older six-digit Northstar verification messages, so recency ranking is visible.
- A BlueRail alphanumeric code.
- An expired code.
- An unrelated receipt containing multiple numbers.
- A magic-link message.
- A booking-reference message.
- A sender-domain conflict.
- An untrusted message containing prompt-injection text.

Fixtures are original, synthetic, rebuilt relative to the current clock, and never use a personal inbox. Scenario pages select a narrow fixture slice so judge results are deterministic.

## Demo scenarios

| Scenario               | Simulated page            | Inbox condition                       | Expected result                                   |
| ---------------------- | ------------------------- | ------------------------------------- | ------------------------------------------------- |
| `magic-link`           | `login.cedarnotes.test`   | Recent Cedar Notes sign-in link       | Allow; masked evidence; explicit same-tab handoff |
| `magic-link-lookalike` | `login.cedarn0tes.test`   | Legitimate Cedar Notes link           | Block; no navigation action                       |
| `reference`            | `trips.cedartravel.test`  | Recent booking reference              | Allow; fill only `CT-7K92Q`; no submit            |
| `reference-lookalike`  | `trips.cedar-travel.test` | Legitimate booking reference          | Block; no mutation                                |
| `legitimate-single`    | `account.northstar.test`  | Recent Northstar code                 | Allow; fill `481203`; no submit                   |
| `legitimate-split`     | `account.northstar.test`  | Recent Northstar code                 | Allow; six fields receive `4 8 1 2 0 3`           |
| `lookalike`            | `account.n0rthstar.test`  | Legitimate Northstar message          | Block; no override or mutation                    |
| `mismatch`             | Northstar page            | BlueRail message only                 | Block service mismatch                            |
| `expired`              | `account.northstar.test`  | Expired Northstar code only           | Block and report expiry                           |
| `ambiguous`            | `account.northstar.test`  | Referenced domain and sender conflict | Warn; require caution acknowledgement             |
| `empty`                | `account.northstar.test`  | Unrelated numeric receipt only        | Empty state; no mutation                          |

Localhost cannot reproduce distinct registrable domains. Each page therefore shows both its real loopback origin and an explicit **SIMULATED ACTIVE DOMAIN** label. The extension accepts that override only on `127.0.0.1` or `localhost`.

## Extension permissions

The MV3 manifest requests:

- `activeTab` for temporary access after the user invokes the extension.
- `scripting` for on-demand main-frame injection.
- `storage` for the selected persistent source, explicit model opt-in, and random companion-service pairing capability. Imported message content, codes, and OAuth tokens are never stored there.
- Fixed loopback host permissions for the companion (`127.0.0.1:4318`) and judge lab (`127.0.0.1:4173`).
- Optional HTTP(S) origin patterns. Chrome grants none by default; if temporary `activeTab` access is insufficient, the popup asks for one exact origin such as `https://example.com/*` at runtime.

It does **not** receive permanent access to every site, or request browsing history, clipboard, password, or form-submission privileges. Chrome documents `activeTab` as temporary access granted by an explicit extension gesture and optional host permissions as runtime-granted access ([activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)).

## Optional GPT-5.6 extraction

The deterministic path is the default judge path. To enable the model path:

```bash
cp .env.example .env
# Put OPENAI_API_KEY in .env. Never commit that file.
npm run service
```

Pair the extension with the terminal code from `npm run service`, leave `npm run demo` running in another terminal, and reopen ContextFill. The popup will say **GPT-5.6 extracted message facts · deterministic policy decided** when a validated model candidate is selected.

The local service:

- Binds only to `127.0.0.1:4318`.
- Reads `OPENAI_API_KEY` from the environment; the key never enters extension source, browser storage, fixtures, or screenshots.
- Uses the OpenAI Responses API with the `gpt-5.6` alias by default and `store: false`.
- Sends one prefiltered temporary-action message at a time, truncated to 4,000 characters; it sends no browsing history or unrelated inbox messages.
- Uses strict JSON-schema output, then validates again with Zod.
- Confirms that a returned value, supporting excerpts, and cited domains occur in the source message.
- Deterministically rejects model-selected password-reset, recovery, payment, and signing links.
- Treats message content as untrusted data and tells the model never to authorize filling or navigation.
- Falls back on missing configuration, timeout, service failure, malformed JSON, schema failure, or invented evidence.

The current OpenAI model guide identifies `gpt-5.6` as the alias for GPT-5.6 Sol and recommends the Responses API for this family ([model guidance](https://developers.openai.com/api/docs/guides/latest-model), [model reference](https://developers.openai.com/api/docs/models/gpt-5.6-sol)).

## Commands

```bash
npm run demo            # Start judge pages at 127.0.0.1:4173
npm run service         # Start optional loopback extractor
npm run service -- --setup gmail # Guide Gmail setup and import its web-client JSON
npm run service -- --setup outlook # Guide Outlook registration and save its client ID
npm run service -- --doctor # Validate mailbox OAuth readiness without printing secrets
npm run dev             # Start both processes
npm test                # Unit and integration tests
npm run check           # Fast iteration gate: format, lint, types, unit/integration tests
npm run test:extension  # Load packaged MV3 extension in Chromium
npm run test:browser    # Run real-Chrome page acceptance tests
npm run build           # Production demo, extension, and service builds
npm run package         # Build extension ZIP and installable companion .tgz
npm run verify          # Format, lint, types, tests, builds, extension load, browser tests
```

The exact verified results are recorded in [Test results](docs/TEST_RESULTS.md).

## CI and releases

Every pull request and push to `main` runs the required `verify` status using the fast `npm run check` iteration gate. Browser installation and end-to-end checks are intentionally reserved for releases.

Pushing a semantic-version tag that exactly matches `package.json` (for example, `v0.2.0-beta.7`) runs the complete `npm run verify` release gate, packages the extension and companion CLI, smoke-tests a fresh companion installation, and publishes both artifacts with separate SHA-256 files to the matching GitHub Release. Hyphenated versions are published as prereleases. An existing tag can be safely republished from the Release workflow's manual dispatch; release assets are replaced only after the full gate passes.

Download verified extension packages and their checksums from [GitHub Releases](https://github.com/lzongren/contextfill/releases).

## Security and sensitive-data behavior

- Candidate values from synthetic, imported, or connected sources exist only in short-lived popup variables after ingestion; imported files are never persisted by ContextFill.
- Runtime candidate state clears after fill, dismissal, explicit expiry, or at most 90 seconds.
- Expired candidate values are removed before the blocked card is retained.
- Successful fills and link openings mark a stable candidate ID as used for 15 minutes; no candidate value is stored in replay state.
- Values are masked by default. Blocked candidates cannot be revealed.
- Magic-link path, query, and fragment secrets are never revealed in the popup. Normal application code never logs a full candidate value.
- Link inspection parses only local message text: it performs no request, prefetch, HEAD call, redirect resolution, or Safe Browsing lookup.
- Links must use HTTPS and are blocked for credentials, IP/local destinations, nonstandard ports, punycode, known shorteners, opaque click/redirect wrappers, destination mismatch, staleness, or replay.
- The extension never touches the clipboard or analytics.
- Candidate/message data is not written to extension storage. The stored loopback capability is restricted to trusted extension contexts.
- User and model text enter the popup through `textContent`, not executable HTML.
- Field mutation dispatches `input` and `change` events but never clicks or submits anything.
- The local service rejects non-loopback/non-extension origins and oversized input.

Read the complete [threat model](docs/THREAT_MODEL.md) before treating this prototype as security-sensitive software.

## Accessibility and UX

The popup and judge lab use semantic labels, keyboard-operable native controls, visible focus rings, textual status labels and icons in addition to color, explicit loading/empty/error/success states, reduced-motion handling, and high-contrast decision cards. Codes and references stay masked until reveal; action-link secrets remain permanently masked. Warnings require a checked acknowledgement before an eligible value-transfer override becomes available. Link warnings cannot be overridden.

## Supported platforms

- Chrome 114+ with Manifest V3 and unpacked-extension developer mode.
- Node.js 20+ on macOS, Linux, or Windows for the local demo and optional service.
- The current MVP detects fields only in the top-level document.

## Honest limitations

- This is a hackathon prototype, not phishing-proof or production-ready.
- Gmail and Outlook require a locally configured OAuth application and running companion service. Refresh tokens use the native OS keychain; if it is unavailable, the UI explicitly reports session-only authorization.
- One-time import accepts only `.eml` files up to 2 MB. Attachments are excluded from extraction, and encrypted or malformed messages may not yield readable content.
- Sender addresses are evidence, not cryptographic proof of email authentication.
- Verified handoff supports only magic-login and email-confirmation links. Password reset, account recovery, payments, document signing, URL shorteners, opaque redirect wrappers, IP/local destinations, and internationalized destinations are blocked or unsupported.
- Lookalike detection covers exact registrable-domain mismatch plus a controlled set of Unicode, punycode, substitution, hyphen, and deceptive-label signals. It does not detect every homograph.
- Field detection does not traverse iframes or closed shadow roots and cannot support every framework-controlled input.
- Replay state is in a Manifest V3 service worker and may reset after browser/extension restart.
- Loopback requests require a one-time paired 256-bit capability plus the extension installation ID. Local malware or another process running as the user remains outside this boundary.
- The GPT-5.6 live path requires the user's own API access and incurs normal API usage. The repository's model tests use injected responses; no live API call was made during the no-key release verification.

## How Codex was used

The primary Codex session took the project from an empty Git repository through architecture, implementation, real Gmail integration, tests, browser QA, security review, packaging, and submission drafts. Codex wrote and verified the shared core, MV3 extension, demo fixtures, optional Responses API service, test suites, and documentation. Human testing on a real Vialto OTP page exposed runtime-origin permission and nonsemantic split-input gaps; Codex added exact-origin permission requests and stronger context detection. Product review then moved the differentiated core from OTP-only transfer to Verified Magic-Link Handoff, with Trusted Reference Transfer as the generalization proof.

The human supplied the product concept, category, deadline, security constraints, acceptance scenarios, and autonomous execution mandate. Before submission, run `/feedback` in this primary session and add the real Session ID to [Codex collaboration](docs/CODEX_COLLABORATION.md) and the Devpost draft. Do not infer the session's model metadata; confirm it from the real session record.

## How GPT-5.6 is used

GPT-5.6 is an optional, privacy-bounded fact extractor. It classifies one prefiltered message and returns a candidate type (`otp`, `magic_link`, or `reference`), value, claimed service, referenced domains, expiration evidence, confidence, and supporting excerpts under a strict schema. Application code validates those facts, rejects invented evidence and high-risk link intents, and independently inspects URLs. GPT-5.6 does not rank sites, authorize transfer or navigation, fill fields, open links, or submit forms. Without an API key, every judge scenario remains functional through deterministic extraction.

## Repository structure

```text
apps/
  demo/             Local judge lab and simulated-domain fixtures
  extension/        MV3 popup, background replay state, content injection
  local-service/    Optional loopback GPT-5.6 Responses API service
packages/core/      Schemas, fixtures, extraction, ranking, policy, fields
tests/              Unit, integration, extension-load, and Chrome tests
scripts/            Reproducible build and packaging scripts
docs/               Judge, threat, demo, collaboration, and submission docs
dist/               Reproducible build output (not committed)
artifacts/          Packaged ZIP output (ZIP not committed)
```

## License

[MIT](LICENSE)
