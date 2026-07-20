# Decisions

## D-001: Vanilla DOM UI instead of React

The extension popup and demo use small TypeScript DOM renderers. Their state is compact, so React would add bundle and dependency surface without improving reliability.

## D-002: Programmatic injection instead of permanent content-script matches

The extension requests `activeTab` and `scripting`. It injects only after the user opens ContextFill and starts a scan. No `<all_urls>` host permission is requested.

## D-003: Model extracts facts; policy stays deterministic

GPT-5.6 may classify a selected verification-like synthetic message and extract structured evidence. Zod validates the result. Domain alignment, expiry, replay, and allow/warn/block remain deterministic.

## D-004: Reserved-domain simulation is explicit

Demo pages run on localhost and publish an explicit simulated hostname through page metadata. The popup labels it as a deterministic fixture; it never claims localhost is the represented domain.
