# Decisions

## D-001: Vanilla DOM UI instead of React

The extension popup and demo use small TypeScript DOM renderers. Their state is compact, so React would add bundle and dependency surface without improving reliability.

## D-002: Programmatic injection instead of permanent content-script matches

The extension requests `activeTab` and `scripting`. It injects only after the user opens ContextFill and starts a scan. No `<all_urls>` host permission is requested.

## D-003: Model extracts facts; policy stays deterministic

GPT-5.6 may classify a selected verification-like synthetic message and extract structured evidence. Zod validates the result. Domain alignment, expiry, replay, and allow/warn/block remain deterministic.

## D-004: Reserved-domain simulation is explicit

Demo pages run on localhost and publish an explicit simulated hostname through page metadata. The popup labels it as a deterministic fixture; it never claims localhost is the represented domain.

## D-005: A single fixed loopback host permission is justified

Chrome extension pages need host permission for cross-origin `fetch`. The manifest therefore grants only `http://127.0.0.1:4318/*` to reach the optional local extractor. Website access remains temporary through `activeTab`; there is no `<all_urls>` permission.

## D-006: Replay identity is stable across extractors

GPT-5.6 and deterministic candidates share the same message-derived candidate ID. Replay prevention therefore survives a temporary change in extraction method without storing the sensitive value.

## D-007: Extension loading and page behavior use different browser channels

Playwright's bundled Chromium is used for command-line MV3 side-loading because stable Chrome removed that headless testing path. Functional judge-page acceptance remains on installed Chrome. Manual Chrome installation remains the judge workflow.

## D-008: Fast iteration CI and full tag-gated releases are separate

Pull requests and pushes to `main` run formatting, lint, type, and unit/integration checks under the existing required `verify` status. Version tags run the complete browser-inclusive release gate before packaging and publishing a version-derived ZIP and checksum to both workflow artifacts and GitHub Releases. This keeps feedback fast without weakening the release gate.

## D-009: Mailbox OAuth stays in a loopback companion service

Gmail and Outlook use authorization code flow with PKCE through the existing Node.js companion service. Access tokens remain in memory; refresh tokens are stored through the native OS credential manager and automatically fall back to visible session-only behavior if that backend is unavailable. Provider APIs return a bounded recent-message set that is normalized to the shared mailbox schema before the existing extraction, ranking, deterministic policy, and explicit-fill pipeline.

Real mailbox messages use deterministic extraction by default. Model extraction is a separate explicit opt-in because configuring an OpenAI key must not silently cause personal message content to leave the device.

## D-010: Loopback access uses one-time capability pairing

An extension installation generates a random 256-bit capability after the user enters a six-digit code printed by the companion service. The service stores only the capability hash and binds it to the extension ID; subsequent mailbox and model-extraction requests require both. Pairing codes expire after 10 minutes and rate-limit after five failures. This replaces manual extension-ID configuration while providing actual authentication instead of treating a public extension ID as a secret.

## D-011: Releases include an installable companion CLI

Real-mail use must not require a source checkout or TypeScript toolchain. Release tags therefore publish a bundled Node.js companion `.tgz` beside the extension ZIP, with independent checksums. Its only runtime dependency is the platform keyring binding. The `contextfill-service --init` command creates an owner-only `.env` without overwriting an existing file.

## D-012: Exported `.eml` is the provider-independent real-message bridge

OAuth app registration is a deployment choice owned by the user's Google Cloud project or Microsoft tenant. ContextFill therefore also accepts one explicitly chosen RFC 5322 `.eml` file in the popup. A maintained, browser-compatible MIME parser handles common multipart and encoded messages under a 2 MB input cap and explicit nesting/header limits. Only normalized sender, subject, date, body text, and HTTP(S) link evidence enter the existing schema; attachments never enter extraction. The raw file and normalized body are dropped immediately after local deterministic candidate extraction, never enter optional model extraction, and are never written to extension storage.

## D-013: Live OAuth setup has a non-secret readiness gate

Provider registration errors should be detected before the user reaches a consent screen. The packaged companion therefore includes `--doctor`, which derives configuration from the same code used by the runtime, prints exact callback URIs and requested scopes, validates the service/callback port match, checks owner-only `.env` permissions on POSIX systems, and reports missing variable names without ever echoing client IDs or secrets. A nonzero exit means no provider is safely ready.
