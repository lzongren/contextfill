# ContextFill — Devpost submission draft

> **Human editing required before submission.** Confirm every placeholder, link, model/session fact, screenshot, and claim. Do not submit this file verbatim without review.

## Project name

ContextFill

## One-line tagline

Verify the message and the website belong together before transferring a temporary code.

## Category recommendation

**Apps for Your Life**

## Problem

Verification codes are designed to prove possession of a trusted communication channel, but the everyday transfer step is mostly context-blind. A user can receive a legitimate code and still paste it into a lookalike or unrelated website. Conventional autofill optimizes convenience; it rarely makes the message-to-page relationship visible before the secret moves.

## Inspiration

ContextFill started from a simple product question: what if moving a temporary secret felt less like copying text and more like approving a small, evidence-backed trust decision? The goal is not to claim perfect phishing detection. It is to demonstrate a safer interaction model that separates extraction from authorization and keeps the user in control.

## What it does

ContextFill is a Chrome Manifest V3 extension backed by a built-in synthetic inbox. When the user opens the extension on a verification page, it:

1. Detects a single OTP field or a split code group.
2. Extracts recent candidates with GPT-5.6 when the optional local service is configured, or a deterministic fallback otherwise.
3. Ranks candidates using recency, message context, and page alignment.
4. Applies a separate deterministic policy over registrable domains, sender evidence, claimed service, expiry, replay state, Unicode/punycode, and controlled lookalike signals.
5. Shows the masked code, sender, subject, age, service, requesting site, decision, and plain-English reason.
6. Fills only after explicit approval and never submits the form.

The judge lab includes an allowed Northstar page and a controlled `n0rthstar` lookalike that is blocked with no override.

## How it was built

The project is a small TypeScript repository with four boundaries:

- A shared deterministic core for Zod schemas, synthetic fixtures, extraction, ranking, public-suffix-aware domain handling through `tldts`, policy, presentation data, and field mutation.
- A Chrome MV3 extension using `activeTab` and `scripting` for temporary, user-triggered access.
- A local Vite judge lab with visibly labeled simulated domains and no personal data.
- An optional loopback Node/Hono service using the official OpenAI JavaScript SDK, the Responses API, GPT-5.6, strict JSON-schema output, `store: false`, and secondary Zod/evidence validation.

Vitest covers unit and integration behavior. Playwright loads the packaged extension in Chromium and runs the page acceptance suite against installed Chrome. A root `npm run verify` command runs the complete release gate.

## How Codex was used

The primary Codex session started from an empty repository and drove architecture, implementation, testing, debugging, security review, visual QA, packaging, and submission preparation. Codex implemented the extension, demo, core, local service, and documentation, then iterated on failures found by real browser tests.

A concrete example: the first split-field browser run revealed that the first digit's `autocomplete="one-time-code"` score incorrectly beat the six-field group. The implementation was corrected so a validated adjacent group takes precedence, then the full suite was rerun.

Before submission, add the real `/feedback` Session ID and confirm the session's actual model metadata. Do not infer either.

## How GPT-5.6 was used

GPT-5.6 acts only as a bounded fact extractor for one prefiltered message. It returns candidate type, value, claimed service, referenced domains, expiration evidence, confidence, and supporting excerpts under a strict schema. Application code checks that values and domains appear in the source message. The deterministic policy—not GPT-5.6—decides whether filling is allowed, warned, or blocked.

When the service, key, API, timeout, JSON, schema, or evidence validation fails, ContextFill falls back to deterministic extraction. Judges can therefore exercise every mandatory scenario without an API key.

## Challenges

- Preserving temporary `activeTab` access while still supporting a local companion service.
- Modeling distinct registrable domains honestly on localhost.
- Detecting split fields without accidentally filling unrelated numeric controls.
- Making lookalike handling conservative without claiming complete homograph defense.
- Validating model output twice while keeping the model outside the authorization boundary.
- Clearing sensitive runtime state without weakening replay protection.

## Accomplishments

- A coherent allow and block story that is visible in under a minute.
- Single and split fill with native events and no automatic submission.
- Public-suffix-aware domain policy with controlled Unicode/punycode/lookalike checks.
- No-key deterministic operation across every required judge fixture.
- Strict GPT-5.6 integration with source-evidence validation and clean fallback.
- Least-privilege page access and loopback-only model service.
- 26 unit/integration tests, five installed-Chrome acceptance cases, and packaged-extension load verification.
- Complete judge, threat, demo, screenshot, collaboration, and release documentation.

## What was learned

The key product lesson is that confidence should not be hidden behind an autofill animation. Users benefit from seeing the message, site, and reason together at the moment of transfer. The key engineering lesson is equally important: model extraction and security authorization need different trust boundaries, schemas, tests, and failure behavior.

Browser behavior also reinforced that “obvious” field heuristics conflict in real pages. Group context must beat an isolated attribute when the full interface clearly represents a split OTP.

## What is next

- Evaluate the confirmation design with users and measure whether it improves mismatch recognition without adding excessive friction.
- Add authenticated, rate-limited local transport.
- Improve Unicode script and brand-risk analysis without overstating coverage.
- Support open shadow roots and carefully scoped iframe workflows.
- Add a provider interface and only then consider Gmail OAuth test-mode integration.
- Explore other temporary information, such as magic links and booking references, while retaining explicit context checks.

## Judge testing

No personal email or API key is required:

```bash
npm install
npm run build
npm run demo
```

Load `dist/extension` as an unpacked Chrome extension. Run `?scenario=legitimate-single`, then `?scenario=lookalike`. Full instructions and expected results are in `docs/JUDGE_TESTING.md`.

## Links — replace before submission

- Repository URL: **TODO**
- Public demo URL, if created: **TODO or “Local judge lab only”**
- Public YouTube demo under three minutes: **TODO**
- Primary Codex `/feedback` Session ID: **TODO — use the real ID from this session**

## Final submission checklist

- [ ] Human-review and edit this draft.
- [ ] Confirm the repository is public and the final commit is pushed.
- [ ] Run `npm ci` and `npm run verify` from the final commit.
- [ ] Test `artifacts/contextfill-extension-v0.1.0.zip` on a clean Chrome profile.
- [ ] Record only synthetic data and a clean browser profile.
- [ ] Use both the allowed and lookalike-blocked flows in the video.
- [ ] Explain accurately how Codex and GPT-5.6 were used.
- [ ] Confirm the uploaded YouTube video is public and under three minutes.
- [ ] Add the final repository and YouTube URLs.
- [ ] Run `/feedback` in the primary Codex session and save the real Session ID.
- [ ] Confirm the session's actual model metadata rather than inferring it.
- [ ] Review the threat model and limitations for overclaims.
- [ ] Submit before Tuesday, July 21, 2026 at 5:00 PM Pacific.
