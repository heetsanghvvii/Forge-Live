# Release and Recovery Guide

**Status: written 2026-10-25 for the branch `release-candidate-2026-10-25` (current commit `6b0b9d6`).
Nothing in this document has been executed. No rules were published, no app was published, and no live system was touched while writing it.**

Read this before you change anything live. Where a step says "check", do it yourself and do not assume.

Related files in the repo: `docs/DEPLOYMENT.md`, `PENDING-TASKS.md`, `firestore.rules`.

---

## 1. Release order

Do these in this order. Do not skip ahead.

1. **Publish the new Firestore rules first.**
   - Open the Firebase console and go to Firestore, then the Rules tab.
   - Database: `ai-studio-100daybollywoodb-310ca205-414f-4013-b825-16ecdc1d38c2` (this is the `firestoreDatabaseId` in `firebase-applet-config.json`).
   - Copy the full contents of `firestore.rules` from the release branch and paste them in, replacing what is there.
   - Click **Publish**.
2. **Then publish the app through AI Studio.** Only do this after you have reviewed the change list and the checklist in section 4.

**Why this order:** the new app writes a coach summary document (`users/{you}/coachSummary/current`). The old rules have no rule for that document, so the new app's sync would be refused until the new rules are live.

**Known cost of this order:** the new rules stop coaches reading the athlete's full profile. An old coach who relied on that loses profile read until the athlete taps **Save to cloud** in Settings, which writes the coach summary the new rules use.

**Note:** `docs/DEPLOYMENT.md` says Publish does not touch rules. Rules are deployed by hand. Check the Rules tab after every publish anyway.

---

## 2. Recovery

### 2a. Restore the previous Firestore rules

1. Find the saved copy of the old rules: `fitness-app-backups/live-firestore-rules-BEFORE-release-2026-10-25.rules`, which sits INSIDE the owner's `Claude Code Experiments` folder on the Mac (not committed to the repo, to keep it private). Verified present on 2026-10-25; it matches the rules on `main`.
2. Open the file in a plain text editor and copy everything.
3. Firebase console, then Firestore, then Rules. Paste over the current text and click **Publish**.

### 2b. Restore the previous code

- **Git bundle and tree backups** are in `Claude Code Experiments/fitness-app-backups` (verified with `git bundle verify` on 2026-10-25). They are not in the repo.
- **Branch `main` still holds the old build.** The release work is on `release-candidate-2026-10-25` only. If you need the old code, `main` is the simplest copy.
- To keep the new code but undo it, do not delete branches. Tell the next person what you did.

### 2c. Roll back the live app (AI Studio / Cloud Run)

**UNVERIFIED. Do not rely on this until you have checked it.** `docs/DEPLOYMENT.md` says:

1. Before any publish, note the current Cloud Run revision name. This is your "previous" version.
2. Open Google Cloud console, then Cloud Run, then the service. Open **Revisions**.
3. Check whether **Manage traffic** is enabled for your account. A community report says it was disabled on a Starter account. If it is enabled, you can send traffic back to the old revision.
4. If it is disabled, the fallback is: restore the earlier code on `main` in AI Studio, then Publish again. This takes a new publish and is slower.
5. **Do not click "Unpublish app" as a rollback.** It releases the URL.

---

## 3. Check the live version after publishing

1. Open the live app on its `.run.app` address. Go to **Settings** and scroll to the bottom.
2. The **Version** label shows a short commit hash, a dot, and the UTC build time, for example `6b0b9d6 · 2026-10-25 14:30 UTC`.
3. Compare it with:
   - The commit hash: the commit at the tip of `release-candidate-2026-10-25` at the time you published. Run `git rev-parse --short HEAD` on that branch to get it.
   - The build time: it should be close to the time you clicked Publish.
4. If the label shows `no-git`, the build ran without git history. Then only the build time can be checked.
5. Functional check: DEPLOYMENT.md says the Sleep card should show a "hours" label and "Not logged" on the day screen. **Caveat:** `PENDING-TASKS.md` says the sleep default fix is still open, so this check may fail even on the correct build. Treat it as a hint, not proof.
6. Confirm sign-in and cloud save work on the `.run.app` address.

**Note:** the build stamp is implemented (DEPLOYMENT.md has been updated). `vite.config.ts` and `SettingsModal.tsx` already show the Version label.

---

## 4. Pre-publish checklist

Run these from the repo folder. Each one must pass.

