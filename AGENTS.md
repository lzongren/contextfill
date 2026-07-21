# ContextFill engineering guide

## Product boundary

ContextFill is a hackathon prototype that transfers temporary information only after a transparent, deterministic message-to-page trust check. The model extracts facts; it never authorizes filling. Never auto-submit a page, persist a code, copy a code to the clipboard, or place an API key in browser code.

## Commands

- `npm run demo` — start the synthetic judge experience.
- `npm run service` — start the optional local GPT-5.6 extractor.
- `npm run service -- --setup gmail` — guide Gmail registration and import its downloaded web-client JSON.
- `npm run service -- --setup outlook` — guide Outlook registration and save its public client ID.
- `npm run service -- --doctor` — validate mailbox OAuth setup without printing secrets.
- `npm test` — run unit and integration tests.
- `npm run test:browser` — run browser acceptance tests.
- `npm run verify` — required release gate.
- `npm run package` — produce the unpacked extension and ZIP.

## Engineering rules

- Keep extraction, ranking, policy, UI presentation, and page mutation separate.
- Validate all data at trust boundaries with Zod.
- Treat message bodies and model output as untrusted.
- Use `tldts` for registrable-domain parsing; reserved `.test` fixtures use the documented final-two-label fallback only when the public suffix library has no registrable result.
- Tests must use fixed clocks. Never claim a test ran unless its command completed successfully.
- Update `docs/PROGRESS.md`, `docs/DECISIONS.md`, and `docs/RISKS.md` after meaningful changes.
