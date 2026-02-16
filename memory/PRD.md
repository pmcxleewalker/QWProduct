# Quick Wing Fleet Management - Product Requirements Document

## Original Problem Statement
Build a comprehensive fleet management application for tracking vehicles, bookings, staff management, and administrative tasks for a company fleet.

---

## 🏢 FRANCHISE DUPLICATION GUIDE

### How to Create a Copy for Another Franchise:

1. **Fork this Chat** (click "Fork Chat" button in Emergent)
   - Creates a complete copy with fresh empty database
   - All code and features included

2. **New franchise visits `/setup`** to configure:
   - Company/Franchise Name
   - Master Admin email & password

3. **Deploy** the forked version
   - Each franchise gets their own URL
   - Separate database, separate users

### Configurable Settings (in `/app/frontend/.env`):
```
REACT_APP_COMPANY_NAME=Your Franchise Name
REACT_APP_PRIMARY_COLOR=#2563eb
```

### What Each Franchise Gets:
- ✅ All features (bookings, QR codes, mileage tracking, reports)
- ✅ Empty database (no pre-existing cars/users/bookings)
- ✅ Own admin/staff user management
- ✅ Independent deployment

---

## User Personas
1. **Admin Users** - Full access to manage cars, users, bookings, to-do lists, and reports
2. **Staff Users** - Can book vehicles, view live status, request assistance

## Core Features Implemented

### Authentication & Authorization
- JWT-based authentication
- Role-based access (admin/staff)
- Admin password reset capability

### Fleet Management
- Car CRUD operations with QR codes
- Live status tracking
- Manual status editing by admins
- Blocking/unblocking vehicles

### Booking System
- Create, edit, delete bookings
- Recurring bookings (daily, weekly, monthly)
- Admin approval workflow
- **Booking Suggestions** - Shows available cars and time slots for next 7 days
- **Bulk Booking Cancellation** - Select multiple bookings and cancel them at once
- **Recurring Series Management** - Delete individual occurrences OR entire series

### Admin To-Do List
- Create, edit, delete tasks
- Mandatory task flagging
- **Scheduling Options**: One-time, Daily, Weekly (select days), Monthly (select dates)
- **Auto-reset**: Mandatory tasks reset to pending 24 hours after completion
- Alert badges on Dashboard and Admin panel

### Reports & Analytics
- Fleet usage statistics
- Car booking frequency
- CSV export

### Mobile-First UI
- Responsive design
- Bottom navigation for mobile
- Touch-friendly components

---

## Completed Features (January 2025)

### Session: January 15, 2025
1. **Fish Icon for pmcxleewalker**
   - Custom navigation for user `pmcxleewalker@quickwing.com`
   - Shows fish icon (🐟) instead of "Live Sheet" text in navigation
   - Icon-only display in both mobile and desktop navigation
   - Tooltip on desktop shows "Live Sheet" on hover

2. **Bookings Page UI Cleanup**
   - Removed List View toggle - now only Calendar View is available
   - Car selector tabs are now fully collapsible (including "All Cars")
   - Click + button to expand car options, - button to collapse
   - Car tabs now wrap to multiple rows for better mobile experience
   - Cleaner, more focused booking interface

3. **Dashboard Fleet Status Redesign**
   - Compact car cards: 5 columns on desktop (was 3)
   - Smaller, visually friendly cards with essential info only
   - Status badges now show emoji icons (🟢 Free, 🔵 In Use, 🟡 Booked, etc.)
   - Location displayed in compact blue pill
   - Edit button moved to bottom-right corner

4. **Automatic Booking Status Updates**
   - Cars automatically show "Booked" status when there's an active booking
   - Backend checks current time against approved booking start/end times
   - Dashboard and Live Sheet show who booked the car (yellow highlight)
   - Live Sheet has new "Booked" counter alongside other status counters
   - Status resets to previous state when booking ends

5. **Booking Form Updates**
   - Renamed "Destination / Notes" to "Purpose" 
   - Added new "Location (Eircode)" field
   - Location entered in booking automatically shows in Live Sheet when car is booked
   - Helper text explains the location will appear in Live Sheet

