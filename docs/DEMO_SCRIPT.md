# Under-three-minute demo script

Target spoken time: about 2 minutes 50 seconds. Leave pauses for the visible countdown.

## 0:00–0:20 — Problem

“‘Check your email’ breaks the task. We leave the site, find the right message, decide whether a one-time link is real, and return to the correct page. OTP autofill solves one narrow format, but it does not provide a transparent trust decision for the broader handoff.”

## 0:20–0:40 — Product and boundary

“ContextFill safely removes that interruption. On a site I explicitly configure, it detects the email wait state, finds an OTP or magic link, and deterministic code—not the model—checks sender, service, destination, active page, freshness, expiry, and replay. It shows every step in page, gives me time to cancel, and revalidates before acting.”

## 0:40–1:20 — Verified magic-link handoff

[On **Allow · magic link**, open ContextFill once, choose **Automation → Auto-Continue**, acknowledge the site behavior, then return to the page.]

“Every new site starts Manual. I granted only this exact origin. Now the popup is closed: ContextFill finds Cedar Notes’ sign-in link without fetching it, shows a local trust progression, and permanently masks the token-bearing path. The page, sender, and destination align.”

“During this three-second countdown I can cancel. ContextFill performs no prefetch, HEAD request, redirect following, clipboard copy, or hidden submit.”

[Let the countdown finish.]

“It rechecked the exact tab URL, page intent, permission, freshness, replay, and deterministic Allow decision, then updated only this tab. The synthetic `.test` target maps to an honestly labeled local completion page. The candidate is now marked used.”

## 1:20–1:52 — Lookalike block

[Open **Block · link lookalike**; do not open the popup.]

“Now the initiating site is `cedarn0tes.test`, with a zero, while the message link targets `cedarnotes.test`. The in-page card stops automatically. ContextFill compares registrable domains and controlled lookalike signals, blocks the action, keeps the token masked, and exposes no override.”

## 1:52–2:12 — General transfer primitive

[Open **Allow · reference**, approve **Fill reference**.]

“The same engine is not hard-coded to login. In Manual mode it extracts a booking reference, verifies the message-to-site context, and fills only the explicitly labeled field. It never submits. OTPs can run in Assisted mode or fill after the same visible Auto countdown.”

## 2:12–2:32 — GPT-5.6 and privacy boundary

“The optional loopback companion can use GPT-5.6 to classify one prefiltered message into a strict schema. Application code verifies copied evidence, rejects high-risk recovery, payment, and signing links, and independently authorizes every action. Without a key—or on any model failure—the deterministic path remains fully functional.”

## 2:32–2:48 — Codex collaboration and close

“I used Codex from architecture through implementation, real Gmail integration, security review, browser testing, packaging, and release automation. Human testing corrected real-site permissions and field detection, then product review made verified magic-link handoff the differentiated core.”

“ContextFill is a hackathon prototype, not phishing-proof. Its idea is simple: remove the email interruption without hiding context, destination, or control.”
