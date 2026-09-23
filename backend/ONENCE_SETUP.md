# Bulk Tracker Setup — secure configuration

The existing Command Centre page is `/platform#bulk-tracker-setup`. Only a super-admin can access its APIs or saved batches.

## Environment variables

Add the following **only to `/app/backend/.env`** (or the backend process's secure environment). Empty slots are provided in the preview environment:

```dotenv
ONENCE_CLIENT_ID=<1NCE API user client ID>
ONENCE_CLIENT_SECRET=<1NCE API user client secret>
ONENCE_API_URL=https://api.1nce.com/management-api
```

Never add these to `frontend/.env`, any `REACT_APP_*` variable, source code, or MongoDB. Restart the backend process after securely changing its environment. No credentials are currently configured. The page displays **1NCE integration not configured**, disables activation/retry, and the backend rejects both actions with HTTP 503 without contacting 1NCE. There is no runtime mock provider.

## CSV

UTF-8, maximum 200 rows / 512 KB. Headers must be exactly these five columns (any order); tenant/franchise columns are rejected:

```csv
registration,tracker_id,sim_iccid,sim_msisdn,tracker_model
```

The selected existing franchise is authoritative. Vehicle registrations are matched case-insensitively, ignoring spaces/hyphens, within that franchise. Tracker IDs, ICCIDs and MSISDNs remain strings. The existing tracker ID field is `imei`; the existing MSISDN field is `sim_number`. Only `sim_iccid`, `tracker_model`, and `provisioning_batch_id` are added to existing tracker records. No SIM inventory model is introduced.

The template download now includes up to 200 sorted vehicle registrations when a franchise is selected, leaving hardware fields blank. Remove unused rows and complete every remaining field. Without a selected franchise, it remains header-only. A separate example-only download contains non-provisionable placeholders; replace them before upload. The on-page CSV guide lists every required column. In Excel, use **Text** for tracker IDs, ICCIDs and MSISDNs before entering values to avoid number rounding or lost leading zeros, then save as CSV UTF-8. CSV itself does not retain spreadsheet fonts or column widths; presentation improvements are in the review screen and column guide.

## Persistence and retries

- `tracker_setup_batches`: reviewed rows, per-row activation results, ordered SMS attempt/results, delivered count, user IDs/timestamps, and restart-safe worker leases.
- `tracker_setup_claims`: unique resource reservations shared with existing tracker write routes; not a separate inventory. Claims are made only upon confirmation, not during CSV review.
- Re-uploading the same normalized CSV for the same franchise returns the same batch. Atomic start/row leases and stable tracker IDs prevent repeated activation/record creation on double-click or refresh.
- SIM status is read from `GET /v1/sims/{iccid}` (Enabled/Disabled). `/status` reports network connectivity and is not used for activation. PUT enables only a Disabled SIM, then GET must confirm Enabled.
- Four separate SMS POSTs use source address `1234`, in the requested order. HTTP 201 is only acceptance. Only an explicit `DELIVERED` record increases the counter. Tracker records are created after confirmed SIM activation and become GPS-active only after 4/4 delivery.
- Pending SMS are polled, never duplicated. “Retry failed” rechecks known provider IDs and resends only terminal failures; previously delivered messages are immutable. Unsent remaining commands continue in sequence.
- A timeout, process interruption, or missing Location header is an uncertain send. Retry first searches 1NCE SMS records by ICCID, payload, source, MT type and submit-time window. Zero/ambiguous matches stay Failed with an explanation; no automatic resend. This is intentionally conservative because 1NCE does not document a send idempotency key. Operator confirmation may be required outside this minimal tool.
- API results are allowlisted (status codes, IDs, timestamps, delivery status); OAuth tokens and raw error bodies are never persisted or returned. Tenant APIs remain scoped to their own tracker/vehicle records; bulk provisioning history is super-admin-only.

## Verification limitation

Automated tests may substitute the provider in isolated test databases. No simulated activation or delivery results are shown as real results in the running app. Live activation/SMS delivery needs the actual 1NCE credentials and a designated test SIM/device; it has not been verified without them.

Official v1 references: https://help.1nce.com/api/authorization/post-access-token-post/ ; https://help.1nce.com/api/sim-management/get-sim-using-get/ ; https://help.1nce.com/api/sim-management/update-sim-using-put/ ; https://help.1nce.com/api/sim-management/send-sms-to-sim-using-post/ ; https://help.1nce.com/api/sim-management/get-sms-of-sim-using-get/