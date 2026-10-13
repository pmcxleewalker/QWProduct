# QuickWing subscription redesign — read-only audit and proposed implementation

Date: 2026-10-10
Status: **AWAITING IMPLEMENTATION APPROVAL — NO APPLICATION CHANGES**

## User requirements and decision

Introduce QuickWing Standard (€6.50/vehicle/month), Essential (€8.50/vehicle/month) and Professional (€12.50/vehicle/month). Essential should be the visually prominent, recommended best-value plan. Standard keeps all existing non-GPS operational functionality. Essential adds existing GPS capabilities and optional Radius/DCI fuel-card access for eligible customers. Hardware/installation arrangements must be separate from subscription pricing. Professional adds genuinely useful advanced reporting, without advertising unfinished work as live.

Preserve existing customers, stored prices, limits, feature overrides, bookings, vehicles and GPS assignments/configuration. No automatic migration, charge increase or billing-integration changes. Audit first, present a plan, then wait for approval.

**User decision:** Professional is **“Coming soon — register interest.”** This approves its intended presentation only, NOT implementation of the redesign or analytics.

## Audit boundaries and verification

- Inspected current React/FastAPI source, feature registry, tenant models, report services, GPS/behaviour services, invoice handling and marketing surfaces.
- Read only the currently configured **local preview MongoDB**, using collection counts, aggregate configuration distributions and field presence. No names, emails, coordinates or identifiers were included in audit output.
- The preview database is not evidence of actual production customer agreements, payment-provider state, fuel-card terms or real-device reliability.
- Verified `GET /api/platform/plans` on the environment's preview URL: HTTP200, returning the old flat-priced catalogue.
- Did NOT import `server.py`, run seed/migration scripts, log in/create users, submit contact forms, change a tenant, enable/disable GPS, send provider commands, alter env values or modify application source.
- No feature implementation or regression suite was run. Some nominal GET routes have writes: notably fuel analytics lazily seeds missing document templates, so it was deliberately NOT called.

## 1. Current subscriptions and customer-impact risks

| Surface | Current implementation | Consequence |
|---|---|---|
| Public landing | Fleet Software €6.50; Fleet Software + Live GPS €8.50 per vehicle/month | Matches two proposed price points, but names/features aren't linked to internal catalogue |
| Internal catalogue | Standard €179/month,10 vehicles/15 users; Essential €299/month,25/35; Professional €499/month,50/50; Custom with tenant-specific terms | Cannot safely replace these defaults globally |
| Tenant agreements | `plan`, stored `monthly_price`, `max_vehicles`, `max_users`, `feature_overrides`; creation defaults to Custom | Agreed terms and feature access must be protected independently from new marketing prices |
| Plan mutation | Super-admin `/platform/tenants/{id}/plan` immediately resets vehicle/user limits and customization allowance; no preview/effective-date/request workflow | Not safe to reuse unchanged for customer upgrades/downgrades |
| GPS | Separate `gps_available`, `gps_requested`, `gps_enabled`, tracker assignments/settings, independent from subscription enum | Renaming a plan must not activate, disable or reassign hardware |
| Invoices | Manual invoice items/quantities/unit prices, status changes, VAT and PDF generation | Keep unchanged; don't silently turn the new catalogue into a charging system |
| Payments | Stripe dependency is installed, but no active Stripe/other checkout, subscription or webhook implementation found in app source | Dependency alone is not an integration. External/manual production arrangements remain unverified |
| Other copy | Admin upsells still contain €279/€399; platform cards use old flat prices; Wingman prompt explicitly rejects per-vehicle pricing | Audit and update all commercial copy through one new catalogue, while keeping legacy agreement displays accurate |

Source references:
- `backend/models/tenant.py:18-23,29-357,372-440`: plan enum, registry, flat prices, limits and tenant fields.
- `backend/server.py:726-747`: public plan catalogue, verified by GET.
- `backend/server.py:794-878,974-1025,1046-1078,1351-1503`: overrides, plan-change behavior, stored agreement price and plan displays.
- `backend/models/invoice.py`; `backend/server.py:4139-4251`: manual invoice mechanics.
- `frontend/src/pages/PlatformAdmin.js:3117-3750`; `Admin.js:3271-3288`; `backend/server.py:12313-12333`: old commercial copy.

### Feature permission mismatch

The registry labels recurring bookings, live status, lift requests and vehicle blocking as higher-tier features, and user management as Professional. However, existing non-GPS marketing and operational screens provide a broader baseline; many corresponding backend routes are role/tenant guarded without plan-feature checks.

