# Quick Wing Fleet Management - Product Requirements Document

## Original Problem Statement
Build a comprehensive fleet management application for tracking vehicles, bookings, staff management, and administrative tasks for a company fleet.

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
- `GET /api/admin/reports/fleet-usage` - Fleet analytics

---

## Prioritized Backlog

### P0 (Done)
- [x] Advanced To-Do features (auto-reset, scheduling)
- [x] Booking suggestions on Bookings page

### P1 (Upcoming)
- [ ] Convert Training Manuals to downloadable PDFs
- [ ] Create printable QR code sheet for all vehicles

### P2 (Future)
- [ ] Complete visual screenshot tutorial for staff
- [ ] User review and feedback session

---

## Test Credentials
- **Admin**: admin@quickwing.com / admin123
- **Staff**: staff@quickwing.com / staff123
