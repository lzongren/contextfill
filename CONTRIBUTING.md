# Contributing to ContextFill

Thank you for helping improve ContextFill. Keep changes focused on its central principle: temporary information moves only after visible context checks and explicit user approval.

## Development

Requirements: Node.js 20+, npm, and Chrome 114+.

```bash
npm ci
npm run verify
```

For manual testing, build the extension and load `dist/extension` through `chrome://extensions` in Developer mode. Run `npm run demo` and use only the synthetic judge fixtures.

## Pull requests

- Keep extraction, ranking, deterministic policy, presentation, and page mutation separate.
- Add tests for security-relevant changes and failure paths.
- Never make GPT-5.6 the final authority for allow, warn, or block.
- Never add automatic form submission, clipboard writes, analytics, permanent inbox persistence, or broad website permissions without an explicit design review.
- Do not commit `.env`, API keys, personal messages, real codes, or screenshots containing private browser data.
- Run `npm run verify` before requesting review.

Small, well-tested changes are preferred over broad scope expansion. Read [`AGENTS.md`](AGENTS.md), [`docs/DECISIONS.md`](docs/DECISIONS.md), and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) before modifying trust-sensitive behavior.
