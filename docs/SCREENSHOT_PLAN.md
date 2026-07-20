# Screenshot plan

Use a clean Chrome profile, crop out unrelated tabs/profile details, and never show `.env`, terminal environment values, personal mail, API dashboards, or keys.

## 1. Legitimate confirmation card

- Page: `?scenario=legitimate-single`.
- Extension state: Allowed, code still masked.
- Must show: sender, subject, message age, Northstar, `account.northstar.test`, deterministic decision reason, and explicit Fill button.
- Composition: judge lab's simulated-domain banner behind or beside the popup so the relationship is immediately legible.

## 2. Filled split-code form

- Page: `?scenario=legitimate-split` after clicking **Fill 6 fields**.
- Must show: six digits in order, untouched Remember checkbox, and **The form has not been submitted.**
- Do not click Verify.

## 3. Blocked lookalike

- Page: `?scenario=lookalike`.
- Extension state: Blocked.
- Must show: simulated `account.n0rthstar.test`, message/request mismatch explanation, masked code, and no Fill/override action.
- This is the strongest hero image because it communicates the differentiator in one frame.

## 4. Optional architecture diagram

- Use the Mermaid architecture diagram from `README.md` or redraw it with the same factual boundaries.
- Emphasize: message facts → deterministic policy → explicit user action → page mutation; never submission.

## 5. Optional GPT/fallback indicator

- Capture one legitimate card with **Deterministic fallback active · no API key required**.
- If a live key is safely configured off-screen, capture another with **GPT-5.6 extracted message facts · deterministic policy decided**.
- Never include the service terminal, `.env`, request headers, or API account page.

## Recording hygiene

- Close personal tabs and notifications.
- Use synthetic fixtures only.
- Keep the browser zoom and popup size at defaults.
- Record the two mandatory paths first in case later optional material must be cut.
- Verify the final video remains under three minutes before uploading publicly to YouTube.
