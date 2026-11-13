# MERGED TO MAIN (2026-11-13): reminders and lab markers are now on `main` (fb08692). Still NOT published.

On the owner's instruction, `claude/forge-reminders` and `claude/forge-lab-markers` were merged into `main` (no conflicts, merge commits, no squash) after main had moved on with the homepage work. Gates on the merged result: tsc clean; unit 344/344 in UTC, Asia/Kolkata, America/New_York; build ok; no secrets. The live site is unchanged until AI Studio pulls `main` and the owner clicks Republish; compare the served bundle to a local build afterwards. Rollback anchor `rollback-to-live-c5fa900` is untouched. The review of the Antigravity log is recorded at the end of `CLAUDE_LOG.md`.

AI Studio note (2026-11-13): the owner confirmed GitHub `main` is the source of truth and AI Studio workspace changes may be overwritten. The AI Studio workspace was found to hold its own PWA code that was never in GitHub: `vite-plugin-pwa` (workbox precache, `registerSW`), `public/sw-notifications.js`, `src/utils/notifications.ts` with four fixed reminders and a Settings card. A pull from `main` replaces that setup with the hand-written one in this repo. `public/sw.js` now also deletes leftover caches on activation (tested), so a device that ran the workbox build cannot keep showing an old copy. After Republish, open the app twice to be sure the new build is showing. The section below was written before the merge, so "nothing merged" there is out of date.

# HANDOFF UPDATE (2026-11-12): two feature branches and a Vercel preview.

`main` and `auto-sync` are still `94d1b7a` (live at AI Studio). Both branches below start from `f7647e4` (the 2026-10-25 handoff commit). No merge, no AI Studio pull or republish, no rules change, no spend.

## Branch `claude/forge-lab-markers` (pushed, tip 060f6c2)
- New "Lab markers" card in the Progress tab: add a blood test report by hand (sample date, lab name, value, unit and the reference range copied from the report), then confirm it by recording a doctor's name. The start-versus-latest table uses confirmed reports only.
- Rules built in: Forge never picks tests, never interprets a value, no colours, flags or scores. Reports are in their own localStorage key `forge_lab_reports_v1` on the device, not part of AppState, not synced, no Firestore or rules change.
- Files: `src/utils/labMarkers.ts` (+ 8 tests), `src/components/LabMarkers.tsx`, one line in `src/views/ProgressView.tsx`.
- Checked: tsc clean; unit 288/288 in UTC, Asia/Kolkata, America/New_York; build ok; real-browser run with synthetic data (validation, no comparison before confirmation, delta shown after, persists after reload, no sideways scroll at 390 px).
- Not done: booking a test from Forge, reading values from a PDF report, a real doctor login (confirmation is the user typing a name), any backup (clearing the browser loses reports).

## Branch `claude/forge-reminders` (pushed, tip 0d12c9e)
- "Habits and reminders" card at the bottom of the Today tab: 6 built-in habits (reminders off by default) plus up to 20 custom ones, each with a time and days of the week. Tick each habit per day; streak and week count shown; a missed day never loses progress. Neutral reminder wording, no advice.
- Reminder runner (`HabitReminderRunner`, mounted once in `App.tsx`): checks every 30 s and when the app returns to the front. Fires a system notification if permission is granted and always shows an in-app banner with a Done button. One reminder per habit per day; none if already ticked.
- Installable app: `public/manifest.webmanifest`, icons, `public/sw.js` (shows notifications and focuses the app on tap; caches nothing), link and meta tags in `index.html`, service worker registered in `src/main.tsx` in production builds only, not in emulator mode.
- Data: `forge_habits_v1` and `forge_habits_notified_v1` in localStorage. Not in AppState, not synced, no Firestore or rules change.
- Files: `src/utils/habits.ts` (+ 12 tests), `src/utils/pushSupport.ts` (+ 3 tests), `src/hooks/useHabitStore.ts`, `src/components/HabitReminders.tsx`, `src/components/HabitReminderRunner.tsx`, small edits to `TodayView.tsx`, `App.tsx`, `main.tsx`, `index.html`, plus `docs/REMINDERS-PUSH-DESIGN.md`.
- Checked: tsc clean; unit 295/295 in the three timezones; build ok; production preview in a real browser with a fake clock (service worker registers, manifest and icons 200, reminder fires once at the right minute, not before, no duplicate, Done ticks the card, persists after reload, no sideways scroll at 390 px).
- NOT verified: a real notification on a real iPhone. The test replaced the notification call and checked that Forge asks for it at the right minute. Headless browsers cannot receive iOS push.
- Limit that cannot be fixed in the front end: a reminder cannot arrive when the app is fully closed. iOS has no scheduled local notifications for web apps. Closed-app push needs sign-in, reminder times in Firestore (a rules change and a privacy line), a scheduled sender (Firebase Blaze or Cloud Scheduler with billing on, which breaks the Rs0 rule) and a real-iPhone test. See `docs/REMINDERS-PUSH-DESIGN.md`. Nothing of that is built.

