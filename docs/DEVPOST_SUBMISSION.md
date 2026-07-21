# ContextFill — Devpost submission draft

> **Human editing required before submission.** Confirm every placeholder, link, model/session fact, screenshot, and claim. Do not submit this file verbatim without review.

## Project name

ContextFill

## One-line tagline

Turn the right message into a temporary, origin-bound context capsule—then transfer only what the current page needs.

## Category recommendation

**Apps for Your Life**

## Problem

“Check your email” interrupts sign-in, confirmation, booking, and support flows. The user must locate the correct message, decide whether it belongs to the current page, and carry one or more temporary facts or actions back to that page. Conventional autofill handles persistent profile data or one-time codes, but rarely shows why a particular message, sender, destination, and form belong together before advancing the task.

## Inspiration

ContextFill started from a simple product question: what if continuing from an email felt less like blindly clicking or copying and more like approving a small, evidence-backed trust decision? The goal is not to claim perfect phishing detection. It is to demonstrate a safer interaction model that separates extraction from authorization and keeps the user in control.

## What it does

ContextFill is a Chrome Manifest V3 extension backed by a built-in synthetic inbox and optional Gmail/Outlook connectors. Its hero flow is **Verified Context Capsules**:

1. Reads one recent airline check-in message and extracts exactly two typed, source-grounded facts: booking reference and passenger surname.
2. Applies deterministic sender, service, referenced-domain, active-page, freshness, expiry, intent, conflict, and replay checks.
3. Shows a compact, masked proof chain: **Message → trust verification → Context Capsule → destination fields**.
4. Conservatively maps both facts to two visible, empty, strongly labeled fields in the same form, rejecting hidden, sensitive, ambiguous, prefilled, or split targets.
5. Transfers both facts or neither only after explicit approval, verifies each write, and rolls the whole handoff back if the page rewrites either value.
6. Reports that the form was not submitted and offers one-click Undo while keeping replay blocked.

The synthetic judge lab places an aligned Aurelia Air check-in beside a one-character airline-domain lookalike. The aligned page exposes the complete masked trust chain and a reversible two-field transfer; the lookalike breaks the chain at deterministic domain verification and exposes no action.

ContextFill also retains Verified Magic-Link Handoff, Trusted Reference Transfer, and single/split OTP fill. It performs no link prefetch, HEAD request, redirect resolution, clipboard copy, automatic navigation, or automatic submission.

## How it was built

The project is a small TypeScript repository with four boundaries:

- A shared deterministic core for strict Zod schemas, synthetic fixtures, bounded fact extraction, public-suffix-aware domain handling through `tldts`, policy, conservative field mapping, masked presentation, atomic field mutation, and rollback.
- A Chrome MV3 extension using `activeTab`, exact-origin runtime permission requests, `scripting`, and captured-tab `tabs.update` for user-triggered same-tab handoff.
- A local Vite judge lab with visibly labeled simulated domains and no personal data.
- An optional loopback Node/Hono service using the official OpenAI JavaScript SDK, the Responses API, GPT-5.6, strict JSON-schema output, `store: false`, and secondary Zod/evidence validation.

Vitest covers unit and integration behavior. Playwright loads the packaged extension in Chromium and runs the page acceptance suite against installed Chrome. A root `npm run verify` command runs the complete release gate.

## How Codex was used

The primary Codex session started from an empty repository and drove architecture, implementation, real Gmail integration, testing, debugging, security review, visual QA, packaging, and submission preparation. Codex implemented the extension, demo, core, local service, and documentation, then iterated on failures found by real browser and real-site tests.

Concrete examples: real Vialto testing exposed a missing per-origin permission flow and a nonsemantic six-box code widget; both were corrected and retested. Product review then scored eight distinct “wow” concepts across judge comprehension, differentiation, user value, security, feasibility, and offline demo quality. Verified Context Capsules won because they make the whole message-to-page contract visible while demonstrating controlled multi-field transfer. Independent product, interaction, and security reviews shaped the final atomic mapping, action-time revalidation, subject masking, replay-after-Undo rule, and forged-loopback negative test. Earlier real Gmail-to-Medium testing also exposed mixed OTP/link precedence, long-token evidence bounds, and a fallback code embedded in the subject; all three were fixed before release.

Before submission, add the real `/feedback` Session ID and confirm the session's actual model metadata. Do not infer either.

## How GPT-5.6 was used

GPT-5.6 acts only as a bounded fact extractor for one prefiltered message. For a Context Capsule, its strict schema permits only the travel-check-in intent, claimed service, referenced domains, and exactly a booking reference plus passenger surname with supporting excerpts. It cannot return selectors, choose fields, mutate the page, or authorize transfer. Application code validates that every value and excerpt appears in the source, then independently runs domain, sender, freshness, intent, replay, mapping, and mutation policy.

