# Screenshot plan

Use a clean Chrome profile, crop out unrelated tabs/profile details, and never show `.env`, terminal environment values, personal mail, API dashboards, or keys.

## 1. Hero — visible Auto-Continue countdown

- Page: `?scenario=magic-link` with Auto-Continue already enabled for the judge origin.
- Extension state: popup closed; in-page card at **Opening in 3…** with verified destination and **Cancel auto action** visible.
- Must show: simulated page identity, visible progress, Auto-Continue mode badge, masked destination hostname only, privacy boundary, and the unchanged page behind it.
- This is the strongest hero image because it communicates popup-free continuity, trust, and user control in one frame.
- Use only the synthetic fixture; confirm no token, personal address, or mailbox UI appears.

## 2. Blocked magic-link lookalike

- Page: `?scenario=magic-link-lookalike` with popup closed.
- Extension state: in-page **Auto-Continue stopped**.
- Must show: simulated `login.cedarn0tes.test`, blocked/mismatch explanation, and no action capable of navigation.
- Pair this with the hero to show that automation preserves the deterministic security boundary.

## 3. Trusted-sites and privacy-safe activity

- Page: extension settings after one synthetic OTP fill and one synthetic magic-link open.
- Must show: exact origin including protocol/port, Auto-Continue badge, Revoke, activity outcome/time, seven-day privacy explanation, and Clear activity.
- Confirm no code, link token, subject, sender address, page path, or personal hostname is visible.

## 4. Manual verified magic-link evidence card

- Page: `?scenario=magic-link`.
- Extension state: Allowed, one-time path permanently masked.
- Must show: sender, subject, message age, Cedar Notes, requesting site and destination `login.cedarnotes.test`, deterministic reason, and **Open verified link in this tab**.
- Composition: judge lab's simulated-domain banner behind or beside the popup so the relationship is immediately legible.
- Confirm `sample-token` is absent before capturing.

## 5. Trusted reference transfer

- Page: `?scenario=reference`, first with the allowed popup and then after **Fill reference**.
- Must show: explicit booking-reference field, unchanged Remember checkbox, and **The form has not been submitted.**
- This image proves the trust engine generalizes beyond links and OTP.

## 6. Optional architecture diagram

- Use the Mermaid architecture diagram from `README.md` or redraw it with the same factual boundaries.
- Emphasize: wait-state detection → message facts → deterministic policy → visible Assisted/Auto gate → execution-time revalidation → same-tab action; never prefetch or extension submission.

## 7. Optional GPT/fallback indicator

- Capture one legitimate card with **Deterministic extraction · policy decided locally**.
- If a live key is safely configured off-screen, capture another with **GPT-5.6 extracted message facts · deterministic policy decided**.
- Never include the service terminal, `.env`, request headers, or API account page.

## Recording hygiene

- Close personal tabs and notifications.
- Use synthetic fixtures only.
- Keep the browser zoom and popup size at defaults.
- Record the popup-free countdown and block paths first in case later material must be cut.
- Verify the final video remains under three minutes before uploading publicly to YouTube.
