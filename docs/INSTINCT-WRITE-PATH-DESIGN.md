# Instinct write path: revised proposal (not implemented, nothing approved)

Date: 2026-10-25. Branch context: `auto-sync` (see HANDOFF.md).
Sources read (auto-sync copies): src/utils/cloudSync.ts, cloudMerge.ts, syncBase.ts, accountLink.ts, autoSave.ts, viewerMode.ts, src/types.ts, src/App.tsx (weigh-in handler), src/views/ProgressView.tsx (weigh-in validation), firestore.rules, HANDOFF.md, docs/RELEASE-AND-RECOVERY.md. Not read: liveRefresh.ts, autoSyncController.ts. No code changed, no network, no Firebase.

**Status.** This is a proposal only. Nothing is built, tested or published. The owner has NOT approved any design, any field scope, any retention period or any cost. Every recommendation below is a recommendation, not an approval.

---

## Plain English

Instinct should be able to add or correct one entry, but only after the owner has confirmed the exact change in chat. Forge already stores a content hash (the "base") for each cloud item, and a save refuses to overwrite a change it did not expect. The new path reuses that hash, wraps the write in one all-or-nothing transaction, writes an audit record, and only says "logged" after reading the value back from the server.

**Recommended: Design A, an in-app Instinct entry form.** Instinct opens a dedicated Forge screen in its logged-in browser, shows the current value, and presses Save only after a "yes" in chat. That browser never runs the normal sync or auto-save code.

**Honest limit.** Instinct uses the owner's own login, so the database cannot tell Instinct from the owner's browser. The audit trail and the time-limited write window make mistakes visible and bounded. They are not security against anyone who holds the login.

---

## 1. Candidate designs

| | A. In-app entry form (recommended) | B. Pending-suggestion queue | C. Write-mode toggle with expiry |
|---|---|---|---|
| How | Owner confirms in chat; Instinct fills the form; Save writes directly | Instinct writes a suggestion doc; owner approves in the app | Owner opens a window; Instinct writes until it expires |
| Pros | "Logged" is true when said; reuses the hash; each entry explicit | Strongest human check | Simplest |
| Cons | Needs a dedicated form and browser automation; Instinct browser must stay isolated | Cannot say "logged" in chat; owner must open the app | Any mistake inside the window lands; hardest to explain |
| Security | Per-entry confirmation, hash check, audit | Good | Weakest |

Ruled out: a server-side write path (Cloud Functions). It may need a paid plan (see Costs, verification pending). No paid service is authorised.

---

## 2. Recommended design (A): daily-log fields

### Flow
0. **Unlock.** On the owner's own device, the owner taps "Allow Instinct entries for N min". This writes `users/{uid}/instinctWriteMode/current` with `enabledUntil`. The form reads it from the server and refuses to save if it is missing or past.
1. **Ask.** Owner: "protein 140 on day 12".
2. **Resolve target.** Instinct reads the date and programme start (Viewer mode, read-only) and maps date to day number. If the date is outside day 1 to 63, the start date is missing, or two documents claim the same day, Instinct asks. It never guesses.
3. **Capture expected hash.** Read the doc with `getDocFromServer`; `expectedHash = hashDailyDoc(doc, day)` (cloudMerge.ts).
4. **Preview in chat.** Every preview must state all four: the exact **field**, the exact **date and day number**, the **current value** in the cloud, and the **proposed value**, then ask "Save this change?". A preview missing any of the four is invalid and must not be saved.
5. **Per-write confirmation.** The owner must reply with an explicit yes to THAT preview. A "yes" to an earlier preview, a general "go ahead" or an open write window never authorises a new write. If any of the four items changes, make a new preview.
6. **Transaction.** One `runTransaction`: read the doc; if `hashDailyDoc(current, day) !== expectedHash`, abort and write nothing; otherwise update only the changed fields (`entered.<metric> = true`, see RELEASE-AND-RECOVERY.md) and write the audit doc.
7. **Confirm.** After commit, read the docs back from the server and compare hashes with the intended result. Only on a match reply "Logged." Otherwise "Not confirmed: ..." with the reason.