## Vercel preview (so the PWA can be tried on an iPhone)
- Deployed from `claude/forge-reminders` at 0d12c9e: team `heet-san-projects` (free Hobby), project `forge-reminders-preview` (`prj_v2p1kkiuGZ0L4tWRJGnXV8Gbeblg`), deployment `dpl_3z1rvz9Bn5JLMBwZ2WxasKAhtzuz`, state READY. Address: https://forge-reminders-preview.vercel.app (target "production" on that project; it is not the live Forge).
- It is a separate address, so it has its own browser storage: the owner's real Forge data does not appear there. Firebase sign-in does not work there (address not in Firebase's authorised domains); habits work without an account.
- OPEN: Vercel Authentication is ON for every `.vercel.app` address of this project (`ssoProtection` all_except_custom_domains). An iPhone Home Screen app cannot use a Safari Vercel login, so it would hit the login wall. The owner was asked whether to switch protection off ("public ok"); no answer yet, so it is still ON and the PWA cannot be installed from it yet. If turned off, the app code becomes readable by anyone with the address (same as the live site already is; no server data). Reversible.
- The owner approved the Vercel team access link; the connection was later dropped and had to reconnect. The Vercel project auto-deploys nothing further unless connected to GitHub; redeploy with `create_deployment` after new pushes.

## How to try it on the iPhone (after protection is off)
Safari: open the address, Share, Add to Home Screen, open Forge from the icon, Today tab, Habits and reminders, turn on a bell, Turn on notifications. iOS 16.4 or later is needed, and notifications only work from the installed icon.

## Next steps, in order
1. Owner: say "public ok" (or choose a Vercel share link instead) so the preview opens without a login; then test on the real iPhone and report back. A real delivery check is the main unproven item.
2. Owner: decide whether to merge either branch to `main`. Release path is unchanged: merge fast-forward, AI Studio GitHub pull, Republish, compare the served bundle to a local build (see the release record below). Habits and Lab markers share no files except small edits to different views, so they should merge cleanly together; re-run the full gates after merging both.
3. Decide closed-app push (needs spend approval) or stay with in-app reminders. Recommendation: stay in-app first and see if reminders are used.
4. Lab markers: PDF report upload and a real doctor sign-off are the next features; both need decisions on data handling first.

---

# RELEASE RECORD (2026-10-25 evening): LIVE at 94d1b7a

## Merge, publish, evidence
- `main` and `auto-sync` = `94d1b7a32c2905b4af15e3f95109671d5d028bd1` (fast-forward, no squash, no force). `release-candidate-2026-10-25` = `051b4b5` (NOT an ancestor of old main `a237d1b`; it is not the rollback anchor).
- AI Studio: GitHub connection had expired; re-signed in by the owner in the same Chrome profile; pulled `main` ("Successfully pulled"), then Republish. Panel: Last published Oct 25 2026, 8:19:07 PM IST (14:49 UTC). (The panel still showed an "unpublished changes" banner after publish; it appeared stale.)
- Served build tied to the commit by BUNDLE COMPARISON: live `assets/index-CwCK4sMA.js` equals a local `vite build` of 94d1b7a byte for byte after normalising the build label (sha256 prefix 168221997c9bb643); the CSS file is identical. Live Settings label: `no-git · 2026-10-25 14:49 UTC`. (AI Studio builds without git, so the label cannot name the commit by itself.)
- Gates before merge (clean tip): tsc clean; unit 280/280 in UTC, Asia/Kolkata, America/New_York; rules 83/83 (emulator); build ok; secret scan clean.

