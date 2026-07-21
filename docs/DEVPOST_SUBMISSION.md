# ContextFill — Devpost submission draft

> **Human editing required before submission.** Confirm every placeholder, link, model/session fact, screenshot, and claim. Do not submit this file verbatim without review.

## Project name

ContextFill

## One-line tagline

Safely remove the “check your email” interruption with visible, verified Auto-Continue.

## Category recommendation

**Apps for Your Life**

## Problem

“Check your email” interrupts sign-in, confirmation, booking, and support flows. The user must locate the correct message, judge whether a one-time link is real, and carry that action back to the correct page. Conventional OTP autofill handles one narrow shape; it rarely makes the sender, destination, and initiating-page relationship visible before email advances the task.

## Inspiration

ContextFill started from a simple product question: what if continuing from an email felt less like blindly clicking or copying and more like approving a small, evidence-backed trust decision? The goal is not to claim perfect phishing detection. It is to demonstrate a safer interaction model that separates extraction from authorization and keeps the user in control.

## What it does

ContextFill is a Chrome Manifest V3 extension backed by a built-in synthetic inbox and optional Gmail/Outlook connectors. Its differentiated core is **Verified Auto-Continue**:

1. Detects a visible OTP or “check your email” wait state on an exact site the user configured.
2. Locally extracts a recent OTP or magic-login/email-confirmation URL without fetching the link.
3. Applies deterministic policy over sender, service, destination, initiating domain, expiry, replay, Unicode/punycode, lookalikes, and competing messages.
4. Shows waiting, found, verified, countdown, success, or block in a keyboard-accessible in-page card; codes and token-bearing URL parts stay masked.
5. Supports **Manual**, **Assisted** (in-page confirmation), and **Auto-Continue** (visible cancellable three-second countdown) per exact origin.
6. Revalidates the unchanged tab URL, current page intent, permission/mode, freshness/replay, and `allow` decision immediately before filling or same-tab navigation.

ContextFill performs no link prefetch, HEAD request, redirect resolution, or clipboard copy. It never clicks Submit/Login or calls a form submission API. An opted-in destination page may itself submit after the final OTP digit, so Auto mode says this explicitly. The same engine retains one narrowly scoped manual Trusted Reference Transfer for booking, application, and support references.

The judge lab includes an allowed Cedar Notes magic link, a controlled `cedarn0tes` initiating-site lookalike blocked with no override, and an allowed booking-reference transfer.

## How it was built

The project is a small TypeScript repository with four boundaries:

- A shared deterministic core for Zod schemas, synthetic fixtures, extraction, strict URL inspection, ranking, public-suffix-aware domain handling through `tldts`, policy, presentation data, and field mutation.
- A Chrome MV3 extension using `activeTab`, explicit exact-origin runtime grants, `scripting`, dynamic SPA wait-state detection, closed-Shadow-DOM status UI, session replay state, and captured-tab `tabs.update`.
- A local Vite judge lab with visibly labeled simulated domains and no personal data.
- An optional loopback Node/Hono service using the official OpenAI JavaScript SDK, the Responses API, GPT-5.6, strict JSON-schema output, `store: false`, and secondary Zod/evidence validation.

Vitest covers unit and integration behavior. Playwright loads the packaged extension in Chromium and runs the page acceptance suite against installed Chrome. A root `npm run verify` command runs the complete release gate.

## How Codex was used

The primary Codex session started from an empty repository and drove architecture, implementation, real Gmail integration, testing, debugging, security review, visual QA, packaging, and submission preparation. Codex implemented the extension, demo, core, local service, and documentation, then iterated on failures found by real browser and real-site tests.

Concrete examples: real Vialto testing exposed a missing per-origin permission flow and a nonsemantic six-box code widget; both were corrected and retested. Product review challenged an OTP-only story, so the architecture expanded into verified magic links and Trusted Reference Transfer. A real Gmail-to-Medium run exposed mixed OTP/link precedence, long-token evidence bounds, and a fallback code embedded in the subject. The next iteration removed the popup interruption itself with per-site modes, visible cancellation, execution-time revalidation, dynamic SPA detection, exact-origin revocation, and secret-free local activity—all backed by packaged-browser tests.

Before submission, add the real `/feedback` Session ID and confirm the session's actual model metadata. Do not infer either.

## How GPT-5.6 was used

GPT-5.6 acts only as a bounded fact extractor for one prefiltered message. It returns candidate type (`otp`, `magic_link`, or `reference`), value, claimed service, referenced domains, expiration evidence, confidence, and supporting excerpts under a strict schema. Application code checks that copied evidence appears in the source, independently rejects high-risk link intents, and runs deterministic URL and trust policy. GPT-5.6 never approves filling or navigation.

When the service, key, API, timeout, JSON, schema, or evidence validation fails, ContextFill falls back to deterministic extraction. Judges can therefore exercise every mandatory scenario without an API key.