The entry form is a separate route. It does not mount autoSave, live refresh or the sync base. autoSave.ts can restore a pending marker (`forge_autosave_pending_v1`); the Instinct browser must have it cleared and `canSave` must return false there.

### Why per-write confirmation beats a timed window alone
A window authorises a period of time, not a specific change: a misheard number, wrong date or text smuggled into content Instinct was reading would all land inside it. A per-write confirmation binds consent to the exact field, date, current and proposed value, so a bad write needs a bad "yes". The window stays as a coarser second safeguard. Both sit on top of the version check and the cloud read-back.

### Honest limits (read before approving anything)
- A shared login cannot show whether a write came from the owner or Instinct. Rules cannot tell them apart.
- The window, confirmation, version check and audit make mistakes visible and harder. They are not security boundaries.
- **None of the proposed protections are active.** The audit collection, write-mode document, entry form and rules changes are design only. Until each is built and tested, no audit trail exists and nothing here may be relied on.

### Data written
- `users/{uid}/dailyLogs/{docId}`: only changed metric fields, `entered.<metric>`, `updatedAt`. Never a full-document overwrite (the normal save, `executeSave`, overwrites whole docs, so it must not be reused).
- `users/{uid}/instinctAudit/{autoId}` (new): `ownerUid`, `createdAt`, `source: "instinct-chat"`, `action`, `status` (committed, rejected-conflict, failed), `date`, `dayNumber`, `target` (doc or profile entry), `field`, `before`, `after` (changed values only), `expectedHash`, `afterHash`. No chat transcript, tokens or credentials.
- `users/{uid}/instinctWriteMode/current` (new): `enabledUntil`, `setAt`.

### Conflict behaviour
If the hash does not match, nothing is written, an audit row records `rejected-conflict`, and Instinct replies with the newer value and asks again. Any retry needs a new preview and hash; no silent retry. On the owner's device, `planPull` adopts the new value and `planSave` reports a conflict instead of overwriting, which is correct. Whether the app pulls automatically depends on liveRefresh.ts (not read).

### Rules changes (additive, none published)
- `instinctAudit/{id}`: owner `create` with validated shape; owner `get, list`; `update, delete` depend on the retention option in section 4 (pending owner choice, NOT APPROVED YET). No coach access.
- `instinctWriteMode/{doc}`: owner read and write, validated fields, no coach access.
- `dailyLogs` rules unchanged (validLog allows the new fields).
- Rules cannot enforce the write window without also blocking the owner's own app. Not proposed.

---

## 3. Weigh-ins (OPTIONAL scope item: the owner may approve or decline; NOT APPROVED YET)

**The owner has NOT approved any field scope. Weigh-ins are not in v1 unless the owner says so.**

### What the code shows
- Weigh-ins are NOT daily-log documents. They are an array field `weighIns` of `{date, dayNumber, weight}` (`WeighInRecord`, types.ts; weight in kg) inside the private profile document `users/{uid}`. `measurementHistory` is the same kind of thing: an array of `{date, dayNumber, measurements{chest, waist, hips, arms}}` in the same profile document. Sources: types.ts, cloudSync.ts (`profilePayload` includes `weighIns` and `measurementHistory`), firestore.rules (`validProfile`).
- The app logs a weigh-in in `handleAddWeighIn` (App.tsx): date is India-local `localYmd()`, `dayNumber` is the day currently selected in the app, and `upsertByDate` replaces any entry for the same date. It ALSO sets `settings.bodyweightKg`, which the normal save writes to the profile and to `coachSummary` (the coach-visible summary). ProgressView validates 20 to 400 kg with one decimal.
- The app saves by `setDoc(users/{uid}, payload, {merge: true})` (cloudSync.ts), after a per-date plan (`planDatedArray`, cloudMerge.ts) that compares each date's entry hash (`hashEntry`) with the stored base. I found no transaction in the app's save path.

### What would be affected
Only the `weighIns` field of `users/{uid}`, and only one date's element in it, plus one new audit document. Not `bodyweightKg`, not `coachSummary`, not any daily log. (Consequence: the "current weight" setting stays as it was until the owner next logs a weight in the app. I did not check whether the app re-derives it from `weighIns`.)

