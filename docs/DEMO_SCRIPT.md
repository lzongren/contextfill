# Under-three-minute demo script

Target spoken time: about 2 minutes 35 seconds. Leave pauses for clicks.

## 0:00–0:20 — Problem

“‘Check your email’ breaks the task. We leave the site, find the right message, decide whether it belongs to this page, and carry one or more temporary facts back. OTP autofill solves one narrow format, but it does not provide a transparent trust decision for the broader handoff.”

## 0:20–0:40 — Product and boundary

“ContextFill turns the right message into a temporary, origin-bound context capsule, then transfers only the facts this page needs. The model may extract facts, but deterministic code owns trust, target mapping, expiry, replay, mutation, and rollback. Nothing opens, copies, fills, or submits automatically.”

## 0:40–1:10 — Verified Context Capsules: success, then lookalike

[Open **Capsule · allow**.]

“Aurelia sent a booking reference and surname. ContextFill masks both, shows the chain from message through deterministic trust checks to exactly two safe fields, and waits for me.”

[Click **Transfer 2 verified facts**, then **Undo**.]

“One click transfers both or neither. The receipt says the form was not submitted; Undo restores both fields, while replay stays blocked.”

[Open **Capsule · lookalike**.]

“Change one letter in the origin and the same capsule is blocked—no transfer button, no override.”

## 1:10–1:40 — Verified magic-link handoff

[Open **Allow · magic link**, then ContextFill.]

“The same boundary handles a Cedar Notes sign-in link. It never fetches the one-time URL during inspection, permanently masks its token, and shows why sender, page, and destination align. Only my explicit click updates the exact initiating tab; the link is then marked used.”

[Open **Block · link lookalike**.]

“A zero substituted in the requesting domain blocks the action and exposes no Open or override button.”

## 1:40–2:03 — GPT-5.6 and privacy boundary

“The optional loopback companion can use GPT-5.6 to extract one prefiltered message into a strict schema. For this capsule it can return exactly two source-grounded facts—never field targets or authority. Application code independently maps and authorizes every action. Without a key, or on any model failure, the deterministic path remains fully functional.”

## 2:03–2:35 — Codex collaboration and close

“I used Codex from architecture through implementation, real Gmail integration, security review, adversarial testing, browser QA, packaging, and release automation. Independent product and security review shaped the capsule into an atomic, reversible handoff with conservative mapping, action-time revalidation, masked presentation, and an explicit synthetic-origin allowlist.”

“ContextFill is a hackathon prototype, not phishing-proof. Its idea is simple: make message context, destination, and consent visible before email advances the task.”