## Rollback (prepared, NOT exercised)
- The previous live build (08:04 IST, label `no-git · 2026-10-25 02:34 UTC`) was identified by bundle comparison as commit `c5fa900` (byte-identical bundle after label normalisation).
- Rollback branch `rollback-to-live-c5fa900` = `ac4c473d5fc1939a46dcb417da0ab05eae69c609`: parent 94d1b7a, tree identical to c5fa900. To roll back: fast-forward `main` to it (no force), AI Studio GitHub pull, Republish, then compare the served bundle to c5fa900's build. Rules were not changed by this release, so no rules rollback is needed.
- Verified bundle backup: `fitness-app-backups/pre-release-all-refs.bundle` (old main, auto-sync, RC, rollback branch). Also `auto-sync-94d1b7a.bundle`.

## LIVE tests (isolated built-in browser, one synthetic account forge-release-test-<id>@example.test; no existing user touched; no rules/billing changes)
All PASS (assertions from page text and request counts; screenshots exist only in tool results, text evidence in `fitness-app-backups/evidence-2026-10-25/live/live-verification.txt`):
- L0 fresh load: version label as above; no EMULATOR banner; header Login when signed out.
- L1 new account: Login replaced by the account; badge "No cloud data yet"; zero Firestore write requests on sign-in.
- L2 explicit Save: link confirm, "verified (3 records read back)".
- L3 cross-session restore (both orders: setup before and after sign-in): "Cloud data found", explicit Load restored data; sign-in alone zero writes.
- L4 real local entry: Load refused; Save gave link confirm and a conflict, no resolution pressed, cloud value unchanged.
- L5 header: Login returns after Sign out; no overflow at 320 px.
- L6 Viewer (?viewer=1): edits blocked, zero writes, no false "saved" toast.
- L7 SIMULATED failure (blocked Firestore requests + offline event, NOT a real network cut): honest "Offline (will retry)", no hang on Saving; recovered after reload.

## Cleanup (verified in the Firebase console)
Deleted `users/1D3TuRV5cHOM6gj7N78brRzZGeO2` with all nested data (the `users` collection is now empty) and deleted the Auth user forge-release-test-ca2dbe90@example.test. The only remaining Auth user is the owner's real Google account (not touched). Local test credentials and browser storage removed. Evidence file kept.

## Live gaps and observations
- NOT TESTED live: Google sign-in; real email delivery (signup requested a verification mail to a non-existent .test address, Firebase accepted it); a real network cut; real keyboard behaviour; a second physical device; coach consent on the deployed rules; the rules-validation publish (rules were NOT deployed).
- Observed, not fixed: the conflicting Save sent 2-3 Firestore write requests (the conflicting day was held back and verified unchanged; probably link metadata or non-conflicting items; worth a look if "zero writes on conflict" is required). In Viewer mode the Today screen did not show cloud data for ~65 s after sign-in until Load from cloud was pressed (the "live refresh" claim for a signed-in viewer on a fresh device is unproven live). The L3 start-date restore check was weak (same date both sides). Only sleep was exercised live (not water, weigh-in, notes). Badge showed "Pending" for 5-10 s after Save's success text.
- Note: this HANDOFF commit is on `auto-sync` only; `main` stays at the deployed commit 94d1b7a.

---

# HANDOFF: Forge auto-sync, sign-in guidance + header fix (2026-10-25 evening)

