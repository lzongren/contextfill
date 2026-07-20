# Risks and limitations log

| Risk                                                            | Current mitigation                                                                            | Status                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Webpage tricks field detection into choosing an unrelated input | Scored OTP signals, visibility/enabled checks, conservative thresholds                        | Unit and installed-Chrome tests pass                               |
| Lookalike checks miss a homograph                               | Exact registrable-domain policy plus limited controlled skeleton checks; honest non-goal      | Controlled fixtures pass; residual risk remains                    |
| Model hallucinates a domain or code                             | Strict structured output, evidence validation, deterministic fallback, model never authorizes | Mocked malformed/invented evidence tests pass; live no-key release |
| Extension leaks a code after use                                | In-memory state only, masked display, short timeout, clear after fill/dismiss/expiry          | Implemented and reviewed                                           |
| Local service is exposed cross-origin                           | Loopback binding, allowlisted localhost and extension origins, bounded request size           | Boundary tests pass; production auth remains future work           |
| Judge machine lacks Playwright browser                          | Automated suite uses installed Chrome plus documented manual flow                             | Chromium install needed only for contributor verification          |