### Why a profile write is riskier than a dailyLogs write
1. The profile document holds private fields: injuries and constraints, diet exclusions, goals, age, gender, height, `authorizedCoachUid`. A bug here touches the most sensitive document.
2. Rules check the whole merged document against an allowlist (`validProfile`, `hasOnly`). Any legacy or unexpected field in the stored document makes every write to it fail. This fails closed (nothing is written), but weigh-in logging would then be blocked, and Instinct must report that plainly.
3. A Firestore array field is replaced as a whole. Two writers means last writer wins on the entire array, so a stale read can silently drop another device's weigh-in. (This is Firestore behaviour; I did not test it here.) Rules only cap the list at 3000 entries and do not check element shape or weight range.

### Safest mechanism
One `runTransaction`:
1. Re-read `users/{uid}` inside the transaction.
2. Find the element for the target date. Compute `hashEntry(element)` (or "absent" when adding) and compare with the `expectedHash` captured at preview. Mismatch: abort, write nothing, show the newer value.
3. Build the new array from the freshly read one, replacing or inserting ONLY that date's element (keep date order as the app does). Write only `weighIns` (via update, not a whole-profile set), plus the audit document, in the same transaction.
4. Read back from the server; say "Logged" only if that date's element matches. Otherwise "Not confirmed".

Rules for entries: kg only, 20 to 400, one decimal (same as the app). **Same-date rule:** a correction replaces that date's entry. If the owner appears to want a second entry on one date, Instinct must ask; it never adds a duplicate. Date is the India-local date; `dayNumber` is derived from the date and programme start (the app instead uses the selected day, so the two can differ and Instinct must show the day number in the preview).

### How this differs from the app's save path
The app writes the whole planned array with `setDoc merge`, no transaction, from a device holding a full local copy. Instinct would read fresh inside a transaction, touch one element, and verify by read-back. The app's per-date base check still protects the owner's device afterwards: an entry changed in the cloud is adopted on pull, or reported as a conflict on save.

### Options and recommendation
- **Decline for v1 (recommended).** Trade-off: weight corrections stay manual in the app; the profile document is never touched by Instinct, which is the main risk removed.
- Include "correct existing / add for today" only. Trade-off: useful, but it needs the profile-document rules tests and the transaction above, and adds a coach-adjacent (bodyweight) mismatch to explain.
- Measurements follow the same mechanism and are out of scope either way.

---

## 4. Audit retention (PENDING OWNER CHOICE, NOT APPROVED YET)

The audit rows contain health data: before and after values (for example protein or weight) with dates. Retention must be finite, not indefinite.

**Proposal only, not approved: a finite period of 90 days, then removal.** Trade-off: 90 days covers the "did I mis-log something this month" case and keeps health data short-lived; older history is lost. The period is a suggestion for the owner to change.