Reporting/behaviour/GPS reads commonly validate the tenant/role but not a centrally resolved plan entitlement. Frontend gating, backend access and registry metadata do not form one consistent commercial policy.

**Recommendation:** explicitly inventory and preserve the existing non-GPS baseline. Use one capability resolver for new versioned plans and grandfathered entitlements, but do not retroactively paywall existing Standard endpoints or remove paid/overridden legacy capabilities. Staff role restrictions and tenant isolation remain separate from commercial entitlements.

References: `middleware/tenant.py:156-199`, `server.py:1455-1503,2056-2182,2313-2379,5149-5345,7254-7443,8148-8285`; frontend `TenantDashboard.js` and `Admin.js` conditional `planData.features` blocks.

## 2. What is already implemented

“Implemented” below means code paths exist and were inspected; this audit does NOT certify production availability for every tenant.

### Standard operational baseline to retain

- Vehicle bookings/calendars, allocation, recurrence and booking administration where currently supported.
- Fleet availability/status, staff accounts and staff mobile workflows, booking history, compliance/reminders, incidents and existing administration.
- Booking Intelligence conflict/compliance checks and suggested alternative slots/vehicles. This is deterministic logic over real bookings, not an LLM or predictive forecasting engine (`BookingIntelligence.js:17-37,103-205`). Keep it; don't misdescribe its technology or results.
- Existing operational reports and exports, including any previously granted custom features. Do not make an existing export or report Professional-only simply because its title sounds advanced.

### Existing reporting/GPS capabilities

| Capability | Evidence and limitations |
|---|---|
| Fleet/booking summaries | Tenant-scoped counts, most-booked vehicles, monthly comparison and seven-day booking creation trend; `server.py:5149-5271` |
| Vehicle booked hours | Per-vehicle booking counts and summed scheduled duration; `server.py:5274-5345`. Not measured driving time; current handling requires overlap/status/window corrections for advanced use |
| Fleet reports | Date filtering, top booked vehicles, current availability and location summaries; `server.py:7254-7384`, `FleetReportsSection.js` |
| Hourly timeline | Date and vehicle filters, overlapping scheduled bookings by hour; `server.py:8148-8285`, mounted `DailyTimelineChart.js` |
| CSV/PDF | Tenant summary CSV/PDF, fleet CSV, booking CSV, timeline CSV, incident exports and compliance PDF pack already exist. Platform executive/invoice PDFs are platform-only, not a tenant Professional suite |
| Incidents | Incident records, admin workflow, summary/filter/export routes; `server.py:6103-6680`, `IncidentReportsSection.js` |
| GPS map/locations/history | Latest positions, history and grouped journey playback with point speed, sample average/max speed and duration; `server.py:2056-2109`, `gps_history_service.py:55-135` |
| GPS event review | Speeding, harsh-braking/acceleration and disconnection flags; vehicle/staff/date/type filters and summaries; `driver_behaviour_service.py`, `server.py:2313-2379`, mounted `Behaviour.js`. Review flags, NOT validated driver safety scores |
| Fuel data | Fuel-log submission aggregation API exists (`server.py:13126-13227`). Its widget is not mounted anywhere in current UI. Not a live fuel-card integration |
| Cost displays | Existing rate-based estimates and odometer-based calculations. Standalone CostAnalyticsDashboard is imported but not rendered. Not measured fuel/maintenance expenditure |

## 3. Professional feature audit and feasibility

| Proposed Professional capability | Status | Realistic next work |
|---|---|---|
| Advanced performance dashboards | Partial foundation | New cross-source KPI dashboard with defined denominators, filters and coverage, no synthetic scores |
| Vehicle/staff/date custom reporting | Partial filters in separate views | Unified scoped report builder with explicit date semantics and staff-assignment coverage |
| Vehicle utilisation | Partial | Scheduled booked-hours/available-hours and daily vehicle utilisation with overlap union, cancellations excluded and correct period clipping |
| Idle-time analysis | Not reliable as measured engine idling | Can report unbooked capacity. True engine-idling needs reliable ignition and stationary history not currently retained |
| Detailed booking trends | Partial | Accurate day/hour/date-range groupings and comparable periods; remove random peak-period values |
| Booking/scheduling efficiency | Partial counts only | Reservation-based metrics possible; on-time collection/return and real trip efficiency need actual timestamps and reliable attribution |
| Capacity and demand | Partial scheduled capacity | Report observed booked capacity and peaks; unmet demand needs persisted rejected/conflicting requests. No invented forecasts |
| Historical comparisons | Basic month comparison exists | Configurable like-for-like periods, coverage and timezone handling; don't promise history not retained |
| Driver behaviour analytics | Existing event feed/summaries | Retain existing GPS event review in Essential. New analytical trends need deduplication/time-aware definitions and honest driver attribution, not unsupported risk scores |
| Fleet operational KPIs | Basic metrics exist | Curated, traceable advanced KPIs combining supported records |
| CSV and Excel | CSV exists; no XLSX reporting export found | Preserve existing CSV; build real XLSX for new reports. Excel vehicle import does not count as report export |
| Downloadable management reports | Existing PDFs exist | New advanced management pack using audited metrics; preserve existing Standard/export rights |
| Consolidated performance summaries | Basic summary exists | New report combining validated booking, availability, compliance, incidents and optional GPS/fuel coverage |
| Cost-reduction insights | Limited input data | Identify observable underused capacity, conflicts and recorded fuel spend; keep rate scenarios labelled estimates; never claim measured savings without evidence |

