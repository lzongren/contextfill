# Primary references

Checked 2026-07-20.

- [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model) — GPT-5.6 aliases and Responses API guidance.
- [GPT-5.6 Sol model](https://developers.openai.com/api/docs/models/gpt-5.6-sol) — Responses API and structured-output support.
- [Official OpenAI JavaScript SDK](https://github.com/openai/openai-node) — Responses API client usage.
- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Chrome tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs) — explicit `tabs.update(tabId, { url })` for captured same-tab navigation.
- [Chrome permission declaration](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) — optional host origins requested at runtime.
- [Chrome cross-origin extension requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chrome permission declarations](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — trusted-context access restriction for the local pairing capability.
- [Manifest V3 overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [tldts](https://github.com/remusao/tldts) — public-suffix-aware hostname parsing.
- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) — `gmail.readonly` classification and public verification requirements.
- [Gmail messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list) and [messages.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get) — bounded recent-message retrieval and MIME payloads.
- [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server) — state, offline access, token exchange, and refresh behavior.
- [Microsoft authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow) and [redirect URI rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url) — PKCE, refresh tokens, and loopback callbacks.
- [Microsoft Graph Mail.Read](https://learn.microsoft.com/en-us/graph/permissions-reference#mailread) and [list messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0) — delegated read-only access, selected fields, and text-body preference.
- [Auth0 passwordless email magic links](https://dev.auth0.com/docs/authenticate/passwordless/authentication-methods/email-magic-link) and [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless) — representative same-device email-link workflows.
- [OWASP unvalidated redirects and forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html) — rationale for refusing opaque redirect wrappers rather than resolving them automatically.
- [`@napi-rs/keyring`](https://github.com/Brooooooklyn/keyring-node) — native bindings for macOS Keychain, Windows Credential Manager, and Linux Secret Service.
