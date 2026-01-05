# Quick Wing Fleet Management System
## Administrator Training Manual

**Author:** Lee Walker  
**Version:** 1.0  
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
7. [Monitoring and Reporting](#monitoring-and-reporting)
8. [System Maintenance](#system-maintenance)
9. [Advanced Features](#advanced-features)
10. [Security Best Practices](#security-best-practices)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Appendix](#appendix)

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

### Default Admin Access

**Website:** https://cartrack-19.preview.emergentagent.com

**Default Admin Login:**
- Email: `admin@quickwing.com`
- Password: `admin123`

**⚠️ CRITICAL: Change this password immediately!**

### First Time Setup

1. **Login with default credentials**
2. **Change admin password:**
   - Click your email (top right)
   - Select "Profile" or "Settings"
   - Change password to something secure
   - Use: 10+ characters, mixed case, numbers, symbols

3. **Verify fleet vehicles:**
   - Go to Admin Panel → Manage Cars
   - Confirm all 19 vehicles are listed
   - Check registrations are correct

4. **Review assistance providers:**
   - Go to Admin Panel → Manage Providers
   - Verify Kerry and West Cork contacts
   - Update phone numbers if needed

5. **Create your admin account:**
   - Admin Panel → Manage Users → Invite User
   - Enter your email
   - Select "Admin" role
   - Copy invite link
   - Register with your email
   - Use strong password

6. **Deactivate default admin:**
   - Once your account is active
   - Go to Manage Users
   - Find admin@quickwing.com
   - Click "Deactivate"
   - System is now secure

### Navigation Overview

**Top Navigation (Desktop):**
- Dashboard - Fleet overview
- Live Sheet - Detailed table view
- Bookings - View all bookings
- Assistance - Provider contacts
- Admin - Your management panel

**Admin Panel Tabs:**
- Manage Cars - Vehicle CRUD operations
- Manage Providers - Assistance contacts
- Manage Users - User accounts

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

Training resources:
- Staff manual: [Link to manual]
- Questions? Contact me directly

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

**Delete User:**
1. Find user in list
2. Click delete (trash) icon
3. Confirm deletion
4. User permanently deactivated (data retained)
5. Cannot be undone

### User Account Lifecycle

**New Hire:**
1. Admin invites user (Staff role)
2. User registers via invite link
3. Admin provides training
4. User begins normal operations

**Role Change (Promotion to Admin):**
1. Admin Panel → Manage Users
2. Change role from Staff to Admin
3. User gets full admin access
4. Provide admin training

**Employee Leaving:**
1. Deactivate account immediately
2. Review their recent activity
3. Reassign any pending bookings
4. Update documentation
5. After grace period, delete account

### Security Considerations

**Password Requirements:**
- Minimum 6 characters (recommend 10+)
- Mix of upper/lowercase
- Include numbers
- Include special characters

**Best Practices:**
- Don't share passwords
- Don't email passwords
- Use unique passwords per user
- Change default passwords immediately
- Regular password changes (every 90 days)
- Deactivate accounts promptly when staff leave

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

### Editing Vehicle Details

**When to Edit:**
- Correct typo in name or registration
- Update transmission type
- Change initial status

**How to Edit:**
1. Admin Panel → Manage Cars
2. Find vehicle in list
3. Click "Edit" button
4. Modify fields as needed
5. Click "Update Car"
6. Changes save immediately

**Note:** Editing does NOT change QR code

### Removing Vehicles

**When to Remove:**
- Vehicle sold
- Vehicle retired
- Vehicle no longer in fleet

**How to Remove:**
1. Admin Panel → Manage Cars
2. Find vehicle in list
3. Click "Delete" button
4. Confirm deletion
5. Vehicle removed from system

**⚠️ Warning:**
- Deletes all associated data
- Removes booking history
- Removes status update history
- Cannot be undone
- QR code becomes invalid

**Alternative (Recommended):**
- Instead of deleting, mark as "Needs Repair"
- Add note: "Out of Service - Retired"
- Keeps historical data
- Can delete later if needed

### QR Code Management

**Generating QR Codes:**

**For Individual Vehicle:**
1. Admin Panel → Manage Cars
2. Click "QR" button next to vehicle
3. QR code image downloads as PNG
4. Name file: `[Registration]-QR.png`

**Bulk Generation:**
- Visit each vehicle's QR link manually
- Right-click → Save As
- Or use documentation file with all links

**QR Code URL Format:**
```
https://cartrack-19.preview.emergentagent.com/api/cars/[VEHICLE_ID]/qr
```

**Printing QR Codes:**

**Specifications:**
- **Size:** 5cm x 5cm minimum (2" x 2")
- **Resolution:** High quality (QR codes scale perfectly)
- **Paper:** Laminated sticker paper (waterproof)
- **Color:** Black and white (best scanning)

**Label Template:**
```
┌───────────────────────────┐
│                           │
│    [QR CODE IMAGE]        │
│                           │
│   Toyota Aygo (M)         │
│   241 D 30517             │
│                           │
│   Scan to update          │
│   vehicle status          │
│                           │
└───────────────────────────┘
```

**Placement in Vehicle:**
- Inside windscreen (driver side)
- On dashboard (protected from sun)
- In glove compartment (backup)
- Visible but protected from damage

**QR Code Maintenance:**
- Check condition monthly
- Replace if damaged or faded
- Keep spares in office
- Report damaged codes to admin

### Vehicle Status Overview

**Status Types:**

1. **Free (Green)** 🟢
   - Vehicle available for use
   - Properly parked
   - No issues
   - Ready to go

2. **In Use (Red)** 🔴
   - Currently being driven
   - Staff member has vehicle
   - May be away from base
   - Check location for whereabouts

3. **Needs Cleaning (Orange)** 🟠
   - Interior requires cleaning
   - Not serious but needs attention
   - Still drivable if urgent
   - Schedule cleaning

4. **Needs Repair (Orange)** 🟠
   - Mechanical or safety issue
   - May not be drivable
   - Requires immediate attention
   - Schedule maintenance

### Fleet Best Practices

**Vehicle Naming:**
- Include make and model
- Add transmission type: (M) or (A)
- Examples:
  - "Toyota Aygo (M)"
  - "Suzuki Ignis (A)"
  - "Dacia Jogger (M)"

**Registration Format:**
- Match official registration exactly
- Include spaces as shown on plate
- Examples:
  - "241 D 30517"
  - "212 KY 560"
  - "251 KY 1752"

**Status Management:**
- Review daily for "Needs Cleaning"
- Immediate action on "Needs Repair"
- Investigate long-term "In Use" status
- Confirm locations are being updated

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

### Removing Providers

**When to Remove:**
- Company out of business
- Poor service complaints
- Contract ended
- Better alternative found

**How to Remove:**
1. Admin Panel → Manage Providers
2. Find provider
3. Click "Delete" button
4. Confirm deletion
5. Provider removed immediately

### Provider Information Best Practices

**Phone Numbers:**
- Always include country code: +353
- Use hyphens for readability: +353-66-712-3456
- Test numbers before adding
- Update immediately if changed

**Service Types:**
- Be specific: "24/7 Breakdown"
- Categories: Breakdown, Towing, Maintenance, Emergency
- Multiple services: "Breakdown & Towing"

**Regional Coverage:**
- Accurate region assignment
- Kerry for Kerry areas
- West Cork for West Cork areas
- Add notes if coverage overlaps

### Recommended Provider List Structure

**Kerry:**
- Minimum 2 breakdown services
- Minimum 1 towing service
- Minimum 1 maintenance garage
- At least one 24/7 service

**West Cork:**
- Minimum 2 breakdown services
- Minimum 1 towing service
- Minimum 1 maintenance garage
- At least one 24/7 service

---

## 7. Monitoring and Reporting

### Live Sheet - Your Control Center

**Access:** Click "Live Sheet" in navigation

**Live Counters (Top Section):**
- **Total Cars:** All vehicles in fleet
- **Free:** Available vehicles (green)
- **In Use:** Currently being used (red)
- **Needs Cleaning:** Requires attention (orange)
- **Needs Repair:** Urgent attention (orange)

**What to Monitor:**
- Free count too low? May need more vehicles
- Many "In Use"? Check they're legitimate
- "Needs Cleaning" piling up? Schedule cleaning
- Any "Needs Repair"? Immediate action required

**Table View (Bottom Section):**

**Columns:**
1. **Vehicle:** Name and make
2. **Registration:** License plate
3. **Status:** Color-coded badge
4. **Location:** Last reported location
5. **Last Updated:** Time of last change
6. **Updated By:** Staff member name
7. **Notes:** Additional information

**How to Use:**
- Scroll horizontally on mobile
- Click column headers to sort
- Review locations for accuracy
- Check update times (recent = active use)
- Read notes for issues

### Dashboard View

**Access:** Click "Dashboard" in navigation

**What You See:**
- Visual card layout
- One card per vehicle
- Color-coded status
- Location prominently displayed
- Recent update info
- Any notes

**When to Use:**
- Quick visual overview
- Check specific vehicle
- View recent activity
- Mobile-friendly quick check

### Booking Management

**View All Bookings:**
- Click "Bookings" in navigation
- See all current and future bookings
- Sorted by date (newest first)

**What to Monitor:**
- Overlapping bookings (shouldn't happen)
- Long-term bookings (may need review)
- Past bookings not returned
- Multiple bookings by same person

**Managing Bookings:**
- Can delete any booking
- Useful for resolving conflicts
- Remove old/invalid bookings
- Clear system periodically

### Exporting Data

**Export to Excel/CSV:**

1. **Go to Live Sheet**
2. **Click "Export Excel" Button**
3. **CSV file downloads:**
   - Filename: `quick-wing-fleet-[DATE].csv`
   - Opens in Excel, Google Sheets, Numbers

**What's Included:**
- Vehicle name
- Registration
- Current status
- Location
- Last update time
- Updated by (user)
- Notes

**Use Cases:**
- Weekly reports
- Management updates
- Audit trail
- Backup data
- Analysis in Excel

**Frequency Recommendations:**
- Daily: If very active fleet
- Weekly: Normal operations
- Monthly: Minimum for records
- Before major changes: Backup

### Key Metrics to Track

**Daily:**
- Number of status updates
- Vehicles "In Use" vs "Free"
- Any vehicles needing attention
- Booking conflicts

**Weekly:**
- Total bookings created
- Most used vehicles
- Least used vehicles
- Average updates per vehicle

**Monthly:**
- Total fleet utilization
- Maintenance frequency
- User activity levels
- System adoption rate

---

## 8. System Maintenance

### Regular Maintenance Tasks

**Daily (2 minutes):**
- [ ] Check Live Sheet counters
- [ ] Review any "Needs Repair" vehicles
- [ ] Verify locations are being updated
- [ ] Check for overnight status changes

**Weekly (15 minutes):**
- [ ] Export data to Excel (backup)
- [ ] Review user activity
- [ ] Check QR code condition reports
- [ ] Clear old completed bookings
- [ ] Update provider info if needed

**Monthly (30 minutes):**
- [ ] Audit user accounts
- [ ] Review vehicle utilization
- [ ] Generate usage report
- [ ] Check for inactive vehicles
- [ ] Update procedures if needed
- [ ] Review and update training materials

**Quarterly (1 hour):**
- [ ] Full data export and backup
- [ ] Comprehensive fleet review
- [ ] User feedback session
- [ ] Process improvements review
- [ ] Security audit
- [ ] Update contact information

### Data Management

**What Gets Stored:**
- All vehicle information
- All status updates (complete history)
- All bookings (past and future)
- All assistance providers
- All user accounts
- Invite history

**Data Retention:**
- Status updates: Forever
- Bookings: After end date
- User accounts: Until deleted
- Deleted vehicles: Gone permanently

**Backup Strategy:**
- Export to CSV weekly
- Save files with date: `quickwing-backup-2026-01-04.csv`
- Store in secure location
- Keep 12 months minimum
- Critical for audit trail

### Performance Optimization

**System is Optimized For:**
- 19 vehicles (current)
- 30 users (current)
- 100s of bookings
- 1000s of status updates
- Fast performance maintained automatically

**If System Slows:**
1. Clear browser cache
2. Check internet connection
3. Try different browser
4. Log out and back in
5. Contact technical support if persists

**Auto-Refresh:**
- Dashboard: Every 30 seconds
- Live Sheet: Every 30 seconds
- Bookings: On demand
- Manual refresh always available

---

## 9. Advanced Features

### Status Update History

**View History:**
1. Go to vehicle in Dashboard
2. Click vehicle card
3. (Feature to be added)

**Currently:**
- Latest status shown
- Full history stored in database
- Available via export

### Booking Conflict Detection

**How It Works:**
- System checks all bookings
- Prevents overlapping times
- Automatic conflict detection
- Clear error messages

**Admin Override:**
- Currently not available
- Conflicts must be resolved by:
  - Cancelling existing booking
  - Choosing different time
  - Selecting different vehicle

### Location Tracking

**Current Method:**
- Staff manually enter location text
- Examples: "Tralee Office", "N22 near Killarney"
- Stored with each status update
- Displayed prominently in Dashboard and Live Sheet

**Best Practices:**
- Encourage specific locations
- Regular location updates
- Location included in training

### QR Code Technology

**How QR Codes Work:**
1. Each vehicle has unique ID
2. QR encodes URL with vehicle ID
3. Scanning opens status update page for that vehicle
4. No login required for status updates
5. Fast and efficient

**QR URL Format:**
```
https://cartrack-19.preview.emergentagent.com/status-update?car=[VEHICLE_ID]
```

**Security:**
- Anyone with QR can update
- Trust-based system
- User names tracked
- Audit trail maintained

---

## 10. Security Best Practices

### Password Security

**Admin Passwords:**
- Minimum 12 characters
- Mix: uppercase, lowercase, numbers, symbols
- Unique (not used elsewhere)
- Changed every 90 days
- Never shared
- Never written down

**Staff Passwords:**
- Minimum 8 characters
- Encouraged: 10+ characters
- Regular reminders to change
- Help reset if forgotten

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
- ❌ Use same password for multiple accounts

### Data Protection

**Sensitive Information:**
- User emails
- Phone numbers (providers)
- Vehicle locations
- Staff activity logs

**Protection Measures:**
- HTTPS encryption (automatic)
- Password-protected access
- Role-based permissions
- Regular backups
- Secure data export

**GDPR Compliance:**
- Users can be deleted
- Data export available
- Minimal personal data stored
- Clear data retention policy

### Incident Response

**If Account Compromised:**
1. Immediately deactivate account
2. Review recent activity
3. Check for unauthorized changes
4. Create new invite for user
5. Investigate security breach
6. Update passwords if needed

**If System Issue:**
1. Document the problem
2. Export current data
3. Contact technical support
4. Inform affected users
5. Follow provided resolution steps

---

## 11. Troubleshooting Guide

### Common User Issues

**Issue: Can't login**

**Diagnosis Questions:**
- What's the error message?
- Email correct?
- Password reset needed?
- Account active?

**Solutions:**
1. Verify email spelling
2. Check caps lock
3. Reset password:
   - Admin panel → Find user → Delete
   - Send new invite
4. Check account status (active/inactive)
5. Reactivate if needed

**Issue: QR code not working**

**Diagnosis:**
- Physical QR code damaged?
- Camera/scanning issue?
- Network problem?

**Solutions:**
1. Check QR code condition
2. Print new QR code
3. Try different QR scanner app
4. Use manual method:
   - Login to app
   - Find vehicle in dashboard
   - Update status from there

**Issue: Can't create booking**

**Diagnosis:**
- Booking conflict error?
- Date/time issues?
- Vehicle available?

**Solutions:**
1. Check booking times carefully
2. Review existing bookings for that vehicle
3. Try different times
4. Select alternative vehicle
5. Delete conflicting booking if legitimate

### Admin Panel Issues

**Issue: Can't see Admin Panel**

**Diagnosis:**
- User role = Staff (not Admin)

**Solution:**
1. Admin Panel → Manage Users
2. Find user
3. Change role to "Admin"
4. User logs out and back in

**Issue: QR code won't download**

**Solutions:**
1. Try different browser
2. Check pop-up blocker
3. Try right-click → Save As
4. Use direct QR URL from documentation

**Issue: User invite not working**

**Diagnosis:**
- Link copied correctly?
- Link already used?
- Email typo?

**Solutions:**
1. Generate new invite
2. Copy link carefully
3. Test link yourself first
4. Send via email (not chat/SMS)

### System Performance Issues

**Issue: Page loading slowly**

**Solutions:**
1. Check internet connection
2. Clear browser cache
3. Try different browser
4. Restart device
5. Check during low-usage time

**Issue: Data not updating**

**Solutions:**
1. Click manual refresh button
2. Wait for auto-refresh (30 sec)
3. Clear browser cache
4. Log out and back in
5. Check if backend is running (contact support)

**Issue: Export not working**

**Solutions:**
1. Check browser pop-up settings
2. Allow downloads from site
3. Try different browser
4. Check download folder
5. Try CSV instead of Excel

### When to Contact Support

**Contact immediately if:**
- System completely down
- Multiple users affected
- Data loss suspected
- Security breach suspected
- Critical functionality broken

**Can handle yourself:**
- Individual user login issues
- QR code reprinting
- User role changes
- Individual booking conflicts
- Provider information updates

**Support Contact:**
- [Technical Support Email]
- [Support Phone Number]
- Expected response: [timeframe]

---

## 12. Appendix

### Admin Checklist - First Day

**Setup Tasks:**
- [ ] Login with default credentials
- [ ] Change default admin password
- [ ] Verify all 19 vehicles present
- [ ] Check vehicle registrations accurate
- [ ] Download all QR codes
- [ ] Print and laminate QR codes
- [ ] Review assistance providers
- [ ] Update provider information if needed
- [ ] Create your personal admin account
- [ ] Deactivate default admin account
- [ ] Test creating a booking
- [ ] Test updating vehicle status
- [ ] Export data to Excel (backup)
- [ ] Bookmark system URL
- [ ] Review staff training manual
- [ ] Create invitation email template
- [ ] Set up weekly backup reminder

### Admin Checklist - Onboarding New Staff

**Pre-Arrival:**
- [ ] Create invite in system
- [ ] Prepare welcome email with invite link
- [ ] Print staff training manual
- [ ] Schedule training session

**First Day:**
- [ ] Send invitation email
- [ ] Confirm they received it
- [ ] Verify account creation
- [ ] Provide staff training manual
- [ ] Walk through login process
- [ ] Demonstrate status update
- [ ] Show Dashboard and Live Sheet
- [ ] Explain booking system
- [ ] Review assistance contacts
- [ ] Have them scan practice QR code
- [ ] Create practice booking
- [ ] Answer questions

**Follow-Up:**
- [ ] Check activity after first week
- [ ] Address any issues
- [ ] Provide additional training if needed
- [ ] Confirm understanding of system

### Quick Reference - Admin URLs

**Main Application:**
```
https://cartrack-19.preview.emergentagent.com
```

**Direct Pages:**
- Login: `/login`
- Dashboard: `/`
- Live Sheet: `/live-sheet`
- Bookings: `/bookings`
- Assistance: `/assistance`
- Admin Panel: `/admin`

**Example Vehicle QR:**
```
https://cartrack-19.preview.emergentagent.com/api/cars/[ID]/qr
```

**Example Status Update:**
```
https://cartrack-19.preview.emergentagent.com/status-update?car=[ID]
```

### Fleet Statistics Template

**Weekly Fleet Report:**

```
QUICK WING WEEKLY FLEET REPORT
Week of: [Date Range]
Report by: [Your Name]

FLEET STATUS:
- Total Vehicles: 19
- Active This Week: __
- Free: __
- In Use: __
- Needs Cleaning: __
- Needs Repair: __

ACTIVITY:
- Total Status Updates: __
- Total Bookings: __
- Most Used Vehicle: ______
- Least Used Vehicle: ______

ISSUES:
- Vehicles Needing Attention: __
- Maintenance Scheduled: __
- QR Codes Replaced: __

USER ACTIVITY:
- Total Active Users: __
- New Users This Week: __
- Most Active User: ______

ACTIONS NEEDED:
1. ________________
2. ________________
3. ________________

NOTES:
_______________________
_______________________
```

### Emergency Contacts

**System Issues:**
- Technical Support: [Contact]
- System Down: [Emergency Contact]

**Fleet Issues:**
- See Assistance page in app
- Kerry: [Emergency Contact]
- West Cork: [Emergency Contact]

**Management:**
- Fleet Manager: [Contact]
- Operations Manager: [Contact]

---

## Training Completion Certificate

**Complete this section after training:**

**Administrator Trained:** _________________________

**Training Completed By:** _________________________

**Date:** _________________________

**Topics Covered:**
- [ ] System overview and navigation
- [ ] User management (invite, edit, delete)
- [ ] Fleet management (add, edit, remove vehicles)
- [ ] QR code generation and printing
- [ ] Provider management
- [ ] Live Sheet monitoring
- [ ] Data export procedures
- [ ] Security best practices
- [ ] Troubleshooting common issues
- [ ] Daily/weekly/monthly maintenance tasks

**Administrator Signature:** _________________________

**Trainer Signature:** _________________________

---

**End of Administrator Training Manual**

**Questions or Support:**
Contact: [Admin Support Email]  
Phone: [Support Phone]

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Author:** Lee Walker

---

## Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Jan 2026 | Initial release | Lee Walker |

---

**Next Review Date:** [Date 6 months from now]