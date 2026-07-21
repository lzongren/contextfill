# Real mailbox integration

ContextFill has two real-message paths. A one-time `.eml` import needs no account connection and stays entirely in the extension popup. Ongoing Gmail or Outlook access uses the local companion service: OAuth tokens and provider API calls stay in the Node.js process on `127.0.0.1`, while the extension receives only a normalized, bounded set of recent message evidence. Neither the provider nor the MIME parser decides whether a link may open or a value may fill.

## Try one real message without OAuth

1. In Gmail or Outlook, export or download the magic-login, email-confirmation, verification-code, or supported reference message in original `.eml` format.
2. Open the page that initiated or is requesting the action.
3. Open ContextFill, click the message-source pill, and choose **Import email file**.
4. Select the `.eml` file, review the sender, subject, requesting website, and allow/warn/block explanation, then explicitly choose **Fill** if appropriate.

The file must end in `.eml` and be no larger than 2 MB. Parsing happens inside the open popup. ContextFill extracts only normalized sender, subject, date, readable body text, and HTTP(S) links; it does not render the email HTML, fetch a link, or use attachments as evidence. The raw file and normalized body are dropped immediately after local deterministic candidate extraction, and neither they nor any candidate value are written to extension storage. Imported messages are never sent through optional model extraction, even when the real-mail model toggle was previously enabled. Encrypted, malformed, or metadata-incomplete messages fail closed with an explanation.

## Current security boundary

- Gmail requests only `gmail.readonly`; Outlook requests delegated `Mail.Read` plus basic sign-in scopes.
- OAuth uses authorization code flow, PKCE, a random 10-minute state value, and an exact loopback callback.
- Mail and model-extraction endpoints require a 256-bit per-install capability established with a one-time six-digit terminal code. The service binds it to the extension installation ID and cross-checks the browser `Origin` header whenever Chrome supplies one.
- Refresh tokens and the hashed service capability are stored in the native macOS Keychain, Windows Credential Manager, or Linux Secret Service through `@napi-rs/keyring`. Access tokens stay in service memory. If the keyring is unavailable, the UI explicitly reports session-only storage.
- The extension stores only its random pairing capability, selected source, and explicit model opt-in. Chrome storage is restricted to trusted extension contexts; message bodies, link tokens, codes, references, provider tokens, and account authorization never enter it.
- Real mailbox messages use deterministic local extraction by default. Sending a prefiltered real message through the optional GPT-5.6 extractor requires a separate explicit toggle in the source screen.
- Imported `.eml` files are capped at 2 MB and parsed with explicit MIME nesting and header-size limits. HTML is converted to inert text plus HTTP(S) link evidence; scripts, styles, templates, and attachments do not enter extraction.
- Gmail queries only temporary-action phrases from the last day and fetches at most 12 bodies. It intentionally uses Gmail's normal result set without opting into Spam or Trash; move a legitimate message to the inbox before scanning. Outlook reads 25 recent summaries, filters locally, then retrieves at most 12 code/link/reference-like bodies before returning at most 10 messages.
- HTML-only message normalization preserves HTTPS anchor destinations as inert text. It does not load images, execute HTML, fetch destinations, or follow redirects.
- Disconnect clears memory, deletes the keychain refresh credential, and makes a best-effort Google revocation request.
- ContextFill still shows an allow/warn/block decision and requires explicit user approval. It never submits the form.

## Common setup

### Install a release

