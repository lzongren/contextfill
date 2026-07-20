# Judge testing — five-minute path

ContextFill is designed to be evaluated without personal email, OAuth, cloud setup, payment, or an OpenAI API key.

## 1. Install and build

Requirements: Node.js 20+, npm, Chrome 114+.

```bash
npm install
npm run build
```

## 2. Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select the repository's `dist/extension` directory.
5. Pin ContextFill if you want one-click access during the demo.

The extension requests temporary `activeTab` access, `scripting`, and access only to the optional loopback service at `127.0.0.1:4318`. It does not request permanent access to all websites.

## 3. Start the judge lab

```bash
npm run demo
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The lab visibly distinguishes its real localhost origin from each **SIMULATED ACTIVE DOMAIN**. Simulated hostnames are deterministic test fixtures, not deployed domains.

## 4. Required path A — legitimate fill

1. Select **Allow · single**, or open [the single-field fixture](http://127.0.0.1:4173/?scenario=legitimate-single).
2. Confirm the visible simulated domain is `account.northstar.test`.
3. Click the ContextFill extension.
4. Expected confirmation card:
   - Decision: **Allowed**.
   - Masked code ending in `03`.
   - Sender: Northstar Access.
   - Claimed service: Northstar.
   - Requesting website: `account.northstar.test`.
   - Explanation: page and message share `northstar.test`; candidate is recent and unused.
   - Extraction line: deterministic fallback when no local model service is running.
5. Click **Fill code**.
6. Expected page result:
   - Input contains `481203`.
   - Status still says **The form has not been submitted.**
   - Reopening ContextFill immediately blocks the same candidate as already used.

## 5. Required path B — lookalike block

1. Select **Block · lookalike**, or open [the lookalike fixture](http://127.0.0.1:4173/?scenario=lookalike).
2. Confirm the visible simulated domain is `account.n0rthstar.test` with a zero.
3. Click ContextFill.
4. Expected confirmation card:
   - Decision: **Blocked**.
   - Explanation: the requesting site resembles the message domain but has a different registrable domain.
   - At least one lookalike signal exists internally.
   - The code cannot be revealed.
   - No Fill or override action is available.
5. Close or dismiss the popup. The page field must remain empty.

## 6. Split fields

Open [the split-field fixture](http://127.0.0.1:4173/?scenario=legitimate-split), open ContextFill, and click **Fill 6 fields**. The fields must read `4 8 1 2 0 3` in order. The checkbox remains unchanged and the form remains unsubmitted.

## 7. Other deterministic gates

| Fixture             | Expected result                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Block · service** | BlueRail candidate is shown as blocked on a Northstar page; no mutation                       |
| **Block · expired** | Expiry is reported; candidate value is cleared; no Fill action                                |
| **Warn · sender**   | Referenced site matches but sender domain conflicts; acknowledgement required before override |
| **Empty**           | Unrelated receipt numbers are ignored; clear empty state                                      |

## Optional GPT-5.6 path

The API key stays in the local process:

```bash
cp .env.example .env
# Add OPENAI_API_KEY to .env
npm run service
```

Keep `npm run demo` running in another terminal. Reopen the legitimate fixture and ContextFill. A successful validated model candidate shows **GPT-5.6 extracted message facts · deterministic policy decided**. Stop the service or remove the key and the same scenario continues through deterministic extraction.

The release was verified without a key. A live GPT-5.6 call therefore depends on the judge's API access; it is optional and not needed to prove the product.

## Run the automated checks

```bash
npm run verify
```

This checks formatting, lint, types, 26 unit/integration cases, three production builds, packaged-extension loading, and five installed-Chrome acceptance cases.

## Troubleshooting

- **Popup says it cannot inspect the tab:** Use the extension on the `http://127.0.0.1:4173` page, not `chrome://extensions` or another restricted browser page.
- **Changes do not appear:** Run `npm run build:extension`, then click the reload icon on the ContextFill card at `chrome://extensions`.
- **Port 4173 is busy:** Stop the process using it; the deterministic fixtures intentionally use this fixed judge URL.
- **Optional service does not connect:** Confirm `curl http://127.0.0.1:4318/health` reports `configured: true`. The extension works without it.
- **A legitimate code is marked used:** Reloading the page is not intended to reset replay state. Reload the extension at `chrome://extensions` or wait 15 minutes for a fresh session.
- **Chrome blocks unpacked extensions:** Use a normal desktop Chrome profile with Developer mode enabled. Managed-device policy may prohibit manual loading.