- [ ] `npm run lint` (type check) passes.
- [ ] `npx tsx --test src/utils/*.test.ts` (unit tests) passes.
- [ ] `npx vite build` (build) passes. This is in DEPLOYMENT.md's checklist.
- [ ] `npm run test:rules` (rules tests) passes. This needs a Java runtime installed. It starts a local Firestore emulator; it does not touch the live database.
- [ ] No secrets in the repo. Run `git grep -i "api[_-]key\|secret"` and review the hits. The Firebase web config is public by design. Gemini keys belong only in AI Studio Secrets.
- [ ] If `firestore.rules` changed, the rules are published by hand (section 1) before the app.
- [ ] Write down the current Cloud Run revision name and the current commit hash (section 2c).
- [ ] Cost check: Rs 0. No billing account, no upgrade, no trial, no paid API, no SMS. Check Cloud console, then Billing, shows nothing charged. The database is on AI Studio shared quota (see section 7).
- [ ] Test accounts are deleted. Remove any test accounts created while testing. (Not from the repo. See section 7.)
- [ ] The release commit is on the branch AI Studio syncs from. See section 6.
- [ ] After publish: run the checks in section 3.

---

## 5. Known limitations

From `docs/DEPLOYMENT.md`:

- AI Studio sync is two-way. Publish may deploy the AI Studio workspace, not the GitHub branch. This is unverified. Before pressing Publish, open a file that changed and confirm the new code is there.
- Rollback in AI Studio is unverified (section 2c).
- Starter tier allows two free deployments and up to two apps per Cloud Run region. Cloud Run charges may apply in some cases. Watch the billing page.
- Publishing does not change Firestore rules. Check the rules tab after each publish.
- Firebase project id is `constant-fuze-dw1xt`. The release is built for this project.
- The Publish dialog can preselect the wrong Cloud project. Check it before you click.
- Users have reported publish failures (quota errors, "service is unavailable"). These are not official.

From `PENDING-TASKS.md`:

- **Sign-in:** Google sign-in is enabled. Email and password sign-in is disabled on the project, and the Firebase console blocks provider changes on the current free tier. Password recovery is not yet available. No verified free way to enable it is known.
- **Phone numbers:** never use phone-number-only access. A phone number is a contact field, not proof of identity.
- **Popup sign-in:** unreliable in some browsers. A redirect sign-in fallback with visible errors is still to do.
- **Sleep default:** new day records are created with 7.5 hours of sleep, which looks like real logged sleep. The fix (track which fields were actually entered) is still open. Do not zero out or edit existing stored records.
- **Coach 7-day averages:** raw numbers still show even though a heuristic label hides them. A logged zero and a skipped day look the same. Hide the numbers until the entered flags exist.
- **Not yet proven by testing:** real Google sign-in round trip, saving to the cloud database, coach read access with a second account, password recovery emails.
- **Dropped:** health-device sync.
- **Scope:** invite-only personal use. No commercial or sales features. Repo stays private with no collaborators (it has course-derived program content).

Added by the owner (not in those two files):

- **Coaches can read daily logs, including notes.** The rules allow any authorized coach to read every daily log document. Confirmed in `firestore.rules`.
- **Defaults are pushed after onboarding.** Not confirmed in the code reviewed. Check before relying on it.
- **Onboarding form pre-fills** from existing settings. Confirmed in `src/components/OnboardingModal.tsx`.

---

## 6. Open questions to settle before publishing

1. **Which branch does AI Studio sync?** `docs/DEPLOYMENT.md` says the release lives on `main`. The release commits are on `release-candidate-2026-10-25` only, and `main` is still the old build. Either merge the release to `main` and push first, or confirm AI Studio is publishing from the workspace. Do not publish until this is settled.
2. Is **Manage traffic** enabled on the Cloud Run service for your account? (Section 2c.)
3. Does Publish deploy the AI Studio workspace or the GitHub branch? Look for any source or commit info in the Publish dialog.
4. Is the rules backup file where the owner expects it? (Section 2a.)

---

## 7. Facts in this document not taken from repo files

These came from the owner, not from the repo. Check them before relying on them:

- (Resolved: the backup folder is inside `Claude Code Experiments`, not at the Desktop root.)
- "Rs 0" and "the database is on AI Studio shared quota". The repo says Rs 0 (`PENDING-TASKS.md`), but the shared-quota detail is not in any repo file.
- "Test accounts are deleted" (a checklist item from the owner).
- "Defaults are pushed after onboarding" (section 5).


