# Screenshot plan

Use a clean Chrome profile, crop out unrelated tabs/profile details, and never show `.env`, terminal environment values, personal mail, API dashboards, or keys.

## 1. Verified magic-link confirmation card

- Page: `?scenario=magic-link`.
- Extension state: Allowed, one-time path permanently masked.
- Must show: sender, subject, message age, Cedar Notes, requesting site and destination `login.cedarnotes.test`, deterministic reason, and **Open verified link in this tab**.
- Composition: judge lab's simulated-domain banner behind or beside the popup so the relationship is immediately legible.
- Confirm `sample-token` is absent before capturing.

## 2. Blocked magic-link lookalike

- Page: `?scenario=magic-link-lookalike`.
- Extension state: Blocked.
- Must show: simulated `login.cedarn0tes.test`, verified destination `login.cedarnotes.test`, mismatch/lookalike explanation, masked link, and no Open/override action.
- This is the strongest hero image because it communicates sender/page/destination verification in one frame.

## 3. Trusted reference transfer

- Page: `?scenario=reference`, first with the allowed popup and then after **Fill reference**.
- Must show: explicit booking-reference field, unchanged Remember checkbox, and **The form has not been submitted.**
- This image proves the trust engine generalizes beyond links and OTP.

## 4. Optional architecture diagram

- Use the Mermaid architecture diagram from `README.md` or redraw it with the same factual boundaries.
- Emphasize: message facts → local URL inspection → deterministic policy → explicit same-tab action or field mutation; never prefetch or submission.

## 5. Optional GPT/fallback indicator

- Capture one legitimate card with **Deterministic extraction · policy decided locally**.
- If a live key is safely configured off-screen, capture another with **GPT-5.6 extracted message facts · deterministic policy decided**.
- Never include the service terminal, `.env`, request headers, or API account page.

## Recording hygiene

- Close personal tabs and notifications.
- Use synthetic fixtures only.
- Keep the browser zoom and popup size at defaults.
- Record the magic-link allow and block paths first in case later material must be cut.
- Verify the final video remains under three minutes before uploading publicly to YouTube.
