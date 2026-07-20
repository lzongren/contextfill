# Security policy

ContextFill is a hackathon prototype, not a production security product. Its supported release line is the latest commit on `main`.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose temporary codes, API keys, browser data, or unsafe filling behavior. Use GitHub's private vulnerability-reporting feature on this repository instead.

Include:

- The affected commit and platform.
- A concise reproduction using synthetic data.
- Expected and observed security behavior.
- Any evidence of code disclosure, domain-policy bypass, replay, automatic submission, or local-service abuse.

Do not include real verification codes, credentials, private messages, or personal browser data. Reports will be acknowledged as soon as practical for a hackathon-maintained project.

The documented threat model and explicit non-goals are in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).
