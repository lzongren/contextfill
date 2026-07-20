# Codex collaboration record

This document records observed work from the primary build session. It must be updated with the real `/feedback` Session ID before submission.

## Where Codex accelerated work

- Translated a detailed product/security specification into a sequenced build and acceptance plan.
- Initialized the empty Git repository as a strict TypeScript workspace.
- Implemented the synthetic inbox, deterministic extractor, candidate schema, ranking, registrable-domain handling, lookalike fixtures, policy engine, confirmation model, and conservative field mutation.
- Built the local judge lab, MV3 extension, optional GPT-5.6 companion service, release scripts, and all required documentation.
- Ran format, lint, types, unit, integration, extension-load, installed-Chrome, live loopback, packaging, and visual QA checks.
- Performed a focused threat review and kept model extraction separate from authorization.

## Important human decisions

The human supplied and constrained:

- The ContextFill product concept and positioning.
- The **Apps for Your Life** category.
- The OpenAI Build Week deadline and submission requirements.
- The requirement to use Codex and GPT-5.6.
- The mandatory no-personal-email judge path.
- The deterministic policy boundary, permission constraints, required scenarios, security guarantees, and definition of done.
- The instruction to work autonomously and continue through packaging and submission preparation.

## Decisions made collaboratively

- Preserve the specified separation between extraction, ranking, policy, presentation, and page mutation.
- Use a deliberately visible localhost simulation instead of claiming test domains are real deployed sites.
- Use vanilla DOM rendering rather than React because both interfaces have compact state.
- Keep GPT-5.6 optional so judges can test the full differentiating flow without credentials.
- Restrict permanent host access to the exact loopback service and use `activeTab` for webpages.

## Where Codex output required correction

- The first real-Chrome split-field run classified the first digit as a single OTP field because its autocomplete score exceeded the group score. Codex changed the heuristic so a validated contextual 4–8 input group takes precedence, then reran unit and browser tests.
- The first split browser assertion used a locator API shape incompatible with the installed Playwright runtime. Codex replaced it with a bounded DOM projection and reran the suite.
- Stable Chrome's headless channel did not side-load the extension for the manifest test. Codex switched that test to Playwright's supported bundled Chromium path while keeping functional page acceptance on installed Chrome.
- The official OpenAI documentation connector could not install because the local Codex executable path was missing. Codex used official OpenAI-domain fallback sources and recorded them in `docs/REFERENCES.md`.

## Main-session artifacts

All code, tests, build scripts, threat analysis, README, judge instructions, demo script, screenshot plan, and Devpost draft currently in this repository were produced and verified in the primary ContextFill Codex session that began with an empty repository.

No live OpenAI API key was configured during the release run. Model behavior was validated through strict schemas, injected/malformed responses, evidence checks, fallback integration tests, and production builds. The repository owner can optionally run the live path before recording.

## Submission metadata

- Primary `/feedback` Session ID: **TODO — run `/feedback` in this primary Codex session and paste the real ID.**
- Confirmed Codex session model: **TODO — copy from the real session metadata; do not infer.**
- Repository URL: **TODO**
- Final commit: use the repository's submitted `HEAD`; confirm after any human edits.
