# ContextFill — Devpost submission draft

> **Human editing required before submission.** Confirm every placeholder, link, model/session fact, screenshot, and claim. Do not submit this file verbatim without review.

## Project name

ContextFill

## One-line tagline

Turn the right message into a temporary, origin-bound handoff—then transfer only what the current page needs.

## Category recommendation

**Apps for Your Life**

## Problem

“Check your email” interrupts sign-in, confirmation, booking, and support flows. Users must find the right message, decide whether it belongs to the current page, then copy temporary facts or follow a link without a visible trust proof. Conventional autofill handles persistent profile data or one-time codes, but rarely explains why a particular message, sender, destination, and page belong together before advancing the task.

## Inspiration

What if continuing from email felt less like blindly copying or clicking and more like approving a small evidence-backed contract? ContextFill does not claim perfect phishing detection. It demonstrates a safer interaction model that separates extraction, deterministic authorization, target mapping, presentation, and execution while keeping control visible.

## What it does

ContextFill is a Chrome Manifest V3 extension with a synthetic offline inbox and optional Gmail/Outlook connectors. Two complementary experiences share one deterministic trust boundary.

### Verified Context Capsules

The hero airline-check-in flow:

1. Extracts exactly two typed, source-grounded facts from one recent message: booking reference and passenger surname.
2. Deterministically checks message binding, sender, claimed service, referenced domain, active page, intent, conflicts, freshness, 90-second expiry, and replay.
3. Shows a compact masked proof: **Message → trust verification → Context Capsule → destination fields**.
4. Maps both facts only to visible, empty, strongly labeled fields in one form, rejecting hidden, sensitive, ambiguous, prefilled, or split targets.
5. Transfers both or neither after explicit approval, verifies each write, and rolls back the whole handoff if the page rewrites either value.
6. Reports **Form not submitted** and offers Undo while keeping replay blocked.

The paired synthetic lookalike removes one airline-domain hyphen. The trace breaks visibly at deterministic domain verification and renders no action.

### Verified Auto-Continue

For OTP and magic-login/email-confirmation wait states, every origin starts Manual. Assisted and Auto-Continue require an explicit, inspectable, revocable exact-origin permission. Assisted waits for an in-page action; Auto adds a visible cancellable three-second countdown and revalidates the exact tab URL, current page intent, permission/mode, freshness, replay, and Allow decision at zero. It fills the detected OTP or opens the exact inspected link in the same tab.

ContextFill never prefollows a link, touches the clipboard, clicks Submit/Login, presses Enter, or calls a form-submission API. Auto’s OTP acknowledgement accurately warns that a destination page can independently react to the final input event. Trusted Reference Transfer and Manual single/split OTP remain supported.

## How it was built

The TypeScript repository keeps four boundaries:

- A shared core for strict Zod schemas, fixtures, bounded extraction, `tldts` registrable-domain analysis, deterministic policy, conservative field mapping, atomic mutation, rollback, and presentation data.
- A Chrome MV3 extension using `activeTab`, `scripting`, exact-origin runtime grants, Manual/Assisted/Auto modes, dynamic SPA wait-state detection, closed-Shadow-DOM UI, session replay state, options/revocation, and captured-tab navigation.
- A Vite judge lab with visibly labeled simulated domains and synthetic allowed, mismatch, conflict, decoy, overwrite, cancellation, replay, and reduced-motion fixtures.
- An optional loopback Node/Hono companion using the official OpenAI SDK, Responses API, strict JSON-schema output, `store: false`, OS-keychain OAuth refresh storage, and paired local requests.

Vitest covers unit/integration behavior. Playwright loads the packaged extension in Chromium and runs acceptance against installed Chrome. `npm run verify` is the complete release gate.

## How Codex was used

The primary Codex work took the repository from initial architecture through real Gmail integration, deterministic trust policy, extension UI, tests, security review, visual QA, packaging, and submission preparation. Real Vialto testing exposed exact-origin permission and nonsemantic split-input gaps; both were corrected. Real Gmail-to-Medium testing exposed mixed OTP/link precedence, long-token evidence bounds, and a fallback code in the subject; all were fixed before the same-tab handoff succeeded.

For the wow iteration, Codex ran three independent product, interaction, and security reviews and scored eight distinct concepts across comprehension, visual impact, originality, value, fit, technical depth, defensibility, offline testability, feasibility, and demo speed. Context Capsules won 49/50. Concurrent isolated work produced Verified Auto-Continue. The integration preserved both: Capsules demonstrate typed multi-fact transfer, while Auto-Continue demonstrates visible, revocable continuation for supported authentication actions.

