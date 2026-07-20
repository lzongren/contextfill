# Risks and limitations log

| Risk                                                            | Current mitigation                                                                            | Status                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Webpage tricks field detection into choosing an unrelated input | Scored OTP signals, visibility/enabled checks, conservative thresholds                        | Unit-tested; browser test pending               |
| Lookalike checks miss a homograph                               | Exact registrable-domain policy plus limited controlled skeleton checks; honest non-goal      | Controlled fixtures pass; residual risk remains |
| Model hallucinates a domain or code                             | Strict structured output, evidence validation, deterministic fallback, model never authorizes | In progress                                     |
| Extension leaks a code after use                                | In-memory state only, masked display, short timeout, clear after fill/dismiss/expiry          | In progress                                     |
| Local service is exposed cross-origin                           | Loopback binding, allowlisted localhost and extension origins, bounded request size           | In progress                                     |
| Judge machine lacks Playwright browser                          | Target installed Chrome channel and retain unit/integration coverage                          | Open                                            |
