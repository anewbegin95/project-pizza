# Rollback and Recovery

## Purpose

This runbook defines how to recover quickly if a merge to `main` causes a production issue.

## Detection

Production regressions are detected by `Main Deployment Gate` via:

- Pre-deploy checks (build + smoke/E2E)
- Post-merge health checks against:
  - `/`
  - `/pop-ups.html`
  - `/contact_us.html`

## Immediate response

1. Confirm failing check in GitHub Actions.
2. Identify the culprit commit SHA from `main` history.
3. Trigger `Rollback Main` workflow with that SHA.
4. Verify rollback commit lands on `main`.
5. Confirm health checks pass.

## Automated rollback workflow

Workflow: `.github/workflows/rollback-main.yml`

- Trigger: manual (`workflow_dispatch`)
- Input: `commit_sha`
- Behavior:
  - Reverts normal commits with `git revert --no-edit`
  - Reverts merge commits with `git revert -m 1 --no-edit`
  - Pushes revert commit to `main`

## Recovery validation

After rollback:

1. Ensure `Main Deployment Gate` is green.
2. Confirm public site pages return HTTP 200.
3. Spot-check homepage content and key navigation.

## Follow-up

- Open incident issue with root cause and timeline.
- Create fix PR targeting `staging` first.
- Merge to `main` only after staging checks are green.

---

## Analytics kill switch

Covers GA4 property `G-JYLM80LHT2` and the three ungated files that feed it
(`resources/js/consent.js`, `analytics.js`, `analytics-events.js`). Event and
parameter reference: [`analytics-events.md`](analytics-events.md).

**Current state (2026-09-14): only lever 1 exists.** `main` is 127 commits
behind `staging`, so production carries no analytics code at all — there is
nothing in production for lever 2 to revert. This section becomes fully
operative at the `staging` → `main` release.

### Lever 1 — stop collection without a deploy

GA4 has **no pause button**. The property-level lever is to delete the web data
stream:

1. GA4 → **Admin** → **Data streams** → the web stream for `G-JYLM80LHT2`.
2. Delete the stream.

Hits for that measurement ID stop being processed immediately. What this does
**not** do: it does not remove data already collected (see lever 3), and it
does not stop the browser sending — visitors who already consented keep firing
requests into a void until they reload a fixed deploy.

**It is a one-way door for the measurement ID.** A recreated stream gets a
**new** ID, so resuming collection afterwards needs a code change and a deploy
in `analytics.js` (`MEASUREMENT_ID`, and the `ga-disable-<id>` key derived from
it). Use this when collection must stop *now* and the cost of a new ID is
acceptable.

### Lever 2 — stop collection with a deploy

Revert the activation commit on `main`:

1. Identify the SHA of the release (or the specific analytics commit) on `main`.
2. Trigger **Rollback Main** (`.github/workflows/rollback-main.yml`,
   `workflow_dispatch`) with that `commit_sha`.
3. Confirm the revert lands and `Main Deployment Gate` is green.
4. Verify on the live site: load any page, accept consent, and confirm no
   request goes to `googletagmanager.com` or `google-analytics.com`.

Slower than lever 1 but fully reversible, and it stops the *sending* rather
than the *processing*. Prefer it whenever the situation tolerates a deploy
cycle.

### Lever 3 — PII found in an event parameter

Order matters; deletion is slow, so stop the inflow first.

1. **Stop collection** — lever 1 if the exposure is ongoing and serious, lever 2
   otherwise.
2. **Request deletion from Google:** GA4 → **Admin** → **Data deletion
   requests** → new request, scoped to the offending parameter (or the whole
   date range if scoping is uncertain). There is a **7-day grace period** during
   which the request can be cancelled, and execution takes up to ~63 days.
   Deletion is not instant and cannot be made instant — which is the argument
   for the PII rules in `analytics-events.md` §4 being preventive.
3. **Fix the parameter** on a branch off `staging`, with a unit test that fails
   on the old behaviour. The rules it must satisfy: no free text a visitor
   typed, no raw paths, no query strings, `entry_id` is a Sanity document id
   only.
4. **Redeploy** through `staging` → `main` as normal.
5. **Re-verify** in GA4 Realtime that the parameter now carries only permitted
   values.

### Who to notify

| Role | Who | When |
|---|---|---|
| Repo / technical owner | Alex (`anewbegin95`) | Any lever pulled |
| Content owner | Runs the site's content and is the consumer of every report | Any lever pulled — reports stop or develop a gap |
| Visitors | via `NYCSliceofLife@gmail.com`, the address in `privacy_policy.html` | Only if PII was collected and the exposure is material |

Whoever pulls a lever opens an incident issue the same day, recording which
lever, why, the time window affected, and whether a deletion request was filed.
Any gap or seam in the data has to be explainable later — GA4 does not annotate
itself.
