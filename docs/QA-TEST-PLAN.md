# QA Test Plan: Forge auto-sync branch

**Status: plan only. Nothing has been run. No code was changed.**

- **Branch:** `auto-sync` at `cef074f` (`main` at `a237d1b` plus one WIP commit).
- **Sources read:** HANDOFF.md, PENDING-TASKS.md, docs/RELEASE-AND-RECOVERY.md, src/utils/autoSave.ts, liveRefresh.ts, viewerMode.ts, cloudSync.ts, and the test file names in src/utils/.
- **Automatable column:** judged from module names. The test files were not opened, so confirm before relying on a "Y".
- **No test file exists** for cloudSync.ts, the UI, or the layout. Sync and layout rows need a live run, an emulator run, or a browser run.
- **KNOWN OPEN** means HANDOFF.md lists it as unfinished. Expect FAIL until it is fixed.
- **WIRING** means the auto-save controller, hook, SyncBadge, Firestore listener or Viewer toggle is not built yet (HANDOFF.md). Those rows are blocked until it is.
- **Synthetic data only.** Use a person called "QA Tester", dates in 2026, and made-up numbers. Never enter real weights, health data, real emails or real passwords.
- **Setup:** Chrome, a fresh profile per scenario, a local dev build on localhost, and no sign-in unless the row says so. Store evidence per ID (screenshots, localStorage dump, network log).
- **Live column:** "N" means no live account is needed. "Y (A#)" points to the approval codes in the last section.

## 1. Fresh profile, legacy data, dates

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| F-01 | Fresh profile shows no invented data | New profile, open localhost, do not sign in. Open Home, Progress, Day 1, Settings. | No weight, measurement, sleep, hunger or soreness values. Empty fields read "Not logged". No day records in storage. | Screenshots; localStorage key list | Y (logic); N (UI) | N |
| F-02 | First weigh-in with empty chart | Fresh profile. Progress, tap Log Weight, enter 80.0 kg for today, save, reload. | Log Weight is visible before any entry (KNOWN OPEN: first-weigh-in blocker). After save: one point, no line, no fake start weight. | Screenshots before and after | N | N |
| F-03 | First workout | Fresh profile. Day 1 workout, log one exercise, 10 reps at 20 kg, finish, reopen, reload. | Only the logged set appears. Nothing prefilled. Set survives reload. | Screenshot; storage dump | N | N |
| F-04 | Legacy sleep 7.5, no entered flags | Seed a day record with sleepHours 7.5 and no entered flags. Open the Day screen and the averages. Make no edits. | Stored record is byte-identical after load. 7.5 is not shown as a confirmed log (owner decides the label; default "Not logged"). | SHA-256 of the record before and after; screenshot | Y (sleep, entered tests) | N |
| F-05 | Coach averages hidden | Seed 7 days with unentered sleep. Open the coach view from a local fixture. | No 7-day average numbers. A logged zero and a skipped day look different. | Screenshot | Y (coachSummary) | N |
| F-06 | Incoherent dates reported, not rewritten | Seed day 5 and day 40 both dated 2026-03-02, and a weigh-in dated 2026-02-30. Load the app and open the validation report. | Issues listed (date, day, reason). No record changed, deleted or re-dated. No crash. Hash unchanged. (WIRING: confirm a report exists.) | Report screenshot; hash | Y (restoreGuard, backup) | N |

## 2. Reload, offline, storage, corruption, saving

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| B-01 | Reload before sync | Signed in with test identity. Edit a day, reload within 1 s (before the 3 s debounce). | Marker `forge_autosave_pending_v1` restored. Status shows pending, never "Synced", until a verified save. Save then runs once. | Storage marker; status screenshot; server read-back | Y (restorePending) | Y (A1, A2). WIRING |
| B-02 | No save on open or sign-in | Signed in. Close and reopen the app. Sign out and back in. | Zero Firestore write requests. | Network log filtered to firestore | Y (no save on create) | Y (A1, A2). WIRING |
| B-03 | Offline recovery | Signed in. DevTools offline, edit a day, wait 5 s. Go online. | Status "Offline" while offline. On reconnect: one save, then "Synced" only after read-back is verified. One write batch. | Network log; status screenshots | Y (setOnline) | Y (A1, A2). WIRING |
| B-04 | Storage quota failure | Fill localStorage to the limit with filler data. Make an edit. | Banner names the storage problem. The edit stays on screen as unsaved. "Download backup" gives valid JSON. Nothing lost silently. | Banner screenshot; downloaded JSON | Partly | N |
| B-05 | Corrupt stored JSON | Seed the main key with truncated `{"settings":`, then with a wrong shape (dailyLogs as an array). Reload. | App loads with no blank screen (KNOWN OPEN: ErrorBoundary, wrong-shape crash). Bad text kept in a quarantine key; original not deleted; banner offers recovery. | Storage keys before and after; screenshot | Partly (storage) | N |

