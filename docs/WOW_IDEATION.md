# ContextFill wow-effect exploration

Date: 2026-07-21

## Product whitespace

ContextFill should not compete by becoming a general password manager or an opaque browser agent. Its distinctive opportunity is a visible, deterministic contract between an ordinary message and the exact page fields or action that message is allowed to advance.

- Password managers primarily fill persistent vault data associated with saved sites. Bitwarden documents URI matching, iframe and insecure-page warnings, and optional TOTP copying; 1Password centers saved credentials, identities, cards, and authenticator codes ([Bitwarden autofill](https://bitwarden.com/help/auto-fill-browser/), [1Password browser filling](https://support.1password.com/explore/browser/)).
- Platform autofill is expanding persistent identity data, while Apple already transfers the narrow verification-code shape from Mail and Messages. Neither documented flow exposes a sender-to-message-to-page authorization proof ([Chrome enhanced autofill](https://blog.google/products-and-platforms/products/chrome/enhanced-autofill/), [Apple verification-code AutoFill](https://support.apple.com/en-us/104982)).
- Gmail and Outlook support rich email actions, but only after sender-side markup, registration, authentication, and action-endpoint work. ContextFill can safely continue ordinary transactional messages without requiring the sender to integrate with an inbox platform ([Gmail Actions](https://developers.google.com/workspace/gmail/markup/actions/actions-overview), [Gmail registration](https://developers.google.com/workspace/gmail/markup/registering-with-google), [Outlook Actionable Messages](https://learn.microsoft.com/en-us/outlook/actionable-messages/)).
- General browser agents can select, type, and navigate broadly, but their own product and security guidance emphasizes monitoring, malicious instructions, and action risk. ContextFill can be narrower and more explainable: extracted facts are untrusted until deterministic code binds them to the current page ([Browse with Copilot](https://support.microsoft.com/en-us/microsoft-copilot/browse-with-copilot), [OpenAI prompt-injection design](https://openai.com/index/designing-agents-to-resist-prompt-injection/)).

## Candidate scorecard

Scores are 1–5. Columns: `5s` five-second comprehension; `Wow` visual effect; `Orig` originality; `Value` real user value; `Fit` core-story fit; `Depth` technical depth; `Sec` security defensibility; `Offline` no-credential judge path; `Feas` feasibility here; `Demo` under-30-second demonstration.

| Candidate                    |  5s | Wow | Orig | Value | Fit | Depth | Sec | Offline | Feas | Demo |  Total | Main tradeoff                                                                                       |
| ---------------------------- | --: | --: | ---: | ----: | --: | ----: | --: | ------: | ---: | ---: | -----: | --------------------------------------------------------------------------------------------------- |
| **Verified Context Capsule** |   5 |   5 |    5 |     5 |   5 |     5 |   5 |       5 |    4 |    5 | **49** | Multi-field mapping must remain one fixed, narrow intent rather than broad autofill.                |
| Trust Flight Recorder        |   5 |   5 |    4 |     4 |   5 |     3 |   5 |       5 |    5 |    5 |     46 | Powerful explanation layer, but too cosmetic to be the primary feature by itself.                   |
| Lookalike Split Shield       |   5 |   5 |    3 |     4 |   5 |     3 |   5 |       5 |    5 |    5 |     45 | Excellent adversarial moment, but the released product already blocks lookalikes.                   |
| Verified Auto-Continue       |   5 |   5 |    4 |     5 |   5 |     5 |   3 |       4 |    3 |    5 |     44 | High impact, but opt-in automation and cancellation materially enlarge the trust boundary.          |
| Guided Continuation Runway   |   5 |   4 |    4 |     4 |   5 |     4 |   4 |       5 |    4 |    5 |     44 | Detecting a unique safe next control is difficult; it must never become a hidden click.             |
| Expiring Handoff Queue       |   4 |   4 |    4 |     5 |   5 |     4 |   4 |       5 |    4 |    4 |     43 | Useful across tasks, but sensitive queue persistence and notification noise need care.              |
| Context Conflict Lens        |   5 |   4 |    4 |     3 |   5 |     3 |   5 |       5 |    4 |    5 |     43 | Restrictive message intent is valuable negative evidence, but natural-language scope can overreach. |
| Cross-message Consensus      |   4 |   4 |    5 |     4 |   4 |     5 |   3 |       5 |    2 |    4 |     40 | Deterministic correlation, aliases, stale conflicts, and replay semantics are hard to defend.       |

## Decision

### Primary feature: Verified Context Capsule

**Promise:** ContextFill turns one trusted travel message into a temporary, origin-bound two-fact capsule, then transfers only those facts into the two exact fields the current page requests.

This wins because the value and safety model are visible in one glance:

**Message → deterministic trust checks → two masked facts → two exact fields → explicit transfer → Undo → never submit**

It is more than another extractor format: authorization now covers an atomic relationship among one message, two independently typed facts, one requesting site, and two unique page controls. It also proves that ContextFill can safely bridge an email-driven task without becoming general form autofill.

### Supporting enhancement: compact Trust Trace

The capsule confirmation visualizes sender, service, domain, freshness, and field binding as an ordered trace. The same trace breaks at the domain step on the adversarial fixture. It is intentionally only a presentation layer: the trace never authorizes an action.

No second primary feature is included. Verified Auto-Continue is being developed on a separate isolated branch and changes overlapping browser integration surfaces. Capsule work remains modular and this branch will not merge or publish a release while that stream is active.

## Experience definition

### Hero journey (20–30 seconds)

1. Open the synthetic Aurelia Air check-in page. Booking reference and passenger surname are empty; a decoy field and submit button are visible.
2. ContextFill finds one recent booking-confirmation message and compresses it into a two-fact capsule.
3. The Trust Trace visibly verifies message, sender and service, referenced domain, current page, freshness, and two unique field labels.
4. Masked chips map booking reference and passenger surname to their exact destination fields.
5. The user explicitly authorizes the transfer.
6. The two fields fill in a short accessible cascade. The decoy, hidden control, checkbox, and submit button remain untouched.
7. An in-page receipt says **2 verified facts transferred · Form not submitted** and offers **Undo**.
8. Undo restores both previous values while the capsule remains replay-blocked.

### States

- **Loading:** announce that ContextFill is checking one message, the page relationship, and exact field bindings.
- **Success-ready:** show an allowed trace, two masked mappings, explicit Transfer and Cancel controls.
- **Warning:** conflicting recent messages stop before selection; no automatic or cautious partial transfer is offered.
- **Block:** lookalike, sender, service, stale, replay, non-empty, hidden, missing, duplicate, or cross-form ambiguity stops the trace at the failed check and exposes no Transfer control.
- **Cancellation:** Cancel removes the in-page review without mutation and clears capsule values.
- **Post-action:** show the short-lived receipt and Undo; replay remains marked even after Undo because the page already received the facts.
- **Error:** atomic application failure rolls back every changed field and reports a masked, non-sensitive explanation.

### Security boundaries

- One fixed `travel_check_in` intent with exactly `booking_reference` and `passenger_surname`; no generic key/value bundles.
- Both facts must occur verbatim in one source message and pass a strict runtime schema. No cross-message assembly.
- Model output may extract facts only. It cannot supply selectors, mapping decisions, trust decisions, or authorization.
- Deterministic code independently checks sender, service, referenced domain, current page, freshness, expiry, replay, supported intent, and exact field semantics.
- Each fact requires one unique, visible, enabled strongly labeled target. Ambiguous, hidden, unrelated, disabled, or unsafe-category controls fail closed.
- The action rechecks the captured tab, URL, current clock, replay state, and field plan immediately before mutation.
- Application is all-or-nothing and invokes no click, Enter key, `submit`, or `requestSubmit`. Page-owned input handlers remain an explicitly documented residual risk.
- Values are memory-only, masked in UI, absent from logs and telemetry, never copied, and cleared after action, Undo window, dismissal, expiry, or 90 seconds.

### Accessibility and motion

- The visual trace has an equivalent ordered text list and does not rely on color.
- Transfer, Cancel, Dismiss, and Undo are keyboard-operable with visible focus.
- Loading, block, success, rollback, and Undo have screen-reader announcements.
- Field mapping highlights cause no layout shift. `prefers-reduced-motion` renders the final mapping state immediately while preserving the same text and announcements.

## Acceptance criteria

- The strict capsule and fact schemas reject unknown keys, selectors, authorization fields, duplicate facts, extra facts, overlength values, and unsafe categories.
- A fixed-clock deterministic extractor produces the correct two facts only from the supported synthetic message and ignores prompt instructions and generic numbers.
- Model facts cannot bypass deterministic domain, sender, freshness, replay, intent, or field-mapping policy.
- The aligned fixture fills exactly two intended fields only after explicit authorization and never submits.
- The lookalike fixture visibly blocks with no mutation or override.
- Duplicate, hidden, unrelated, disabled, non-empty, missing, and cross-form targets remain untouched.
- Mutation is atomic; failure rolls back all changed fields.
- Undo restores the pre-action field values without making the capsule reusable.
- Keyboard and reduced-motion paths communicate the same result.
- Existing magic-link, reference, single-OTP, split-OTP, mailbox, fallback, packaging, and release gates remain green.
- The complete allowed and adversarial demonstrations work offline without credentials, personal data, network access, or an API key.