6. **Three-Color Booking Status System**
   - 🟢 **Free** (green) - Car is available
   - 🔴 **Booked** (red) - Car has a one-time booking
   - 🟣 **Recurring** (purple) - Car has a recurring booking
   - Applied to: Car Availability Cards, Live Sheet, Dashboard
   - Live Sheet has separate "Recurring" counter
   - Legend on availability cards shows all three colors

7. **Push Notifications for Phones**
   - Web Push notifications using Service Workers
   - **"Push On/Off" toggle** in navigation bar
   - **Lift Requests**: Admins receive notification when staff request a lift
   - **Admin Messages**: Staff receive notification when admin posts announcement
   - Works on mobile browsers (Android/iOS Safari)
   - Auto-removes invalid subscriptions

### Session: February 16, 2026
1. **"My Bookings" Tab**
   - New toggle tabs: "All Bookings" and "My Bookings" on the `/bookings` page
   - "My Bookings" filters calendar to show only logged-in user's bookings
   - Badge shows count of user's total bookings (e.g., "33")
   - Calendar header changes to indigo/purple with "👤 My Bookings - [Month]" text
   - Shows user email below the month name
   - Works for both staff and admin accounts

2. **Booking Conflict Alert System**
   - Real-time conflict detection when creating new bookings
   - Orange warning banner appears when selected car+time overlaps with existing bookings
   - Shows: car name, conflicting user name, date, time range, and booking status
   - Helpful tip: "💡 Consider choosing a different time or car to avoid scheduling conflicts"
   - Uses debounced checking (300ms) for smooth UX
   - Warning disappears when conflict is resolved

3. **Enhanced Admin Reports**
   - **Date-filtered Fleet Numbers**: Summary cards (Total Bookings, Pending, etc.) now change based on selected date range
   - **Booking Details Sub-tabs**: "List" view for data table, "Charts" view for visual analytics
   - **Charts for Audit Data**:
     - Bookings by Status (bar chart)
     - Recurring vs One-time (circular badges)
     - Bookings by Day of Week (horizontal bars)
     - Top Bookers (ranked list)
     - Top Booked Cars (ranked list)
     - Bookings by Location (grouped by car base_location)
     - Monthly Booking Trend (bar chart)
   - **Daily Availability by Location**: Shows cars with no bookings on a specific date, grouped by Tralee/Bantry/Unassigned
   - **Base Location field**: Added to car model for location-based reporting

### Session: February 5, 2026
1. **Purple Color for Recurring Bookings on Calendar**
   - Recurring bookings now show in purple on the main calendar (previously used car color)
   - Fixed `isRecurring` check to use both `is_recurring` flag AND `recurring_group_id`
   - Removed purple from car color palette to avoid confusion
   - 🔄 emoji shows on recurring booking entries
   - Purple background visible in day modal when clicking on recurring bookings

2. **Live Daily Availability Report**
   - New report in Admin > Reports tab
   - Shows hourly availability grid for all active cars (7am-10pm)
   - Date picker to view any day's availability
   - Summary stats: Active Cars, Available Hours, Booked Hours, Availability Rate
   - Color-coded grid: Green (available), Red (booked), Purple (recurring), Gray (past)
   - Hover shows who booked the slot
   - New API endpoint: `GET /api/admin/reports/daily-availability`

3. **Admin Notification System**
   - Push notifications disabled for admin accounts (staff only)
   - New "Updates" button in navigation for admins only
   - Shows deployment changelog with recent fixes/features
   - Easy way to communicate updates to admin users

### Session: January 14, 2025
1. **Admin Car Swap for Recurring Bookings**
   - Admins can change the assigned car for individual booking occurrences
   - Dropdown shows only cars available for that specific time slot
   - New API endpoint: `GET /api/admin/available-cars`
   - Modified edit modal in `/app/frontend/src/components/EditBookingModal.js`

2. **Personalized Dashboard Greetings**
   - Custom greetings for specific users (carlyodonovan, carecoordinatorkwc, kevanfewtrell, pmcxleewalker)
   - "Welcome, Carly!" with paw emojis for Carly
   - "Hey [Username]!" format for others

