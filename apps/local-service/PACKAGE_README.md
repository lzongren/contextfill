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

For Outlook, run the guided setup after creating a Microsoft Entra app registration. It prints the exact callback and delegated permissions, asks only for the public Application (client) ID, preserves unrelated settings, and keeps `.env` owner-only:

```bash
contextfill-service --setup outlook
```

Gmail's OAuth web client includes a secret, so configure its values directly in the private `.env` file. Provider registration is documented at <https://github.com/lzongren/contextfill/blob/main/docs/MAILBOX_INTEGRATION.md>. Before starting OAuth, validate the exact callbacks, scopes, loopback port, and private file permissions without exposing credential values:

```bash
contextfill-service --doctor
```

Start the service:

```bash
contextfill-service
```

Enter its six-digit terminal code in the extension's **Message source** screen. Refresh tokens and the hashed pairing record use the native OS credential manager. If that backend is unavailable, the extension reports session-only storage.

The service never fills or submits a form. The extension continues to require an explicit **Fill code** action.
