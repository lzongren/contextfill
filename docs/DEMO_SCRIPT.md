# Under-three-minute demo script

Target spoken time: about 2 minutes 40 seconds. Approximate spoken length: 360 words. Leave pauses for clicks.

## 0:00–0:20 — Problem

“Verification codes are temporary secrets. Existing autofill makes them convenient to move, but convenience alone does not answer the crucial question: does the message actually belong with the page asking for the code?”

## 0:20–0:40 — Product and architecture

“ContextFill securely brings temporary information from a trusted message to the page requesting it, while verifying that the message and website belong together. This prototype is a Chrome Manifest V3 extension, a synthetic inbox, a deterministic trust engine, and an optional local GPT-5.6 extractor. The model extracts facts. Code—not the model—decides allow, warn, or block.”

## 0:40–1:18 — Legitimate fill

“This judge lab is running on localhost, so it clearly labels the simulated active domain: `account.northstar.test`. No personal inbox or API key is involved.”

[Open ContextFill.]

“ContextFill detected one verification field and selected the newest relevant Northstar message. The candidate stays masked. I can inspect the sender, subject, age, claimed service, requesting website, extraction method, and the reason for the decision. The registrable domains align, the message is recent, and the code is unused, so the deterministic policy allows it.”

[Click Fill.]

“The field now contains the code. Notice that ContextFill did not click Verify or submit the form. It also marks the candidate used so it cannot be immediately replayed.”

## 1:18–1:55 — Lookalike block

[Open the lookalike fixture.]

“Now the simulated hostname is `account.n0rthstar.test`, with a zero. The email is still the legitimate Northstar message.”

[Open ContextFill.]

“ContextFill compares registrable domains and controlled lookalike signals. It blocks this transfer, explains the mismatch, hides reveal, and provides no Fill or override action. The page stays unchanged.”

## 1:55–2:20 — GPT-5.6 boundary

“With an API key in the loopback-only companion service, GPT-5.6 classifies one prefiltered message and extracts a strict schema: code, service, domains, expiration evidence, confidence, and excerpts. The service validates that evidence against the source. If the key, service, response, or schema fails, deterministic extraction takes over. GPT-5.6 never authorizes transfer.”

## 2:20–2:42 — Codex collaboration

“I used Codex as the lead engineering workspace from an empty repository through architecture, implementation, security review, browser testing, packaging, and these submission materials. Its test loop caught and corrected a real split-field scoring conflict before release.”

## 2:42–2:55 — Impact and close

“ContextFill is a hackathon prototype, not a claim of perfect phishing detection. Its idea is broader than OTP extraction: make context and consent visible before sensitive information crosses from one trusted place into another.”