**The design cannot promise both automatic cleanup AND undeletable audit records at the free tier.** Automatic cleanup needs clients (the app, or the owner's login) to be allowed to delete rows. Records that clients cannot delete need a manual console purge. The owner must pick one of the two options below. **No option is approved.**

**Store only changed values** (field, before, after, date), never whole documents or the profile, to keep the health data minimal.

| Option | How | Pros | Cons |
|---|---|---|---|
| R1. App-side cleanup; audit rows owner-deletable | Rules allow the owner to delete audit rows. The app removes rows older than the chosen period whenever it runs. | Cleanup happens without a console step. | **Not tamper-resistant:** anyone holding the shared login, including Instinct's session, can delete audit rows. Cleanup only runs when the app runs. |
| R2. Client deletes blocked; manual console purge | Rules block client `update` and `delete` on the audit collection. The owner purges old rows by hand in the Firebase console. | Stronger against accidental or in-app deletion: clients cannot erase the trail. | Retention depends on the owner purging by hand; rows stay until then. Still not secure against console or admin access. |

TTL (server-side automatic expiry) is **excluded**: it requires billing (section 6). It is not one of the options and is not part of any plan here.

### Deletion versus tamper-resistance (honest)
- Under R1, if the owner can delete audit rows, so can anyone with the shared login, including Instinct's session. Such an audit is **not tamper-proof**.
- Under R2, clients cannot erase the trail, but retention then depends on the owner purging by hand, and rows older than the period remain until that happens.
- Neither option is secure against someone with console or admin access.
- **What the audit can honestly provide:** a visible record that helps the owner spot mistakes and see what Instinct changed. It is not forensic proof and must not be described as one.

Open choice (see Decisions): R1 or R2. Neither option is approved. The 90-day period is still only a proposal.

---

## 5. Browser: an open owner choice (not confirmed; NOT APPROVED YET)

No dedicated browser or profile setup has been confirmed. Do not assume one.

- **Option 1: dedicated browser profile used only for Forge**, no extensions, no other logins. Trade-off: some setup; far smaller exposure, since a general-use browser holds a session that can write to the owner's account and can be influenced by other pages.
- **Option 2: shared general-use browser.** Trade-off: no setup; higher risk from other content and other sessions.
- **If the owner has not confirmed a choice:** Viewer mode stays the default; the write window cannot be opened from the Instinct browser unless the owner explicitly opens it there; Instinct reports "read-only" for any write request.

---

## 6. Costs and limits

**No paid services, billing changes or upgrades are authorised. The design must stay within free limits.** Facts below were read on official Firebase pages on 2026-10-25 by a research pass (sources listed; the pages themselves should be re-checked before relying on exact numbers).

| Item | What the official docs say | Source | Status |
|---|---|---|---|
| Firestore free quota | 1 GiB stored; 50,000 reads, 20,000 writes, 20,000 deletes per day; 10 GiB outbound per month. More needs billing. | firebase.google.com/docs/firestore/quotas | Verified (what happens at the limit is described inconsistently: a daily reset on one page, "shut off for the rest of the month" on the Spark plans page). Not the shared AI Studio group in the next row, which has different daily numbers. |
| "AI shared quota" (this project's database is AI Studio provisioned) | One shared group across the AI Studio databases: 1 GiB, 10 GiB egress per month, **40,000 writes/day, 50,000 reads/day, 50,000 real-time update units/day**. When it runs out all databases in the group fail until about midnight Pacific. The Firebase docs describe an upgrade path for an AI Studio database: the database must be upgraded explicitly in the Firebase console; linking a billing account alone does not lift the group cap. Upgrade path exists, none authorised. | firebase.google.com/docs/ai-assistance/ai-studio-integration | Verified. The console banner's exact wording was not found |
| Realtime listeners | One read per document added or updated in the result; reconnecting after more than 30 minutes offline counts as a new query. Initial-snapshot and metadata-only counting are not spelled out. | firebase.google.com/docs/firestore/pricing | Partly verified |
| **TTL auto-delete** | **Not free: it needs billing enabled**, deletes are billed as deletes, and expiry can lag by up to about 24 hours. | firebase.google.com/docs/firestore/ttl, /quotas | Verified. **So TTL is excluded from this design.** |
| Security-rule `get()` / `exists()` | Billed as reads even when the request is denied; limit 10 such calls per single-document request (20 for multi-document). Coach reads cost extra reads. | firebase.google.com/docs/firestore/security/rules-conditions | Verified |
| Authentication limits | Spark: 150 password-reset emails/day; 1,000 verification emails/day; Identity Platform on Spark 3,000 daily active users; Authentication listed as no cost up to 50,000 monthly active users. | firebase.google.com/docs/auth/limits, /pricing | Verified. "Starter tier" in your console is not described in the docs read |
| Cloud Functions | Deploying needs the paid **Blaze** plan (emulation works anywhere). | firebase.google.com/docs/functions/get-started | Verified. **Excluded.** |

**Conclusion (with caveats):** for one person, one audit write per entry plus a listener on one small list is very likely inside the free limits. The risk is the shared AI Studio group: 1 GiB, 10 GiB egress per month, 40,000 writes/day, 50,000 reads/day and 50,000 real-time update units/day, shared with other AI Studio databases. If it runs out, Forge fails along with them. Upgrade path exists, none authorised. A server-side audit (Cloud Functions) and automatic cleanup (TTL) both need billing and are excluded. Nothing here may be implemented with a paid service.

Expected extra load per entry (unverified): one audit write, one write-mode read, one or two read-backs.

---

## 7. Tests required

- **Unit (`npx tsx --test`):** target resolution (date to day, out of range, no start date, duplicate day); `hashDailyDoc` ignores `updatedAt`; hash mismatch aborts; patch touches only listed fields; audit payload holds changed values only; "Logged" only when read-back matches; window expiry. Weigh-ins (if approved): replace only one date's element; refuse a second entry on a date; reject outside 20 to 400; all other profile fields unchanged.
- **Rules emulator (`npm run test:rules`):** owner can create a valid audit doc; coach cannot read audit or write-mode; malformed audit denied; update/delete behaviour matches the chosen option; a profile with an unknown legacy field blocks the weigh-in write; existing tests (83 at a237d1b) stay green.
- **Two-browser (live, needs an owner-approved test identity and cleanup, per HANDOFF.md):** Instinct write appears on the owner device after load; an owner edit after the preview causes rejection; expired window refuses to save.
- **Conflict, offline, ambiguity:** forced change between read and commit aborts with nothing written; offline never queues a write; "yesterday" across midnight, two entries on one date, day outside 1 to 63, non-numeric value each produce a question and no write.
- **Regression:** existing planSave, planPull and syncBase tests unchanged.

---

## 8. Decisions the owner must make

**Every item is NOT APPROVED YET. Recommendations are not approvals.** Flags: [PRIVACY] [SECURITY] [COST].

| # | Decision | Recommended default | Trade-off | Flags | Status |
|---|---|---|---|---|---|
| 1 | Shared login or a separate Instinct identity | Shared login for v1 | Cannot tell Instinct from you; a separate identity is the only real fix but adds rules and complexity | [SECURITY] [PRIVACY] | NOT APPROVED YET |
| 2 | Write window length | 10 min, closes after first committed write | Shorter is safer, more taps | [SECURITY] | NOT APPROVED YET |
| 3 | Field scope | Daily-log fields only (calories, protein, fat, carbs, water, steps, sleep, energy) | Narrow limits harm; excludes checklist, supplements, photos, measurements, profile | [PRIVACY] [SECURITY] | NOT APPROVED YET |
| 4 | Weigh-ins in scope? | Decline for v1 (alternative: correct existing / add for today only) | Declining avoids the private profile document; including needs a transaction, extra tests and a profile-rules check | [PRIVACY] [SECURITY] | NOT APPROVED YET |
| 5 | Audit retention and delete rule (pending owner choice) | Not chosen. Pick R1 (app-side cleanup, owner-deletable, not tamper-resistant) or R2 (client deletes blocked, manual console purge, stronger against accidental deletion). Proposed period 90 days (proposal only); changed values only | Cannot have both automatic cleanup and undeletable records at the free tier. TTL excluded (needs billing). Neither option stops a console or admin holder | [PRIVACY] [SECURITY] [COST: TTL excluded] | NOT APPROVED YET |
| 6 | Browser for Instinct | Dedicated profile, Forge only | Setup effort versus exposure; if unconfirmed, Viewer mode stays default | [SECURITY] [PRIVACY] | NOT APPROVED YET |
| 7 | Second-device notice ("Instinct changed Day 12") | Yes, dismissible banner | Helps spot wrong writes; needs reliable live refresh | [SECURITY] | NOT APPROVED YET |
| 8 | Costs | Stay inside free limits; nothing paid | Limits verified from official pages (section 6): the shared AI Studio quota is the tightest. An upgrade path exists but none is authorised; no Cloud Functions, no TTL | [COST] | NOT APPROVED YET |
| 9 | Rules publish | Additive rules first, only after tests pass and the current live rules are saved | Rules govern live data; a mistake could lock the owner out | [SECURITY] [PRIVACY] | NOT APPROVED YET |

### Implementation order (nothing is built)
1. India-local dates and DST-safe day dates verified in a real browser (HANDOFF.md lists these as unfinished); target resolution depends on them.
2. Extend the rules tests (audit, write-mode, and profile cases if weigh-ins are approved) and get them passing.
3. Build the entry form, transaction and audit write behind Viewer mode; unit tests.
4. Publishing rules is a separate manual step and needs its own explicit owner approval, with a saved copy of the live rules first.
5. Two-browser live test only with an approved test identity and cleanup.

Until each step is done and tested, the audit protections are not active and must not be described as active.
