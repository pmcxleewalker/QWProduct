# Quick Wing Fleet Management - Multi-Tenant SaaS Platform

## Product Overview
Quick Wing is a comprehensive fleet management SaaS platform designed for multi-franchise operations. Each franchise (tenant) operates in complete data isolation while being managed from a central platform.

## Recent Changes (April 2026)

### New Features - April 10, 2026
**All Bookings List Report:**
- Added new "All Bookings List" section in Fleet Reports with:
  - Custom date range selector (defaults to last 30 days)
  - CSV export functionality with all booking details
  - Full table view with User, Vehicle, Start Time, End Time, Status, Route
  - Badge showing total booking count
  
**Collapsible Report Sections:**
- All report sections now have a collapsible feature with chevron icon in top right
- Sections include: Summary Statistics, All Bookings List, Most Booked Cars, Daily Availability Report, Compliance Report, By Location Summary
- Click header to toggle section open/closed
- State persists while on the page

### Bug Fixes - April 10, 2026
**QR Code Fix:**
- Fixed `VehicleQRCode.js` component to accept `tenantSlug` as a prop instead of using `useParams()`
- This fix ensures the QR code URL is correctly generated even when the user is on routes without the tenant slug in the URL (e.g., `/dashboard`)
- Updated `TenantDashboard.js` to pass `activeTenant?.tenant_slug` to the VehicleQRCode component
- QR codes now correctly encode URLs like: `{baseUrl}/{tenant_slug}/vehicle/{vehicle_id}/mileage`
- **Admin Panel QR Fix**: Fixed QR download in Admin Panel > Fleet Vehicles. The download function now uses axios with proper Authorization headers and blob response type, instead of trying to download directly via a link (which didn't send auth headers)
- **Critical: QR codes scanning to wrong franchise fix**: When platform admins (super_admin) navigated to a tenant route without direct membership, they weren't getting a tenant-scoped token. This caused QR codes to generate with the wrong/missing tenant slug. Fixed by auto-selecting tenant by slug lookup when platform admins navigate to a franchise route.

**Booking Conflict Detection Fix:**
- **Critical bug fixed**: The booking system was NOT checking if a vehicle was already booked for a time period. This allowed double-booking of vehicles by different users.
- Added vehicle conflict check in `POST /api/bookings` endpoint that rejects bookings when the vehicle is already booked
- Added vehicle conflict check in `PUT /api/bookings/{id}` endpoint for booking updates
- Changed status exclusion from `"rejected"` to `["rejected", "cancelled"]` for accurate availability
- Clear error messages: "Vehicle is already booked at this time by {user} (starts: {time})"

**Smart Car Recommendations on Conflict:**
- Added new endpoint `GET /api/bookings/check-availability` that returns conflict info AND available alternatives
- When user selects a car/time that conflicts, the system now recommends available cars
- Frontend shows clickable green buttons for each available car (e.g., "Van 2 (STD-002)")
- Clicking a recommended car auto-selects it in the form
- Also shows "No other cars available" message if all cars are booked at that time

**"+ Book" Button Redirect:**
- Modified `CarBookingCalendar.js` to support a `redirectToBookings` prop
- When `redirectToBookings={true}`, clicking the "+ Book" button navigates to the main bookings page instead of opening an inline modal
- The navigation uses the correct tenant-prefixed route: `/{tenant_slug}/bookings`
- State is passed with `selectedCarId` for potential pre-selection functionality
- Updated `TenantDashboard.js` Fleet > Car Calendars section to use `redirectToBookings={true}`

### Feature Updates - April 7, 2026
**Removed:**
- Maps features removed entirely
- Map tab removed from admin panel
- Updates/Deployment notes tab removed from navigation
- FleetMap.js component deleted

**Booking Enhancements:**
- **Recurring booking approval**: Bookings exceeding 4 straight weeks now require admin approval
- **Double-up call feature**: Can add a secondary user to a booking
  - Secondary user's booking also populates their calendar
  - System checks for conflicts to avoid double-booking same car/time
- New API endpoints: `/api/bookings/pending-approval`, `/api/bookings/{id}/approve`, `/api/bookings/{id}/reject`

**Fleet Reports & Analytics:**
- Fixed authentication headers for report fetching
- Reports section fully functional with date filtering and CSV export

### Compliance Warning System - COMPLETED ✅ (April 7, 2026)
- **Dashboard Compliance Alerts**: New `ComplianceAlerts` component on Overview tab
  - Shows critical/warning/upcoming issues for Tax, NCT, and Service Due
  - Color-coded severity (red=critical, amber=warning, green=compliant)
  - Settings gear icon to configure reminder thresholds
- **Custom Reminder Settings**: 
  - Tax warning: configurable days before due (default 60/2 months)
  - NCT warning: configurable days before due (default 60/2 months)
  - Service warning: configurable km before due (default 10km)
  - Each alert type can be enabled/disabled individually
  - Settings saved per-tenant
- **Manage Vehicles Tab**: Added "Reminders" button to access compliance settings
- **Fleet Reports**: New "Compliance Report" section showing:
  - Tax/NCT/Service status summary
  - List of vehicles with issues
  - Settings note showing current thresholds
- **API Endpoints**:
  - `GET /api/tenant/settings` - includes compliance settings
  - `PUT /api/tenant/settings/compliance` - update compliance thresholds

### Staff Mobile View - REDESIGNED ✅ (April 7-8, 2026)
- **Visual Redesign** matching user-provided reference images:
  - Clean white/light gray background (#F8F9FA)
  - Vibrant blue accent (#007BFF) for buttons and active states
  - Green indicators (#22C55E) for available status
  - Amber/yellow highlights (#FCD34D) for selected items
  - 2-column vehicle grid with card shadows
  - Toggle-style status indicators
- **Simplified 3-Tab Interface** for staff/driver users on mobile:
  1. **Home** - Dashboard with stats cards (Available/In Use), Live Fleet Status with 2-column vehicle grid
  2. **Bookings** - Car selection chips, date navigator, time slots grid, New Booking form
  3. **Lift** - Request a Lift form with all fields pre-validated
- **Technical Fixes**:
  - Fixed initial render timing: now checks both localStorage flag AND activeTenant.role
  - Screen properly fits mobile viewport (100dvh with fixed positioning)
  - Refresh persists correctly via localStorage 'qw_staff_mobile_user' flag
  - Bottom navigation is static and fixed to screen
  - Body scroll is locked for proper app-like behavior
- **Test User**: teststaff@standard-fleet.com / teststaff123

### Fleet Map & Journey Tracking - COMPLETED ✅ (April 2026)
- **Journey Map Tab**: New sub-tab under Fleet for Essential and Professional tiers
- **Mandatory Journey Fields**: Bookings now require start_eircode and end_eircode
- **Optional Stops**: Support for journey stops along the route
- **Interactive Map**: Uses react-leaflet with OpenStreetMap tiles
- **Color-Coded Routes**: Each vehicle's journeys shown in distinct colors
- **Eircode Geocoding**: MOCKED - Uses hardcoded Dublin area coordinate mapping (D01-D24, Cork T12/T23/T45, Galway H91)
- **Tier-Gated**: Only available for Essential and Professional tiers via show_map/map_booking_pins features

### All Cars Calendar Enhancement - COMPLETED ✅ (April 2026)
- **Standardized Color Scheme**: Red=Booked, Purple=Recurring, Amber=Pending (matches app-wide standard)
- **Month Statistics Header**: Shows total bookings, confirmed, pending, recurring counts
- **Vehicle Filter Dropdown**: Filter calendar by specific vehicle
- **Improved Modal**: Booking details use correct colors for booking types
- **Better Organization**: Clearer visual hierarchy with gradient header

### Public QR Code Mileage Submission - VERIFIED ✅ (April 7-8, 2026)
- **No login required** - Anyone can scan QR and submit mileage
- **QR Code Generation**: 
  - Endpoint: `GET /api/vehicles/{vehicle_id}/qr` returns PNG image
  - QR encodes URL: `{baseUrl}/{tenant_slug}/vehicle/{vehicle_id}/mileage`
  - Download and Print functionality in Admin UI
- **Public Mileage Page** (`/{tenant}/vehicle/{id}/mileage`):
  - Vehicle name, registration, organisation displayed
  - Last recorded mileage shown
  - Optional "Your Name" field for accountability
  - Optional "Notes" field for reporting issues
  - Shows calculated difference from last reading
  - Service alerts displayed after submission (warning/urgent/overdue)
- **Public API Endpoints**: 
  - `GET /api/public/vehicle/{tenant_slug}/{vehicle_id}` - Get vehicle info (no auth)
  - `POST /api/public/vehicle/{tenant_slug}/{vehicle_id}/submit-mileage` - Submit mileage (no auth)
- **Service Alert Integration**:
  - Triggers when mileage within 1000km of service_due_mileage (warning)
  - Triggers when mileage within 500km of service_due_mileage (urgent)
  - Triggers when mileage exceeds service_due_mileage (overdue)

### Live Status Updates - COMPLETED ✅ (April 2026)
- Vehicle status now reflects **active bookings in real-time**
- When a booking is active (current time between start/end), vehicle shows "In Use"
- Active booking info displayed (user name, purpose, end time)
- Blocked vehicles always show "Blocked" status
- Status updates immediately without manual intervention

## Recent Changes (March 2026)

### Granular Feature Toggle System - COMPLETED ✅ (March 2026)
- **28 toggleable features** organized into 9 categories
- Feature Registry API: `GET /api/platform/feature-registry`
- Per-tenant feature overrides stored in `feature_overrides` field
- Addon pricing displayed for each sellable feature
- "Not in plan" indicators for features outside base tier
- Full documentation at `/app/docs/FEATURE_TIERS_REFERENCE.md`

### Updated Pricing (March 2026)
| Plan | Price | Vehicles | Users |
|------|-------|----------|-------|
| Standard | €179/mo | 10 | 15 |
| Essential | €299/mo | 25 | 35 |
| Professional | €499/mo | 50 | 50 |

### 3-Tier Subscription Plan System - COMPLETED ✅
- Implemented Standard (€179), Essential (€299), and Professional (€499) plans
- Backend enforcement: API returns 403 when vehicle/user limits are reached
- Frontend: Usage indicators show X/Y vehicles and X/Y users
- Frontend: Add buttons disabled with toast notifications when at limit
- Color-coded usage indicators: green (< 80%), amber (80-99%), red (100%)
- Legacy plan names (`starter`, `basic`, `pro`) mapped to new tiers

### Plan Comparison Page - COMPLETED ✅ (March 16, 2026)
- New "Plans" tab in Command Centre navigation
- Side-by-side comparison of all 3 plans with pricing
- Feature comparison with checkmarks for each plan tier
- "Most Popular" badge on Essential plan

### Feature Gating - COMPLETED ✅ (March 16, 2026)
- Reports tab shows "Limited Reports Available" warning for Standard plan
- Feature availability based on `planData.features` from /api/my-plan endpoint
- UI elements adapt based on tenant's effective features

### Monthly Customization Credits - COMPLETED ✅ (March 16, 2026)
- Customization credits tracking per tenant (Standard: 1, Essential: 2, Professional: 4)
- "Use Credit" and "Reset Credits" buttons in Feature Override Modal
- Credits visible in Manage Franchise section

### Super Admin Feature Overrides - COMPLETED ✅ (March 16, 2026)
- Feature Override Modal accessible from franchise cards in Plans tab
- Plan change buttons (Standard/Essential/Professional)
- Limit overrides: Max Vehicles and Max Users editable fields
- Feature toggles to override plan defaults per tenant
- Save Changes persists overrides to database

## Production Domain
- **URL:** https://quick-wing.com
- Path-based tenant URLs: `https://quick-wing.com/{tenant-slug}/login`

## Test Credentials

### Super Admin (Platform Owner)
- **URL:** https://quick-wing.com/login
- **Email:** superadmin@quickwing.com
- **Password:** Super123
- **Email:** admin.kerry-fleet@quickwing.com
- **Password:** KerryFleet123

---

## Architecture

### Multi-Tenant Model
- **Tenants**: Franchises/companies with isolated data
- **Users**: Global accounts with role-based memberships per tenant
- **Memberships**: Links users to tenants with specific roles

### Role Hierarchy (Simplified - March 2026)
| Role | Scope | Capabilities |
|------|-------|--------------|
| `super_admin` | Platform | Full platform control, create/manage all tenants |
| `master_admin` | Tenant | Franchise owner - pays subscription, manages their tenant |
| `admin` | Tenant | Manage tenant users, vehicles, settings |
| `staff` | Tenant | Book vehicles, view data within tenant |

### Data Isolation
- Every tenant-scoped record includes `tenant_id`
- All queries automatically filtered by tenant context
- Cross-tenant access blocked at application level
- Audit logging for sensitive operations
- Automated tenant isolation tests verify security

## Features

### 1. Platform Administration (Franchise Command Centre)
- **Overview**: Platform-wide statistics (tenants, users, vehicles, bookings)
- **Tenant Management**: Create franchises with auto-generated Master Admin credentials
- **User Management**: Create platform and tenant users
- **Audit Log**: View all security and action events
- **Impersonation**: Support access with full audit trail
- **Suspend/Reactivate**: Control tenant access for non-payment

### 2. Tenant Creation Flow
When creating a new tenant:
1. Super Admin fills in franchise name, slug, and plan
2. Optionally specifies Master Admin email and name
3. System auto-generates:
   - Master Admin user account
   - Secure 12-character password
   - Tenant-specific login URL
4. Credentials displayed in modal for sharing with franchise owner

### 3. Tenant Features (Per Franchise)
- **Dashboard**: Overview, weather, notifications
- **Vehicle Management**: Add/edit/delete fleet vehicles
- **Booking System**: Calendar-based reservations with conflict detection
- **Live Sheet**: Real-time fleet status
- **Reports**: Usage statistics and analytics
- **Team Management**: Add/remove staff members

### 4. Security Features
- JWT-based authentication with tenant context
- Role-based access control (RBAC)
- Tenant suspension for non-payment
- Complete audit trail
- IDOR prevention via TenantQueryBuilder
- Automated tenant isolation tests

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get token
- `POST /api/auth/select-tenant` - Switch active tenant
- `GET /api/auth/me` - Get current user info

### Platform (Super Admin)
- `GET /api/platform/tenants` - List all tenants
- `POST /api/platform/tenants` - Create tenant (returns Master Admin credentials)
- `PUT /api/platform/tenants/{id}` - Update tenant
- `POST /api/platform/tenants/{id}/suspend` - Suspend tenant
- `POST /api/platform/tenants/{id}/reactivate` - Reactivate tenant
- `POST /api/platform/tenants/{id}/impersonate` - Start impersonation
- `POST /api/platform/stop-impersonation` - End impersonation
- `GET /api/platform/stats` - Platform statistics
- `GET /api/platform/audit-log` - Audit events
- `GET /api/platform/settings` - Get company settings
- `PUT /api/platform/settings` - Update company settings

### Invoices & Reports (Super Admin)
- `POST /api/platform/invoices` - Create invoice
- `GET /api/platform/invoices` - List invoices (with filters)
- `GET /api/platform/invoices/{id}` - Get invoice details
- `PUT /api/platform/invoices/{id}` - Update invoice status
- `DELETE /api/platform/invoices/{id}` - Delete draft invoice
- `GET /api/platform/invoices/{id}/pdf` - Download invoice PDF
- `GET /api/platform/reports/executive-summary` - Get executive summary
- `GET /api/platform/reports/executive-summary/pdf` - Download executive summary PDF
- `GET /api/platform/reports/franchises` - Get franchises report
- `GET /api/platform/reports/franchises/pdf` - Download franchises report PDF
- `GET /api/platform/reports/invoices` - Get invoices report
- `GET /api/platform/reports/invoices/pdf` - Download invoices report PDF

### Tenant-Scoped (Requires tenant context)
- `GET /api/vehicles` - List vehicles
- `POST /api/vehicles` - Create vehicle (Admin only)
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `GET /api/tenant/users` - List tenant users
- `POST /api/tenant/users` - Add user to tenant (Admin only)
- `GET /api/tenant/reports/summary` - Get tenant reports summary (Admin only)
- `GET /api/tenant/reports/vehicle-utilization` - Get vehicle utilization report (Admin only)
- `GET /api/tenant/reports/summary/pdf` - Download tenant analytics as PDF (Admin only)
- `GET /api/tenant/reports/summary/csv` - Download tenant analytics as CSV (Admin only)

## Database Schema

### Collections
- `tenants`: id, name, slug, status, plan, max_vehicles, max_users
- `users`: id, email, name, password_hash, is_active
- `memberships`: id, user_id, tenant_id, role
- `vehicles`: id, tenant_id, name, registration, status
- `bookings`: id, tenant_id, car_id, user_name, start_time, end_time
- `audit_events`: id, actor_user_id, tenant_id, action, resource_type
- `invoices`: id, invoice_number, tenant_id, items[], subtotal, tax_rate, tax_amount, total, status, due_date
- `company_settings`: id, company_name, address, tax_id, bank_details, invoice_prefix, currency

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@quickwing.com | Super123 |
| Master Admin (Kerry Care) | admin.kerry-care@quickwing.com | Rer6FQql1zWq |

## Status

### Completed (March 2026)
- [x] Multi-tenant database schema with tenant_id
- [x] Tenant isolation middleware with TenantQueryBuilder
- [x] JWT with tenant context
- [x] Platform Command Centre UI
- [x] Tenant creation with auto-generated Master Admin credentials
- [x] Tenant suspension/reactivation
- [x] Impersonation with audit logging
- [x] Role-based access control (Super Admin, Master Admin, Admin, Staff)
- [x] Tenant selector for multi-membership users
- [x] Security documentation (SECURITY.md)
- [x] Automated tenant isolation tests (pytest)
- [x] Data cleanup script (removed orphaned records)
- [x] Quick Setup Wizard for new Master Admins (onboarding flow)
- [x] Path-based branded tenant URLs (e.g., quick-wing.com/tenant-slug/login)
- [x] **PDF Export for Reports & Invoices** (March 2026)
  - Executive Summary PDF export
  - Franchises Report PDF export  
  - Invoices Report PDF export
  - Individual Invoice PDF export
  - Blue & white color scheme with Quick Wing branding
- [x] **Invoice Management CRUD** (March 2026)
  - Create invoices with line items, tax calculation
  - List invoices with filters (status, tenant)
  - Update invoice status (draft → sent → paid)
  - Summary stats (total, paid, pending)
- [x] **Rebuilt Tenant Dashboard** (March 2026)
  - New TenantDashboard.js with Overview/Vehicles/Bookings/Team tabs
  - Add Vehicle and Add Team Member modals
  - Fixed onboarding redirects for new tenants
- [x] **Reports & Billing Integrated into Command Centre** (March 2026)
  - Moved from separate page to tab in Franchise Command Centre
  - Sub-tabs: Executive Summary, Franchises Report, Invoices, Company Settings
- [x] **User Management Expansion** (March 2026)
  - View user details with all tenant memberships
  - Edit user role per tenant membership
  - Remove user from tenant
  - Add user to new tenant
  - Backend endpoint: POST /platform/users/{user_id}/add-to-tenant
- [x] **Legacy Dashboard Cleanup** (March 2026)
  - Simplified Dashboard.js to redirect to new TenantDashboard
  - Removed 700+ lines of legacy fleet status code
- [x] **Tenant-Specific Reports** (March 2026)
  - New Reports tab in TenantDashboard for admin users only
  - Fleet utilization percentage (vehicles used this month)
  - Bookings this month vs last month with trend percentage
  - Most Used Vehicles ranked list (top 10)
  - Bookings This Week visual bar chart (7-day rolling)
  - Summary Statistics section
  - Backend endpoints: GET /api/tenant/reports/summary, GET /api/tenant/reports/vehicle-utilization
  - Staff users cannot see Reports tab (admin/master_admin only)
  - **CSV/PDF Export** for franchise analytics reports
    - Export CSV: GET /api/tenant/reports/summary/csv
    - Export PDF: GET /api/tenant/reports/summary/pdf
    - Downloadable reports with all metrics, vehicle usage, and daily trends
- [x] **Enhanced Fleet Management Features** (March 2026)
  - **Request a Lift Sticky Button**: Full-width sticky button at bottom for staff on mobile
  - **Live Fleet Status Dashboard**: Real-time vehicle status with 30-second auto-refresh
    - Fleet summary stats (Total Cars, Free, In Use, Blocked)
    - Live indicator showing update frequency
    - Vehicle cards with status and booking capability
  - **Individual Car Calendars** (07:00-22:00)
    - Each vehicle has its own booking calendar
    - Time slots from 07:00 to 22:00 (hourly)
    - Color coding: Green=Free, Purple=Booked, Orange=Recurring
    - Day/Week view toggle
    - Click-to-book functionality
    - Booking modal with Name, Time, Notes, Recurring option
  - **All Cars Monthly Calendar** (Admin only)
    - Monthly calendar view of all bookings across fleet
    - Daily booking counts in corner of each day
    - Click-to-drill-down showing detailed booking list
    - Legend: One-time, Recurring, Pending
  - **New Components**: CarBookingCalendar.js, AllCarsCalendar.js, RequestLiftButton.js
  - **Role-Based Tabs**:
    - Staff: Live Fleet, Car Calendars, My Bookings
    - Admin: Overview, Live Fleet, Car Calendars, All Cars, Vehicles, Team, Reports
- [x] **QR Code Scanning & Mileage Update** (March 2026)
  - **QR Code Generation**: Each vehicle gets a unique QR code (format: QUICKWING:VEHICLE:{id})
  - **Vehicle QR Code Modal**: Download (PNG) and Print functionality
  - **QR Scanner**: Camera-based scanner for status updates
  - **Status Options**: Free, In Use, Needs Cleaning, Needs Repair
  - **Mileage Tracking**: Update current mileage on scan
  - **Location Tracking**: Update vehicle location
  - **Status History**: Full audit trail of all QR scan updates
  - **Real-time Updates**: Live Fleet dashboard refreshes to show updated info
  - **Components**: QRScanner.js, VehicleQRCode.js
  - **Endpoints**: POST /api/vehicles/{id}/scan-update, GET /api/vehicles/{id}/status-history
- [x] **Enhanced Vehicle Cards & Fleet Reports** (March 2026)
  - **Enhanced Vehicle Card Design** (FleetVehicleCard.js):
    - Current Mileage display with odometer icon
    - Service Due At (km) with service alert warnings
    - Tax Due Date, NCT Due Date
    - Base Location
    - Last updated timestamp + user
    - Service Alert Banners: Warning (1000km), Urgent (500km), Overdue (0km)
    - QR, Edit, Delete action buttons
  - **Block for Appointment Feature**:
    - Dropdown options: Service, Cleaning, Other (with icons)
    - Notes field (optional)
    - Blocked vehicles show red styling + "Unblock & Return to Fleet" button
    - Endpoints: POST /api/vehicles/{id}/block, POST /api/vehicles/{id}/unblock
  - **Edit Vehicle Modal** (EditVehicleModal.js):
    - All fields: Name, Registration, Status, Mileage, Service Due, Tax, NCT, Location
  - **Fleet Reports Section** (FleetReportsSection.js):
    - Summary Stats Cards: Total Vehicles, Total Bookings, Pending, Blocked
    - Most Booked Cars (Ranked) - Top 10 list
    - Daily Availability Report with donut chart visualization
    - By Location Summary with utilization %
    - Date filters (From/To)
    - Export CSV functionality
    - Endpoint: GET /api/tenant/fleet-reports, GET /api/tenant/fleet-reports/csv

### Pending (P1)
- [ ] Email notifications for invoices
- [ ] Automated invoice reminders for overdue payments

### Future (P2-P3)
- [ ] Dashboard analytics and charts

## Files Structure
```
/app/backend/
├── server.py              # Main API server (2400+ lines)
├── models/
│   ├── tenant.py          # Tenant, User, Membership models
│   ├── resources.py       # Vehicle, Booking, etc. models
│   └── invoice.py         # Invoice and CompanySettings models
├── middleware/
│   └── tenant.py          # Tenant isolation middleware
├── services/
│   ├── audit.py           # Audit logging service
│   └── pdf_service.py     # PDF generation for reports & invoices
└── tests/
    ├── test_tenant_isolation.py  # Automated isolation tests
    └── test_pdf_export.py        # PDF export tests

/app/frontend/src/
├── contexts/
│   └── AuthContext.js     # Multi-tenant auth context
├── pages/
│   ├── PlatformAdmin.js   # Franchise Command Centre
│   ├── TenantSelector.js  # Tenant selection page
│   ├── SetupWizard.js     # Onboarding wizard for Master Admins
│   ├── Login.js           # Updated login flow with tenant support
│   ├── Dashboard.js       # Main dashboard with wizard redirect
│   └── Reports.js         # Reports & Billing with PDF export
├── components/
│   ├── CarBookingCalendar.js   # Individual car booking calendar (07:00-22:00)
│   ├── AllCarsCalendar.js      # Monthly all-cars calendar with drill-down
│   ├── RequestLiftButton.js    # Sticky bottom button for staff mobile
│   ├── AdminTraining.js        # In-app training guide
│   ├── AnnouncementBanner.js   # Staff view - pending announcements banner
│   ├── AnnouncementsManager.js # Admin view - create/manage announcements
│   ├── DailyTimelineChart.js   # Hourly availability timeline chart
│   ├── FleetVehicleCard.js     # Detailed vehicle card with status
│   ├── NotificationBell.js     # Notification bell with polling & toast alerts
│   └── QRScanner.js            # Camera-based QR code scanner
└── components/ui/         # Shadcn UI components
```

## Testing
- Backend: 19/19 auth and platform tests passed (100%) - Dec 2025
- Backend: 25/25 PDF & Invoice tests passed (100%)
- Backend: 17/17 tenant isolation tests passed (100%)
- Backend: 15/15 fleet management tests passed (100%) - Mar 2026
- Backend: 20/20 fleet reports & block tests passed (100%) - Mar 2026
- Backend: 17/17 announcements & timeline tests passed (100%) - Mar 2026
- Frontend: All UI flows verified
- Tenant isolation: Verified via pytest and manual testing
- Test reports: `/app/test_reports/iteration_13.json`

## Recent Updates (March 2026)

### Staff Announcements Feature
- Create announcements with title, content, and priority (low/normal/high/urgent)
- Require staff acknowledgment before using the app
- Admin view: AnnouncementsManager to create/delete/view acknowledgment counts
- Staff view: AnnouncementBanner with Acknowledge button
- **Notification Bell with Polling**:
  - Bell icon with badge showing unread count
  - Dropdown with pending announcements and quick acknowledge
  - Toast notifications with sound alert for new announcements
  - 30-second polling interval for real-time updates
- Endpoints:
  - `POST /api/messages` - Create announcement
  - `GET /api/announcements` - List all announcements
  - `GET /api/announcements/pending` - Get unacknowledged for current user
  - `GET /api/announcements/unread-count` - Get count of unread
  - `POST /api/messages/{id}/acknowledge` - Acknowledge an announcement
  - `DELETE /api/announcements/{id}` - Delete announcement

### Daily Availability Timeline
- Hourly utilization chart (07:00-22:00)
- Summary cards: Total Fleet, Available, Peak Hour, Avg Utilization
- Date picker to view historical data
- CSV export functionality
- Endpoints:
  - `GET /api/tenant/reports/daily-timeline` - Get hourly availability data
  - `GET /api/tenant/reports/daily-timeline/csv` - Export as CSV

### Dashboard UI Consolidation
- **Main Tabs**: Overview, Fleet, Bookings, Team, Reports, Announcements
- **Fleet Sub-tabs**: Live Status, Car Calendars, All Cars Calendar, Manage Vehicles
- **Reports Sub-tabs**: Analytics, Fleet Reports, Daily Timeline
- Badge on Announcements tab showing unread count for admins
- Staff users see simplified tabs: Live Fleet, Car Calendars, My Bookings

## Scalability Assessment (Dec 2025)
**User Requirement**: 10 franchises, 20-30 cars per franchise, 15 admins + 30 staff per franchise

| Metric | Current Capacity | Required | Status |
|--------|-----------------|----------|--------|
| Tenants | Unlimited | 10 | ✅ Ready |
| Users per tenant | 999 (Enterprise) | 45 | ✅ Ready |
| Vehicles per tenant | 999 (Enterprise) | 30 | ✅ Ready |
| Role-based access | 4 roles | 4 roles | ✅ Ready |
| Data isolation | Full tenant isolation | Required | ✅ Ready |
| PDF exports | Working | Required | ✅ Ready |
| Invoicing | CRUD + PDF | Required | ✅ Ready |

### Plan Limits (Updated March 2026)
The platform now uses a 3-tier subscription model:

| Plan | Price | Max Vehicles | Max Users | Monthly Customizations |
|------|-------|--------------|-----------|----------------------|
| **Quick Wing Standard** | €179/month | 10 | 20 | 1 |
| **Quick Wing Essential** | €279/month | 25 | 35 | 2 |
| **Quick Wing Professional** | €399/month | 50 | 50 | 4 |

#### Feature Availability by Plan
| Feature | Standard | Essential | Professional |
|---------|----------|-----------|--------------|
| Vehicle Booking | ✅ | ✅ | ✅ |
| Fleet Compliance | ✅ | ✅ | ✅ |
| Basic Reports | ✅ | ✅ | ✅ |
| Enhanced Reports | ❌ | ✅ | ✅ |
| Detailed Reports | ❌ | ❌ | ✅ |
| Staff Calendars | ✅ | ✅ | ✅ |
| Admin All Cars Calendar | ✅ | ✅ | ✅ |
| Enhanced Booking Visibility | ❌ | ✅ | ✅ |
| Booking Admin Control | ❌ | ✅ | ✅ |
| Broader Compliance Oversight | ❌ | ✅ | ✅ |
| Multi-Location Support | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |
| Custom Branding | ❌ | ❌ | ✅ |
| Cost Analytics | ❌ | ❌ | ✅ |

**Recommendation**: Use **Essential** plan (most popular) for growing franchises with 15-35 users. Use **Professional** for larger operations requiring cost analytics and custom branding.

---

## Changelog

### March 17, 2026 - Professional Tier Overhaul ✅
**Fixed 6 critical issues reported by user:**

1. **QR Codes** - Verified working. Endpoint `/api/vehicles/{id}/qr` generates valid PNG image with correct URL.

2. **"Manage" Button in Bookings** - Now functional! Opens a booking management modal with:
   - Booking details (User, Vehicle, Date, Status, Purpose, Location)
   - Delete Booking action
   - Approve/Cancel actions for pending/approved bookings

3. **Reports Depth** - Added Cost Analytics section for Professional tier:
   - Customizable mileage rate (€ per km/mile)
   - Fuel cost per km/mile
   - Maintenance cost per km/mile
   - Currency selection (EUR/GBP/USD)
   - Distance unit selection (km/miles)
   - Real-time cost calculations based on fleet mileage

4. **API Access Feature** - Removed from PLAN_CONFIG as it was unimplemented.

5. **Custom Branding** - Implemented for Professional tier:
   - Logo URL upload
   - Brand color picker
   - Settings saved to tenant's database record

6. **Tenant Settings Modal** - New feature for Professional tier:
   - "Settings" button in header
   - Cost Analytics Configuration section
   - Custom Branding section
   - Save/Cancel functionality

**New Endpoints:**
- `GET /api/tenant/settings` - Fetch tenant branding and cost analytics settings
- `PUT /api/tenant/settings` - Update tenant settings (admin only)

**Test Report:** `/app/test_reports/iteration_17.json` - 23/23 tests passed (100%)

### March 17, 2026 - Daily Timeline Vehicle Dropdown ✅
**Added individual vehicle filtering to Daily Availability Timeline (all tiers):**

- **Vehicle Dropdown** added to Daily Timeline showing "All Vehicles (N)" by default
- **Individual vehicle view** shows:
  - Vehicle name and registration
  - Status Today (Active/Idle)
  - Hours Booked count
  - Hourly status bars (Available/Booked) instead of utilization percentages
- **Backend updated** (`GET /api/tenant/reports/daily-timeline`):
  - Added `vehicle_id` query parameter for filtering
  - Returns `vehicle_list` array for dropdown population
  - Returns `selected_vehicle` info when filtering by specific vehicle
- Works across all subscription tiers (Standard, Essential, Professional)

### March 17, 2026 - Professional Tier Additional Fixes ✅
**Fixed 4 additional issues reported by user:**

1. **QR Codes Now Link to Mileage Input Page** ✅
   - QR codes now link to `/{tenant}/vehicle/{id}/mileage` instead of booking page
   - New `MileageLog.js` page created:
     - Shows login screen if not authenticated
     - After login, shows vehicle name, last recorded mileage, and input form
     - Input fields: Current Mileage (km), Notes (optional)
     - "Log Mileage" button saves to database and updates vehicle record
   - New backend endpoint: `POST /api/vehicles/{id}/log-mileage`
   - Mileage history tracked in `mileage_logs` collection

2. **Team Tab Reorganized** ✅
   - **Administrators Section** (purple header): Shows admin accounts with "Change Password" button for self
   - **Staff Members Section** (blue header): Shows staff with "Reset Password" and "Remove" buttons
   - Clear visual separation between roles

3. **Logo Upload Replaced URL Input** ✅
   - **Upload Logo** button with file picker
   - Preview box shows uploaded logo
   - "Remove logo" link to clear
   - Supported formats: PNG, JPG, WEBP, SVG (max 2MB)
   - New backend endpoint: `POST /api/tenant/upload-logo`
   - Files stored in `/app/backend/uploads/logos/`

4. **All Cars Calendar** - Already correctly inside Fleet tab as a sub-tab

### March 19, 2026 - Quick Wing Content Worker Module ✅
**Built complete social media content management module for Instagram:**

**Features:**
1. **Content Dashboard** - Overview with stat cards showing:
   - Total Drafts, In Review, Approved, Posted, Rejected counts
   - Total Assets, Content Ideas, Scheduled counts
   - Recent Assets and Content Ideas sections
   - Workflow visualization showing Upload → Draft → Review → Approve → Post

2. **Asset Manager** - Media file upload and management:
   - Upload images (PNG, JPG, WEBP, GIF) and videos (MP4, MOV, WEBM)
   - File size limit: 100MB
   - Search and filter by type (All/Images/Videos)
   - Preview modal with full-size view
   - Create Post action directly from asset

3. **New Post Form** - Create Instagram content:
   - Media Asset selection from library or upload new
   - Post Type selection (Product Demo, Pain Point, Before/After, Educational, Trust Proof, Feature Spotlight)
   - Format Type (Reel, Carousel, Single Image, Story)
   - Hook (attention-grabbing first line)
   - 3 Caption Options with selection
   - Call to Action input
   - Hashtags field
   - Internal Notes (not published)
   - Schedule Post date/time picker
   - Save Draft / Submit for Review actions

4. **Review Queue** - Approval workflow:
   - Status filtering (All Status, Drafts, In Review, Approved, Rejected, Scheduled)
   - Draft preview modal with full details
   - Approve/Reject actions with notes
   - Submit for Review action for drafts
   - Delete draft functionality

5. **Posted Content** - Content calendar:
   - Three view modes: Posted, Scheduled, Ready to Post
   - Copy Caption to clipboard
   - Mark as Posted action
   - Schedule post with datetime picker
   - Connect Instagram banner (placeholder for future API)

6. **Content Ideas** - Inspiration management:
   - CRUD operations for content ideas
   - Category filtering (Product Demo, Pain Point, Educational, Trust Proof, Feature Spotlight, Trending Topic)
   - Quick Inspiration suggestions
   - Create Post from idea action
   - Hook, Target Audience, CTA fields

7. **Content Settings** - Configuration:
   - Instagram account name input (Coming Soon placeholder for API)
   - Post Templates CRUD with format, brand style, logo position
   - Workflow settings (Require Approval, Privacy Check toggles)
   - Brand Defaults inherited from franchise settings

**New API Endpoints:**
- `GET /api/content-worker/stats` - Dashboard statistics
- `GET/POST /api/content-worker/assets` - Asset management
- `POST /api/content-worker/assets/upload` - File upload
- `GET /api/content-worker/files/{filename}` - Serve content files
- `DELETE /api/content-worker/assets/{asset_id}` - Delete asset
- `GET/POST /api/content-worker/drafts` - Draft management
- `GET /api/content-worker/drafts/{draft_id}` - Get specific draft
- `PUT /api/content-worker/drafts/{draft_id}` - Update draft
- `POST /api/content-worker/drafts/{draft_id}/submit-review` - Submit for review
- `POST /api/content-worker/drafts/{draft_id}/approve` - Approve draft
- `POST /api/content-worker/drafts/{draft_id}/reject` - Reject draft
- `DELETE /api/content-worker/drafts/{draft_id}` - Delete draft
- `GET/POST /api/content-worker/privacy-flags` - Privacy flag management
- `PUT/DELETE /api/content-worker/privacy-flags/{flag_id}` - Update/delete flags
- `GET/POST /api/content-worker/templates` - Template management
- `PUT/DELETE /api/content-worker/templates/{template_id}` - Update/delete templates
- `GET/PUT /api/content-worker/instagram-settings` - Instagram settings
- `GET/POST /api/content-worker/ideas` - Content ideas management
- `PUT/DELETE /api/content-worker/ideas/{idea_id}` - Update/delete ideas

**New Components:**
- `/app/frontend/src/components/ContentWorker/index.js` - Main module entry
- `/app/frontend/src/components/ContentWorker/ContentDashboard.js`
- `/app/frontend/src/components/ContentWorker/AssetManager.js`
- `/app/frontend/src/components/ContentWorker/NewPost.js`
- `/app/frontend/src/components/ContentWorker/ReviewQueue.js`
- `/app/frontend/src/components/ContentWorker/PostedContent.js`
- `/app/frontend/src/components/ContentWorker/ContentIdeas.js`
- `/app/frontend/src/components/ContentWorker/ContentSettings.js`

**Access Control:**
- All Content Worker endpoints require `Super Admin` role
- Module accessible via "Content" tab with Instagram icon in Franchise Command Centre
- Role badge shows "Social Media Manager" in module header

**Database Collections:**
- `content_assets` - Uploaded media files
- `content_drafts` - Social media post drafts with status workflow
- `privacy_flags` - Areas in assets to be blurred (for future privacy feature)
- `post_templates` - Pre-defined content styles
- `instagram_settings` - Instagram API connection settings (placeholder)
- `content_ideas` - Content inspiration and ideas

**Test Report:** `/app/test_reports/iteration_18.json` - 27/27 backend + 10/10 frontend tests passed (100%)

### March 19, 2026 - Extended Content Worker with Privacy Workflow ✅
**Added privacy-protected content creation workflow:**

**New Workflow Features:**
1. **Step-by-Step Workflow UI** - Guided 6-step process:
   - Upload → Select Frame → Privacy → Preview → Caption → Save
   - Progress indicator with completed/active/pending states
   - Previous/Next navigation

2. **Video Frame Extraction**:
   - Extract 1-3 key frames from uploaded videos
   - Visual frame selector with thumbnails
   - Selection indicator with checkmark

3. **Privacy Detection & Blur Tool**:
   - OCR-based detection using Tesseract
   - Pattern matching for: emails, phone numbers, names, registration numbers, booking details, times/dates
   - Keyword detection for sensitive terms
   - Draggable, resizable blur boxes
   - Add/remove manual blur zones
   - Toggle between original and blurred preview
   - Mark as "Privacy Reviewed" action
   - Color-coded zone types (red=email, orange=phone, etc.)

4. **Branded Preview Generation**:
   - Square (1080x1080) and Portrait (1080x1350) formats
   - Quick Wing branding bar at bottom
   - Blur zones applied to final preview
   - Light gray-blue background for non-image areas

5. **Caption Generator**:
   - 7 content focus options: Booking Simplicity, Calendar Visibility, Compliance Tracking, Admin Efficiency, Time Saving, Reducing Chaos, Operational Clarity
   - 3 professional caption options per focus
   - Each includes: Hook, Body copy, CTA, Hashtags
   - Professional, product-focused tone
   - No cheesy hype or generic AI buzzwords

6. **Enhanced Review Queue**:
   - Original vs Processed preview toggle
   - Privacy zones summary display
   - Caption options viewer with selection
   - Review notes field
   - Actions: Approve, Reject, Send Back to Draft
   - Caption editing capability
   - Full draft details view

**New API Endpoints:**
- `POST /api/content-worker/extract-frames` - Extract video frames
- `GET /api/content-worker/files/frames/{filename}` - Serve frame files
- `POST /api/content-worker/detect-privacy` - OCR privacy detection
- `POST /api/content-worker/generate-preview` - Create branded previews
- `GET /api/content-worker/files/previews/{filename}` - Serve preview files
- `POST /api/content-worker/generate-captions` - Generate 3 caption options
- `POST /api/content-worker/drafts/create-with-workflow` - Create draft with full workflow data
- `PUT /api/content-worker/drafts/{draft_id}/review-action` - Approve/reject/send back
- `PUT /api/content-worker/drafts/{draft_id}/update-caption` - Edit caption option
- `GET /api/content-worker/drafts/{draft_id}/full` - Get draft with blur zones and captions

**New Frontend Components:**
- `/app/frontend/src/components/ContentWorker/NewPostWorkflow.js` - Full workflow UI
- `/app/frontend/src/components/ContentWorker/PrivacyEditor.js` - Blur zone editor
- `/app/frontend/src/components/ContentWorker/FrameSelector.js` - Video frame picker
- `/app/frontend/src/components/ContentWorker/CaptionEditor.js` - Caption viewer/editor

**Database Updates:**
- `content_drafts`: Added fields: `generated_captions`, `selected_caption_index`, `content_focus`, `preview_url_square`, `preview_url_portrait`, `privacy_reviewed`, `review_notes`
- `content_assets`: Added `processed_file_url` for blurred previews
- `privacy_flags`: Stores detected and manual blur zones with coordinates

**Dependencies Added:**
- pytesseract==0.3.13 (OCR)
- opencv-python-headless==4.13.0.92 (Frame extraction)
- tesseract-ocr (System package)

### March 19, 2026 - Content Ideas Engine ✅
**Built comprehensive content suggestion system:**

**Features Implemented:**

1. **Suggested This Week** (5-7 ideas):
   - Balanced across 6 content categories
   - Each idea includes: title, category, format, hook, caption starter, CTA, target audience, recommendation reason, confidence score
   - Ranked by confidence score (70-96%)
   - Category-balanced for variety

2. **Content Goal Selector** - 5 priorities:
   - Reach (maximize visibility)
   - Engagement (drive interactions)
   - Leads (generate enquiries)
   - Education (build authority)
   - Product Awareness (showcase features)
   - Ideas filter based on selected goal

3. **Top Performing Categories** (ranked):
   - Trust/Proof (95 score, 5.8% engagement)
   - Pain Point (92 score, 5.1% engagement)
   - Before/After (88 score, 4.8% engagement)
   - Product Demo (85 score, 4.2% engagement)
   - Feature Spotlight (80 score, 3.9% engagement)
   - Educational (78 score, 3.5% engagement)

4. **Top Performing Formats** (ranked):
   - Reel (94 score, ~2,500 reach)
   - Carousel (86 score, ~1,800 reach)
   - Single Image (72 score, ~1,200 reach)
   - Story (68 score, ~800 reach)

5. **Create Draft from Idea**:
   - One-click draft creation
   - Auto-fills: title, hook, caption starter, CTA, category, format
   - Generates 3 caption options
   - Links draft to source idea

6. **Saved Ideas Library**:
   - Save suggestions for later
   - Filter by category and format
   - Status tracking (saved, draft_created)
   - Delete functionality

7. **24 Pre-Built Content Ideas** covering:
   - Easy vehicle booking
   - Calendar management
   - Compliance tracking
   - Admin chaos reduction
   - Team/manager visibility
   - Time saving
   - Spreadsheet replacement

**New API Endpoints:**
- `GET /api/content-worker/ideas/suggestions` - Get weekly suggestions (optional goal filter)
- `GET /api/content-worker/ideas/performance` - Category & format performance metrics
- `POST /api/content-worker/ideas/from-suggestion` - Save suggestion to library
- `POST /api/content-worker/ideas/{id}/create-draft` - Create draft from idea

**New Frontend Component:**
- `/app/frontend/src/components/ContentWorker/ContentIdeasEngine.js`

**Quality Rules Applied:**
- All ideas specific to Quick Wing value propositions
- No generic filler or irrelevant lifestyle content
- Professional, actionable recommendations
- Clear confidence scores and reasoning


### March 19, 2026 - Instagram Publishing & Analytics ✅
**Completed Instagram publishing and basic analytics capabilities:**

**Features Implemented:**

1. **Analytics Tab (NEW)** - Added to Content Worker navigation:
   - 5 Metric Cards: Total Likes, Total Comments, Total Reach, Total Saves, Engagement Rate
   - Average per post shown for likes and reach
   - Top Posts section with sorting by likes/comments/reach/saves
   - Recent Posts section with publish dates
   - Performance by Category breakdown
   - Performance by Format breakdown
   - "Sync Metrics" button to pull mock data from Instagram

2. **Instagram Connection UI** (Settings tab enhanced):
   - Beautiful gradient header with Instagram icon
   - Connection status (Connected/Not Connected)
   - Account name display (@quickwing_official)
   - Token Status (Valid/Expiring/Expired) with days remaining
   - Last Sync timestamp
   - Account Details section
   - Connect/Disconnect buttons
   - Token Refresh capability
   - Instructions for connecting Instagram API

3. **Enhanced Review Queue** with publishing actions:
   - Status filter expanded: All, Drafts, In Review, Approved, Scheduled, Publishing, Posted, Failed, Rejected
   - For Approved drafts: Schedule button + Publish Now button
   - For Scheduled drafts: Unschedule button + Publish Now button
   - For Failed drafts: Retry Publish button
   - Publishing status spinner during publish operations
   - Schedule Modal with datetime picker

4. **Enhanced Posted Content Calendar**:
   - 4 Status Tabs: Posted, Scheduled, Ready to Post, Failed
   - Instagram Connected/Disconnected status in header
   - For Posted: View on Instagram + View Analytics buttons
   - For Scheduled: Unschedule + Publish Now buttons
   - For Ready to Post: Schedule picker + Publish to Instagram button
   - For Failed: Error message display + Retry Publish button
   - Cards show: thumbnail, status badge, format, publish date, Instagram URL

**New Backend API Endpoints:**
- `POST /api/content-worker/drafts/{draft_id}/schedule` - Schedule approved draft
- `POST /api/content-worker/drafts/{draft_id}/unschedule` - Revert scheduled to approved
- `POST /api/content-worker/drafts/{draft_id}/publish` - Publish to Instagram (MOCKED)
- `POST /api/content-worker/drafts/{draft_id}/retry-publish` - Retry failed publish
- `GET /api/content-worker/analytics/overview` - Get aggregate metrics
- `GET /api/content-worker/analytics/posts` - Get posts with metrics
- `GET /api/content-worker/analytics/top-posts` - Get top performing posts
- `GET /api/content-worker/analytics/by-category` - Category performance
- `GET /api/content-worker/analytics/by-format` - Format performance
- `POST /api/content-worker/analytics/sync` - Sync metrics from Instagram (MOCKED)
- `POST /api/content-worker/instagram/connect` - Connect Instagram account
- `POST /api/content-worker/instagram/disconnect` - Disconnect account
- `POST /api/content-worker/instagram/refresh-token` - Refresh access token

**New Frontend Components:**
- `/app/frontend/src/components/ContentWorker/ContentAnalytics.js` - Full analytics dashboard

**Updated Components:**
- `index.js` - Added Analytics tab to navigation
- `ReviewQueue.js` - Added Schedule/Unschedule/Publish/Retry buttons
- `PostedContent.js` - Complete rewrite with 4-tab calendar and publishing workflow
- `ContentSettings.js` - Instagram connection UI

**Database Collections:**
- `instagram_metrics` - Post performance metrics (likes, comments, reach, saves, shares, impressions)
- `instagram_settings` - Connection status, access token, account details, token expiry

**IMPORTANT:** All Instagram API calls are MOCKED:
- Publishing generates fake Instagram post IDs and URLs
- Sync Metrics generates random but realistic performance numbers
- No real Instagram API integration yet

**Test Report:** `/app/test_reports/iteration_19.json` - 31/31 backend + 18/18 frontend tests passed (100%)

### March 19, 2026 - Training Guide Added ✅
**Added in-app training guide accessible via Help tab:**

**Features:**
- New "Help" tab in Content Worker navigation (BookOpen icon)
- Interactive accordion-style guide with 8 expandable sections
- Quick action buttons to navigate directly to features

**Guide Sections:**
1. **Getting Started** - Overview, key features, navigation grid
2. **Creating a New Post (6-Step Workflow)** - Detailed steps with icons
3. **Review & Approval Process** - Status flow diagram, action explanations
4. **Scheduling & Publishing** - Calendar tabs, publishing options
5. **Understanding Analytics** - Metrics explanation, sync instructions
6. **Using the Content Ideas Engine** - Goals, performance insights
7. **Instagram Connection Setup** - Step-by-step connection guide
8. **Best Practices & Tips** - Content creation, publishing, workflow tips

**New Component:**
- `/app/frontend/src/components/ContentWorker/TrainingGuide.js`

**Also Created (file system):**
- `/app/docs/CONTENT_WORKER_TRAINING_GUIDE.md` - Full markdown guide
- `/app/docs/CONTENT_WORKER_QUICK_START.md` - Quick reference guide

### March 19, 2026 - Mobile Responsiveness ✅
**Made Content Worker fully mobile-friendly for social media managers:**

**Mobile Features:**
1. **Full-Screen Mode**: On mobile, the parent Franchise Command Centre header and navigation are hidden, giving Content Worker full screen space
2. **Sticky Header**: Compact header with back button, title, and hamburger menu
3. **Dropdown Navigation**: Current tab indicator with full navigation dropdown
4. **Bottom Navigation Bar**: Quick access to Home, Create, Review, Posted, Stats
5. **Responsive Dashboard**: 2-column stat grid, smaller fonts, compact spacing
6. **Responsive Workflow**: Horizontal scroll for workflow steps
7. **Touch-Friendly**: Larger tap targets, appropriate spacing

**Files Updated:**
- `/app/frontend/src/components/ContentWorker/index.js` - Mobile navigation, bottom nav bar, dropdown menu
- `/app/frontend/src/components/ContentWorker/ContentDashboard.js` - Responsive grid and spacing
- `/app/frontend/src/pages/PlatformAdmin.js` - Hide header/nav on mobile when Content Worker active


### April 5, 2026 - All Cars Calendar Enhancement & Fleet Map Integration ✅

**All Cars Calendar Fixes:**
1. **Standardized Color Scheme**: Red=Booked, Purple=Recurring, Amber=Pending (matches app-wide standard)
2. **Month Statistics Header**: Blue gradient header showing:
   - Total bookings this month
   - Confirmed bookings count
   - Pending bookings count
   - Recurring bookings count
3. **Vehicle Filter Dropdown**: Filter calendar view by specific vehicle
4. **Improved Modal Colors**: Booking detail modals use correct colors per booking type
5. **Better Organization**: Clearer visual hierarchy, summary stats at top

**Fleet Map Integration (Essential & Professional Tiers Only):**
1. **New "Journey Map" Sub-Tab**: Added under Fleet tab for Essential and Professional tiers
2. **React-Leaflet Map**: Interactive map using OpenStreetMap tiles
3. **Journey Visualization**: Color-coded routes per vehicle
4. **Eircode Geocoding (MOCKED)**: Uses hardcoded Dublin area coordinate mapping (D01-D24, Cork, Galway)
5. **Feature-Gated**: Only shows for tenants with `show_map` or `map_booking_pins` features enabled

**Files Updated:**
- `/app/frontend/src/components/AllCarsCalendar.js` - Colors, stats, filter
- `/app/frontend/src/components/FleetMap.js` - Map component (already existed)
- `/app/frontend/src/pages/TenantDashboard.js` - Added FleetMap import and rendering
- `/app/memory/PRD.md` - Removed Stripe and Instagram integration from roadmap

**Test Report:** `/app/test_reports/iteration_20.json` - All tests passed

**Roadmap Changes:**
- REMOVED: Stripe Integration (P1) from roadmap
- REMOVED: Full Instagram API Integration (P2) from roadmap
