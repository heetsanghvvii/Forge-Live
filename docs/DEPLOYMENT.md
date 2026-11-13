# Deployment: GitHub -> Google AI Studio -> live

**Nothing in this document has been executed.** No publish, deploy, rollback or rules change was done while writing it. Tags: VERIFIED = backed by a source URL read on the date of writing; UNVERIFIED = must be checked by a person in the AI Studio UI. No API keys are in this file.

## Known facts about this project
- Firebase project id: `constant-fuze-dw1xt` (Starter / AI Studio tier). VERIFIED (observed in project config by the team, not from a web source).
- Authorized domains include `service-100-day-bollywood-body-phase-2.ai.studio` and `service-100-day-bollywood-body-phase-2-309635711195.asia-southeast1.run.app` (Cloud Run). VERIFIED (observed in Firebase console by the team).
- Repo: private `heetsanghvvii/100-day-bollywood-body-phase-2`, default branch `main`. PENDING-TASKS.md says the live site runs an older build.

## How the path works
1. **GitHub link.** AI Studio Settings has a "GitHub" tab to create a new repo or link an existing one; "Import from GitHub" is in the + (Add files) menu of the prompt box. VERIFIED: https://ai.google.dev/gemini-api/docs/aistudio-build-mode
2. **Sync is two-way.** AI Studio can push changes to the repo (AI-written commit messages) and pull changes made in an IDE or by teammates. A "Resolve conflicts" dialog shows a side-by-side diff and lets you keep the AI Studio or GitHub version per file. VERIFIED: same URL.
3. **Which branch/commit?** The docs do not mention branch selection. UNVERIFIED: in Settings > GitHub, look for a branch name next to the linked repo. Confirm it is `main` and note the last synced commit hash, if shown.
4. **Publish.** Top-right "Publish" opens "Deploy app on Google Cloud"; choose a Cloud project, click "Publish your app"; AI Studio generates the Cloud Run service name; wait a few minutes, then open the App URL. VERIFIED: https://codelabs.developers.google.com/deploy-from-aistudio-to-run
5. **What gets published.** The docs say the app built in AI Studio is deployed to Cloud Run. They do not say whether it is the AI Studio workspace state or the GitHub branch. UNVERIFIED (important): after a GitHub pull, check that the AI Studio file view shows the new code (e.g. open `src/components/SleepEntry.tsx`) BEFORE pressing Publish. Treat the AI Studio workspace as the thing that gets published.
6. **Starter limits.** Starter tier gets two free deployments and up to two full-stack apps per Cloud Run region. "Unpublish app" is the cleanup action that avoids charges. VERIFIED: codelab above. Pricing for Cloud Run may apply. VERIFIED: build-mode page.
7. **Firestore rules are NOT part of Publish.** Publishing deploys the web app only. Rules (`firestore.rules`) are deployed separately and manually (Firebase console or `firebase deploy --only firestore:rules`). UNVERIFIED that AI Studio never touches rules: after any publish, open Firebase console > Firestore > Rules and compare with the repo file.

## Rollback
- **Cloud Run revisions.** A community report (not official docs) shows Publish creates numbered Cloud Run revisions (e.g. 00024, 00025), but "Manage Traffic" was disabled on a Starter account, so traffic could not be shifted back. A Google rep did not offer a rollback. Source: https://discuss.ai.google.dev/t/starter-deployment-failed-production-unavailable-and-rollback-disabled/186294 . Status: VERIFIED only as a user report; UNVERIFIED for this project.
- **Same report:** restoring a source checkpoint in AI Studio is not a deployment rollback.
- **Official docs say nothing on rollback** (build-mode page and codelab). 
- **Practical rollback plan (UNVERIFIED, check before relying on it):** (a) In Google Cloud console > Cloud Run > the service > Revisions, see whether "Manage traffic" is enabled for you. (b) If not, the fallback is to restore the earlier code into AI Studio (git revert on `main`, then pull in AI Studio) and Publish again. Before any publish, write down the current revision name so you know what "previous" is.
- **Do not click "Unpublish app" as a rollback:** a Google rep asked a user not to, because it releases the URL (same forum thread).
- Known publish failure modes reported by users (not official): active-revision quota errors, "service is unavailable", wrong Cloud project preselected. Check the project shown in the Publish dialog is the intended one.

## Verify what is live
- Build hash: view-source of the live page; the script tag is `/assets/index-<hash>.js`. Compare with `dist/assets/index-<hash>.js` from a local `npx vite build` of the same commit. (Hashes only match if the build is identical; treat a match as proof, a mismatch as "check further".)
- **Build stamp (implemented in this branch):** in `vite.config.ts` add `define: { __BUILD__: JSON.stringify(process.env.GIT_SHA ?? new Date().toISOString()) }` and show `Build {__BUILD__}` small in Settings. Caveat UNVERIFIED: AI Studio may run its own build and not pass GIT_SHA, so use the timestamp fallback and compare to the publish time.
- Quick functional check: the Sleep card ("hours" label, "Not logged") should appear on the day screen if this version is live.

## Pre-publish checklist
- [ ] `npm run lint`, `npx tsx --test src/utils/*.test.ts`, `npx vite build` all pass.
- [ ] Changes are merged to `main` and pushed; AI Studio Settings > GitHub shows the same commit (pull if not).
- [ ] No secrets in the repo (`git grep -i "api[_-]key\|secret"`; Firebase web config is public by design but keep Gemini keys in AI Studio Secrets only).
- [ ] Firestore rules: if `firestore.rules` changed, deploy them separately and manually, and test with `npm run test:rules` first.
- [ ] Rollback prep: note current Cloud Run revision and current commit hash.
- [ ] Cost check: Starter tier, Cloud Run within free usage, no billing account upgrade, expected bill Rs 0. Check Cloud console > Billing shows nothing charged.
- [ ] After publish: verify the live version (above) and that sign-in/sync works on the `.run.app` domain.

## Open questions for the user
1. In AI Studio Settings > GitHub, which branch is linked, and does it show the last synced commit?
2. Is "Manage traffic" enabled on the Cloud Run service for your account?
3. Does Publish deploy the AI Studio workspace or the GitHub branch? (Look for any "source" or commit info in the Publish dialog.)
4. Are you OK with adding a build stamp to Settings?