Before submission, add the real `/feedback` Session ID and confirm actual model metadata. Do not infer either.

## How GPT-5.6 was used

GPT-5.6 is only a bounded fact extractor for one prefiltered untrusted message. For a Capsule, its schema permits only travel-check-in intent, service/domain evidence, and exactly booking reference plus passenger surname with verbatim excerpts. For legacy actions, it may classify OTP, magic link, or narrow reference facts. It cannot return selectors, choose fields or automation mode, authorize, navigate, fill, or submit.

Application code validates every copied value and excerpt against the source, rejects high-risk link intents, then independently runs deterministic domain, sender, freshness, replay, mapping, and execution policy. Missing key, API failure, timeout, malformed output, schema failure, or invented evidence falls back to deterministic extraction. Every judge path works without an API key.

## Challenges

- Mapping two facts without becoming broad arbitrary-form autofill.
- Guaranteeing an all-or-nothing receipt when frameworks can rewrite inputs.
- Inspecting one-time links without fetching or consuming them.
- Binding automatic action to an exact opted-in origin, unchanged tab, current intent, and visible cancellable countdown.
- Detecting dynamic SPA wait states without persistent all-sites access.
- Modeling distinct registrable domains honestly on localhost.
- Preserving replay protection while supporting Undo and revocation.
- Keeping activity useful without retaining codes, tokens, subjects, sender addresses, bodies, or paths.

## Accomplishments

- A four-stage masked Capsule proof understandable in seconds.
- Atomic two-field transfer, truthful no-submit receipt, whole-handoff Undo, and replay protection.
- A realistic airline-domain lookalike that visibly blocks with no override.
- Exact-site Manual/Assisted/Auto modes with visible cancellation, action-time revalidation, and revocable permission.
- Dynamic SPA detection and a privacy-minimized seven-day activity view.
- Local-only URL inspection, permanent token masking, exact same-tab navigation, and independent lookalike proof.
- No-key offline operation, strict GPT-5.6 extraction boundaries, and comprehensive automated/browser coverage.
- A completed real Gmail-to-Medium Manual handoff plus a beta.8 real-provider acceptance gate before Auto-Continue release.

## What was learned

The opportunity is not OTP extraction alone; it is the whole “check your email” interruption. The strongest experience makes the message, facts/action, trust checks, page relationship, and execution control visible. The engineering counterpart is strict separation: extraction, authorization, mapping, presentation, mutation/navigation, rollback, replay, and automation mode each need their own authority and failure behavior.

## What is next

- Evaluate whether the Capsule trace improves mismatch recognition without excessive friction.
- Add new Capsule shapes only as narrow typed intents with dedicated schemas and deterministic mappers.
- Detect synchronous destination-owned submission/navigation after input events.
- Improve Unicode/brand-risk analysis without overstating coverage.
- Support carefully scoped open shadow roots and iframe workflows.
- Complete provider reviews and live Outlook conformance before broad mailbox distribution.
- Keep recovery, payment, signing, health, government-ID, and arbitrary-form workflows out of scope.

## Judge testing

No personal email or API key is required:

```bash
npm install
npm run build
npm run demo
```

Load `dist/extension`. Run `?scenario=capsule`, approve and Undo, then run `?scenario=capsule-lookalike`. Next configure Auto-Continue on an OTP fixture, observe/cancel the countdown, run the exact-origin link allow, then the fresh lookalike block. Full expectations are in `docs/JUDGE_TESTING.md`.

## Links — replace before submission

- Repository: [https://github.com/lzongren/contextfill](https://github.com/lzongren/contextfill)
- Public demo: **TODO or “Local judge lab only”**
- Public YouTube demo under three minutes: **TODO**
- Primary Codex `/feedback` Session ID: **TODO — use the real ID**

## Final submission checklist

- [ ] Human-review this draft and every factual claim.
- [ ] Confirm the final branch is integrated and CI-green.
- [ ] Run `npm ci` and `npm run verify` from the final commit.
- [ ] Test the final branch-built extension ZIP in a clean Chrome profile.
- [ ] Record only synthetic data; show Capsule allow, receipt, Undo, and block plus visible Auto countdown/cancel.
- [ ] Explain accurately how Codex and GPT-5.6 were used.
- [ ] Confirm the public video is under three minutes.
- [ ] Add final repository, video, and real `/feedback` Session ID.
- [ ] Confirm actual session model metadata rather than inferring it.
- [ ] Review threat model and limitations for overclaims.
- [ ] Submit before Tuesday, July 21, 2026 at 5:00 PM Pacific.
