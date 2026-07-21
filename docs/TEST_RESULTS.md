# Test results

The current beta.8 head plus Verified Context Capsules is being preflighted in a disposable integration worktree. The newest beta.8 hardening explicitly excludes Gmail Spam/Trash and limits Outlook retrieval to Inbox. After applying that commit, formatting, lint, types, all 119 unit/integration tests, all three builds, and all eight non-companion packaged interactions pass. Final artifacts will be rebuilt after the post-merge rebase. No integration artifact was published.

## Combined preflight checkpoint

| Check                                     | Result                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Formatting, lint, types, unit/integration | 22 files / 119 tests passed after the latest mailbox hardening                         |
| Production bundles                        | Demo, MV3 extension, and companion built after the latest mailbox hardening            |
| Packaged browser interaction              | 8/8 Auto + Capsule + legacy link/reference scenarios passed after the latest hardening |
| Installed-Chrome acceptance               | 12/12 passed at the prior checkpoint; final post-merge rerun required                  |
| Package and companion clean install       | ZIP/TGZ and clean-install smoke passed at the prior checkpoint; final rebuild required |
| Integrity, secret scan, audit             | Valid/empty/0-vulnerability at the prior checkpoint; final rebuild required            |

The separate companion-backed packaged load/pairing test is deferred only while the real beta.8 acceptance companion owns fixed port 4318; it passed on the beta.8 branch and must be repeated after the live handoff.

## Combined coverage

- Capsule: strict schema/evidence grounding, masking, expiry/replay, same-form mapping, hidden/ambiguous/sensitive/nonempty rejection, atomic rollback, truthful no-submit receipt, Undo, forged-loopback block, and model facts unable to bypass deterministic authorization.
- Auto-Continue: exact-origin opt-in/revocation, Manual/Assisted/Auto modes, dynamic SPA detection, visible cancellable countdown, overlay-removal fail-closed, action-time revalidation, same-tab navigation, fresh lookalike block, privacy-safe history, explicit Gmail Spam/Trash exclusion, Outlook Inbox-only retrieval, and zero extension-initiated submissions.
- Regression: legacy OTP, verified link, trusted reference, mailbox connectors, MIME import, pairing, doctor/setup, and deterministic no-key fallback.

## Publication state

- PR #16 and PR #17 remain draft at this checkpoint.
- No integration release or tag was created.
- Final rebased artifact paths, sizes, hashes, and exact counts will replace this checkpoint after the post-merge gate.
