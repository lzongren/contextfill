# ContextFill companion service

This package is the local half of ContextFill's Gmail and Outlook integration. It binds only to `127.0.0.1`, owns provider OAuth and OS-keychain credentials, returns a bounded recent-message set, and requires one-time capability pairing with the Chrome extension.

## Install

Requires Node.js 20 or newer. Download this `.tgz` and the matching checksum from the same GitHub Release, verify it, then install:

```bash
npm install --global ./contextfill-companion-vVERSION.tgz
mkdir contextfill-runtime
cd contextfill-runtime
contextfill-service --init
```

For Outlook, run the guided setup before creating a Microsoft Entra app registration. It prints the account prerequisite, exact callback, and delegated permissions, then asks only for the public Application (client) ID, preserves unrelated settings, and keeps `.env` owner-only. Creating an app registration requires a work/school account with an Entra tenant role or a personal account backed by its own Azure tenant; a standalone Outlook.com account cannot create one.

```bash
contextfill-service --setup outlook
```

For Gmail, print the registration instructions, then import Google's downloaded OAuth web-client JSON. The import validates the exact callback and writes the ID and secret without echoing either value:

```bash
contextfill-service --setup gmail
contextfill-service --setup gmail --credentials /path/to/client_secret.json
```

Provider registration is documented at <https://github.com/lzongren/contextfill/blob/main/docs/MAILBOX_INTEGRATION.md>. Before starting OAuth, validate the exact callbacks, scopes, loopback port, and private file permissions without exposing credential values:

```bash
contextfill-service --doctor
```

Start the service:

```bash
contextfill-service
```

Enter its six-digit terminal code in the extension's **Message source** screen. Refresh tokens and the hashed pairing record use the native OS credential manager. If that backend is unavailable, the extension reports session-only storage.

The service never fills or submits a form. The extension continues to require an explicit **Fill code** action.