Branch `auto-sync`. NOT merged, NOT published, no AI Studio change, no rules published, no chat write path built. `main` = `a237d1b` (unchanged since the earlier misstep recorded in git history; AI Studio's workspace still holds `a237d1b`, the live site is an older build).

## Sign-in guidance and header fix (this commit, on top of 1f50f4c)
- Setup-only signed-in device: a READ-ONLY cloud probe (`probeCloudData`, `runCloudProbe` in `cloudRead.ts`) runs once per uid. Badge: "Cloud data found" (tells the user to Load) / "No cloud data yet" (Save to create) / "Could not check the cloud" + Retry (a failed or denied read is never "empty"). "Tap Save to cloud once" is now only for the genuine first-link case (real entries never linked). Settings shows a notice and makes Load the primary button when cloud data exists. Load is explicit only: no auto-load, no write on sign-in.
- Header: it showed Login after Firebase sign-in because it read the legacy local account. New `useFirebaseUser` + `headerIdentity`: signed in (Firebase or legacy) shows the profile button (cloud avatar for Firebase-only, opens Settings account area); logout returns to Login. Coach flow untouched.
- Tests: tsc clean; unit 280/280 in default, Asia/Kolkata, America/New_York; rules 83/83; vite build ok; secret scan clean; no change to src/lib, rules, firebase.json, package.json.
- Browser (isolated emulator, fake accounts): G1 returning user with cloud data PASS (zero writes after sign-in, explicit Load restored data and linked); G2 new account PASS (zero writes, explicit Save created it); G3 denied read PASS (error badge, no writes, rules restored); G4 real local entry PASS (Load refused, Save gave link confirm + conflict, nothing overwritten); H1 header PASS incl. logout and 320 px. Evidence: `fitness-app-backups/evidence-2026-10-25/guidance/`.
- Gaps: transient "Checking cloud..." not seen in browser (unit-tested); profile button aria-label is only "View user profile" (account shown elsewhere); Settings runs its own probe so two reads happen when it opens; Google sign-in, deployed rules, live Firebase, real email, real network cut, real keyboard, AI Studio publish/rollback remain unproven. Next: a separately approved release with live verification and rollback.

## New-device cloud-loading trap: FIXED (this commit)
- Cause: confirming the programme start before sign-in counted as local data, so "Load from cloud" was refused.
- Rule now (`hasMeaningfulLocalData`, `src/utils/cloudMerge.ts`): real entries count (weigh-ins, measurements, logs with content, any `entered` flag incl. explicit zeros, completed/rest/skipped/modified workouts). Not counted: programme start, phase, timezone, profile text, onboarding weight, untouched defaults.
- Setup-only device + cloud data: cloud programme settings win. Cloud genuinely absent: local setup kept, clear message. Failed/denied read: "Could not read the cloud (...). Nothing was changed." (never treated as empty). Real local entries still force the explicit conflict choice. Sign-in alone writes nothing; first link still needs the explicit confirm; auto-save never links.
- New: `src/utils/cloudRead.ts`, `src/utils/setupOnlyPull.test.ts` (19 tests). One old test in `cloudMerge.test.ts` asserted the bug and was changed. No change to `src/lib`, rules, firebase.json, package.json.
- Tests: tsc clean; unit 267/267 in default, Asia/Kolkata, America/New_York; rules 83/83; `vite build` ok; secret scan clean.
- Browser (isolated emulator, two sessions, fake accounts): N1 fresh device + setup + sign in + explicit load restored cloud settings and records, zero writes; N2 sign-in alone zero writes; R1 setup + real entry still refused and Save shows conflict (nothing overwritten); R2 explicit typed zero counts as real; E1 empty cloud keeps local setup, explicit save creates it; E2 denied read shows error, no write. Evidence: `fitness-app-backups/evidence-2026-10-25/new-device/`.
- Not changed, noted: badge text on a setup-only signed-in device says "Tap Save to cloud once to link this device" (steers to Save, which gives the link confirm and a conflict, instead of the clean Load); top bar may still show LOGIN after sign-in (not checked); Day-1 logs keyed to today, not the start date (pre-existing).
- Still unproven: deployed rules, live Firebase and listeners, real email, real network cut / Failed badge, real keyboard, AI Studio publish/rollback, Google sign-in.

## Earlier checkpoint (a6e69c5) adds
- **Off-by-default emulator target** (`src/lib/firebaseTarget.ts`, `src/lib/firebase.ts`): emulator only if `VITE_USE_EMULATOR` is exactly `true`, not a production build, and host is localhost; otherwise it THROWS (never falls back to production). Emulator mode uses a fake `demo-forge-test` project, a demo key and the `(default)` database; the real project/database ids are never used. After connecting it hard-stops unless Auth is 127.0.0.1:9099 and Firestore 127.0.0.1:8089. Red EMULATOR banner and `[EMULATOR]` tab title. Run: `npm run emulators` then `npm run dev:emulator`.
- Bug fixes from the emulator and screen audits (see below), design doc corrections (design only).

## Tests actually run on this tree
- `tsc --noEmit` clean. Unit: 245/245 (now 267, see above) (default TZ, Asia/Kolkata, America/New_York). Rules emulator: 83/83. `vite build` ok; a normal build contains the real project id and no emulator flag. Secret scan clean.
- **Isolation proof in a real browser** (both sessions, start/middle/end): EMULATOR_MODE true, project `demo-forge-test`, Auth 127.0.0.1:9099, Firestore 127.0.0.1:8089, no firestore.googleapis.com / firebaseapp.com traffic (only fonts and the gapi script load).
- **Two-browser emulator suite T1-T6: all PASS** (reload before sync; open/sign-in with zero writes; offline simulation + backend stall; concurrent edits with both resolution paths and conflict re-detected after reload; deletion not resurrected after reload (meal); Viewer mode receives updates in ~5 s with zero writes and no false success toasts).
- **Re-verification of fixes V1-V8: PASS** except one item fixed afterwards (Reset confirm clipped 18 px at 320 px: now scrolls into view, re-checked on screen).
- Screens verified at 320 and 375 px incl. Settings (signed out/in/viewer), SyncBadge states, Remove row, storage-failure banner. Screenshots preserved in `~/Desktop/Claude Code Experiments/fitness-app-backups/evidence-2026-10-25/` (`screens/` 91 files, `sync/`, `after-fix/`).

## Bugs found and fixed here
Cloud-apply triggered an auto-save; duplicate conflict listing; profile doc written when only a timestamp changed; no timeout when the backend stalls; `+null cm` on Progress; Authorize/coach row clipped; Settings footer below the fold at 320 px; Train input behind the Prev/Next bar; tap targets under 36 px; Reset confirm clipped.

## Emulator results do NOT prove
The deployed rules, the live Firebase service, real listener latency, real email delivery, or a real network cut. The Failed badge state, real soft-keyboard behaviour and a UI weigh-in delete (none exists) were not exercised.

## Known limitations (not fixed)
Toasts cover the header controls for ~4 s. Header title text hidden below 360 px. Several controls are exactly 36 px. A stalled backend now reports Failed after 20 s (code and unit tests; not reproduced in a browser).

## Remaining LIVE-ONLY tests (NOT run; each needs your separate approval)
Target for all: the existing live Firebase project (`constant-fuze-dw1xt`, database `ai-studio-100daybollywoodb-...`), using only the approved alias `heetsanghvi02+fitness-owner@gmail.com` (never the real account). Password generated locally, never shown.
1. **Real listener and deployed-rules behaviour** (the current deployed rules, not the new validation): sign up, link, two-browser refresh. Writes: only under `users/<that uid>`: TEST sleep 7.5, one +250 ml water, TEST meal "TEST dal and curd", one 71.5 kg weigh-in, one TEST note. Cleanup: delete `users/<uid>` (confirm the delete dialog path), delete that login in Authentication, delete the local password file, verify both gone.
2. **Email delivery**: verification and password-reset mail reach the alias inbox (you check; I cannot read it). Writes: none beyond the login in test 1.
3. **Rules validation publish** (numeric fields, role): a manual console publish of `firestore.rules` after saving the current rules; then re-run test 1. Needs explicit approval; rules govern live data.
4. **Real network cut / Failed badge**: against the live project (or an emulator run with a real offline toggle); writes as in test 1.
5. **AI Studio publish and rollback rehearsal**: not run; AI Studio workspace currently at `a237d1b`.

## Smallest remaining steps before a supervised core-app trial
1. (Done) new-device trap fix. Optional: badge wording for setup-only signed-in devices.
2. Your approval for live test 1 (+2), then run it with cleanup.
3. Decide AI Studio: leave `a237d1b` pulled or restore the earlier snapshot; then merge/publish approval for `auto-sync`.
4. Optional: rules validation publish (live test 3).
Chat write path: design only, all choices NOT APPROVED (see docs/INSTINCT-WRITE-PATH-DESIGN.md).
