# Pending Tasks - 100 Day Bollywood Body: Phase 2

Status: 24 Oct 2026. Live site runs the 5:42 PM build; this repo holds the newer working build (unpublished).

## Accounts and sign-in
- Goal: invite-only personal use; each person gets a private account.
- Chosen direction: managed email + password sign-in with password recovery, phone number kept only as an optional contact field.
- Current state: Google sign-in is enabled in Firebase; Email/Password is disabled on the project and the Firebase console blocks provider changes on the current free tier. Needs a verified no-cost enable path before it can be promised.
- Never ship phone-number-only access: a phone number is an identifier, not proof of identity.
- Popup sign-in is unreliable in some browsers; add a redirect-based sign-in fallback with visible error messages.

## Data integrity
- Sleep default: new day records are created with sleepHours = 7.5, which looks like real logged sleep. Fix by tracking which fields were actually entered (entered flags). Do not zero out or edit existing stored records.
- Coach dashboard 7-day averages: numbers are hidden behind a heuristic label, but the raw averages still show. Suppress the numbers until entered flags exist; a logged zero and a skipped day are currently indistinguishable.
- Fixed: cloud sync no longer invents a programme start date when none is set.

## Tested vs untested
- Passed (preview): fresh install has no fake data, signup records only what is typed, data survives reload, CSV export works, cloud sync asks for consent first.
- Not yet proven: real Google sign-in round trip, saving to the cloud database, coach read access with a second account, password recovery emails.

## Hard constraints
- Rs 0: no billing, trials, upgrades, paid APIs, or SMS costs.
- No commercial or sales features yet; invite-only personal use.
- This repo stays private with no collaborators (it contains course-derived program content).
- Health-device sync is dropped.

## Update 2026-10-25 (release candidate)
- Branch `release-candidate-2026-10-25` holds the finished work; `main` is unchanged and the live site is unpublished.
- New Firestore rules are live (see docs/RELEASE-AND-RECOVERY.md for rollback). Email/Password sign-in is enabled.
- Still open: publish through AI Studio (branch/rollback unverified), coach consent scope (coaches read daily logs incl. notes), default profile text pushed after onboarding, weigh-in/measurement form pre-fills.
- Published 2026-10-25: live site runs the release (Version no-git, 2026-10-25 02:24 UTC). Rules and app are both live.
