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
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `dist/extension`.
4. Pin ContextFill if you want one-click popup access.

The extension uses temporary `activeTab` and `scripting`, fixed access to the loopback companion and judge lab, and optional website origins granted one exact origin at a time. Assisted and Auto-Continue run only on origins explicitly listed in settings; every other site remains Manual.

## 3. Start the judge lab

```bash
npm run demo
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The lab visibly distinguishes its real localhost origin from each **SIMULATED ACTIVE DOMAIN**. Simulated hostnames are deterministic fixtures, not deployed domains.

## 4. Recommended wow path A — Verified Context Capsule

1. Open [the airline check-in fixture](http://127.0.0.1:4173/?scenario=capsule). The synthetic Capsule appears in page without opening the popup.
2. Confirm the real loopback origin is visibly separate from simulated `checkin.aurelia-air.test`.
3. Read the four-stage trace: **Message → deterministic trust checks → masked capsule → destination fields**.
4. Before approval, confirm:
   - Booking reference, passenger surname, and their occurrences in the subject are masked.
   - Sender, service, referenced domain, page, freshness, intent, replay, and exact two-field mapping align.
   - Only **Booking reference** and **Passenger surname** appear in the plan.
   - Both fields remain empty and the form submit count is zero.
5. Click **Transfer 2 verified facts**. Exactly synthetic `AU-47K2` and `Rivera` appear; unrelated controls remain unchanged; the receipt says **Form not submitted**.
6. Click **Undo entire handoff**. Both fields return to their original values while replay remains blocked.
7. Press Escape on a fresh Capsule to confirm keyboard dismissal.

### Adversarial counterpart

Open [the capsule lookalike](http://127.0.0.1:4173/?scenario=capsule-lookalike). The simulated origin removes one airline-name hyphen (`checkin.aureliaair.test`) while the message evidence remains `aurelia-air.test`. The trust trace must break at domain verification, keep both fields empty, and expose no Transfer or override action.

### Capsule safety fixtures

| Fixture                                                                            | Expected result                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`capsule-decoy`](http://127.0.0.1:4173/?scenario=capsule-decoy)                   | Hidden/decoy controls are ignored; only the two visible safe fields are mapped |
| [`capsule-conflict`](http://127.0.0.1:4173/?scenario=capsule-conflict)             | Conflicting passenger details block before mapping                             |
| [`capsule-stale`](http://127.0.0.1:4173/?scenario=capsule-stale)                   | Stale message blocks                                                           |
| [`capsule-non-empty`](http://127.0.0.1:4173/?scenario=capsule-non-empty)           | Prefilled target blocks rather than overwriting                                |
| [`capsule-reduced-motion`](http://127.0.0.1:4173/?scenario=capsule-reduced-motion) | The same complete trust path works without motion                              |

The packaged Capsule entry also uses a closed activation allowlist: only the root path on the exact judge/test origins `127.0.0.1:4173` and `127.0.0.1:4179` plus known scenario/host/service tuples may mount it. Arbitrary loopback pages fail closed.

### Optional private Gmail → Alaska Airlines path

This is user-owned conformance evidence, not part of the public judge flow:

1. Connect Gmail through the loopback companion and select **Gmail** as the message source.
2. Open `https://www.alaskaair.com/booking/reservation-lookup` and grant that exact origin if Chrome asks.
3. Open ContextFill. It uses the Alaska-only historical query and must not show unrelated temporary-code mail.
4. Choose the masked Alaska confirmation, then **Review verified transfer**.
5. Confirm the trace maps exactly `Booking reference` to `Confirmation code or e-ticket #` and `Passenger surname` to `Passenger's last name`.
6. Choose **Transfer 2 verified facts**. Confirm both fields change, the receipt says **Form not submitted**, and the page's **Continue** button remains untouched.
7. Choose **Undo entire handoff**. Both fields return to their prior values while replay remains marked.

The path accepts only the exact official reservation route and one unambiguous traveler record from a verified Alaska reservation message. It does not claim that a completed itinerary remains retrievable after manual submission.

## 5. Recommended wow path B — Verified Auto-Continue