## Challenges

- Preserving temporary `activeTab` access while still supporting a local companion service.
- Inspecting one-time links without fetching, consuming, or exposing their tokens.
- Binding both Assisted and automatic navigation to the exact initiating tab while rechecking that page, permission, and trust state did not change.
- Modeling distinct registrable domains honestly on localhost.
- Detecting split fields without accidentally filling unrelated numeric controls.
- Making lookalike handling conservative without claiming complete homograph defense.
- Validating model output twice while keeping the model outside the authorization boundary.
- Keeping a visible countdown cancellable even on hostile pages, while failing closed if the card is removed or the page changes.
- Recording useful activity and trusted-site state without retaining codes, tokens, senders, subjects, bodies, or page paths.

## Accomplishments

- A coherent verified-link allow and lookalike-block story that is visible in under a minute.
- Popup-free OTP fill and verified same-tab magic-link navigation with local-only URL inspection, permanent token masking, visible countdown, and replay blocking.
- Manual, Assisted, and Auto modes with exact-origin grants, settings/revocation, SPA detection, reduced motion, and privacy-safe activity history.
- Trusted Reference Transfer as evidence that the core generalizes beyond OTP.
- Single and split fill with native events and no automatic submission.
- Public-suffix-aware domain policy with controlled Unicode/punycode/lookalike checks.
- No-key deterministic operation across every required judge fixture.
- Strict GPT-5.6 integration with source-evidence validation and clean fallback.
- Least-privilege page access and loopback-only model service.
- Comprehensive unit/integration, judge-browser, and packaged-extension coverage, including dynamic dialogs, cancel/revoke, removed-overlay fail-closed behavior, lookalikes, exact-origin permissions, and zero extension-initiated submission.
- A completed real Gmail-to-Medium flow with local no-fetch inspection, permanently masked URL details, explicit approval, and successful same-tab sign-in.
- Complete judge, threat, demo, screenshot, collaboration, and release documentation.

## What was learned

The key product lesson is that “check your email” is the opportunity, not OTP extraction alone—and forcing a popup open at the exact interruption leaves much of that opportunity unsolved. Users benefit when the sender, destination, active page, reason, countdown, and Cancel action appear where the task is already happening. The key engineering lesson is equally important: page detection, model extraction, local URL inspection, deterministic authorization, mode consent, and execution-time revalidation need separate trust boundaries, schemas, tests, and failure behavior.

Browser behavior also reinforced that “obvious” field heuristics conflict in real pages. Group context must beat an isolated attribute when the full interface clearly represents a split OTP.

## What is next

- Evaluate Manual/Assisted/Auto defaults with users and measure cancellation, mismatch recognition, and false-positive rates.
- Add authenticated, rate-limited local transport.
- Improve Unicode script and brand-risk analysis without overstating coverage.
- Support open shadow roots and carefully scoped iframe workflows.
- Complete a live user-owned Outlook conformance run and provider reviews before general mailbox distribution; the Gmail OTP and magic-link paths are validated.
- Expand safe handoff only where the destination and page can be verified locally; keep recovery, payment, and signing actions out of scope.

## Judge testing

No personal email or API key is required:

```bash
npm install
npm run build
npm run demo
```

Load `dist/extension` as an unpacked Chrome extension. On `?scenario=legitimate-single`, choose **Automation → Auto-Continue** once and watch the in-page countdown fill without reopening the popup. Then run `?scenario=magic-link` and `?scenario=magic-link-lookalike`; the first advances the same tab, the second stops in page. Full instructions and expected results are in `docs/JUDGE_TESTING.md`.

## Links — replace before submission

- Repository URL: [https://github.com/lzongren/contextfill](https://github.com/lzongren/contextfill)
- Public demo URL, if created: **TODO or “Local judge lab only”**
- Public YouTube demo under three minutes: **TODO**
- Primary Codex `/feedback` Session ID: **TODO — use the real ID from this session**

## Final submission checklist

- [ ] Human-review and edit this draft.
- [ ] Confirm the repository is public and the final commit is pushed.
- [ ] Run `npm ci` and `npm run verify` from the final commit.
- [ ] Test `artifacts/contextfill-extension-v0.2.0-beta.8.zip` on a clean Chrome profile.
- [ ] Record only synthetic data and a clean browser profile.
- [ ] Use both the allowed and lookalike-blocked flows in the video.
- [ ] Explain accurately how Codex and GPT-5.6 were used.
- [ ] Confirm the uploaded YouTube video is public and under three minutes.
- [ ] Add the final repository and YouTube URLs.
- [ ] Run `/feedback` in the primary Codex session and save the real Session ID.
- [ ] Confirm the session's actual model metadata rather than inferring it.
- [ ] Review the threat model and limitations for overclaims.
- [ ] Submit before Tuesday, July 21, 2026 at 5:00 PM Pacific.
