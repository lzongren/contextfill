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

Gmail and Outlook use authorization code flow with PKCE through the existing Node.js companion service. The extension stores only the selected provider, while access and refresh tokens remain in service memory. Provider APIs return a bounded recent-message set that is normalized to the shared mailbox schema before the existing extraction, ranking, deterministic policy, and explicit-fill pipeline. Session-only tokens add reconnection friction but avoid introducing plaintext persistent credentials before OS-keychain support exists.

Real mailbox messages use deterministic extraction by default. Model extraction is a separate explicit opt-in because configuring an OpenAI key must not silently cause personal message content to leave the device.