3. **Staff Weather Widgets**
   - Live weather display for Kerry and West Cork regions
   - Backend proxy at `/api/weather` to avoid CORS issues
   - Uses wttr.in API (no key required)
   - Weather icons based on conditions

4. **Critical Booking Calendar Fix**
   - Fixed bug where bookings weren't appearing on calendar
   - Issue: API limit of 100 results + descending sort excluded current month
   - Fix: Increased limit to 500, changed to ascending sort order
   - **STATUS: In preview, awaiting user deployment to production**

5. **Enhanced Booking Form Feedback**
   - Validation improvements
   - Success/error alert popups
   - Auto-scrolling to form feedback

### Session: January 12, 2025
1. **Advanced To-Do Features**
   - Auto-reset mandatory tasks to incomplete after 24 hours
   - Schedule types: daily, weekly (Mon-Sun selector), monthly (date selector)
   - Schedule badges in task list (🔄 Daily, 📅 Weekly: Mon, Wed, Fri)
   
2. **Booking Suggestions**
   - New API endpoint `/api/bookings/suggestions`
   - Calculates free time slots for each car over next 7 days (8 AM - 6 PM)
   - Suggestion cards with car info, available slots, and "Book This Car" button
   - Collapsible section on Bookings page

3. **Bulk Booking Cancellation**
   - "Select Bookings" mode in List view
   - Checkboxes on approved bookings (pending bookings cannot be selected)
   - "Select All" / "Deselect All" toggle
   - Selected count display
   - "Cancel Selected" bulk delete button
   - Visual highlighting (red border + background) for selected bookings

4. **Recurring Booking Series Management**
   - "🔄 Recurring" badge on booking cards in list view
   - Modal shows "(Recurring - X bookings)" count
   - "Cancel This One" - Delete single occurrence
   - "Cancel Entire Series (X bookings)" - Delete all bookings in the series
   - New API endpoint: `DELETE /api/bookings/series/{recurring_group_id}`

---

## Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main API routes
- `/app/backend/auth.py` - JWT authentication
- MongoDB with Motor async driver

### Frontend (React)
- `/app/frontend/src/pages/` - Main pages (Dashboard, Bookings, Admin, etc.)
- `/app/frontend/src/api/api.js` - API client
- TailwindCSS for styling

### Key API Endpoints
- `POST /api/auth/login` - User login
- `GET/POST/PUT/DELETE /api/admin/todos` - To-Do list management
- `GET /api/bookings/suggestions` - Car availability suggestions
- `DELETE /api/bookings/{id}` - Delete individual booking
- `GET /api/admin/reports/fleet-usage` - Fleet analytics

---

## Prioritized Backlog

### P0 (Critical - Awaiting Action)
- [ ] **DEPLOY TO PRODUCTION** - Booking calendar fix is in preview, needs deployment

### P0 (Done)
- [x] **"My Bookings" Tab** - Added tab on `/bookings` page showing only logged-in user's bookings (February 2026)
- [x] **Booking Conflict Alert System** - Real-time warning when booking overlaps with existing bookings (February 2026)
- [x] Fish icon for pmcxleewalker user
- [x] Advanced To-Do features (auto-reset, scheduling)
- [x] Booking suggestions on Bookings page
- [x] Bulk booking cancellation
- [x] Admin car swap for recurring bookings
- [x] Personalized dashboard greetings
- [x] Staff weather widgets
- [x] Purple color for recurring bookings on calendar (February 2026)
- [x] Live Daily Availability Report in Admin Reports section (February 2026)

### P1 (Upcoming)
- [ ] Redesign "Available Cars & Time Slots" section (Backend done, Frontend in progress)
  - New scrollable hourly cards (7am-11pm)
  - Navigation controls (day/week/month)
  - Show 6 cards initially, "Show More" button
- [ ] Convert Training Manuals to downloadable PDFs
- [ ] Create printable QR code sheet for all vehicles

### P2 (Future)
- [ ] Complete visual screenshot tutorial for staff
- [ ] User review and feedback session
- [ ] Refactor Bookings.js (1000+ lines) into smaller components

---

## Test Credentials
- **Admin**: admin@quickwing.com / admin123
- **Staff**: staff@quickwing.com / staff123