### Data-quality blockers before marketing Professional as live

1. **MOCKED metric:** `TenantDashboard.js:2670` uses `Math.random()` for Peak Booking Hours. Must be replaced by real aggregation or an honest no-data state after approval.
2. **Unsupported forecast:** `Admin.js:3233-3241` multiplies bookings by1.15 and says “Growth trend detected.” Not a data-derived forecast. Remove/relabel or replace, not advertise.
3. **Misleading utilisation semantics:** existing summary is vehicles with any booking created this month / fleet size, not percentage of operating hours. Fleet availability counts ≥8 bookings as “fully booked,” not8 booked hours (`server.py:7317-7354`). Advanced reporting must not reuse these formulas under stronger claims.
4. **Incomplete interval/status logic:** some reports include all statuses, use booking creation dates rather than usage dates, sum overlapping durations and cap fetched records at10k/100k. Correct definitions, bounded database aggregation and tests are required.
5. **Idle telemetry gap:** poller infers ignition from speed/voltage and retains only moving fixes plus one transitional stop (`gps_poller.py:127-172`). It cannot reconstruct measured engine-idling durations from missing stationary samples.
6. **Driver attribution:** events link to overlapping bookings and fall back to booking creator. Do not treat a booking author as a verified driver; expose unassigned/coverage and validate attribution.
7. **Cost estimates:** existing inline dashboard sums lifetime odometers and multiplies configured rates (`TenantDashboard.js:653-677`). These are not actual period costs. Fuel-log amounts are entered amounts, not verified provider transactions.
8. **Demo separation:** demo tracker data shares telemetry/event collections. Professional analytics must identify/exclude or clearly label simulation through tenant/device lineage, not presume all points are real.

## 4. Preview data coverage (not production customer statistics)

Read-only snapshot: 73 tenants,26 vehicles,177 bookings,120 memberships,10 tracker devices,50,541 history points,6,260 behaviour events,65 status updates,4 document submissions,0 incident rows,0 invoice rows. Counts can change through existing background activity.

- All73 tenants have stored monthly_price, limits and feature_overrides; none have pricing_version, subscription_id or stripe_customer_id fields populated.
- Plans comprise16 Standard,8 Professional,49 Custom; no Essential tenants in this preview. This is NOT proof of production adoption or payment status.
- All10 trackers are marked demo. **SIMULATED GPS preview data is not real-hardware verification.** Existing real SinoTrack adapter code remains, but a production/device check is required before relying on telemetry quality claims.
- All177 bookings have scheduled times/creator IDs; only2 have assigned_to_user_id. No actual collection/return timestamps observed.
- History includes speed and inferred ignition but no per-point mileage or is_demo marker. Device lineage is needed to separate demo records.
- Only6 behaviour records have a staff_id and7 have a booking_id. Driver analytics cannot silently invent attribution.
- Eight vehicles have mileage/compliance/location fields populated. Missing data needs explicit coverage/no-data states, not zero-as-measured assumptions.

## 5. Proposed implementation — subject to approval

### Phase A — Three-plan presentation and truthful commercial catalogue

