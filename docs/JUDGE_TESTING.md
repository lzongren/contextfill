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

The extension requests temporary `activeTab` access, `scripting`, fixed access to the loopback companion and judge lab, and optional site origins that are granted one exact origin at a time only when the user approves. Assisted and Auto-Continue run persistently only on origins listed in settings; every other site remains Manual.

## 3. Start the judge lab

```bash
npm run demo
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The lab visibly distinguishes its real localhost origin from each **SIMULATED ACTIVE DOMAIN**. Simulated hostnames are deterministic test fixtures, not deployed domains.

## 4. Recommended wow path — Verified Auto-Continue

1. Open the [single-field OTP fixture](http://127.0.0.1:4173/?scenario=legitimate-single), then open ContextFill once.
2. Select **Automation → Auto-Continue**, check the acknowledgement, and approve the exact `http://127.0.0.1:4173/*` origin if Chrome asks.
3. Return to the page. Without reopening the popup, the in-page card progresses through message found, deterministic verification, and a visible three-second countdown.
4. Confirm the code remains masked, **Cancel auto action** is visible and keyboard reachable, the correct field highlights and receives `481203`, and the fixture's submit count remains zero.
5. Open the [magic-link fixture](http://127.0.0.1:4173/?scenario=magic-link). The card displays only the verified destination hostname and counts down; the exact inspected synthetic link opens in that same tab.
6. Open the [lookalike fixture](http://127.0.0.1:4173/?scenario=magic-link-lookalike). It must show **Auto-Continue stopped** and never navigate.
7. Open ContextFill settings through **Automation → Manage trusted sites and activity**. Confirm the exact origin and privacy-safe outcomes are visible, no code/link token appears, then click **Revoke**. Reload an OTP fixture and confirm no overlay or fill occurs.

To demonstrate user control, repeat step 3 and press **Cancel auto action** during the countdown. The card must confirm cancellation and leave the field/tab unchanged. **Assisted** follows the same automatic detection/trust path but waits indefinitely for the in-page Fill/Open button.

## 5. Manual path A — verified magic-link handoff

1. Select **Allow · magic link**, or open [the magic-link fixture](http://127.0.0.1:4173/?scenario=magic-link).
2. Confirm the visible simulated domain is `login.cedarnotes.test`.
3. Click the ContextFill extension.
4. Expected confirmation card:
   - Decision: **Allowed**.
   - Candidate link: `https://login.cedarnotes.test/magic/••••`.
   - No `sample-token` value appears anywhere in the popup.
   - Sender: Cedar Notes at the aligned `cedarnotes.test` registrable domain.
   - Requesting website and link destination: `login.cedarnotes.test`.
   - Explanation: page, sender, and destination align; message is recent and unused.
   - Button: **Open verified link in this tab**.
5. Before clicking, confirm the page has not navigated. ContextFill has parsed only message text and has not prefetched or consumed the link.
6. Click **Open verified link in this tab**.
7. Expected result:
   - The same browser tab reaches **Verified handoff completed**.
   - The fixture explicitly says the non-resolving `.test` link was mapped locally; localhost is not presented as the real destination.
   - Reopening the source fixture and ContextFill immediately blocks the same link as already used.

## 6. Manual path B — magic-link lookalike block

1. Select **Block · link lookalike**, or open [the magic-link lookalike fixture](http://127.0.0.1:4173/?scenario=magic-link-lookalike).
2. Confirm the visible simulated initiating domain is `login.cedarn0tes.test` with a zero, while the message link points to `login.cedarnotes.test`.
3. Click ContextFill.
4. Expected confirmation card:
   - Decision: **Blocked**.
   - Explanation: the initiating site resembles the link destination but has a different registrable domain.
   - The token remains masked.
   - No Open or override action is available.
5. Close or dismiss the popup. The page must not navigate.

## 7. Manual path C — trusted reference transfer

1. Select **Allow · reference**, or open [the reference fixture](http://127.0.0.1:4173/?scenario=reference).
2. Open ContextFill and confirm the message, sender, service, domain, and explicitly labeled booking-reference field align.
3. Click **Fill reference**.
4. The booking-reference field receives `CT-7K92Q`; the unrelated checkbox is unchanged and the form remains unsubmitted.
5. The **Block · reference site** fixture uses `cedar-travel.test` and must expose no fill action.

## 8. Proven Manual OTP path

Open [the single-field fixture](http://127.0.0.1:4173/?scenario=legitimate-single), open ContextFill, and click **Fill code**. The input receives `481203`, the form remains unsubmitted, and immediate replay blocks.

### Split fields

Open [the split-field fixture](http://127.0.0.1:4173/?scenario=legitimate-split), open ContextFill, and click **Fill 6 fields**. The fields must read `4 8 1 2 0 3` in order. The checkbox remains unchanged and the form remains unsubmitted.

## 9. Other deterministic gates

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

Keep `npm run demo` running in another terminal. Reopen an allowed fixture and ContextFill. A successful validated model candidate shows **GPT-5.6 extracted message facts · deterministic policy decided**. Stop the service or remove the key and the same scenario continues through deterministic extraction. GPT-5.6 extracts facts only; it cannot approve navigation or filling.

The release was verified without a key. A live GPT-5.6 call therefore depends on the judge's API access; it is optional and not needed to prove the product.

## Run the automated checks

```bash
npm run verify
```

This checks formatting, lint, types, all unit/integration cases, three production builds, packaged-extension Manual/Assisted/Auto behavior, dynamic SPA detection, cancellation/revocation, and browser fixture acceptance cases.

## Troubleshooting

- **Popup says it cannot inspect the tab:** Use the extension on the `http://127.0.0.1:4173` page, not `chrome://extensions` or another restricted browser page.
- **A real website asks for access:** ContextFill requests only that exact origin. Approve only if it is the page currently requesting the action, then scan again.
- **Auto-Continue does not start on an existing site:** Reopen **Automation** and confirm the exact origin is listed as Assisted or Auto-Continue. Chrome permission removal automatically disables the rule.
- **Changes do not appear:** Run `npm run build:extension`, then click the reload icon on the ContextFill card at `chrome://extensions`.
- **Port 4173 is busy:** Stop the process using it; the deterministic fixtures intentionally use this fixed judge URL.
- **Optional service does not connect:** Confirm `curl http://127.0.0.1:4318/health` reports `configured: true`. The extension works without it.
- **A legitimate candidate is marked used:** Reloading the page is not intended to reset replay state. Reload the extension at `chrome://extensions` or wait 15 minutes for a fresh session.
- **Chrome blocks unpacked extensions:** Use a normal desktop Chrome profile with Developer mode enabled. Managed-device policy may prohibit manual loading.
