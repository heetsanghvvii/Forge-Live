# Reminders: what works today and what closed-app push needs

Design only for the second half. Nothing in the second half has been built, deployed or paid for.

## Built (branch claude/forge-reminders)
- Habits: 6 built-in plus up to 20 custom, each with a time and days of the week, ticked done per day, with streak and week count.
- Reminders fire while Forge is open or in the background (checked every 30 seconds and when the app returns to the front): a system notification if allowed, and always a banner inside the app with a Done button.
- Installable: manifest, icons and a service worker that only shows notifications. Nothing is cached.
- Data stays on the device (`forge_habits_v1`). Not part of AppState, not synced, no Firestore change.

## Not possible without a server: reminders when the app is fully closed
iOS has no scheduled local notifications for web apps. A reminder reaches a closed app only through web push (APNs via Firebase Cloud Messaging or plain Web Push) sent by a server at the right time. iPhone needs iOS 16.4 or later and the app added to the Home Screen.

Needed, each needing the owner:
1. A Web Push key pair (VAPID) generated in the Firebase console. Public key goes in the app; the private key stays on the server only.
2. Store each device's push subscription with its reminder times, per signed-in user, in Firestore. This changes `firestore.rules` and moves reminder times off the device, so it needs a privacy line in Settings.
3. A sender that runs every minute: reads who is due, skips anyone who already ticked the habit, sends the push. Options: Cloud Functions with a schedule (needs the Blaze billing plan), or the Cloud Run service AI Studio already creates plus Cloud Scheduler (billing must be enabled). Both break the Rs0 rule even if usage stays in the free tier, so they need explicit approval.
4. Sign-in is required, because a push needs to know who to send to. Today the app works without an account.
5. Live testing on a real iPhone with a synthetic account. Headless browsers cannot receive iOS push.

## Unverified
Delivery of a system notification on a real iPhone. The test replaced the notification call and checked that Forge asks for it at the right minute, once, for the right habit.