1. Add a **new versioned per-vehicle catalogue** with the three user-specified names/prices. Leave the existing flat/custom agreements and old catalogue interpretation intact.
2. Desktop: Standard / Essential / Professional side by side. Essential in the centre with the restrained warm highlighted border, strongest CTA, **Recommended + Best Value**. Mobile: stacked cards inside the existing collapsed Pricing section; expandable grouped comparison to avoid another excessively long page.
3. Standard comparison includes the full existing non-GPS baseline, staff/mobile/booking intelligence and existing reports/exports. Essential makes the additional **€2/vehicle/month** clear, with existing GPS capabilities and optional eligible fuel-card benefit. No made-up financial savings.
4. Professional shows€12.50/vehicle/month, **Coming soon**, clearly labelled planned additions, and **Register interest**, never an active paid upgrade or implied live analytics.
5. Reuse the existing contact/enquiry service for plan-specific leads and Professional interest; no new payment processor or partner API. Existing contact delivery behavior must remain.
6. Update landing/pricing comparison, admin plan displays, upgrade copy, ROI plan names and training/chatbot pricing guidance consistently. Existing customer account displays retain their own agreement/price, including legacy Professional and Custom.
7. Hardware copy states compatible GPS hardware and activation are required; installation/hardware arrangements and any separate charges confirmed before activation. No invented hardware price or free-installation promise.
8. Fuel copy: optional Radius/DCI access for eligible customers; availability, discounts and approval subject to partner terms. No guaranteed discount, compulsory signup or automatic sharing with the partner.

**Popularity safeguard:** the static old `is_popular` flag and preview tenant distribution are not evidence of new Essential uptake. Use Recommended/Best Value at launch; add “Most Popular” only when supported by actual adoption data. Flagged deviation from requested badge in order to honor the no-misleading-claims requirement.

### Phase B — Safe plan controls and grandfathering

1. Missing pricing version resolves to the legacy agreement; no bulk database rewrite/migration and no startup seeding. New/explicitly approved agreements use the new catalogue.
2. Preserve stored monthly_price, capacity limits, existing permissions/overrides, Custom terms, GPS flags and hardware assignments for every current customer. Keep old Professional customers distinct from the new coming-soon Professional offer.
3. Add a centralized capability resolver and backend enforcement for new plan-specific capabilities, used by frontend and APIs. Keep tenant/role controls separate, and preserve the audited old operational baseline. GPS plan inclusion does not itself imply hardware activation.
4. Add a simple tenant plan-change request with before/after capabilities, quoted terms and owner approval/effective date. No instant charging, provider checkout, proration or automatic paid upgrade. Do not reuse the current reset-limits endpoint unchanged.
5. Downgrades must preserve records, historical exports and tracker configuration. Any loss of future GPS/report access is disclosed and explicitly approved; never delete history or send SIM/device deactivation commands as a side effect.
6. Do not set new vehicle/user caps silently from legacy10/25/50 tiers. Keep existing capacities; new agreement capacity and billable vehicle definition need explicit commercial rules.
7. Run tenant-isolation and Standard baseline regression tests, grandfathering/override tests, no-charge tests, downgrade/history preservation tests and mobile comparison/enquiry tests.

### Phase C — Separate Professional development milestone (not part of first launch)

Priority1: remove random/fixed-growth reporting output; establish canonical metric definitions/date handling; real booking utilisation and peak/time trends; vehicle/staff/date filters with missing-data coverage.

Priority2: consolidated operational summary, existing-data comparisons, real XLSX and advanced PDF/CSV exports, GPS event trends with valid attribution and demo exclusion, recorded fuel-log summaries where present.

Deferred until data exists: measured engine idling, on-time departure/return metrics, true unmet-demand/forecasting, actual monetary savings and validated driver risk scoring.

Keep Professional coming soon throughout. Activation/public “live” claims require a separately reviewed working feature list and completed tests.

## 6. Customer/billing safeguards and decisions to confirm

- Existing agreements are not re-priced, renamed into different entitlements or stripped of capabilities. No production DB migration or billing integration changes.
- Confirm VAT presentation before publishing a tax-inclusive/exclusive statement. Existing invoice code defaults to23%, but that does not establish whether these newly advertised prices include VAT.
- Confirm billable vehicle definition, new-plan capacity policy, change effective dates and proration rules before automatic charging; such charging is outside proposed phasesA/B.
- Obtain approved hardware/installation wording and Radius/DCI eligibility/referral process before any specific promise or external handoff. Until then, quote/interest flow only.
- Actual production contract/provider configuration must be confirmed read-only before any release affecting entitlements. Preview data alone cannot authorize a migration or enforce new restrictions.
- Unfinished Professional features and existing synthetic metrics are not promoted as live. Existing fabricated metrics are recorded for approved correction, not silently changed during this audit.

## Approval gate

Recommended next authorization: **Phases A+B, with legacy customer/billing protection and Professional as coming soon.** PhaseC analytics development and any billing/provider change remain separately approved work.

No approval has yet been received for application implementation. Stop here and present this proposal to the user.