1. Download the extension ZIP, companion `.tgz`, and both checksum files from the same [GitHub Release](https://github.com/lzongren/contextfill/releases). Verify both artifacts.
2. Unzip the extension, then load that directory through `chrome://extensions` with Developer mode enabled.
3. Install the companion package and create a private runtime configuration:

   ```bash
   npm install --global ./contextfill-companion-v0.2.0-beta.7.tgz
   mkdir contextfill-runtime
   cd contextfill-runtime
   contextfill-service --init
   ```

### Run from source

1. Install dependencies and build the extension:

   ```bash
   npm ci
   npm run build:extension
   ```

2. Load `dist/extension` through `chrome://extensions` with Developer mode enabled.

### Configure and connect

1. In the runtime directory, keep the callback origin in the generated `.env` (or copy `.env.example` when running from source):

   ```dotenv
   CONTEXTFILL_OAUTH_REDIRECT_ORIGIN=http://localhost:4318
   ```

2. Configure at least one provider below. Outlook has a guided path that derives the exact callback and permissions from the runtime configuration, then saves only its public client ID:

   ```bash
   contextfill-service --setup outlook
   ```

   From a source checkout, use `npm run service -- --setup outlook`. Gmail has an equivalent secret-safe downloaded-JSON flow described below.

3. Validate the local configuration. The doctor prints exact callbacks and scopes, checks that the loopback ports agree and `.env` is owner-only, and never prints credential values:

   ```bash
   contextfill-service --doctor
   ```

   From a source checkout, use `npm run service -- --doctor` instead. A nonzero result means the consent flow is not ready; correct the reported setting before continuing.

4. Start the companion service:

   ```bash
   contextfill-service
   ```

   From a source checkout, use `npm run service` instead.

5. Copy the six-digit pairing code printed in the terminal. Open ContextFill, click the message-source button, enter the code, and click **Pair service**. The code is single-use and expires after 10 minutes.
6. Connect Gmail or Outlook and finish the provider consent flow in the new tab.
7. Reopen ContextFill on the real page that initiated or requests the temporary action and select the connected mailbox as the source. A service restart restores the refresh authorization from the OS keychain.

Leave **GPT-5.6 for real mail** disabled if message bodies must remain on the device. Enabling it allows one prefiltered message at a time to pass from the loopback service to the configured OpenAI API with `store: false`; deterministic code still makes every allow/warn/block decision.

### Pairing and keychain recovery

The terminal code bootstraps one extension installation. The raw 256-bit capability stays in trusted extension storage; only its SHA-256 hash is stored by the service. Five failed guesses rate-limit pairing until restart.

If the browser capability is lost or you intentionally want to pair another installation, set `CONTEXTFILL_PAIRING_RESET=1`, start the service once, pair with the newly printed code, then return the setting to `0`. `CONTEXTFILL_EXTENSION_ID` remains only as a compatibility option for the first connector beta and should normally be left empty.

Keychain failure does not break the connector, but both pairing and provider authorization become session-only and must be repeated after the service stops. The source screen makes that downgrade visible.

## Gmail

1. Create or choose a Google Cloud project and enable the Gmail API.
2. Configure the OAuth consent screen. During development, keep the app in testing mode and add your own Google account as a test user.
3. Add the restricted `https://www.googleapis.com/auth/gmail.readonly` scope.
4. Create an OAuth client for a web application with this exact authorized redirect URI:

   ```text
   http://localhost:4318/mail/oauth/gmail/callback
   ```

5. Download the OAuth web-client JSON. Import it directly so the secret is not copied into terminal history or printed:

   ```bash
   contextfill-service --setup gmail --credentials /path/to/client_secret.json
   ```

   From a source checkout, use `npm run service -- --setup gmail --credentials /path/to/client_secret.json`. The command rejects desktop clients, malformed/oversized files, and clients without the exact runtime callback; it updates only the Gmail keys in owner-only `.env` and never prints either credential. Delete the downloaded JSON after a successful import.

Google classifies `gmail.readonly` as a restricted scope. Personal testing can use an OAuth test user, but a generally distributed application must complete Google's OAuth verification requirements. If restricted Gmail data is stored or transmitted through a remote server, Google also requires a security assessment. ContextFill's current connector keeps tokens and message processing on the user's loopback service, but public distribution still needs a formal Google review.

Official references: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [messages.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list), [messages.get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get), and [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## Outlook and Microsoft 365

Creating an app registration and signing into the finished application are different account checks. Registration requires a work/school identity in an Entra tenant with permission to register apps (at least the Application Developer role), or a personal Microsoft account backed by an Azure account and its own tenant. A standalone Outlook.com/Hotmail personal account is placed in the restricted `Microsoft Services` tenant and cannot create registrations; it can still use a finished app whose supported account type includes personal Microsoft accounts. If the admin center reports `AADSTS50020` in the `Microsoft Services` tenant, create an Azure account/tenant, ask a tenant administrator to register ContextFill, or configure Gmail instead.

Official prerequisite and error guidance: [register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) and [AADSTS50020 troubleshooting](https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/error-code-aadsts50020-user-account-identity-provider-does-not-exist).

1. Create an app registration in Microsoft Entra while signed into the tenant that will own it.
2. Choose the supported account type appropriate for your use. `common` supports personal Microsoft accounts plus work and school accounts when the registration allows them.
3. Add a Mobile and desktop application platform with this loopback redirect URI:

   ```text
   http://localhost:4318/mail/oauth/outlook/callback
   ```

4. Add delegated `Mail.Read` and `User.Read` permissions. Do not add application permissions or `Mail.ReadWrite`.
5. Enable public-client flows for the application. The recommended guided command saves the public client ID and defaults the tenant to `common`:

   ```bash
   contextfill-service --setup outlook
   ```

   Use `--tenant <tenant-id-or-domain>` to restrict sign-in. The equivalent manual settings are:

   ```dotenv
   CONTEXTFILL_MICROSOFT_CLIENT_ID=
   CONTEXTFILL_MICROSOFT_TENANT=common
   ```

Microsoft documents delegated `Mail.Read` as available to personal and organizational accounts without admin consent by default, although an organization's own consent policies can still require administrator approval. The connector uses PKCE and requests `offline_access` so it can refresh tokens during the current companion-service session.

Official references: [authorization code flow with PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [redirect URI rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url), [Mail.Read permission](https://learn.microsoft.com/en-us/graph/permissions-reference#mailread), and [list messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0).

## Failure behavior

- If the service is stopped, the extension explains that the mailbox source is unavailable; it does not silently switch to another real account.
- If access expires or is revoked, the service requires a new provider connection. Disconnect deletes the keychain credential and reports an error instead of claiming success if durable deletion fails.
- If the extension loses its pairing capability, restart once with `CONTEXTFILL_PAIRING_RESET=1` and pair again.
- If provider output or an imported message is malformed, message normalization rejects it before extraction.
- The synthetic demo inbox remains available as an explicit source for development and regression testing.
