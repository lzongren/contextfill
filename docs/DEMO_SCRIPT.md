# Under-three-minute demo script

Target spoken time: about 2 minutes 45 seconds. Approximate spoken length: 365 words. Leave pauses for clicks.

## 0:00–0:20 — Problem

“‘Check your email’ breaks the task. We leave the site, find the right message, decide whether a one-time link is real, and return to the correct page. OTP autofill solves one narrow format, but it does not provide a transparent trust decision for the broader handoff.”

## 0:20–0:40 — Product and boundary

“ContextFill safely bridges the gap between checking email and continuing the task—starting with verified magic links. It extracts temporary actions, then deterministic code—not the model—checks the sender, claimed service, destination, active page, freshness, expiry, and replay state. Nothing opens, fills, copies, or submits automatically.”

## 0:40–1:20 — Verified magic-link handoff

[Open **Allow · magic link**, then ContextFill.]

“This judge lab clearly labels its simulated domain, `login.cedarnotes.test`; localhost never pretends to be that site. ContextFill found Cedar Notes’ sign-in link without fetching it. The token path is masked. I can inspect the sender, subject, age, claimed service, requesting page, destination, and the deterministic reason for Allow.”

“The tab has not moved. ContextFill performs no prefetch, HEAD request, redirect following, or clipboard copy.”

[Click **Open verified link in this tab**.]

“Only this click updates the exact initiating tab. The synthetic `.test` target maps to an honestly labeled local completion page. The candidate is now marked used.”

## 1:20–1:52 — Lookalike block

[Open **Block · link lookalike**, then ContextFill.]

“Now the initiating site is `cedarn0tes.test`, with a zero, while the message link targets `cedarnotes.test`. ContextFill compares registrable domains and controlled lookalike signals, blocks the action, keeps the token masked, and exposes no Open or override button.”

## 1:52–2:12 — General transfer primitive

[Open **Allow · reference**, approve **Fill reference**.]

“The same engine is not hard-coded to OTPs or links. Here it extracts a booking reference, verifies the message-to-site context, and fills only the explicitly labeled field. It never submits. The original single and split OTP flows remain supported.”

## 2:12–2:32 — GPT-5.6 and privacy boundary

“The optional loopback companion can use GPT-5.6 to classify one prefiltered message into a strict schema. Application code verifies copied evidence, rejects high-risk recovery, payment, and signing links, and independently authorizes every action. Without a key—or on any model failure—the deterministic path remains fully functional.”

## 2:32–2:48 — Codex collaboration and close

“I used Codex from architecture through implementation, real Gmail integration, security review, browser testing, packaging, and release automation. Human testing corrected real-site permissions and field detection, then product review made verified magic-link handoff the differentiated core.”

“ContextFill is a hackathon prototype, not phishing-proof. Its idea is simple: make context, destination, and consent visible before email advances the task.”