## 3. Conflicts and deletions (two devices)

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| C-01 | Concurrent edits, two devices | Device A and device B (see last section) edit the same day. Save A, then save B. Then make one new edit on B. | B shows the conflict count, item labels, and "Nothing was overwritten". Cloud keeps A's values. The new edit must NOT clear the conflict badge (autoSave.ts `notifyChange` resets the count; flag it if it does). | Screenshots; server read-back | Y (cloudMerge, syncBase planning) | Y (A1, A7) |
| C-02 | Resolve: use this device | From C-01, choose "Use this device". | Only the conflicting documents are overwritten. Others unchanged. Read-back verified, then "Synced". | Cloud docs before and after | Y (planSave `only`) | Y (A1, A7) |
| C-03 | Resolve: use cloud | From C-01, choose "Use cloud". | Local item replaced by the cloud copy. Nothing written to cloud. Base updated after apply. | Local dump; cloud unchanged | Y (planUseCloud) | Y (A1, A7) |
| C-04 | Deletions not resurrected | Device A deletes the weigh-in dated 2026-10-10 and syncs. Device B (holding an old copy) syncs or pulls. | Weigh-in stays deleted on both devices. No reappearance after a pull. | Both screens; cloud doc | Y (cloudMerge) | Y (A1, A7) |

## 4. Viewer mode and live refresh

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| V-01 | Viewer default for coach browser | Fresh profile, open localhost/?viewer=1. | Viewer on: edit controls hidden or disabled. Banner shows the VIEWER_MODE_NOTICE text. (WIRING: viewerMode.ts does not read ?viewer=1; confirm where it is read.) | Screenshots | Y (viewerMode); UI N | N local; Y coach side (A1, A6) |
| V-02 | Zero writes in viewer | Viewer on. Try every edit path: log weight, log day, workout, settings, restore, Save to cloud. | Zero Firestore write requests. No data key changes in localStorage. Status "disabled". | Network log; storage hash before and after | Partly (guardEdit) | Y (A1, A6) |
| V-03 | Live refresh still works in viewer | Viewer on coach browser. Owner device edits and syncs. Wait 10 s. | Coach view updates within about 5 s, no reload. Several remote changes give one pull. Zero writes. | Timed screenshots; network log | Y (liveRefresh) | Y (A1, A6, A7) |
| V-04 | Refresh waits while busy | Owner has an unsaved edit. Trigger a remote change. | Pull not applied while local work is pending. Applied after the save finishes. | Status log | Y (busy path) | Y (A1) |

## 5. Phase pills

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| P-01 | Preview does not change the plan | Open phase pills, select another phase, close without confirming. | Plan, day list and storage unchanged. No write. | Before and after screenshots; hash | Partly (settingsLogic) | N |
| P-02 | Explicit confirm changes the plan | Same as P-01, then tap Confirm. | Plan changes. One activePhase write. Undo reverts it (KNOWN OPEN: undo-too-much). | Screenshots; storage diff | Partly | N (Y (A1) if sync checked) |

## 6. Sign-in and sign-out

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| S-01 | Login exit | Signed out. Open sign-in, close with X. Repeat with Back and browser back. | Returns to signed-out local mode. Local data intact. No forced sign-in. Any draft kept. | Screenshots | N | N |
| S-02 | Unified sign-in entry points | Start sign-in from Settings, Save to cloud, Load from cloud, and Coach access. | Same flow and wording each time. No duplicate popups. | Screenshots | N | Y (A1) |
| S-03 | Popup blocked or unreliable | Block popups. Start Google sign-in. | Visible error with a next step. Redirect fallback is still to do (PENDING-TASKS); expect FAIL until built. | Error screenshot | N | Y (A1) |
| S-04 | Email/password and reset | After A4, sign up with a test address, sign out, sign in, reset password. Try a wrong password. | Sign-in works. Reset email reaches the test address only. Wrong password gives a clear message. | Screenshots; email | N | Y (A4, A8) |

## 7. Two-browser cross-device refresh

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| X-01 | Two-browser refresh | Browser 1 (owner test identity) edits and saves. Browser 2 (same identity) gets focus or reconnects. | Change appears in Browser 2 within 5 s, no reload. Never a stale "Synced". | Timed screenshots | N | Y (A1, A7) |

## 8. Layout and touch

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| L-01 | 320 px width | Resize to 320x640. Visit Home, Day, Progress, Settings and every modal. Focus an input. | No horizontal scroll. 16 px side gutter. Tab bar does not cover the focused input. Tap targets at least 36 px (measure with getBoundingClientRect). KNOWN OPEN. | Screenshots; measurement output | Partly | N |
| L-02 | 375 px width | Same steps at 375x812. | Same checks pass. | Screenshots; measurement output | Partly | N |
| L-03 | Long name | At 320 px, enter a 60-character synthetic name in the profile. | Wraps or truncates with no overlap (KNOWN OPEN). | Screenshot | N | N |

