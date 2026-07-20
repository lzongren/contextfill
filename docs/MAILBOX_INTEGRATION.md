# Real mailbox integration

ContextFill can read recent verification-like messages from Gmail or Outlook through the local companion service. Mailbox OAuth tokens and provider API calls stay in the Node.js process on `127.0.0.1`; the extension receives only a normalized, bounded set of recent message evidence. The provider never decides whether a code may be filled.

## Current security boundary

- Gmail requests only `gmail.readonly`; Outlook requests delegated `Mail.Read` plus basic sign-in scopes.
- OAuth uses authorization code flow, PKCE, a random 10-minute state value, and an exact loopback callback.
- Mail endpoints accept only the exact Chrome extension origin configured through `CONTEXTFILL_EXTENSION_ID`.
- Tokens are held in memory and cleared when the companion service stops. They are never written to the repository, extension storage, logs, or browser bundle.
- Real mailbox messages use deterministic local extraction by default. Sending a prefiltered real message through the optional GPT-5.6 extractor requires a separate explicit toggle in the source screen.
- Gmail queries only verification-like messages from the last day and fetches at most 12 bodies. Outlook reads 25 recent summaries, filters locally, then retrieves at most 12 verification-like bodies before returning at most 10 messages.
- Disconnect clears the in-memory token and makes a best-effort Google revocation request.
- ContextFill still shows an allow/warn/block decision and requires explicit user approval. It never submits the form.

The session-only token policy is deliberate until OS-keychain persistence is implemented. Restarting the companion service therefore requires reconnecting the mailbox.

## Common setup

1. Install dependencies and build the extension:

   ```bash
   npm ci
   npm run build:extension
   ```

2. Load `dist/extension` through `chrome://extensions` with Developer mode enabled.
3. Copy the extension's 32-character ID from `chrome://extensions`.
4. Copy `.env.example` to `.env` and set:

   ```dotenv
   CONTEXTFILL_EXTENSION_ID=your_extension_id
   CONTEXTFILL_OAUTH_REDIRECT_ORIGIN=http://localhost:4318
   ```

5. Configure at least one provider below.
6. Start the companion service:

   ```bash
   npm run service
   ```

7. Open ContextFill, click the message-source button in the header, connect Gmail or Outlook, and finish the provider consent flow in the new tab.
8. Reopen ContextFill on a real page requesting a verification code and select the connected mailbox as the source.

Leave **GPT-5.6 for real mail** disabled if message bodies must remain on the device. Enabling it allows one prefiltered message at a time to pass from the loopback service to the configured OpenAI API with `store: false`; deterministic code still makes every allow/warn/block decision.

## Gmail

1. Create or choose a Google Cloud project and enable the Gmail API.
2. Configure the OAuth consent screen. During development, keep the app in testing mode and add your own Google account as a test user.
3. Add the restricted `https://www.googleapis.com/auth/gmail.readonly` scope.
4. Create an OAuth client for a web application with this exact authorized redirect URI:

   ```text
   http://localhost:4318/mail/oauth/gmail/callback
   ```

5. Set the generated credentials in `.env`:

   ```dotenv
   CONTEXTFILL_GOOGLE_CLIENT_ID=
   CONTEXTFILL_GOOGLE_CLIENT_SECRET=
   ```

Google classifies `gmail.readonly` as a restricted scope. Personal testing can use an OAuth test user, but a generally distributed application must complete Google's OAuth verification requirements. If restricted Gmail data is stored or transmitted through a remote server, Google also requires a security assessment. ContextFill's current connector keeps tokens and message processing on the user's loopback service, but public distribution still needs a formal Google review.

Official references: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list), [messages.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get), and [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## Outlook and Microsoft 365

1. Create an app registration in Microsoft Entra.
2. Choose the supported account type appropriate for your use. `common` supports personal Microsoft accounts plus work and school accounts when the registration allows them.
3. Add a Mobile and desktop application platform with this loopback redirect URI:

   ```text
   http://localhost:4318/mail/oauth/outlook/callback
   ```

4. Add delegated `Mail.Read` and `User.Read` permissions. Do not add application permissions or `Mail.ReadWrite`.
5. Enable public-client flows for the application and set:

   ```dotenv
   CONTEXTFILL_MICROSOFT_CLIENT_ID=
   CONTEXTFILL_MICROSOFT_TENANT=common
   ```

Microsoft documents delegated `Mail.Read` as available to personal and organizational accounts without admin consent by default, although an organization's own consent policies can still require administrator approval. The connector uses PKCE and requests `offline_access` so it can refresh tokens during the current companion-service session.

Official references: [authorization code flow with PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [redirect URI rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url), [Mail.Read permission](https://learn.microsoft.com/en-us/graph/permissions-reference#mailread), and [list messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0).

## Failure behavior

- If the service is stopped, the extension explains that the mailbox source is unavailable; it does not silently switch to another real account.
- If access expires or is revoked, the service clears the invalid session and requires a new connection.
- If provider output is malformed, message normalization rejects it before extraction.
- The synthetic demo inbox remains available as an explicit source for development and regression testing.