## Status on 2026-10-25 (added after the live tests)
- **New Firestore rules were published** to database `ai-studio-100daybollywoodb-310ca205-414f-4013-b825-16ecdc1d38c2` on 2026-10-25 at 07:41 (console version list: "Today 7:41 am"). The previous version (rules identical to `main`) is the console entry dated "Yesterday 6:12 pm"; restore by choosing it in the version list and Publish, or paste the saved copy.
- **The app itself is NOT published.** Until it is, the live site runs the old build. A coach using the old build cannot read the owner's profile under the new rules.
- Live tests with temporary accounts (all deleted afterwards, cleanup verified): sign-up, login, logout, wrong password, cross-browser load, account-switch guard, coach denied before consent, coach read-only after consent (summary and logs readable, profile and all writes denied), coach denied again after revoke, and no re-grant after a later Save to cloud.
- Not live-tested: two devices editing the same day (conflict buttons), verification and reset email delivery, real CSV download dialog, AI Studio branch/publish/rollback.

## AI Studio facts verified on 2026-10-25 (read-only look at the console)
- App: "100 Day Bollywood Body: Phase 2" in AI Studio; published at `service-100-day-bollywood-body-phase-2.ai.studio`; last published Oct 24 2026 7:24:29 PM.
- Settings > GitHub: linked to `heetsanghvvii/100-day-bollywood-body-phase-2`, branch **main**; last synced Oct 24 7:22 PM; button "Pull changes to Google AI Studio" (status said changes in GitHub were ready to pull).
- Settings > Versions: a list of app versions with "Restore version" (this is the in-AI-Studio recovery path). The current version before the release was "Snapshot from 2026-10-24T13:52:33" (7:22 PM).
- Settings > Publish: shows "Republish"; it also said there are unpublished changes before the pull.
- Not verified: whether Republish deploys the workspace (assumed yes), and whether Cloud Run traffic rollback is available on this tier.
- `main` now equals the release candidate (051b4b5 + this doc commit).

## Steps to go live (owner)
1. AI Studio > open the app > Settings (gear, top right) > GitHub > "Pull changes to Google AI Studio". If a per-file conflict dialog appears, choose the GitHub version for every file.
2. Open Settings (gear in the app) and look at the Version label at the bottom. AI Studio may build without git history, in which case it reads `no-git · <build time> UTC`; the build time is then the proof. Also check that Settings shows the new 'Email' log in panel and 'Review entries'.
3. Settings > Publish > "Republish". Wait until the status stops saying "In progress".
4. Open `https://service-100-day-bollywood-body-phase-2.ai.studio`, open Settings in the app, and check the Version label shows a build time after the publish (and the new commit hash if git is available), plus the Email log in panel in Settings.
5. If anything is wrong: Settings > Versions > pick the "Snapshot from 2026-10-24T13:52:33" entry > Restore version > Republish. Rules can be rolled back separately from the Firestore version list.

## PUBLISHED on 2026-10-25
- AI Studio pull from GitHub `main` succeeded with no conflicts (GitHub and AI Studio reported in sync, 7:53 AM IST). The app was then republished at the same URL.
- Verified on the live site `https://service-100-day-bollywood-body-phase-2.ai.studio/`: Version label `no-git · 2026-10-25 02:24 UTC` (AI Studio builds without git history, so the build time is the proof); email login panel, Review entries, Save to cloud / Load from cloud present; old Sync Now gone; no console errors on load.
- AI Studio's Publish panel kept showing the old 'Last published' time and an 'unpublished changes' note after the publish; the live site is the source of truth.
- No live account was created on the production URL; the live-project tests ran from a local copy against the same Firebase project (all test accounts deleted).
- Rollback: AI Studio > Settings > Versions > Snapshot from 2026-10-24T13:52:33 > Restore version > Republish; rules via the Firestore rules history.

## Restore (Settings > Restore JSON): what is checked
- The whole file is checked before anything changes. Limits: 4,000,000 characters of text, 40 levels of nesting, 200,000 values, lists (weigh-ins, measurements, photos, lesson ids) at most 3000 entries. Dates must be real YYYY-MM-DD dates; day numbers 1 to 63; numbers must be finite and in sane ranges. Invalid files are rejected with a list of the first 20 problems (path and reason).
- Numeric text migration: a plain number written as text in a numeric field (for example "9000" or "71.5") is converted to a number, and the restore confirmation says "N value(s) were converted from text to numbers". Text that is not a plain number (for example "abc" or "1e3") in a numeric field rejects the file. Nothing else is converted or dropped.
- The restore is written to browser storage first and read back. If that fails (storage full, too nested), the previous data and the current screen stay exactly as they were and an error message is shown. Closing Settings while a file is being read cancels the restore.
