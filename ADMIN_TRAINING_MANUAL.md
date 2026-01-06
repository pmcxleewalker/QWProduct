# Quick Wing Fleet Management System
## Administrator Training Manual

**Owner:** Lee Walker  
**Copyright:** © 2026 Lee Walker. All rights reserved.  
**Version:** 1.1  
**Date:** January 2026  
**Document Type:** Administrator Guide

---

## Table of Contents

1. [Introduction](#introduction)
2. [Admin Responsibilities](#admin-responsibilities)
3. [Getting Started](#getting-started)
4. [User Management](#user-management)
5. [Fleet Management](#fleet-management)
6. [Assistance Provider Management](#assistance-provider-management)
7. [Lift Request Management](#lift-request-management)
8. [Monitoring and Reporting](#monitoring-and-reporting)
9. [System Maintenance](#system-maintenance)
10. [Advanced Features](#advanced-features)
11. [Security Best Practices](#security-best-practices)
12. [Troubleshooting Guide](#troubleshooting-guide)
13. [Appendix](#appendix)

---

## 1. Introduction

### Purpose of This Manual

This comprehensive guide is designed for Quick Wing administrators who are responsible for:
- Managing user accounts
- Maintaining the vehicle fleet
- Overseeing system operations
- Providing user support
- Ensuring data accuracy

### System Overview

Quick Wing is a complete fleet management solution with:
- **Authentication**: Role-based access control (Admin/Staff)
- **Fleet Tracking**: Real-time vehicle status with QR codes
- **Booking System**: Conflict detection and management
- **Lift Requests**: Staff can request rides from colleagues
- **Location Tracking**: Text-based driver location input
- **Live Reporting**: Dashboard and Excel export capabilities
- **Mobile-First**: Optimized for smartphone use

### Admin Access Levels

**Admin users can:**
- ✅ Everything staff can do, PLUS:
- ✅ Invite and manage users
- ✅ Add, edit, delete vehicles
- ✅ Generate QR codes
- ✅ Manage assistance providers
- ✅ Delete lift requests permanently
- ✅ Access full system settings
- ✅ View all historical data
- ✅ Export reports

---

## 2. Admin Responsibilities

### Daily Tasks

**Morning (5 minutes):**
- Review Live Sheet counters
- Check for vehicles needing attention
- Review overnight status updates
- Verify no overdue bookings

**Throughout Day (as needed):**
- Respond to staff support requests
- Activate new user accounts
- Address reported vehicle issues
- Monitor booking conflicts

**End of Day (5 minutes):**
- Export daily report if needed
- Review vehicle locations
- Check all vehicles accounted for
- Note any pending maintenance

### Weekly Tasks

- Review user activity
- Clean up old/inactive bookings
- Update assistance provider info
- Check QR code condition reports
- Generate weekly fleet report

### Monthly Tasks

- Audit user accounts (deactivate leavers)
- Review vehicle utilization
- Update provider contact information
- Backup system data (export to Excel)
- Review and update procedures

### As Needed

- Invite new users
- Add new vehicles to fleet
- Remove decommissioned vehicles
- Reset user passwords
- Update assistance contacts
- Print new QR codes

---

## 3. Getting Started

### System Access

**Website:** https://cartrack-19.emergent.host

**⚠️ CRITICAL: Secure the default admin account immediately!**

### First Time Setup

1. **Login with admin credentials**

2. **Create your personal admin account:**
   - Admin Panel → Manage Users → Invite User
   - Enter your email
   - Select "Admin" role
   - Copy invite link
   - Register with your email
   - Use strong password

3. **Verify fleet vehicles:**
   - Go to Admin Panel → Manage Cars
   - Confirm all vehicles are listed
   - Check registrations are correct

4. **Review assistance providers:**
   - Go to Admin Panel → Manage Providers
   - Verify Kerry and West Cork contacts
   - Update phone numbers if needed

5. **Deactivate default admin:**
   - Once your account is active
   - Go to Manage Users
   - Find default admin account
   - Click "Deactivate"
   - System is now secure

### Navigation Overview

**Top Navigation (Desktop):**
- Dashboard - Fleet overview + Lift Requests
- Live Sheet - Detailed table view
- Bookings - View all bookings
- Assistance - Provider contacts
- Admin - Your management panel

**Admin Panel Tabs:**
- Manage Cars - Vehicle CRUD operations
- Manage Providers - Assistance contacts
- Manage Users - User accounts
- Messages - Staff announcements

---

## 4. User Management

### Inviting New Users

**Step-by-Step Process:**

1. **Go to Admin Panel**
   - Click "Admin" in navigation
   - Click "Manage Users" tab

2. **Click "Invite User" Button**

3. **Fill Invitation Form:**
   - **Email Address:** Enter staff member's work email
   - **Role:** Select Staff or Admin
     - **Staff:** Can update status, make bookings, view data
     - **Admin:** Full system access including user management

4. **Click "Send Invitation"**

5. **Copy Invite URL:**
   - Green success message appears
   - Invite URL displayed in blue box
   - Click "Copy" button

6. **Send to User:**
   - Email the invite link to the staff member
   - Include their role and basic instructions
   - Set expiry expectations (links don't expire but are one-time use)

### Email Template for Invitations

```
Subject: Your Quick Wing Fleet Management Access

Hi [Name],

You've been granted [Staff/Admin] access to Quick Wing, our fleet management system.

Your Invitation Link:
[PASTE INVITE URL HERE]

Steps to activate:
1. Click the link above
2. Enter your email: [user@email.com]
3. Create a password (minimum 6 characters)
4. Confirm password
5. Click "Create Account"

You'll be automatically logged in and can start using the system.

Important:
- This link works only once
- Save your password securely
- Contact me if you have any issues

Website: https://cartrack-19.emergent.host

Best regards,
[Your Name]
[Your Contact Info]
```

### Managing Existing Users

**View All Users:**
- Admin Panel → Manage Users
- See complete list with:
  - Email address
  - Role (Admin/Staff badge)
  - Status (Active/Inactive badge)
  - Join date

**Change User Role:**
1. Find user in list
2. Click role dropdown
3. Select "Staff" or "Admin"
4. Change is immediate
5. User gets new permissions on next login

**Deactivate User:**
1. Find user in list
2. Click "Deactivate" button
3. Confirm action
4. User can no longer log in
5. Their data remains in system

**Reactivate User:**
1. Find inactive user
2. Click "Activate" button
3. User can log in again with same password

---

## 5. Fleet Management

### Adding New Vehicles

**Step-by-Step:**

1. **Go to Admin Panel → Manage Cars**

2. **Click "Add Car" Button**

3. **Fill Vehicle Form:**
   - **Car Name:** Full vehicle name
     - Example: "Toyota Aygo (M)"
     - Include transmission: (M) or (A)
   
   - **Registration:** Exact as on vehicle
     - Example: "241 D 30517"
     - Match spacing and format
   
   - **Current Status:** Select initial status
     - Usually "Free" for new additions
   
   - **Compliance Dates (Optional):**
     - Tax Due Date
     - NCT Due Date
     - Service Due Date

4. **Click "Create Car"**

5. **Success:**
   - Vehicle appears in list
   - QR code automatically generated
   - Unique ID assigned

6. **Download QR Code:**
   - Click "QR" button next to vehicle
   - PNG file downloads
   - Print and laminate
   - Place in vehicle

### Vehicle Blocking

Admins can block vehicles for appointments:

1. **Go to Admin Panel → Manage Cars**
2. **Find the vehicle**
3. **Click "🔒 Block for Appointment"**
4. **Select reason:** Service, Cleaning, or Other
5. **Vehicle becomes unavailable for booking**

To unblock:
1. **Click "🔓 Sign Off & Unblock"**
2. **Add sign-off notes if needed**
3. **Vehicle becomes available again**

### Compliance Alerts

The Dashboard shows compliance alerts for vehicles with:
- Tax due within 30 days
- NCT due within 30 days
- Service due within 30 days

Alerts appear in red at the top of the admin Dashboard.

### QR Code Management

**Generating QR Codes:**

**For Individual Vehicle:**
1. Admin Panel → Manage Cars
2. Click "QR" button next to vehicle
3. QR code image downloads as PNG
4. Name file: `[Registration]-QR.png`

**QR Code URL Format:**
```
https://cartrack-19.emergent.host/api/cars/[VEHICLE_ID]/qr
```

**Printing QR Codes:**

**Specifications:**
- **Size:** 5cm x 5cm minimum (2" x 2")
- **Resolution:** High quality (QR codes scale perfectly)
- **Paper:** Laminated sticker paper (waterproof)
- **Color:** Black and white (best scanning)

**Placement in Vehicle:**
- Inside windscreen (driver side)
- On dashboard (protected from sun)
- In glove compartment (backup)
- Visible but protected from damage

---

## 6. Assistance Provider Management

### Adding Providers

**Step-by-Step:**

1. **Go to Admin Panel → Manage Providers**

2. **Click "Add Provider" Button**

3. **Fill Provider Form:**
   - **Region:** Kerry or West Cork
   - **Provider Name:** Company name
   - **Phone Number:** Full phone with country code
     - Example: "+353-66-712-3456"
   - **Service Type:** Breakdown, Towing, Maintenance, etc.

4. **Click "Create Provider"**

5. **Provider appears in list immediately**

### Editing Providers

**When to Edit:**
- Phone number changes
- Company name changes
- Service type correction

**How to Edit:**
1. Admin Panel → Manage Providers
2. Find provider in list
3. Click "Edit" button
4. Update information
5. Click "Update Provider"

---

## 7. Lift Request Management

### Overview

The "Request a Lift" feature allows staff to ask colleagues for rides. As an admin, you have additional controls.

### Viewing Lift Requests

- **Dashboard** shows all active lift requests in a blue panel at the top
- **Notification bell** in the navigation shows count of active requests
- Click the bell to see a dropdown of all requests

### Admin Controls

**Delete Requests:**
- Only admins can permanently delete lift requests
- Staff can only "Hide" requests from their view
- Click the **red trash icon** to delete
- Confirm the deletion

**Why Admin-Only Delete?**
- Prevents accidental removal of valid requests
- Maintains audit trail
- Staff can hide requests they're not interested in

### Lift Request Flow

1. **Staff creates request** → Appears on all dashboards
2. **Another staff accepts** → Modal to add message
3. **Requester gets notification** → Shows who accepted + message
4. **Request removed** → No longer visible to anyone

### Notification System

When someone accepts a lift request:
- The **original requester** sees a popup notification
- Shows who accepted and their message
- Requester clicks "Got it, thanks!" to dismiss

---

## 8. Monitoring and Reporting

### Live Sheet - Your Control Center

**Access:** Click "Live Sheet" in navigation

**Live Counters (Top Section):**
- **Total Cars:** All vehicles in fleet
- **Free:** Available vehicles (green)
- **In Use:** Currently being used (red)
- **Needs Cleaning:** Requires attention (orange)
- **Needs Repair:** Urgent attention (orange)
- **Blocked:** Vehicles blocked for appointments (purple)

### Dashboard View

**Admin-Only Sections:**
- **Compliance Alerts** - Red panel showing upcoming Tax/NCT/Service dates
- **Pending Booking Approvals** - Orange panel for recurring booking requests
- **Lift Requests** - Blue panel (visible to all, but admins can delete)

### Exporting Data

**Export to Excel/CSV:**

1. **Go to Live Sheet**
2. **Click "Export Excel" Button**
3. **CSV file downloads:**
   - Filename: `quick-wing-fleet-[DATE].csv`
   - Opens in Excel, Google Sheets, Numbers

---

## 9. System Maintenance

### Regular Maintenance Tasks

**Daily (2 minutes):**
- [ ] Check Live Sheet counters
- [ ] Review any "Needs Repair" vehicles
- [ ] Check compliance alerts
- [ ] Verify locations are being updated

**Weekly (15 minutes):**
- [ ] Export data to Excel (backup)
- [ ] Review user activity
- [ ] Check QR code condition reports
- [ ] Clear old completed bookings
- [ ] Review lift request activity

**Monthly (30 minutes):**
- [ ] Audit user accounts
- [ ] Review vehicle utilization
- [ ] Update compliance dates
- [ ] Generate usage report

---

## 10. Advanced Features

### Recurring Bookings

**Staff can request recurring bookings:**
- Daily, Weekly, or Monthly
- Requires admin approval
- Appears in "Pending Booking Approvals" on Dashboard

**To Approve/Reject:**
1. View pending bookings on Dashboard
2. Click **Approve** (green) or **Reject** (red)
3. All instances are approved/rejected together

### Staff Message Board

**Create announcements for staff:**
1. Admin Panel → Messages tab
2. Click "Create Message"
3. Enter title and content
4. Set "Require Acknowledgment" if needed
5. Messages appear as popups when staff log in

---

## 11. Security Best Practices

### Account Security

**Do:**
- ✅ Change default admin password immediately
- ✅ Create personal admin account
- ✅ Deactivate default account
- ✅ Deactivate accounts when staff leave
- ✅ Regular security audits
- ✅ Keep user list current

**Don't:**
- ❌ Share admin credentials
- ❌ Leave accounts active for ex-staff
- ❌ Use simple passwords
- ❌ Write passwords down
- ❌ Email passwords

---

## 12. Troubleshooting Guide

### Common User Issues

**Issue: Can't login**
- Verify email spelling
- Check caps lock
- Reset password via new invite
- Check account status (active/inactive)

**Issue: Invite link not working**
- Generate new invite
- Ensure using correct deployed URL: https://cartrack-19.emergent.host
- Link may have been used already

**Issue: QR code not working**
- Check physical condition
- Print new QR code
- Use manual method via app

---

## 13. Appendix

### Quick Reference - URLs

**Main Application:**
```
https://cartrack-19.emergent.host
```

**Direct Pages:**
- Login: `/login`
- Dashboard: `/`
- Live Sheet: `/live-sheet`
- Bookings: `/bookings`
- Assistance: `/assistance`
- Admin Panel: `/admin`

### Admin Checklist - First Day

**Setup Tasks:**
- [ ] Login with admin credentials
- [ ] Create your personal admin account
- [ ] Deactivate default admin account
- [ ] Verify all vehicles present
- [ ] Download all QR codes
- [ ] Review assistance providers
- [ ] Test creating a booking
- [ ] Test updating vehicle status
- [ ] Export data to Excel (backup)
- [ ] Bookmark system URL

### Admin Checklist - Onboarding New Staff

**Pre-Arrival:**
- [ ] Create invite in system
- [ ] Prepare welcome email with invite link

**First Day:**
- [ ] Send invitation email
- [ ] Confirm account creation
- [ ] Provide training
- [ ] Demonstrate status update
- [ ] Show Request a Lift feature
- [ ] Answer questions

---

## Training Completion Certificate

**Administrator Trained:** _________________________

**Training Completed By:** _________________________

**Date:** _________________________

**Topics Covered:**
- [ ] System overview and navigation
- [ ] User management (invite, edit, delete)
- [ ] Fleet management (add, edit, remove vehicles)
- [ ] QR code generation and printing
- [ ] Provider management
- [ ] Lift request management
- [ ] Live Sheet monitoring
- [ ] Security best practices

**Administrator Signature:** _________________________

---

**End of Administrator Training Manual**

---

**Document Version:** 1.1  
**Last Updated:** January 2026  
**Owner:** Lee Walker  
**Copyright:** © 2026 Lee Walker. All rights reserved.

This document and the Quick Wing Fleet Management System are the intellectual property of Lee Walker. Unauthorized reproduction, distribution, or modification is prohibited.

---

## Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Jan 2026 | Initial release | Lee Walker |
| 1.1 | Jan 2026 | Updated URL to deployed version, added lift request feature, added copyright | Lee Walker |