# Build plan

Last updated: 2026-07-20

1. Establish a strict TypeScript workspace and release commands.
2. Prove the riskiest slice: synthetic message → validated candidate → deterministic trust decision → explicit page fill.
3. Add deterministic extraction, ranking, domain normalization, lookalike checks, and policy coverage.
4. Build realistic localhost fixtures for single, split, mismatched, expired, lookalike, and empty scenarios.
5. Wrap the slice in a Manifest V3 popup using only `activeTab` and `scripting`.
6. Add the optional localhost GPT-5.6 Responses API extractor; fail closed to deterministic extraction.
7. Polish accessibility and state lifecycle, then run browser checks and security review.
8. Produce the extension package and submission documentation.
9. Validate real Gmail-to-page OTP flow and correct real-site permission/field gaps.
10. Make Verified Magic-Link Handoff the differentiated core: local URL inspection, masked evidence, deterministic sender/page/destination policy, explicit same-tab navigation, and adversarial tests.
11. Add Trusted Reference Transfer as a narrow generalization proof, then complete the beta release gate and public artifacts.

## Riskiest assumptions

- A popup-triggered injection can reliably discover and mutate both ordinary and framework-controlled OTP inputs without broad host permissions.
- Registrable-domain handling remains meaningful for public domains while reserved `.test` fixtures stay explicit and honest.
- The optional model response can be constrained and validated without allowing model text to influence the final trust decision.
- A Chrome judge can reach a loopback companion service without exposing permissive cross-origin behavior.
- One-time link destinations can be verified usefully without fetching or consuming them; opaque destinations must fail closed.
- Explicit navigation can remain bound to the initiating tab even when the popup or page focus changes.
