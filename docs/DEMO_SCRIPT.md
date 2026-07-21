# Under-three-minute demo script

Target spoken time: about 2 minutes 50 seconds. Leave pauses for the Capsule transfer and visible Auto-Continue countdown.

## 0:00–0:18 — Problem

[Show a synthetic check-in page beside a “check your email” state.]

“Email is often the missing step inside another task. We hunt for the right message, decide whether it belongs to this page, then copy facts or follow a link without a visible trust proof.”

## 0:18–0:35 — Product and boundary

“ContextFill turns the right message into a temporary, origin-bound handoff. A model may extract bounded facts, but deterministic code owns sender, service, domain, freshness, replay, target mapping, and execution. It never prefollows a link, touches the clipboard, clicks Submit, or calls a form-submission API.”

## 0:35–1:05 — Verified Context Capsule

[Open **Capsule · verified**. Hold the complete four-stage trace, then approve the transfer and click Undo.]

“This recent Aurelia message becomes a 90-second capsule with exactly two masked facts. The trace proves Message → trust checks → capsule → two unique fields. One click transfers both or neither. The receipt says the form was not submitted; Undo restores both fields while replay stays blocked.”

[Open **Capsule · lookalike**.]

“Remove one hyphen from the simulated airline domain and the chain breaks visibly—no transfer button, no override, no changed field.”

## 1:05–1:43 — Verified Auto-Continue

[On **Allow · magic link**, open ContextFill once, choose **Automation → Auto-Continue**, acknowledge the site behavior, then reload the fixture and close the popup.]

“For OTP and verified-link wait states, every origin starts Manual. I explicitly granted only this exact origin. ContextFill now detects the wait state, finds the matching message, masks the one-time link, and shows a cancellable three-second verification countdown.”

[Let the countdown finish.]

“At zero it rechecks the unchanged tab, current page intent, permission and mode, freshness, replay, and deterministic Allow decision. Only then does it update this same tab. It never clicks a page button; an Auto OTP opt-in separately warns that a destination page may react to the last digit.”

## 1:43–2:00 — Auto block and revocation

[Open **Block · link lookalike** with a fresh unused candidate.]

“On `cedarn0tes.test`, with a zero, sender and link remain legitimate but the requesting site does not. The in-page card stops, records the lookalike reason, and exposes no action. Trusted-site settings revoke both the rule and exact-origin permission.”

## 2:00–2:20 — GPT-5.6 and privacy

“The optional loopback companion can use GPT-5.6 to extract one prefiltered message into a strict schema. For a capsule it can return only service/domain evidence, booking reference, and passenger surname—never selectors or authority. Without a key, every judge path uses deterministic extraction.”

## 2:20–2:42 — Codex

“I used Codex from architecture through implementation, real Gmail integration, security review, adversarial testing, visual QA, packaging, and release automation. Independent product, interaction, and security reviews shaped the Capsule’s atomic rollback and Auto-Continue’s exact-site opt-in, visible cancellation, action-time revalidation, and privacy-safe history.”

## 2:42–2:50 — Close

“ContextFill is a hackathon prototype, not phishing-proof. Its idea is simple: make message context, destination, and control visible before email advances the task.”

## Recording hygiene

- Record only synthetic fixtures in a clean browser profile.
- Do not show a real inbox, account identifier, personal address, key, fallback code, token, or terminal environment.
- Verify the public cut remains under three minutes.
