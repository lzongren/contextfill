# Screenshot plan

Use a clean Chrome profile, crop out unrelated tabs/profile details, and never show `.env`, terminal environment values, personal mail, API dashboards, or keys. Use synthetic fixtures only.

## 1. Verified Context Capsule trust trace

- Page: `?scenario=capsule`, before transfer.
- Viewport: 1280×720 at default zoom.
- Must show: the simulated `checkin.aurelia-air.test` banner, all four stages (**Source message → Deterministic trust verification → Context Capsule → Destination fields**), five aligned checks, two masked fact chips, the unique two-field map, and **Transfer 2 verified facts**.
- Composition: keep the page form beside the capsule so the destination relationship is understandable in one frame.
- Confirm `AU-47K2` and `Rivera` are absent from the capsule DOM before capturing.

## 2. Atomic transfer receipt and Undo

- Page: `?scenario=capsule`, immediately after the explicit transfer.
- Must show: exactly two highlighted destination fields, **2 verified facts transferred. Form not submitted.**, the unchanged Remember control, and **Undo entire handoff**.
- Follow with a second frame after Undo showing both fields empty and the restoration receipt.
- The filled values are synthetic fixture data. Never substitute a real booking or passenger name.

## 3. Blocked capsule lookalike

- Page: `?scenario=capsule-lookalike`.
- Must show: simulated `checkin.aureliaair.test`, **Transfer blocked**, the registrable-domain mismatch explanation, faded downstream capsule/map stages, unchanged empty fields, and no Transfer or override action.
- Pair this with image 1. Together they communicate the product and its deterministic security boundary in under 30 seconds.

## 4. Verified magic-link confirmation card

- Page: `?scenario=magic-link`.
- Extension state: Allowed, one-time path permanently masked.
- Must show: sender, subject, message age, Cedar Notes, requesting site and destination `login.cedarnotes.test`, deterministic reason, and **Open verified link in this tab**.
- Confirm `sample-token` is absent before capturing.

## 5. Optional architecture diagram

- Use the Mermaid architecture diagram from `README.md` or redraw it with the same factual boundaries.
- Emphasize: untrusted message → bounded facts → deterministic policy → conservative field map → explicit atomic mutation; the model never authorizes or selects fields.

## 6. Optional GPT/fallback indicator

- Capture one legitimate card with **Deterministic extraction · policy decided locally**.
- If a live key is safely configured off-screen, capture another with **GPT-5.6 extracted message facts · deterministic policy decided**.
- Never include the service terminal, `.env`, request headers, or API account page.

## 20–30 second Capsule segment

1. Hold the masked four-stage allowed trace for 4 seconds.
2. Approve the transfer; hold the two-field, no-submit receipt for 4 seconds.
3. Click Undo and show both fields restored for 3 seconds.
4. Switch to the lookalike fixture and hold the broken trust chain with no action for 5 seconds.
5. Close on: “The model extracts facts. Deterministic code decides whether they belong on this page.”

## Recording hygiene

- Close personal tabs and notifications.
- Use synthetic fixtures only.
- Keep browser zoom and popup size at defaults.
- Record the Capsule allow, Undo, and block paths first in case later material must be cut.
- Verify the final video remains under three minutes before uploading publicly to YouTube.