1. Open the [single-field OTP fixture](http://127.0.0.1:4173/?scenario=legitimate-single), then open ContextFill once.
2. Select **Automation → Auto-Continue**, check the page-behavior acknowledgement, and approve the exact `http://127.0.0.1:4173/*` origin if Chrome asks.
3. Return to the page. Without reopening the popup, the in-page card progresses through message found, deterministic verification, and a visible three-second countdown.
4. Confirm the code stays masked, **Cancel auto action** is keyboard reachable, the correct field receives `481203`, and the fixture submit count remains zero.
5. Repeat and press **Cancel auto action** during the countdown. The card confirms cancellation and leaves the field/tab unchanged. **Assisted** uses the same detection/trust path but waits for the in-page Fill/Open button.
6. Open the [magic-link fixture](http://127.0.0.1:4173/?scenario=magic-link). The card displays only the verified destination hostname, counts down, revalidates, and opens the exact inspected synthetic link in the same tab.
7. With a fresh unused candidate, open the [link lookalike](http://127.0.0.1:4173/?scenario=magic-link-lookalike). It must show **Auto-Continue stopped**, record the lookalike reason, and never navigate.
8. Open **Automation → Manage trusted sites and activity**. Confirm the exact origin and privacy-safe outcomes are visible, no code/link token appears, then click **Revoke**. Reload a fixture and confirm no overlay or fill occurs.

Auto mode never clicks Submit/Login or invokes form submission. Its acknowledgement is necessary because a destination page can independently react to the final OTP `input` event.

## 6. Manual regression paths

### Verified magic-link handoff

On [`magic-link`](http://127.0.0.1:4173/?scenario=magic-link), open ContextFill in Manual mode. The card must show Allowed, masked `https://login.cedarnotes.test/magic/••••`, aligned sender/page/destination evidence, and **Open verified link in this tab**. Before clicking, no navigation or prefetch occurs. The explicit action opens the local simulated completion in that same tab and marks replay used.

On [`magic-link-lookalike`](http://127.0.0.1:4173/?scenario=magic-link-lookalike), the initiating domain `login.cedarn0tes.test` must block with no Open or override action.

### Trusted reference transfer

On [`reference`](http://127.0.0.1:4173/?scenario=reference), approve **Fill reference**. Only the labeled field receives `CT-7K92Q`; the checkbox and submit count stay unchanged. [`reference-lookalike`](http://127.0.0.1:4173/?scenario=reference-lookalike) exposes no fill action.

### OTP fields

On [`legitimate-single`](http://127.0.0.1:4173/?scenario=legitimate-single), Manual **Fill code** places `481203` in the one matching field and never submits. On [`legitimate-split`](http://127.0.0.1:4173/?scenario=legitimate-split), **Fill 6 fields** produces `4 8 1 2 0 3` in order and leaves the unrelated checkbox unchanged.

### Other deterministic gates

| Fixture             | Expected result                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Block · service** | BlueRail candidate is blocked on a Northstar page; no mutation                            |
| **Block · expired** | Expiry is reported; candidate value is cleared; no action                                 |
| **Warn · sender**   | Sender conflict requires acknowledgement for eligible Manual value fill; automation stops |
| **Empty**           | Unrelated receipt numbers are ignored; clear empty state                                  |

## 7. Optional GPT-5.6 path

The API key stays in the local companion process:

```bash
cp .env.example .env
# Add OPENAI_API_KEY to .env
npm run service
```

Keep the judge lab running in another terminal. A validated model result is labeled **GPT-5.6 extracted message facts · deterministic policy decided**. Stop the service or remove the key and every required scenario continues through deterministic extraction. GPT-5.6 cannot choose a mode, authorize, select fields, navigate, fill, or submit.

## 8. Run the automated checks

```bash
npm run verify
```

This checks formatting, lint, types, all unit/integration cases, three production builds, packaged Capsule/Manual/Assisted/Auto behavior, dynamic SPA detection, cancellation/revocation, forged-loopback blocking, and installed-Chrome fixture acceptance.

## Troubleshooting

- **Popup cannot inspect the tab:** Use it on the `http://127.0.0.1:4173` page, not `chrome://extensions` or another restricted page.
- **A real site asks for access:** ContextFill requests only that exact origin. Approve only when it is the page requesting the action.
- **Auto-Continue does not start:** Confirm the exact origin is listed as Assisted or Auto-Continue and still has Chrome permission.
- **Changes do not appear:** Rebuild, then reload the ContextFill card at `chrome://extensions`.
- **Port 4173 is busy:** Stop the process using it; deterministic fixtures intentionally use this fixed judge URL.
- **Optional service does not connect:** Check `http://127.0.0.1:4318/health`. Required synthetic paths work without it.
- **Candidate is already used:** Reloading the page does not reset replay. Reload the extension or wait 15 minutes.
- **Chrome blocks unpacked extensions:** Use a normal desktop Chrome profile with Developer mode. Managed-device policy may prohibit loading.