## 9. Inputs and dates

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| D-01 | Input validation | Enter weights "71,5", "7.5e1", "-5", "abc". | Each is accepted as one consistent value or rejected with a message. Never NaN or a negative stored. KNOWN OPEN. | Storage dump; screenshot | Partly | N |
| D-02 | Indian dates near midnight | Run node tests with TZ=Asia/Kolkata for entries at 23:55 and 00:05 IST. In the browser, use a DevTools timezone override. | Each entry lands on the IST calendar day. No off-by-one. KNOWN OPEN. | Node output; screenshot | Y (node TZ env) | N |
| D-03 | DST-safe day dates | Run node tests with TZ=America/New_York and TZ=Europe/London across 2026-03-08 and 2026-11-01 (US), and 2026-03-29 and 2026-10-25 (UK). | Day number and date stable across each change. No duplicate or skipped day. KNOWN OPEN. | Node output | Y | N |
| D-04 | Same-date weigh-in | Log two weigh-ins on the same date. | One replaces the other, or the second is blocked with a message (KNOWN OPEN). Never a silent duplicate. | Storage dump | Partly | N |

## 10. Restore, backup, CSV

| ID | Scenario | Exact steps | Expected result | Evidence | Auto | Live (approval) |
|---|---|---|---|---|---|---|
| R-01 | Valid restore round trip | Export a backup (synthetic). Clear data. Restore it. | Data identical (hash). Message gives counts. Written, then read back. | Hashes; screenshot | Y (backup, restoreGuard) | N |
| R-02 | Invalid file | Edit a backup: date 2026-02-30, day 64, 41 levels of nesting, 3001 weigh-ins. Restore. | Whole file rejected. First 20 problems listed. Existing data unchanged. | Screenshot; hash | Y | N |
| R-03 | Numeric text | Three files: weight "9000"; weight "abc"; weight "1e3". Restore each. | "9000" converted, message says 1 value converted. "abc" and "1e3" reject the file. | Messages | Y | N |
| R-04 | Restore storage failure | Fill storage to the limit. Restore a valid file. | Error shown. Previous data and screen unchanged. | Screenshot; hash | Partly | N |
| R-05 | BOM-prefixed backup | Prepend EF BB BF to a valid backup. Restore. | Accepted, or a clear message (KNOWN OPEN). | Message | Y | N |
| R-06 | Close Settings mid-read | Start restoring a large file. Close Settings before it finishes. | Restore cancelled. No change. | Hash | Partly | N |
| R-07 | CSV downloads | Export daily logs, workout sets, weigh-ins and measurements from synthetic data. Open the files in a spreadsheet app. | Four files with correct names. First bytes EF BB BF. Dates ISO. Empty fields blank, not 0. Non-ASCII text intact. | Hex of first bytes; screenshots | Y (exportCsv) for content; N for dialog | N (dialog check: last section) |

## Needs owner approval before running

No live step runs until the owner answers A1 to A3. Each approval is per step.

| Code | Step | Exact approval to request |
|---|---|---|
| A1 | Test identities | Owner creates two throwaway Google accounts (owner-test and coach-test) and gives only their email addresses. Ask: "Use these two test accounts for sync tests on [target]." Passwords are never shared with the assistant. |
| A2 | Target | Choose one: (a) Firebase emulator, already used by `npm run test:rules` (recommended); (b) a separate test Firebase project; (c) live project constant-fuze-dw1xt, which needs an explicit yes for writes to the live database. |
| A3 | Cleanup | After each live run, delete the test user documents (users/{uid}, dailyLogs, workoutLogs, coachAccess, coachSummary) and the test Auth accounts. Owner approves the exact list first, because deletion is permanent. |
| A4 | Email/Password | Owner enables Email/Password in the Firebase console. This is an owner-only account setting. Check the bill is Rs 0 first, since the console may block it on the free tier. |
| A5 | Branch and deploy | Each separately: push `auto-sync`; merge to `main`; publish Firestore rules; AI Studio pull and Republish; Versions > Restore; any Cloud Run traffic change. Do not click Unpublish. Check Billing shows Rs 0. |
| A6 | Coach grant | Owner approves entering the test coach UID in the test athlete's Settings. This writes coachAccess and coachSummary. |
| A7 | Instinct's browser | Owner decides whether and when Instinct's browser is used. Instinct signs in himself. The assistant does not type credentials. |
| A8 | Reset email | Owner approves one password-reset email to the test address. This sends a real email. |

## Cannot be tested without Instinct's browser

- Real Google sign-in round trip in a second real browser profile (S-02, S-03 live parts).
- Two real devices: concurrent edits and conflict buttons (C-01 to C-04 live), and cross-device refresh (X-01, V-03 live).
- Coach view with a real second account (V-01 to V-03 live parts).
- Verification and reset email delivery in a real inbox (S-04).
- The real CSV download dialog in the owner's normal browser (R-07 final check).
- Touch checks on real phone hardware (L-01, L-02), if that device is available.
- AI Studio branch, publish and rollback (A5). These are owner-console steps and are not browser-tested here.