When the service, key, API, timeout, JSON, schema, or evidence validation fails, ContextFill falls back to deterministic extraction. Judges can therefore exercise every mandatory scenario without an API key.

## Challenges

- Preserving temporary `activeTab` access while still supporting a local companion service.
- Inspecting one-time links without fetching, consuming, or exposing their tokens.
- Binding explicit navigation to the exact initiating tab without auto-opening anything.
- Modeling distinct registrable domains honestly on localhost.
- Detecting split fields without accidentally filling unrelated numeric controls.
- Making lookalike handling conservative without claiming complete homograph defense.
- Validating model output twice while keeping the model outside the authorization boundary.
- Clearing sensitive runtime state without weakening replay protection.
- Mapping two facts without turning the extension into broad arbitrary-form autofill.
- Guaranteeing an all-or-nothing receipt when page frameworks can rewrite input values.
- Making the trust proof readable at 1280×720 without relying on motion or developer tools.

## Accomplishments

- A four-stage, masked Context Capsule proof that is understandable in seconds.
- Atomic two-field transfer, truthful no-submit receipt, whole-handoff Undo, and replay protection.
- Visible aligned and lookalike outcomes with no credentials, API key, popup, or network request.
- Local-only URL inspection, permanent token masking, explicit same-tab navigation, and replay blocking.
- Trusted Reference Transfer as evidence that the core generalizes beyond OTP.
- Single and split fill with native events and no automatic submission.
- Public-suffix-aware domain policy with controlled Unicode/punycode/lookalike checks.
- No-key deterministic operation across every required judge fixture.
- Strict GPT-5.6 integration with source-evidence validation and clean fallback.
- Least-privilege page access and loopback-only model service.
- Comprehensive unit/integration, installed-Chrome, and packaged-extension acceptance coverage, including inert link confirmation and explicit same-tab handoff.
- A completed real Gmail-to-Medium flow with local no-fetch inspection, permanently masked URL details, explicit approval, and successful same-tab sign-in.
- Complete judge, threat, demo, screenshot, collaboration, and release documentation.

## What was learned

The key product lesson is that “check your email” is the opportunity, not OTP extraction alone. Users benefit from seeing the message, extracted facts, trust checks, destination fields, and reason together before a temporary handoff advances the task. The key engineering lesson is equally important: model extraction, deterministic authorization, field mapping, presentation, mutation, and rollback need separate trust boundaries, schemas, tests, and failure behavior.

Browser behavior also reinforced that “obvious” field heuristics conflict in real pages. Group context must beat an isolated attribute when the full interface clearly represents a split OTP.

## What is next

- Evaluate the confirmation design with users and measure whether it improves mismatch recognition without adding excessive friction.
- Add authenticated, rate-limited local transport.
- Improve Unicode script and brand-risk analysis without overstating coverage.
- Support open shadow roots and carefully scoped iframe workflows.
- Complete a live user-owned Outlook conformance run and provider reviews before general mailbox distribution; the Gmail OTP and magic-link paths are validated.
- Expand safe handoff only where the destination and page can be verified locally; keep recovery, payment, and signing actions out of scope.
- Generalize capsules only through new narrow, typed intents with their own schemas and deterministic mappers—not arbitrary form filling.

## Judge testing

No personal email or API key is required:

```bash
npm install
npm run build
npm run demo
```

Load `dist/extension` as an unpacked Chrome extension. Run `?scenario=capsule`, approve and Undo the handoff, then run `?scenario=capsule-lookalike`. The same path also works natively in the judge lab without opening the popup. Full instructions and expected results are in `docs/JUDGE_TESTING.md`.

## Links — replace before submission

- Repository URL: [https://github.com/lzongren/contextfill](https://github.com/lzongren/contextfill)
- Public demo URL, if created: **TODO or “Local judge lab only”**
- Public YouTube demo under three minutes: **TODO**
- Primary Codex `/feedback` Session ID: **TODO — use the real ID from this session**

## Final submission checklist

- [ ] Human-review and edit this draft.
- [ ] Confirm the repository is public and the final commit is pushed.
- [ ] Run `npm ci` and `npm run verify` from the final commit.
- [ ] Test the latest branch-built extension ZIP on a clean Chrome profile.
- [ ] Record only synthetic data and a clean browser profile.
- [ ] Use the Capsule allow, no-submit receipt, Undo, and lookalike-blocked flows in the video.
- [ ] Explain accurately how Codex and GPT-5.6 were used.
- [ ] Confirm the uploaded YouTube video is public and under three minutes.
- [ ] Add the final repository and YouTube URLs.
- [ ] Run `/feedback` in the primary Codex session and save the real Session ID.
- [ ] Confirm the session's actual model metadata rather than inferring it.
- [ ] Review the threat model and limitations for overclaims.
- [ ] Submit before Tuesday, July 21, 2026 at 5:00 PM Pacific.
